import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { BellRing, Monitor, ShieldCheck, Smartphone, Wallet } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import api, {
  FreelancerBalanceStats,
  PaymentMethod,
  PaymentMethodId,
  PaymentTransaction,
  TelegramStatusResponse,
  UserSettings,
} from '../services/api';
import { DashboardShell } from '../components/dashboard/DashboardShell';
import { getClientSidebarItems, getFreelancerSidebarItems } from '../components/dashboard/dashboardNav';
import { useTranslation } from 'react-i18next';
import { formatDate, formatMoneyKGS } from '../utils/locale';
import { PageHeader } from '../components/ui/PageHeader';
import { Badge } from '../components/ui/Badge';
import { DataTable, type DataTableColumn } from '../components/ui/DataTable';
import { SettingToggle } from '../components/ui/SettingToggle';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Skeleton } from '../components/ui/Skeleton';
import { WORKSPACE_PATH } from '@/utils/routes';

interface PasswordForm {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface EmailForm {
  newEmail: string;
  currentPassword: string;
}

const DEFAULT_PASSWORD_FORM: PasswordForm = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

const DEFAULT_EMAIL_FORM: EmailForm = {
  newEmail: '',
  currentPassword: '',
};

const DEFAULT_SETTINGS: UserSettings = {
  twoFactorEnabled: false,
  loginAlertsEnabled: true,
  notificationsEnabled: true,
  telegramNotificationsEnabled: true,
};

function resolveTransactionVariant(status: string): 'default' | 'success' | 'warning' | 'danger' | 'info' {
  const normalized = status.toLowerCase();

  if (normalized.includes('completed') || normalized.includes('success') || normalized.includes('released') || normalized.includes('paid')) {
    return 'success';
  }

  if (normalized.includes('failed') || normalized.includes('cancel') || normalized.includes('reject')) {
    return 'danger';
  }

  if (normalized.includes('pending') || normalized.includes('hold') || normalized.includes('review')) {
    return 'warning';
  }

  return 'info';
}

function presentEnumLabel(value: string): string {
  return value.replace(/_/g, ' ');
}

export function DashboardSettingsPage() {
  const { t, i18n } = useTranslation();
  const { isDark } = useTheme();
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [passwordForm, setPasswordForm] = useState<PasswordForm>(DEFAULT_PASSWORD_FORM);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [isLoadingFinance, setIsLoadingFinance] = useState(true);
  const [financeError, setFinanceError] = useState<string | null>(null);

  const [clientStats, setClientStats] = useState<{ activeOrders: number; completedOrders: number; totalSpent: number; inEscrow: number } | null>(null);
  const [freelancerStats, setFreelancerStats] = useState<{
    activeOrders: number;
    completedOrders: number;
    totalEarnings: number;
    balance: number;
    pendingAmount: number;
    rating: number;
  } | null>(null);
  const [balance, setBalance] = useState<FreelancerBalanceStats | null>(null);

  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawMethod, setWithdrawMethod] = useState<PaymentMethodId>('mbank');
  const [withdrawDetails, setWithdrawDetails] = useState('');
  const [withdrawMessage, setWithdrawMessage] = useState<string | null>(null);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);

  const [emailForm, setEmailForm] = useState<EmailForm>(DEFAULT_EMAIL_FORM);
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [isChangingEmail, setIsChangingEmail] = useState(false);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [telegramStatus, setTelegramStatus] = useState<TelegramStatusResponse | null>(null);
  const [isLoadingTelegramStatus, setIsLoadingTelegramStatus] = useState(false);
  const [isOpeningTelegramLink, setIsOpeningTelegramLink] = useState(false);
  const [isUnlinkingTelegram, setIsUnlinkingTelegram] = useState(false);

  const isFreelancer = user?.role === 'FREELANCER';

  const loadFinance = useCallback(async () => {
    if (!user) return;

    try {
      setIsLoadingFinance(true);
      setFinanceError(null);

      const [paymentMethods, transactionResult] = await Promise.all([
        api.getPaymentMethods(),
        api.getTransactions({ limit: 8 }),
      ]);

      setMethods(paymentMethods.filter((method) => method.enabled));
      setTransactions(transactionResult.data);

      if (user.role === 'CLIENT') {
        const stats = await api.getClientPaymentStats();
        setClientStats(stats);
      }

      if (user.role === 'FREELANCER') {
        const [stats, balanceData] = await Promise.all([api.getFreelancerPaymentStats(), api.getFreelancerBalance()]);
        setFreelancerStats(stats);
        setBalance(balanceData);
      }
    } catch (err) {
      setFinanceError(err instanceof Error ? err.message : t('dashboard.settings.financeLoadFailed'));
    } finally {
      setIsLoadingFinance(false);
    }
  }, [t, user]);

  useEffect(() => {
    void loadFinance();
  }, [loadFinance]);

  const loadAuthSettings = useCallback(async () => {
    if (!user) return;

    try {
      setSettingsError(null);
      const remote = await api.getAuthSettings();
      setSettings({ ...DEFAULT_SETTINGS, ...remote });
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : t('dashboard.settings.settingsLoadFailed', { defaultValue: 'Failed to load settings' }));
      if (user.settings) {
        setSettings({ ...DEFAULT_SETTINGS, ...user.settings });
      }
    }
  }, [t, user]);

  useEffect(() => {
    if (user?.settings) {
      setSettings({ ...DEFAULT_SETTINGS, ...user.settings });
    }
    void loadAuthSettings();
  }, [loadAuthSettings, user?.settings]);

  const loadTelegramStatus = useCallback(async () => {
    if (!user) return;
    try {
      setIsLoadingTelegramStatus(true);
      const status = await api.getTelegramStatus();
      setTelegramStatus(status);
    } catch {
      setTelegramStatus(null);
    } finally {
      setIsLoadingTelegramStatus(false);
    }
  }, [user]);

  useEffect(() => {
    void loadTelegramStatus();
  }, [loadTelegramStatus]);

  const sidebarItems = useMemo(() => {
    if (!user) return [];
    return user.role === 'FREELANCER' ? getFreelancerSidebarItems() : getClientSidebarItems();
  }, [user]);

  const passwordChecks = useMemo(
    () => [
      {
        key: 'minLength',
        done: passwordForm.newPassword.length >= 8,
        label: t('dashboard.settings.passwordMinLength', { defaultValue: 'At least 8 characters' }),
      },
      {
        key: 'number',
        done: /\d/.test(passwordForm.newPassword),
        label: t('dashboard.settings.passwordNeedNumber', { defaultValue: 'Contains a number' }),
      },
      {
        key: 'letter',
        done: /[A-Za-zА-Яа-я]/.test(passwordForm.newPassword),
        label: t('dashboard.settings.passwordNeedLetter', { defaultValue: 'Contains letters' }),
      },
      {
        key: 'match',
        done: Boolean(passwordForm.newPassword) && passwordForm.newPassword === passwordForm.confirmPassword,
        label: t('dashboard.settings.passwordMustMatch', { defaultValue: 'Matches confirmation' }),
      },
    ],
    [passwordForm.confirmPassword, passwordForm.newPassword, t]
  );

  const transactionColumns = useMemo<Array<DataTableColumn<PaymentTransaction>>>(
    () => [
      {
        key: 'date',
        header: t('common.date', { defaultValue: 'Date' }),
        render: (tx) => formatDate(tx.createdAt, i18n.language),
      },
      {
        key: 'type',
        header: t('common.type'),
        render: (tx) => (
          <span className="font-medium text-[var(--color-text)]">
            {presentEnumLabel(tx.type)}
          </span>
        ),
      },
      {
        key: 'amount',
        header: t('common.amount'),
        cellClassName: 'whitespace-nowrap',
        render: (tx) => (
          <span className="font-medium text-[var(--color-text)]">
            {formatMoneyKGS(tx.amount, i18n.language)}
          </span>
        ),
      },
      {
        key: 'status',
        header: t('common.status'),
        render: (tx) => (
          <Badge variant={resolveTransactionVariant(tx.status)}>
            {presentEnumLabel(tx.status)}
          </Badge>
        ),
      },
      {
        key: 'order',
        header: t('common.order', { defaultValue: 'Order' }),
        render: (tx) =>
          tx.order?.id ? (
            <Link
              to={`/orders/${tx.order.id}`}
              className="font-medium text-[var(--color-primary)] hover:underline"
            >
              {tx.order.title}
            </Link>
          ) : (
            <span className="text-[var(--color-text-soft)]">-</span>
          ),
      },
    ],
    [i18n.language, t]
  );

  if (!user) return <Navigate to="/login" replace />;
  if (!['CLIENT', 'FREELANCER'].includes(user.role)) return <Navigate to={WORKSPACE_PATH} replace />;

  const handleChangePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setPasswordError(null);
    setPasswordMessage(null);

    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordError(t('dashboard.settings.errors.fillAllFields'));
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError(t('dashboard.settings.errors.passwordMismatch'));
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      setPasswordError(t('dashboard.settings.errors.passwordTooShort'));
      return;
    }

    try {
      setIsChangingPassword(true);
      const result = await api.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordMessage(result.message);
      setPasswordForm(DEFAULT_PASSWORD_FORM);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : t('dashboard.settings.errors.passwordUpdateFailed'));
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleWithdraw = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setWithdrawError(null);
    setWithdrawMessage(null);

    const amount = Number(withdrawAmount);
    if (Number.isNaN(amount) || amount < 1000) {
      setWithdrawError(t('dashboard.settings.errors.withdrawMin'));
      return;
    }

    if (!withdrawDetails.trim()) {
      setWithdrawError(t('dashboard.settings.errors.withdrawDetailsRequired'));
      return;
    }

    try {
      setIsWithdrawing(true);
      const result = await api.requestWithdrawal({ amount, method: withdrawMethod, details: withdrawDetails.trim() });
      setWithdrawMessage(result.message);
      setWithdrawAmount('');
      setWithdrawDetails('');
      await loadFinance();
    } catch (err) {
      setWithdrawError(err instanceof Error ? err.message : t('dashboard.settings.errors.withdrawCreateFailed'));
    } finally {
      setIsWithdrawing(false);
    }
  };

  const saveSettingsPatch = async (patch: Partial<UserSettings>) => {
    const previous = settings;
    const next = { ...settings, ...patch };
    setSettings(next);
    setSettingsMessage(null);
    setSettingsError(null);

    try {
      setIsSavingSettings(true);
      const saved = await api.updateAuthSettings(patch);
      setSettings({ ...DEFAULT_SETTINGS, ...saved });
      setSettingsMessage(t('dashboard.settings.saved', { defaultValue: 'Settings saved' }));
      await refreshUser().catch(() => null);
    } catch (err) {
      setSettings(previous);
      setSettingsError(err instanceof Error ? err.message : t('dashboard.settings.settingsSaveFailed', { defaultValue: 'Failed to save settings' }));
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleChangeEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setEmailError(null);
    setEmailMessage(null);

    if (!emailForm.newEmail.trim() || !emailForm.currentPassword.trim()) {
      setEmailError(t('dashboard.settings.errors.fillAllFields'));
      return;
    }

    try {
      setIsChangingEmail(true);
      const result = await api.changeEmail({
        newEmail: emailForm.newEmail.trim(),
        currentPassword: emailForm.currentPassword,
      });
      setEmailMessage(result.message);
      setEmailForm(DEFAULT_EMAIL_FORM);
      await refreshUser().catch(() => null);
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : t('dashboard.settings.emailChangeFailed', { defaultValue: 'Failed to change email' }));
    } finally {
      setIsChangingEmail(false);
    }
  };

  const handleDeleteAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setDeleteError(null);

    if (!deletePassword.trim()) {
      setDeleteError(t('dashboard.settings.errors.passwordRequired', { defaultValue: 'Password is required' }));
      return;
    }

    try {
      setIsDeletingAccount(true);
      await api.deleteAccount({ currentPassword: deletePassword });
      await logout();
      navigate('/');
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : t('dashboard.settings.deleteFailed', { defaultValue: 'Failed to delete account' }));
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleOpenTelegramLink = async () => {
    if (!user) return;

    setSettingsError(null);
    setSettingsMessage(null);

    try {
      setIsOpeningTelegramLink(true);
      const payload = await api.getTelegramDeepLink();
      if (!payload.deepLink) {
        throw new Error(t('dashboard.settings.telegramOpenFailed', { defaultValue: 'Failed to generate Telegram link' }));
      }

      const popup = window.open('', '_blank', 'noopener,noreferrer');
      if (popup) {
        popup.location.href = payload.deepLink;
      } else {
        window.location.assign(payload.deepLink);
      }

      setSettingsMessage(
        t('dashboard.settings.telegramInstructions', {
          defaultValue: 'Open Telegram and send /start from bot chat to complete binding.',
        })
      );
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : t('dashboard.settings.telegramOpenFailed', { defaultValue: 'Failed to open Telegram link' }));
    } finally {
      setIsOpeningTelegramLink(false);
    }
  };

  const handleUnlinkTelegram = async () => {
    if (!user) return;

    setSettingsError(null);
    setSettingsMessage(null);

    try {
      setIsUnlinkingTelegram(true);
      const status = await api.unlinkTelegramChat();
      setTelegramStatus(status);
      setSettings((prev) => ({ ...prev, telegramNotificationsEnabled: status.telegramNotificationsEnabled }));
      setSettingsMessage(t('dashboard.settings.telegramUnlinked', { defaultValue: 'Telegram chat unlinked' }));
      await refreshUser().catch(() => null);
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : t('dashboard.settings.telegramUnlinkFailed', { defaultValue: 'Failed to unlink Telegram' }));
    } finally {
      setIsUnlinkingTelegram(false);
    }
  };

  return (
    <DashboardShell
      isDark={isDark}
      sidebarTitle={user.name || t('topbar.user')}
      sidebarSubtitle={t('topbar.workspace')}
      sidebarItems={sidebarItems}
      onLogout={logout}
    >
      <PageHeader
        title={t('dashboard.settings.title')}
        subtitle={t('dashboard.settings.subtitle')}
        badges={
          <>
            <Badge variant="info">{isFreelancer ? 'Freelancer' : 'Client'}</Badge>
            <Badge variant="success">{t('common.escrowProtection')}</Badge>
          </>
        }
        actions={
          isFreelancer ? (
            <Link
              to="/dashboard/freelancer/profile"
              className="inline-flex h-10 items-center rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-sm font-semibold text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-2)]"
            >
              {t('dashboard.settings.goToProfileEdit')}
            </Link>
          ) : (
            <Link
              to="/dashboard/client/profile"
              className="inline-flex h-10 items-center rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-sm font-semibold text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-2)]"
            >
              {t('dashboard.settings.goToProfile')}
            </Link>
          )
        }
      />

      <section className="surface p-5 sm:p-6">
        <div className="mb-5">
          <h2 className="section-title flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            {t('dashboard.settings.security')}
          </h2>
          <p className="section-subtitle mt-1">{t('dashboard.settings.securityHint')}</p>
        </div>

        {passwordError && <Alert type="danger" text={passwordError} />}
        {passwordMessage && <Alert type="success" text={passwordMessage} />}

        <form onSubmit={handleChangePassword} className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Input
            type="password"
            aria-label={t('dashboard.settings.currentPassword')}
            value={passwordForm.currentPassword}
            onChange={(event) => setPasswordForm((prev) => ({ ...prev, currentPassword: event.target.value }))}
            placeholder={t('dashboard.settings.currentPassword')}
            className="h-10"
          />
          <Input
            type="password"
            aria-label={t('dashboard.settings.newPassword')}
            value={passwordForm.newPassword}
            onChange={(event) => setPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))}
            placeholder={t('dashboard.settings.newPassword')}
            className="h-10"
          />
          <Input
            type="password"
            aria-label={t('dashboard.settings.confirmPassword')}
            value={passwordForm.confirmPassword}
            onChange={(event) => setPasswordForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
            placeholder={t('dashboard.settings.confirmPassword')}
            className="h-10"
          />

          <div className="md:col-span-2 xl:col-span-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {passwordChecks.map((item) => (
              <div key={item.key} className="surface-muted px-3 py-2 text-xs">
                <p className={item.done ? 'font-semibold text-[var(--color-success)]' : 'font-semibold text-[var(--color-text-soft)]'}>
                  {item.done ? t('common.done', { defaultValue: 'Done' }) : t('common.pending', { defaultValue: 'Pending' })}
                </p>
                <p className="mt-1 text-[var(--color-text-muted)]">{item.label}</p>
              </div>
            ))}
          </div>

          <div className="md:col-span-2 xl:col-span-3">
            <Button
              type="submit"
              isLoading={isChangingPassword}
            >
              {t('dashboard.settings.updatePassword')}
            </Button>
          </div>
        </form>
      </section>

      <section className="surface p-5 sm:p-6">
        <h2 className="section-title mb-4">{t('dashboard.settings.devices2fa')}</h2>
        {settingsError ? <Alert type="danger" text={settingsError} /> : null}
        {settingsMessage ? <Alert type="success" text={settingsMessage} /> : null}

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <SettingToggle
            title={t('dashboard.settings.twoFactor')}
            hint={t('dashboard.settings.twoFactorHint')}
            checked={settings.twoFactorEnabled}
            onCheckedChange={(checked) => void saveSettingsPatch({ twoFactorEnabled: checked })}
            disabled={isSavingSettings}
            icon={<Smartphone className="h-4 w-4 text-[var(--color-text-soft)]" />}
            enabledLabel={t('dashboard.settings.alertsEnabled', { defaultValue: 'Enabled' })}
            disabledLabel={t('dashboard.settings.disabled', { defaultValue: 'Disabled' })}
          />

          <SettingToggle
            title={t('dashboard.settings.loginAlerts')}
            hint={t('dashboard.settings.loginAlertsHint')}
            checked={settings.loginAlertsEnabled}
            onCheckedChange={(checked) => void saveSettingsPatch({ loginAlertsEnabled: checked })}
            disabled={isSavingSettings}
            icon={<BellRing className="h-4 w-4 text-[var(--color-text-soft)]" />}
            enabledLabel={t('dashboard.settings.alertsEnabled', { defaultValue: 'Enabled' })}
            disabledLabel={t('dashboard.settings.disabled', { defaultValue: 'Disabled' })}
          />

          <SettingToggle
            title={t('dashboard.settings.notifications', { defaultValue: 'Notifications' })}
            hint={t('dashboard.settings.notificationsHint', { defaultValue: 'Enable in-app and Telegram notifications.' })}
            checked={settings.notificationsEnabled}
            onCheckedChange={(checked) => void saveSettingsPatch({ notificationsEnabled: checked })}
            disabled={isSavingSettings}
            icon={<BellRing className="h-4 w-4 text-[var(--color-text-soft)]" />}
            enabledLabel={t('dashboard.settings.alertsEnabled', { defaultValue: 'Enabled' })}
            disabledLabel={t('dashboard.settings.disabled', { defaultValue: 'Disabled' })}
          />

          <div id="telegram">
            <SettingToggle
              title="Telegram"
              hint={t('dashboard.settings.telegramHint', { defaultValue: 'Connect Telegram and receive instant updates.' })}
              checked={settings.telegramNotificationsEnabled}
              onCheckedChange={(checked) => void saveSettingsPatch({ telegramNotificationsEnabled: checked })}
              disabled={isSavingSettings}
              icon={<Smartphone className="h-4 w-4 text-[var(--color-text-soft)]" />}
              enabledLabel={t('dashboard.settings.alertsEnabled', { defaultValue: 'Enabled' })}
              disabledLabel={t('dashboard.settings.disabled', { defaultValue: 'Disabled' })}
              extra={
                <div className="space-y-2">
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {isLoadingTelegramStatus
                      ? t('common.loading', { defaultValue: 'Loading...' })
                      : telegramStatus?.linked
                        ? t('dashboard.settings.telegramLinked', {
                            defaultValue: `Linked: ${telegramStatus.chatIdMasked || 'chat connected'}`,
                          })
                        : t('dashboard.settings.telegramNotLinked', { defaultValue: 'Telegram not linked yet' })}
                  </p>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      onClick={() => void handleOpenTelegramLink()}
                      isLoading={isOpeningTelegramLink}
                      size="sm"
                    >
                      {telegramStatus?.linked
                        ? t('dashboard.settings.telegramRelink', { defaultValue: 'Перепривязать Telegram' })
                        : t('dashboard.settings.telegramLink', { defaultValue: 'Привязать Telegram' })}
                    </Button>

                    <Button
                      type="button"
                      onClick={() => void loadTelegramStatus()}
                      isLoading={isLoadingTelegramStatus}
                      variant="outline"
                      size="sm"
                    >
                      {t('dashboard.settings.telegramRefresh', { defaultValue: 'Проверить связь' })}
                    </Button>

                    {telegramStatus?.linked ? (
                      <Button
                        type="button"
                        onClick={() => void handleUnlinkTelegram()}
                        isLoading={isUnlinkingTelegram}
                        variant="destructive"
                        size="sm"
                      >
                        {t('dashboard.settings.telegramUnlink', { defaultValue: 'Отвязать Telegram' })}
                      </Button>
                    ) : null}
                  </div>
                </div>
              }
            />
          </div>
        </div>
      </section>

      <section className="surface p-5 sm:p-6">
        <h2 className="section-title mb-4">{t('dashboard.settings.account', { defaultValue: 'Account' })}</h2>

        <div className="rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
          <div className="mb-2 flex items-center gap-2">
            <Monitor className="h-4 w-4 text-[var(--color-text-soft)]" />
            <p className="text-sm font-semibold text-[var(--color-text)]">{t('dashboard.settings.activeSessions')}</p>
          </div>
          <div className="space-y-2 text-xs text-[var(--color-text-muted)]">
            <p>{t('dashboard.settings.currentSession')}</p>
            <p>{t('dashboard.settings.mobileSession')}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setSessionNotice(t('dashboard.settings.sessionsCleared'))}
            className="mt-3"
          >
            {t('dashboard.settings.closeOtherSessions')}
          </Button>
          {sessionNotice ? <p className="mt-2 text-xs text-[var(--color-success)]">{sessionNotice}</p> : null}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
          <form onSubmit={handleChangeEmail} className="rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
            <p className="text-sm font-semibold text-[var(--color-text)]">{t('dashboard.settings.changeEmail', { defaultValue: 'Change email' })}</p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              {t('dashboard.settings.changeEmailHint', { defaultValue: 'Confirm with current password.' })}
            </p>
            <div className="mt-3 space-y-2">
              <Input
                type="email"
                aria-label={t('dashboard.settings.newEmail', { defaultValue: 'New email' })}
                value={emailForm.newEmail}
                onChange={(event) => setEmailForm((prev) => ({ ...prev, newEmail: event.target.value }))}
                placeholder={t('dashboard.settings.newEmail', { defaultValue: 'New email' })}
                className="h-10"
              />
              <Input
                type="password"
                aria-label={t('dashboard.settings.currentPassword')}
                value={emailForm.currentPassword}
                onChange={(event) => setEmailForm((prev) => ({ ...prev, currentPassword: event.target.value }))}
                placeholder={t('dashboard.settings.currentPassword')}
                className="h-10"
              />
            </div>
            <Button
              type="submit"
              isLoading={isChangingEmail}
              className="mt-3"
              size="sm"
            >
              {t('dashboard.settings.changeEmail', { defaultValue: 'Change email' })}
            </Button>
            {emailError ? <p className="mt-2 text-xs text-[var(--color-danger)]">{emailError}</p> : null}
            {emailMessage ? <p className="mt-2 text-xs text-[var(--color-success)]">{emailMessage}</p> : null}
          </form>

          <div className="rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--color-danger)_35%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] p-4">
            <p className="text-sm font-semibold text-[var(--color-danger)]">{t('dashboard.settings.deleteAccount', { defaultValue: 'Delete account' })}</p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              {t('dashboard.settings.deleteAccountHint', { defaultValue: 'This action is irreversible.' })}
            </p>
            <Button
              type="button"
              onClick={() => {
                setDeleteError(null);
                setDeletePassword('');
                setIsDeleteModalOpen(true);
              }}
              variant="destructive"
              size="sm"
              className="mt-3"
            >
              {t('dashboard.settings.deleteAccount', { defaultValue: 'Delete account' })}
            </Button>
          </div>
        </div>
      </section>

      <section className="surface p-5 sm:p-6">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-[var(--color-text)]">
          <Wallet className="h-5 w-5" />
          {t('dashboard.settings.finance')}
        </h2>

        {financeError && <Alert type="danger" text={financeError} />}

        {isLoadingFinance ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="surface-muted p-4">
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="mt-2 h-6 w-28" />
              </div>
            ))}
          </div>
        ) : (
          <>
            {user.role === 'CLIENT' && clientStats && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <FinanceCard label={t('common.active')} value={clientStats.activeOrders.toString()} />
                <FinanceCard label={t('common.completed')} value={clientStats.completedOrders.toString()} />
                <FinanceCard label={t('common.spent')} value={formatMoneyKGS(clientStats.totalSpent, i18n.language)} />
                <FinanceCard label={t('common.inEscrow')} value={formatMoneyKGS(clientStats.inEscrow, i18n.language)} />
              </div>
            )}

            {user.role === 'FREELANCER' && freelancerStats && balance && (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <FinanceCard label={t('common.available')} value={formatMoneyKGS(balance.available, i18n.language)} />
                  <FinanceCard label={t('common.pending')} value={formatMoneyKGS(freelancerStats.pendingAmount, i18n.language)} />
                  <FinanceCard label={t('common.earned')} value={formatMoneyKGS(freelancerStats.totalEarnings, i18n.language)} />
                  <FinanceCard label={t('dashboard.settings.rating')} value={freelancerStats.rating.toFixed(1)} />
                </div>

                <form onSubmit={handleWithdraw} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
                  <Input
                    type="number"
                    aria-label={t('dashboard.settings.withdrawAmount')}
                    value={withdrawAmount}
                    onChange={(event) => setWithdrawAmount(event.target.value)}
                    min={1000}
                    placeholder={t('dashboard.settings.withdrawAmount')}
                    className="h-10"
                  />

                  <select
                    value={withdrawMethod}
                    onChange={(event) => setWithdrawMethod(event.target.value as PaymentMethodId)}
                    aria-label={t('dashboard.settings.withdrawMethod', { defaultValue: 'Withdrawal method' })}
                    className={inputClassName()}
                  >
                    {(methods.length > 0 ? methods : [{ id: 'mbank', name: 'MBank' } as PaymentMethod]).map((method) => (
                      <option key={method.id} value={method.id}>
                        {method.name}
                      </option>
                    ))}
                  </select>

                  <Input
                    aria-label={t('dashboard.settings.withdrawDetails')}
                    value={withdrawDetails}
                    onChange={(event) => setWithdrawDetails(event.target.value)}
                    placeholder={t('dashboard.settings.withdrawDetails')}
                    className="h-10"
                  />

                  <Button
                    type="submit"
                    isLoading={isWithdrawing}
                    variant="secondary"
                    size="sm"
                    className="justify-center"
                  >
                    {t('dashboard.settings.withdraw')}
                  </Button>
                </form>

                {withdrawError && <Alert type="danger" text={withdrawError} />}
                {withdrawMessage && <Alert type="success" text={withdrawMessage} />}
              </>
            )}

            <div className="mt-6">
              <h3 className="mb-2 text-sm font-semibold text-[var(--color-text)]">{t('dashboard.settings.latestTransactions')}</h3>
              <DataTable
                columns={transactionColumns}
                data={transactions}
                rowKey={(tx) => tx.id}
                isLoading={isLoadingFinance}
                ariaLabel={t('dashboard.settings.latestTransactions')}
                emptyTitle={t('dashboard.settings.noTransactions', { defaultValue: 'No transactions yet' })}
                emptyDescription={t('dashboard.settings.noTransactionsHint', { defaultValue: 'New transactions will appear here.' })}
              />
            </div>
          </>
        )}
      </section>

      {isDeleteModalOpen ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 px-4">
          <form
            onSubmit={handleDeleteAccount}
            className="surface w-full max-w-md p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
          >
            <h3 className="text-lg font-semibold text-[var(--color-text)]">
              <span id="delete-account-title">
              {t('dashboard.settings.deleteAccount', { defaultValue: 'Delete account' })}
              </span>
            </h3>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              {t('dashboard.settings.deleteConfirm', { defaultValue: 'Enter your password to confirm account deletion.' })}
            </p>

            <Input
              type="password"
              aria-label={t('dashboard.settings.currentPassword')}
              value={deletePassword}
              onChange={(event) => setDeletePassword(event.target.value)}
              placeholder={t('dashboard.settings.currentPassword')}
              className="mt-4 h-10"
            />

            {deleteError ? (
              <p className="mt-2 text-xs text-[var(--color-danger)]">{deleteError}</p>
            ) : null}

            <div className="mt-5 flex items-center justify-end gap-2">
              <Button
                type="button"
                disabled={isDeletingAccount}
                onClick={() => setIsDeleteModalOpen(false)}
                variant="outline"
                size="sm"
              >
                {t('common.cancel', { defaultValue: 'Cancel' })}
              </Button>
              <Button
                type="submit"
                isLoading={isDeletingAccount}
                variant="destructive"
                size="sm"
              >
                {t('dashboard.settings.deleteAccount', { defaultValue: 'Delete account' })}
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </DashboardShell>
  );
}

function FinanceCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-muted p-4">
      <p className="text-xs text-[var(--color-text-soft)]">{label}</p>
      <p className="mt-1 text-lg font-semibold text-[var(--color-text)]">{value}</p>
    </div>
  );
}

function inputClassName() {
  return 'h-10 w-full rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 text-sm text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-ring)]';
}

function Alert({ type, text }: { type: 'danger' | 'success'; text: string }) {
  if (type === 'danger') {
    return (
      <div className="mb-4 rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--color-danger)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_12%,transparent)] px-4 py-3 text-sm text-[var(--color-danger)]">
        {text}
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--color-success)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-success)_12%,transparent)] px-4 py-3 text-sm text-[var(--color-success)]">
      {text}
    </div>
  );
}
