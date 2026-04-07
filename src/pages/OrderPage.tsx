import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  Loader2,
  Paperclip,
  RotateCcw,
  Send,
  ShieldCheck,
  Star,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import api, { Message, Order } from '@/services/api';
import { toAbsoluteAssetUrl } from '@/utils/assetUrl';
import { formatDateTime, formatMoneyKGS } from '@/utils/locale';
import { OrderStatusBadge } from '@/components/dashboard/OrderStatusBadge';
import { getClientSidebarItems, getFreelancerSidebarItems } from '@/components/dashboard/dashboardNav';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { WORKSPACE_PATH } from '@/utils/routes';
import {
  connectSocket,
  joinOrder,
  leaveOrder,
  onNewMessage,
  offNewMessage,
  onUserTyping,
  offUserTyping,
  onUserStopTyping,
  offUserStopTyping,
  onSocketError,
  offSocketError,
  sendTyping,
  stopTyping,
} from '@/services/socket';

type OrderWithMessages = Order & { messages: Message[] };

type MessageType = 'text' | 'image' | 'file' | 'system';

type LocalMessageStatus = 'sending' | 'failed';

interface PendingAttachment {
  id: string;
  file: File;
  isImage: boolean;
  previewUrl?: string;
}

interface ChatMessage extends Message {
  type: MessageType;
  localId?: string;
  localStatus?: LocalMessageStatus;
  uploadProgress?: number;
  retryFile?: File;
  localPreviewUrl?: string;
}

const MAX_ATTACHMENT_SIZE = 50 * 1024 * 1024;
const BLOCKED_EXTENSIONS = new Set(['.exe', '.sh', '.bat', '.cmd', '.com', '.msi', '.ps1', '.jar']);
const ALLOWED_ATTACHMENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/zip',
]);
const ALLOWED_ATTACHMENT_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.pdf', '.doc', '.docx', '.zip']);

function getFileExtension(name: string): string {
  const index = name.lastIndexOf('.');
  if (index === -1) return '';
  return name.slice(index).toLowerCase();
}

function isImageMime(mimeType?: string): boolean {
  return Boolean(mimeType && mimeType.startsWith('image/'));
}

function inferMessageType(message: Message): MessageType {
  if (message.type) return message.type;
  if (!message.fileUrl) return 'text';
  if (isImageMime(message.mimeType)) return 'image';

  const extension = getFileExtension(message.fileName || message.fileUrl || '');
  if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(extension)) {
    return 'image';
  }

  return 'file';
}

function normalizeMessage(message: Message): ChatMessage {
  return {
    ...message,
    type: inferMessageType(message),
    text: message.text ?? message.content,
  };
}

function createLocalMessageId(): string {
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getDisplayFileUrl(message: ChatMessage): string | undefined {
  if (message.localPreviewUrl) {
    return message.localPreviewUrl;
  }

  if (!message.fileUrl) {
    return undefined;
  }

  if (message.fileUrl.startsWith('blob:')) {
    return message.fileUrl;
  }

  return toAbsoluteAssetUrl(message.fileUrl);
}

function formatFileSize(size: number | undefined, language: string): string {
  if (!size || size <= 0) return '';

  return new Intl.NumberFormat(language === 'ky' ? 'ky-KG' : language === 'en' ? 'en-US' : 'ru-RU', {
    style: 'unit',
    unit: 'megabyte',
    maximumFractionDigits: 1,
  }).format(size / (1024 * 1024));
}

function shouldRenderMessageText(message: ChatMessage): boolean {
  const text = (message.content || '').trim();
  if (!text) return false;
  return !text.startsWith('[attachment]');
}

export function OrderPage() {
  const { id } = useParams<{ id: string }>();
  const { isDark } = useTheme();
  const { user, logout } = useAuth();
  const { t, i18n } = useTranslation();

  const [order, setOrder] = useState<OrderWithMessages | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedAttachments, setSelectedAttachments] = useState<PendingAttachment[]>([]);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typingName, setTypingName] = useState<string | null>(null);

  const typingTimeoutRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadOrder = useCallback(async () => {
    if (!id || !user) {
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      const data = await api.getOrder(id);
      setOrder(data);
      setMessages((prev) => {
        const remoteMessages = (data.messages || []).map((message) => normalizeMessage(message));
        const pendingMessages = prev.filter((message) => message.localStatus);
        const merged = [...remoteMessages];

        for (const pending of pendingMessages) {
          if (!merged.some((existing) => existing.id === pending.id)) {
            merged.push(pending);
          }
        }

        return merged.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('orders.details.loadFailed', { defaultValue: 'Failed to load order' }));
    } finally {
      setIsLoading(false);
    }
  }, [id, t, user]);

  useEffect(() => {
    void loadOrder();

    const timer = setInterval(() => {
      void loadOrder();
    }, 30000);

    return () => clearInterval(timer);
  }, [loadOrder]);

  useEffect(() => {
    if (!id || !user) return;

    connectSocket();
    joinOrder(id);

    const handleNewMessage = (message: Message) => {
      if (message.orderId !== id) return;
      const normalized = normalizeMessage(message);

      setMessages((prev) => {
        if (prev.some((existing) => existing.id === normalized.id)) return prev;
        return [...prev, normalized].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      });
    };

    const handleTyping = (payload: { userId: string; name: string }) => {
      if (payload.userId === user.id) return;
      setTypingName(payload.name);
    };

    const handleStopTyping = () => {
      setTypingName(null);
    };

    const handleSocketError = (payload: { message?: string }) => {
      if (payload?.message) setError(payload.message);
    };

    onNewMessage(handleNewMessage);
    onUserTyping(handleTyping);
    onUserStopTyping(handleStopTyping);
    onSocketError(handleSocketError);

    return () => {
      leaveOrder(id);
      offNewMessage(handleNewMessage);
      offUserTyping(handleTyping);
      offUserStopTyping(handleStopTyping);
      offSocketError(handleSocketError);

      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    };
  }, [id, user]);

  const isClient = useMemo(() => {
    if (!order || !user) return false;
    return order.client.id === user.id;
  }, [order, user]);

  const isFreelancer = useMemo(() => {
    if (!order || !user || !order.freelancer) return false;
    return order.freelancer.id === user.id;
  }, [order, user]);

  const isMessagingLocked = order?.status === 'COMPLETED' || order?.status === 'CANCELLED';

  const validateAttachment = useCallback(
    (file: File): string | null => {
      if (file.size > MAX_ATTACHMENT_SIZE) {
        return t('chat.fileTooLarge');
      }

      const extension = getFileExtension(file.name);
      if (BLOCKED_EXTENSIONS.has(extension)) {
        return t('chat.fileTypeNotAllowed');
      }

      const hasAllowedMime = file.type ? ALLOWED_ATTACHMENT_TYPES.has(file.type) : false;
      const hasAllowedExtension = ALLOWED_ATTACHMENT_EXTENSIONS.has(extension);

      if (!hasAllowedMime && !hasAllowedExtension) {
        return t('chat.fileTypeNotAllowed');
      }

      return null;
    },
    [t]
  );

  const addAttachments = useCallback(
    (files: File[]) => {
      if (isMessagingLocked) return;

      const nextItems: PendingAttachment[] = [];
      for (const file of files) {
        const validationError = validateAttachment(file);
        if (validationError) {
          setError(validationError);
          continue;
        }

        nextItems.push({
          id: createLocalMessageId(),
          file,
          isImage: isImageMime(file.type) || ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(getFileExtension(file.name)),
          previewUrl: isImageMime(file.type) ? URL.createObjectURL(file) : undefined,
        });
      }

      if (nextItems.length > 0) {
        setSelectedAttachments((prev) => [...prev, ...nextItems]);
      }
    },
    [isMessagingLocked, validateAttachment]
  );

  const removeAttachment = (attachmentId: string) => {
    setSelectedAttachments((prev) => {
      const item = prev.find((attachment) => attachment.id === attachmentId);
      if (item?.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
      }
      return prev.filter((attachment) => attachment.id !== attachmentId);
    });
  };

  const upsertLocalMessage = (localId: string, update: Partial<ChatMessage>) => {
    setMessages((prev) => prev.map((message) => (message.localId === localId ? { ...message, ...update } : message)));
  };

  const sendTextMessage = async (content: string) => {
    if (!id || !content.trim()) return;

    const created = await api.sendMessage({
      orderId: id,
      content: content.trim(),
      type: 'text',
    });

    const normalized = normalizeMessage(created);
    setMessages((prev) => {
      if (prev.some((message) => message.id === normalized.id)) return prev;
      return [...prev, normalized];
    });
  };

  const sendAttachmentMessage = async (attachment: PendingAttachment, reuseLocalId?: string) => {
    if (!id || !user) return;

    const localId = reuseLocalId || createLocalMessageId();

    if (!reuseLocalId) {
      const optimisticMessage: ChatMessage = {
        id: localId,
        localId,
        orderId: id,
        senderId: user.id,
        sender: {
          id: user.id,
          name: user.name || 'User',
          avatar: user.avatar,
        },
        type: attachment.isImage ? 'image' : 'file',
        content: '',
        text: '',
        fileName: attachment.file.name,
        fileSize: attachment.file.size,
        size: attachment.file.size,
        mimeType: attachment.file.type || undefined,
        createdAt: new Date().toISOString(),
        localStatus: 'sending',
        uploadProgress: 0,
        retryFile: attachment.file,
        localPreviewUrl: attachment.previewUrl,
      };

      setMessages((prev) => [...prev, optimisticMessage]);
    } else {
      upsertLocalMessage(localId, {
        localStatus: 'sending',
        uploadProgress: 0,
      });
    }

    try {
      const uploadResult = await api.uploadFileWithProgress(attachment.file, (progress) => {
        upsertLocalMessage(localId, { uploadProgress: progress });
      });

      const created = await api.sendMessage({
        orderId: id,
        content: '',
        fileUrl: uploadResult.url,
        fileName: uploadResult.fileName || uploadResult.originalName || attachment.file.name,
        fileSize: uploadResult.size || attachment.file.size,
        mimeType: uploadResult.mimeType || uploadResult.mimetype || attachment.file.type,
        type: attachment.isImage ? 'image' : 'file',
      });

      if (attachment.previewUrl) {
        URL.revokeObjectURL(attachment.previewUrl);
      }

      const normalized = normalizeMessage(created);
      setMessages((prev) =>
        prev.map((message) => (message.localId === localId ? normalized : message)).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      );
    } catch (err) {
      upsertLocalMessage(localId, {
        localStatus: 'failed',
        uploadProgress: 0,
      });
      setError(err instanceof Error ? err.message : t('chat.failed'));
    }
  };

  const retryMessage = async (localId: string) => {
    const failedMessage = messages.find((message) => message.localId === localId);
    if (!failedMessage?.retryFile) return;

    await sendAttachmentMessage(
      {
        id: localId,
        file: failedMessage.retryFile,
        isImage: failedMessage.type === 'image',
        previewUrl: failedMessage.localPreviewUrl,
      },
      localId
    );
  };

  const handleSendMessage = async () => {
    if (!id || isMessagingLocked) return;

    const trimmedText = newMessage.trim();
    const attachments = [...selectedAttachments];

    if (!trimmedText && attachments.length === 0) return;

    setError(null);
    setNewMessage('');
    setSelectedAttachments([]);

    if (id) {
      stopTyping(id);
      setTypingName(null);
    }

    try {
      if (trimmedText) {
        await sendTextMessage(trimmedText);
      }

      for (const attachment of attachments) {
        await sendAttachmentMessage(attachment);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('orders.details.sendFailed', { defaultValue: 'Failed to send message' }));
    }
  };

  const runAction = async (action: () => Promise<unknown>) => {
    try {
      setIsActionLoading(true);
      setError(null);
      await action();
      await loadOrder();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('orders.details.actionFailed', { defaultValue: 'Action failed' }));
    } finally {
      setIsActionLoading(false);
    }
  };

  const openReviewModal = () => {
    setReviewError(null);
    setReviewRating(5);
    setReviewComment('');
    setIsReviewModalOpen(true);
  };

  const submitReview = async () => {
    if (!order) return;

    const normalizedComment = reviewComment.trim();
    if (reviewRating < 1 || reviewRating > 5) {
      setReviewError(t('orders.details.review.ratingRequired', { defaultValue: 'Choose rating from 1 to 5' }));
      return;
    }

    if (normalizedComment.length < 10) {
      setReviewError(t('orders.details.review.commentRequired', { defaultValue: 'Review text must contain at least 10 characters' }));
      return;
    }

    try {
      setIsSubmittingReview(true);
      setReviewError(null);
      setError(null);
      await api.submitOrderReview(order.id, { rating: reviewRating, comment: normalizedComment });
      setIsReviewModalOpen(false);
      await loadOrder();
    } catch (err) {
      const message = err instanceof Error ? err.message : t('orders.details.review.failed', { defaultValue: 'Failed to submit review' });
      setReviewError(message);
      setError(message);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  if (isLoading) {
    return (
      <div className="app-background flex min-h-screen items-center justify-center px-4">
        <div className="surface w-full max-w-md p-5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-3 h-3.5 w-5/6" />
          <Skeleton className="mt-2 h-3.5 w-3/4" />
          <Skeleton className="mt-6 h-10 w-full rounded-[var(--radius-control)]" />
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (!order) {
    return (
      <div className="app-background flex min-h-screen items-center justify-center px-4">
        <div className="surface p-8 text-center">
          <h1 className="text-2xl font-bold text-[var(--color-text)]">{t('orders.details.notFound', { defaultValue: 'Order not found' })}</h1>
          <Link to={WORKSPACE_PATH} className="mt-3 inline-block text-sm font-semibold text-[var(--color-primary)] hover:underline">
            {t('orders.details.backToDashboard', { defaultValue: 'Back to dashboard' })}
          </Link>
        </div>
      </div>
    );
  }

  const counterpart = isClient ? order.freelancer : order.client;
  const sidebarItems = user.role === 'FREELANCER' ? getFreelancerSidebarItems() : getClientSidebarItems();
  const hasActionButtons =
    (order.status === 'PENDING' && isClient) ||
    (order.status === 'PENDING' && !isClient && user.role === 'FREELANCER') ||
    (order.status === 'ACTIVE' && isFreelancer) ||
    (order.status === 'SUBMITTED' && isClient);

  const renderActionButtons = (compact = false) => {
    const sizeClass = compact ? 'h-10 px-4 text-sm' : 'h-9 px-3 text-xs';

    return (
      <>
        {order.status === 'PENDING' && isClient ? (
          <button
            disabled={isActionLoading}
            onClick={() => void runAction(() => api.cancelOrder(order.id, t('orders.details.cancelReason', { defaultValue: 'Cancelled by client' })))}
            className={`inline-flex items-center rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--color-danger)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_12%,transparent)] font-semibold text-[var(--color-danger)] disabled:opacity-60 ${sizeClass}`}
          >
            {t('orders.details.cancelOrder', { defaultValue: 'Cancel order' })}
          </button>
        ) : null}

        {order.status === 'PENDING' && !isClient && user.role === 'FREELANCER' ? (
          <button
            disabled={isActionLoading}
            onClick={() => void runAction(() => api.acceptOrder(order.id))}
            className={`inline-flex items-center rounded-[var(--radius-control)] bg-[var(--color-primary)] font-semibold text-white transition-colors hover:bg-[var(--color-primary-hover)] disabled:opacity-60 ${sizeClass}`}
          >
            {t('orders.details.acceptOrder', { defaultValue: 'Accept order' })}
          </button>
        ) : null}

        {order.status === 'ACTIVE' && isFreelancer ? (
          <button
            disabled={isActionLoading}
            onClick={() => void runAction(() => api.submitOrder(order.id, t('orders.details.submitNote', { defaultValue: 'Work is ready for review' })))}
            className={`inline-flex items-center rounded-[var(--radius-control)] bg-[var(--color-success)] font-semibold text-white disabled:opacity-60 ${sizeClass}`}
          >
            {t('orders.details.submitWork', { defaultValue: 'Submit work' })}
          </button>
        ) : null}

        {order.status === 'SUBMITTED' && isClient ? (
          <>
            <button
              disabled={isActionLoading || isSubmittingReview}
              onClick={openReviewModal}
              className={`inline-flex items-center rounded-[var(--radius-control)] bg-[var(--color-success)] font-semibold text-white disabled:opacity-60 ${sizeClass}`}
            >
              {t('orders.details.approveWork', { defaultValue: 'Approve work' })}
            </button>
            <Link
              to={`/orders/${order.id}/dispute`}
              className={`inline-flex items-center gap-1.5 rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--color-danger)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_12%,transparent)] font-semibold text-[var(--color-danger)] ${sizeClass}`}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              {t('orders.details.openDispute')}
            </Link>
          </>
        ) : null}
      </>
    );
  };

  return (
    <DashboardShell
      isDark={isDark}
      sidebarTitle={user.name || 'Workspace'}
      sidebarSubtitle={user.role === 'FREELANCER' ? 'Freelancer workspace' : 'Client workspace'}
      sidebarItems={sidebarItems}
      onLogout={logout}
    >
      <PageHeader
        title={`${t('orders.details.title')} #${order.id}`}
        subtitle={t('orders.details.subtitle')}
        badges={
          <>
            <OrderStatusBadge status={order.status} isDark={isDark} />
            <Badge variant="success">{t('common.safeDeal')}</Badge>
            <Badge variant="info">{t('common.escrowProtection')}</Badge>
          </>
        }
        actions={
          <Link
            to={WORKSPACE_PATH}
            className="inline-flex h-10 items-center rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-sm font-semibold text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-2)]"
          >
            {t('orders.details.backToDashboard', { defaultValue: 'Back to dashboard' })}
          </Link>
        }
      />

      {error ? (
        <div className="rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--color-danger)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_12%,transparent)] px-4 py-3 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-8">
          <section className="surface p-6">
            <h2 className="text-2xl font-bold text-[var(--color-text)]">{order.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-muted)]">{order.description}</p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Badge variant="default">
                {t('orders.details.budget', { defaultValue: 'Budget' })}: {formatMoneyKGS(order.budget, i18n.language)}
              </Badge>
              <Badge variant="default">
                {t('orders.details.escrow', { defaultValue: 'Escrow' })}: {formatMoneyKGS(order.escrowAmount, i18n.language)}
              </Badge>
              {order.category ? <Badge variant="default">{order.category}</Badge> : null}
            </div>

            <div className="mt-5 flex flex-wrap gap-2">{renderActionButtons()}</div>
          </section>

          <section
            className={`surface p-6 ${isDraggingFiles ? 'border border-[var(--color-primary)]' : ''}`}
            onDragOver={(event) => {
              event.preventDefault();
              if (!isMessagingLocked) setIsDraggingFiles(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              setIsDraggingFiles(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setIsDraggingFiles(false);
              if (isMessagingLocked) return;
              addAttachments(Array.from(event.dataTransfer.files || []));
            }}
          >
            <h3 className="mb-4 text-lg font-semibold text-[var(--color-text)]">{t('orders.details.chat')}</h3>

            <div className="mb-4 h-[440px] overflow-y-auto rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
              {messages.length === 0 ? <p className="text-sm text-[var(--color-text-soft)]">{t('orders.details.noMessages')}</p> : null}

              <div className="space-y-3">
                {messages.map((message, index) => {
                  const own = message.senderId === user.id;
                  const messageType = message.type || inferMessageType(message);
                  const fileUrl = getDisplayFileUrl(message);
                  const showText = shouldRenderMessageText(message);

                  return (
                    <motion.div
                      key={message.localId || message.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: index * 0.01, ease: 'easeOut' }}
                      className={
                        own
                          ? 'ml-auto max-w-[82%] rounded-[var(--radius-control)] bg-[var(--color-primary)] px-4 py-3 text-white'
                          : 'max-w-[82%] rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-[var(--color-text)]'
                      }
                    >
                      <p className="mb-1 text-xs font-semibold">{own ? t('orders.details.you', { defaultValue: 'You' }) : message.sender.name}</p>

                      {messageType === 'image' && fileUrl ? (
                        <button
                          type="button"
                          onClick={() => setPreviewImageUrl(fileUrl)}
                          className="block overflow-hidden rounded-[10px] border border-[color-mix(in_srgb,white_28%,transparent)]"
                          aria-label={t('chat.preview', { defaultValue: 'Preview attachment' })}
                        >
                          <img src={fileUrl} alt={message.fileName || 'attachment'} className="max-h-52 w-full object-cover" />
                        </button>
                      ) : null}

                      {messageType === 'file' && fileUrl ? (
                        <a
                          href={fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className={
                            own
                              ? 'mt-1 inline-flex items-center gap-2 rounded-[10px] bg-[color-mix(in_srgb,white_14%,transparent)] px-2.5 py-2 text-xs font-semibold text-white hover:bg-[color-mix(in_srgb,white_22%,transparent)]'
                              : 'mt-1 inline-flex items-center gap-2 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2.5 py-2 text-xs font-semibold text-[var(--color-text)] hover:bg-[var(--color-surface)]'
                          }
                        >
                          <FileText className="h-3.5 w-3.5" />
                          <span className="max-w-[220px] truncate">{message.fileName || t('chat.file', { defaultValue: 'File' })}</span>
                          {message.fileSize ? <span>({formatFileSize(message.fileSize, i18n.language)})</span> : null}
                        </a>
                      ) : null}

                      {showText ? <p className="mt-2 text-sm leading-relaxed">{message.content}</p> : null}

                      <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
                        <span className={own ? 'text-white/80' : 'text-[var(--color-text-soft)]'}>
                          {formatDateTime(message.createdAt, i18n.language)}
                        </span>

                        {message.localStatus === 'sending' ? (
                          <span className="inline-flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            {t('chat.sending')} {message.uploadProgress ? `${message.uploadProgress}%` : ''}
                          </span>
                        ) : null}

                        {message.localStatus === 'failed' ? (
                          <button
                            type="button"
                            onClick={() => void retryMessage(message.localId || '')}
                            className={
                              own
                                ? 'inline-flex items-center gap-1 rounded-[8px] bg-[color-mix(in_srgb,white_18%,transparent)] px-2 py-1 font-semibold text-white'
                                : 'inline-flex items-center gap-1 rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1 font-semibold text-[var(--color-text)]'
                            }
                          >
                            <RotateCcw className="h-3 w-3" />
                            {t('chat.retry')}
                          </button>
                        ) : null}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {typingName && !isMessagingLocked ? (
              <p className="mb-2 text-xs text-[var(--color-text-soft)]">
                {typingName} {t('orders.details.typing', { defaultValue: 'is typing...' })}
              </p>
            ) : null}

            {isMessagingLocked ? (
              <p className="mb-2 text-xs text-[var(--color-text-soft)]">{t('orders.details.chatLocked')}</p>
            ) : null}

            {selectedAttachments.length > 0 ? (
              <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {selectedAttachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex items-center gap-2 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2.5 py-2"
                  >
                    {attachment.previewUrl ? (
                      <img src={attachment.previewUrl} alt={attachment.file.name} className="h-8 w-8 rounded-[8px] object-cover" />
                    ) : (
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-soft)]">
                        <ImageIcon className="h-4 w-4" />
                      </span>
                    )}
                    <span className="max-w-[220px] truncate text-xs font-medium text-[var(--color-text-muted)]">{attachment.file.name}</span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(attachment.id)}
                      className="inline-flex h-6 w-6 items-center justify-center rounded-[8px] text-[var(--color-text-soft)] hover:bg-[var(--color-surface)]"
                      aria-label={t('chat.removeAttachment', { defaultValue: 'Remove attachment' })}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            {isDraggingFiles && !isMessagingLocked ? (
              <div className="mb-3 rounded-[10px] border border-dashed border-[var(--color-primary)] bg-[color-mix(in_srgb,var(--color-primary)_10%,transparent)] px-3 py-2 text-xs font-medium text-[var(--color-primary)]">
                {t('chat.dropHint')}
              </div>
            ) : null}

            <div className="flex gap-2.5">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp,.pdf,.doc,.docx,.zip"
                className="hidden"
                onChange={(event) => {
                  const files = Array.from(event.target.files || []);
                  addAttachments(files);
                  event.target.value = '';
                }}
              />

              <button
                type="button"
                disabled={isMessagingLocked}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex h-10 w-11 items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-2)] disabled:cursor-not-allowed disabled:opacity-60"
                title={t('chat.attach')}
                aria-label={t('chat.attach')}
              >
                <Paperclip className="h-4 w-4" />
              </button>

              <input
                value={newMessage}
                disabled={isMessagingLocked}
                aria-label={t('orders.details.inputPlaceholder')}
                onChange={(event) => {
                  setNewMessage(event.target.value);
                  if (!id || isMessagingLocked) return;
                  sendTyping(id);
                  if (typingTimeoutRef.current) {
                    window.clearTimeout(typingTimeoutRef.current);
                  }
                  typingTimeoutRef.current = window.setTimeout(() => {
                    stopTyping(id);
                  }, 1000);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void handleSendMessage();
                  }
                }}
                placeholder={isMessagingLocked ? t('orders.details.inputLocked') : t('orders.details.inputPlaceholder')}
                className="h-10 flex-1 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-soft)] outline-none transition-colors focus:border-[var(--color-ring)] disabled:opacity-60"
              />

              <button
                type="button"
                onClick={() => void handleSendMessage()}
                disabled={isMessagingLocked}
                className="inline-flex h-10 w-11 items-center justify-center rounded-[var(--radius-control)] bg-[var(--color-primary)] text-white transition-colors hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
                aria-label={t('chat.send', { defaultValue: 'Send message' })}
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </section>
        </div>

        <aside className="space-y-6 xl:col-span-4 xl:sticky xl:top-24 xl:self-start">
          <section className="surface p-6">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--color-text-soft)]">{t('orders.details.parties')}</h3>

            <div className="space-y-3">
              <div className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
                <p className="text-xs text-[var(--color-text-soft)]">{t('orders.details.client')}</p>
                <p className="mt-1 text-sm font-semibold text-[var(--color-text)]">{order.client.name}</p>
              </div>

              <div className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
                <p className="text-xs text-[var(--color-text-soft)]">{t('orders.details.freelancer')}</p>
                <p className="mt-1 text-sm font-semibold text-[var(--color-text)]">
                  {order.freelancer?.name || t('orders.details.notAssigned', { defaultValue: 'Not assigned yet' })}
                </p>
              </div>
            </div>

            {counterpart ? (
              <div className="mt-4 flex items-center gap-2.5 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                <img
                  src={toAbsoluteAssetUrl(counterpart.avatar) || '/vite.svg'}
                  alt={counterpart.name}
                  className="h-10 w-10 rounded-[10px] object-cover"
                />
                <div>
                  <p className="text-sm font-semibold text-[var(--color-text)]">{counterpart.name}</p>
                  <p className="text-xs text-[var(--color-text-soft)]">{isClient ? t('orders.details.freelancer') : t('orders.details.client')}</p>
                </div>
              </div>
            ) : null}
          </section>

          <section className="surface p-6">
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--color-text-soft)]">{t('orders.details.escrowPanel')}</h3>
            <p className="text-2xl font-bold text-[var(--color-text)]">{formatMoneyKGS(order.escrowAmount, i18n.language)}</p>

            <div className="mt-4 rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--color-success)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-success)_12%,transparent)] p-3">
              <p className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--color-success)]">
                <ShieldCheck className="h-4 w-4" />
                {t('orders.details.escrowActive')}
              </p>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                {t('orders.details.escrowHint', {
                  defaultValue: 'Funds are released only after approval or dispute resolution.',
                })}
              </p>
            </div>

            <div className="mt-3 space-y-2">
              <div className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-xs text-[var(--color-text-muted)]">
                {t('orders.details.flow.hold', { defaultValue: '1. Budget is reserved' })}
              </div>
              <div className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-xs text-[var(--color-text-muted)]">
                {t('orders.details.flow.work', { defaultValue: '2. Work is in progress' })}
              </div>
              <div className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-xs text-[var(--color-text-muted)]">
                {t('orders.details.flow.release', { defaultValue: '3. Approval and release' })}
              </div>
            </div>
          </section>

          {order.status === 'SUBMITTED' && isClient ? (
            <section className="surface p-6">
              <h3 className="mb-2 text-base font-semibold text-[var(--color-text)]">{t('orders.details.needEscalation', { defaultValue: 'Need escalation?' })}</h3>
              <p className="text-sm text-[var(--color-text-muted)]">
                {t('orders.details.escalationHint', { defaultValue: 'If there is a dispute, open a case and attach evidence.' })}
              </p>
              <Link
                to={`/orders/${order.id}/dispute`}
                className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--color-danger)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_12%,transparent)] px-4 text-sm font-semibold text-[var(--color-danger)]"
              >
                <AlertTriangle className="h-4 w-4" />
                {t('orders.details.openDispute')}
              </Link>
            </section>
          ) : null}

          {order.status === 'COMPLETED' ? (
            <section className="surface p-6">
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-success)]">
                <CheckCircle2 className="h-4 w-4" />
                {t('orders.details.completed')}
              </div>
              <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                {t('orders.details.completedHint', { defaultValue: 'Deal is closed, chat is read-only.' })}
              </p>
            </section>
          ) : null}
        </aside>
      </section>

      {hasActionButtons ? <div className="h-20 lg:hidden" /> : null}

      {hasActionButtons ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-surface)_96%,transparent)] px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] backdrop-blur-sm lg:hidden">
          <div className="mx-auto flex max-w-[var(--layout-dashboard-width)] gap-2 overflow-x-auto">
            {renderActionButtons(true)}
          </div>
        </div>
      ) : null}

      {isReviewModalOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4 py-6">
          <div className="surface w-full max-w-lg p-6" role="dialog" aria-modal="true" aria-labelledby="order-review-title">
            <h3 className="text-lg font-semibold text-[var(--color-text)]">
              <span id="order-review-title">
              {t('orders.details.review.title', { defaultValue: 'Rate completed work' })}
              </span>
            </h3>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              {t('orders.details.review.subtitle', { defaultValue: 'Your review is required to complete the order.' })}
            </p>

            <div className="mt-4">
              <p className="mb-2 text-sm font-medium text-[var(--color-text)]">
                {t('orders.details.review.rating', { defaultValue: 'Rating' })}
              </p>
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setReviewRating(value)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-2)]"
                    aria-label={`Rate ${value}`}
                  >
                    <Star
                      className={
                        value <= reviewRating
                          ? 'h-4 w-4 fill-amber-500 text-amber-500'
                          : 'h-4 w-4 text-[var(--color-text-soft)]'
                      }
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">
                {t('orders.details.review.comment', { defaultValue: 'Review text' })}
              </label>
              <textarea
                rows={4}
                value={reviewComment}
                onChange={(event) => setReviewComment(event.target.value)}
                placeholder={t('orders.details.review.placeholder', { defaultValue: 'Describe quality, communication and deadlines' })}
                className="w-full rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-ring)]"
              />
            </div>

            {reviewError ? (
              <p className="mt-3 rounded-[10px] border border-[color-mix(in_srgb,var(--color-danger)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_12%,transparent)] px-3 py-2 text-xs text-[var(--color-danger)]">
                {reviewError}
              </p>
            ) : null}

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  if (isSubmittingReview) return;
                  setIsReviewModalOpen(false);
                }}
                className="inline-flex h-10 items-center rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-sm font-semibold text-[var(--color-text)]"
              >
                {t('common.cancel', { defaultValue: 'Cancel' })}
              </button>
              <button
                type="button"
                disabled={isSubmittingReview}
                onClick={() => void submitReview()}
                className="inline-flex h-10 items-center rounded-[10px] bg-[var(--color-success)] px-4 text-sm font-semibold text-white disabled:opacity-60"
              >
                {isSubmittingReview ? t('common.loading', { defaultValue: 'Loading...' }) : t('orders.details.review.submit', { defaultValue: 'Complete order' })}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {previewImageUrl ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4" onClick={() => setPreviewImageUrl(null)} role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] border border-[color-mix(in_srgb,white_38%,transparent)] bg-[color-mix(in_srgb,black_55%,transparent)] text-white"
            onClick={() => setPreviewImageUrl(null)}
            aria-label={t('common.close', { defaultValue: 'Close preview' })}
          >
            <X className="h-5 w-5" />
          </button>
          <img src={previewImageUrl} alt={t('chat.preview')} className="max-h-[90vh] max-w-[95vw] rounded-[var(--radius-control)] object-contain" />
        </div>
      ) : null}
    </DashboardShell>
  );
}
