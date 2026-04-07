import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, CheckCheck, ExternalLink, RefreshCcw, Send, Shield, Trash2 } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import api, { NotificationItem, UserSettings } from '@/services/api';
import { connectSocket, disconnectSocket, offNotification, onNotification, SocketNotification } from '@/services/socket';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { getClientSidebarItems, getFreelancerSidebarItems } from '@/components/dashboard/dashboardNav';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { SettingToggle } from '@/components/ui/SettingToggle';
import { Skeleton } from '@/components/ui/Skeleton';
import { useTranslation } from 'react-i18next';
import { formatDateTime } from '@/utils/locale';
import { WORKSPACE_PATH } from '@/utils/routes';

type NotificationSettingKey =
  | 'notificationsEnabled'
  | 'loginAlertsEnabled'
  | 'telegramNotificationsEnabled';

function getNotificationVariant(type: string): 'default' | 'success' | 'warning' | 'danger' | 'info' {
  switch (type) {
    case 'ORDER_COMPLETED':
    case 'PAYMENT_RECEIVED':
    case 'WITHDRAWAL_COMPLETED':
      return 'success';
    case 'DISPUTE_OPENED':
      return 'danger';
    case 'ORDER_CANCELLED':
      return 'warning';
    case 'ORDER_CREATED':
    case 'ORDER_ACCEPTED':
    case 'ORDER_SUBMITTED':
    case 'MESSAGE_RECEIVED':
      return 'info';
    default:
      return 'default';
  }
}

function getNotificationLabel(type: string) {
  return type.split('_').join(' ');
}

export function DashboardNotificationsPage() {
  const { t, i18n } = useTranslation();
  const { isDark } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [isClearingRead, setIsClearingRead] = useState(false);
  const [activeNotificationId, setActiveNotificationId] = useState<string | null>(null);
  const [savingSettingKey, setSavingSettingKey] = useState<NotificationSettingKey | null>(null);

  const loadNotifications = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [notificationResult, authSettings] = await Promise.all([
        api.getNotifications({ limit: 50 }),
        api.getAuthSettings(),
      ]);

      setNotifications(notificationResult.data);
      setUnreadCount(notificationResult.unreadCount);
      setSettings(authSettings);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('notifications.loadFailed', { defaultValue: 'Failed to load notifications' })
      );
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (!user) return;

    connectSocket();

    const handleIncomingNotification = (incoming: SocketNotification) => {
      setNotifications((prev) => {
        if (prev.some((item) => item.id === incoming.id)) {
          return prev;
        }
        return [incoming, ...prev];
      });

      if (!incoming.isRead) {
        setUnreadCount((prev) => prev + 1);
      }
    };

    onNotification(handleIncomingNotification);

    return () => {
      offNotification(handleIncomingNotification);
      disconnectSocket();
    };
  }, [user]);

  const markOneAsRead = useCallback(async (item: NotificationItem) => {
    if (item.isRead) return true;

    const previousNotifications = notifications;
    const previousUnreadCount = unreadCount;

    setNotifications((prev) =>
      prev.map((entry) =>
        entry.id === item.id
          ? {
              ...entry,
              isRead: true,
              readAt: entry.readAt || new Date().toISOString(),
            }
          : entry
      )
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      await api.markNotificationRead(item.id);
      return true;
    } catch (err) {
      setNotifications(previousNotifications);
      setUnreadCount(previousUnreadCount);
      setError(
        err instanceof Error
          ? err.message
          : t('notifications.markReadFailed', { defaultValue: 'Failed to mark notification as read' })
      );
      return false;
    }
  }, [notifications, t, unreadCount]);

  const openNotification = useCallback(async (item: NotificationItem) => {
    setActiveNotificationId(item.id);
    try {
      const ok = await markOneAsRead(item);
      if (ok && item.link) {
        navigate(item.link);
      }
    } finally {
      setActiveNotificationId(null);
    }
  }, [markOneAsRead, navigate]);

  const deleteNotification = useCallback(async (item: NotificationItem) => {
    const previousNotifications = notifications;
    const previousUnreadCount = unreadCount;

    setActiveNotificationId(item.id);
    setNotifications((prev) => prev.filter((entry) => entry.id !== item.id));
    if (!item.isRead) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }

    try {
      await api.deleteNotification(item.id);
    } catch (err) {
      setNotifications(previousNotifications);
      setUnreadCount(previousUnreadCount);
      setError(
        err instanceof Error
          ? err.message
          : t('notifications.deleteFailed', { defaultValue: 'Failed to delete notification' })
      );
    } finally {
      setActiveNotificationId(null);
    }
  }, [notifications, t, unreadCount]);

  const markAllAsRead = useCallback(async () => {
    if (unreadCount === 0) return;

    const previousNotifications = notifications;
    const previousUnreadCount = unreadCount;

    setIsMarkingAll(true);
    setNotifications((prev) =>
      prev.map((item) =>
        item.isRead
          ? item
          : {
              ...item,
              isRead: true,
              readAt: item.readAt || new Date().toISOString(),
            }
      )
    );
    setUnreadCount(0);

    try {
      await api.markAllNotificationsRead();
    } catch (err) {
      setNotifications(previousNotifications);
      setUnreadCount(previousUnreadCount);
      setError(
        err instanceof Error
          ? err.message
          : t('notifications.markAllFailed', { defaultValue: 'Failed to mark all notifications as read' })
      );
    } finally {
      setIsMarkingAll(false);
    }
  }, [notifications, t, unreadCount]);

  const clearReadNotifications = useCallback(async () => {
    const previousNotifications = notifications;

    setIsClearingRead(true);
    setNotifications((prev) => prev.filter((item) => !item.isRead));

    try {
      await api.deleteReadNotifications();
    } catch (err) {
      setNotifications(previousNotifications);
      setError(
        err instanceof Error
          ? err.message
          : t('notifications.clearReadFailed', { defaultValue: 'Failed to clear read notifications' })
      );
    } finally {
      setIsClearingRead(false);
    }
  }, [notifications, t]);

  const saveSetting = useCallback(async (key: NotificationSettingKey, value: boolean) => {
    if (!settings) return;

    const previousSettings = settings;
    setSavingSettingKey(key);
    setSettings({ ...settings, [key]: value });

    try {
      const nextSettings = await api.updateAuthSettings({ [key]: value });
      setSettings(nextSettings);
    } catch (err) {
      setSettings(previousSettings);
      setError(
        err instanceof Error
          ? err.message
          : t('notifications.settingsSaveFailed', { defaultValue: 'Failed to save notification settings' })
      );
    } finally {
      setSavingSettingKey(null);
    }
  }, [settings, t]);

  const readCount = useMemo(
    () => notifications.reduce((total, item) => total + (item.isRead ? 1 : 0), 0),
    [notifications]
  );

  const hasReadNotifications = readCount > 0;

  const settingCards = useMemo(() => {
    if (!settings) return [];

    return [
      {
        key: 'notificationsEnabled' as const,
        title: t('notifications.settingsInAppTitle', { defaultValue: 'In-app notifications' }),
        hint: t('notifications.settingsInAppHint', { defaultValue: 'Show updates about orders, disputes and payments inside the workspace.' }),
        checked: settings.notificationsEnabled,
        icon: <Bell className="h-4 w-4 text-[var(--color-info)]" />,
      },
      {
        key: 'loginAlertsEnabled' as const,
        title: t('notifications.settingsLoginAlertsTitle', { defaultValue: 'Login alerts' }),
        hint: t('notifications.settingsLoginAlertsHint', { defaultValue: 'Notify you when a new session signs in to your account.' }),
        checked: settings.loginAlertsEnabled,
        icon: <Shield className="h-4 w-4 text-[var(--color-warning)]" />,
      },
      {
        key: 'telegramNotificationsEnabled' as const,
        title: t('notifications.settingsTelegramTitle', { defaultValue: 'Telegram notifications' }),
        hint: t('notifications.settingsTelegramHint', { defaultValue: 'Mirror important order events to your linked Telegram account.' }),
        checked: settings.telegramNotificationsEnabled,
        icon: <Send className="h-4 w-4 text-[var(--color-primary)]" />,
      },
    ];
  }, [settings, t]);

  if (!user) return <Navigate to="/login" replace />;
  if (!['CLIENT', 'FREELANCER'].includes(user.role)) return <Navigate to={WORKSPACE_PATH} replace />;

  const sidebarItems = user.role === 'FREELANCER' ? getFreelancerSidebarItems() : getClientSidebarItems();

  return (
    <DashboardShell
      isDark={isDark}
      sidebarTitle={user.name || t('topbar.user')}
      sidebarSubtitle={t('topbar.workspace')}
      sidebarItems={sidebarItems}
      onLogout={logout}
    >
      <PageHeader
        title={t('notifications.title')}
        subtitle={t('notifications.subtitle')}
        badges={
          <>
            <Badge variant="info">{t('notifications.unread')}: {unreadCount}</Badge>
            <Badge variant="default">
              {t('notifications.total', { defaultValue: 'Total' })}: {notifications.length}
            </Badge>
          </>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => void loadNotifications()}
              isLoading={isLoading}
              leftIcon={<RefreshCcw className="h-4 w-4" />}
            >
              {t('common.refresh')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void markAllAsRead()}
              isLoading={isMarkingAll}
              disabled={unreadCount === 0}
              leftIcon={<CheckCheck className="h-4 w-4" />}
            >
              {t('notifications.markAllRead')}
            </Button>
          </div>
        }
      />

      {error ? (
        <div className="mb-6 rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--color-danger)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_12%,transparent)] px-4 py-3 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-8">
          <section className="surface p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-[var(--color-text)]">{t('notifications.feed')}</h2>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void clearReadNotifications()}
                isLoading={isClearingRead}
                disabled={!hasReadNotifications}
                leftIcon={<Trash2 className="h-4 w-4" />}
              >
                {t('notifications.clearRead', { defaultValue: 'Clear read' })}
              </Button>
            </div>

            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="surface-muted p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-3.5 w-full" />
                        <Skeleton className="h-3.5 w-2/3" />
                      </div>
                      <Skeleton className="h-8 w-20 rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <EmptyState
                title={t('notifications.emptyTitle', { defaultValue: 'No notifications yet' })}
                description={t('notifications.emptyDescription', { defaultValue: 'Order, payment and dispute updates will appear here as you use the platform.' })}
                icon={<Bell className="h-5 w-5" />}
                action={
                  <Button type="button" variant="outline" onClick={() => void loadNotifications()}>
                    {t('common.refresh')}
                  </Button>
                }
              />
            ) : (
              <div className="space-y-3">
                {notifications.map((item) => (
                  <article
                    key={item.id}
                    className={
                      item.isRead
                        ? 'rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4'
                        : 'rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--color-primary)_45%,transparent)] bg-[color-mix(in_srgb,var(--color-primary)_10%,transparent)] p-4'
                    }
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-[var(--color-text)]">{item.title}</p>
                          <Badge variant={getNotificationVariant(item.type)} size="sm">
                            {getNotificationLabel(item.type)}
                          </Badge>
                          {!item.isRead ? <Badge variant="info" size="sm">{t('notifications.new')}</Badge> : null}
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-muted)]">{item.message}</p>
                        <p className="mt-3 text-xs text-[var(--color-text-soft)]">
                          {formatDateTime(item.createdAt, i18n.language)}
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void openNotification(item)}
                          isLoading={activeNotificationId === item.id}
                        >
                          {item.link
                            ? t('notifications.open', { defaultValue: 'Open' })
                            : item.isRead
                              ? t('notifications.view', { defaultValue: 'View' })
                              : t('notifications.markRead', { defaultValue: 'Mark as read' })}
                          {item.link ? <ExternalLink className="h-4 w-4" /> : null}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => void deleteNotification(item)}
                          disabled={activeNotificationId === item.id}
                          leftIcon={<Trash2 className="h-4 w-4" />}
                        >
                          {t('common.delete', { defaultValue: 'Delete' })}
                        </Button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-6 xl:col-span-4">
          <section className="surface p-5 sm:p-6">
            <h2 className="mb-3 text-lg font-semibold text-[var(--color-text)]">
              {t('notifications.settings')}
            </h2>
            <div className="space-y-3">
              {settingCards.map((item) => (
                <SettingToggle
                  key={item.key}
                  title={item.title}
                  hint={item.hint}
                  checked={item.checked}
                  disabled={savingSettingKey === item.key}
                  onCheckedChange={(checked) => void saveSetting(item.key, checked)}
                  icon={item.icon}
                  enabledLabel={t('common.enabled', { defaultValue: 'Enabled' })}
                  disabledLabel={t('common.disabled', { defaultValue: 'Disabled' })}
                />
              ))}
            </div>
          </section>

          <section className="surface p-5 sm:p-6">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-primary)]">
              <Shield className="h-4 w-4" />
              {t('notifications.policy')}
            </p>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              {t('notifications.policyText')}
            </p>
            <p className="mt-2 inline-flex items-center gap-2 text-xs text-[var(--color-text-soft)]">
              <Bell className="h-3.5 w-3.5" />
              {t('notifications.policyHint')}
            </p>
          </section>
        </aside>
      </section>
    </DashboardShell>
  );
}
