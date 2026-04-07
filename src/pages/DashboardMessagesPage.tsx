import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { MessageCircle, RefreshCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import api, { Conversation } from '../services/api';
import { DashboardShell } from '../components/dashboard/DashboardShell';
import { getClientSidebarItems, getFreelancerSidebarItems } from '../components/dashboard/dashboardNav';
import { OrderStatusBadge } from '../components/dashboard/OrderStatusBadge';
import { toAbsoluteAssetUrl } from '../utils/assetUrl';
import { PageHeader } from '../components/ui/PageHeader';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { WORKSPACE_PATH } from '@/utils/routes';

export function DashboardMessagesPage() {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const { user, logout } = useAuth();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadConversations = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [list, unread] = await Promise.all([api.getConversations(), api.getUnreadMessagesCount()]);
      setConversations(list);
      setUnreadCount(unread);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('dashboard.messages.loadFailed', { defaultValue: 'Failed to load messages' }));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  if (!user) return <Navigate to="/login" replace />;
  if (!['CLIENT', 'FREELANCER'].includes(user.role)) return <Navigate to={WORKSPACE_PATH} replace />;

  const isFreelancer = user.role === 'FREELANCER';
  const sidebarItems = isFreelancer ? getFreelancerSidebarItems() : getClientSidebarItems();

  return (
    <DashboardShell
      isDark={isDark}
      sidebarTitle={user.name || t('topbar.user', { defaultValue: 'User' })}
      sidebarSubtitle={isFreelancer ? 'Freelancer workspace' : 'Client workspace'}
      sidebarItems={sidebarItems}
      onLogout={logout}
    >
      <PageHeader
        title={t('dashboard.messages.title')}
        subtitle={`${t('dashboard.messages.unread')}: ${unreadCount}`}
        badges={error ? <Badge variant="danger">{t('common.error', { defaultValue: 'Error' })}</Badge> : <Badge variant="success">{t('common.ready', { defaultValue: 'Ready' })}</Badge>}
        actions={
          <Button type="button" variant="outline" onClick={() => void loadConversations()} leftIcon={<RefreshCcw className="h-4 w-4" />}>
            {t('common.refresh')}
          </Button>
        }
      />

      {error && (
        <div className="rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--color-danger)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_12%,transparent)] px-4 py-3 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      )}

      <section className="surface p-5 sm:p-6">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="surface-muted p-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-[10px]" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-40" />
                    <Skeleton className="h-3.5 w-3/4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <EmptyState title={t('dashboard.messages.empty')} icon={<MessageCircle className="h-5 w-5" />} compact />
        ) : (
          <div className="space-y-3">
            {conversations.map((conversation, index) => (
              <motion.div
                key={conversation.orderId}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, delay: index * 0.02, ease: 'easeOut' }}
              >
                <Link
                  to={`/orders/${conversation.orderId}`}
                  aria-label={`${t('common.open')} ${conversation.orderTitle}`}
                  className="surface-muted block p-4 transition-colors hover:bg-[var(--color-surface)]"
                >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <img
                        src={toAbsoluteAssetUrl(conversation.otherUser?.avatar) || '/vite.svg'}
                        alt={conversation.otherUser?.name || t('topbar.user', { defaultValue: 'User' })}
                        className="h-8 w-8 rounded-[10px] object-cover"
                      />
                      <p className="truncate text-sm font-semibold text-[var(--color-text)]">
                        {conversation.otherUser?.name || t('dashboard.messages.interlocutor', { defaultValue: 'Interlocutor' })}
                      </p>
                    </div>

                    <p className="mt-2 truncate text-sm text-[var(--color-text-muted)]">{conversation.orderTitle}</p>

                    {conversation.lastMessage && (
                      <p className="mt-1 truncate text-xs text-[var(--color-text-soft)]">
                        {conversation.lastMessage.isFromMe ? `${t('orders.details.you', { defaultValue: 'You' })}: ` : ''}
                        {conversation.lastMessage.content}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <OrderStatusBadge status={conversation.orderStatus} isDark={isDark} />
                    {conversation.unreadCount > 0 && (
                      <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[var(--color-primary)] px-2 text-xs font-bold text-white">
                        {conversation.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </section>
    </DashboardShell>
  );
}
