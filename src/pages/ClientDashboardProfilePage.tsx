import { type ChangeEvent, type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Briefcase, Building2, CalendarDays, Mail, MapPin, Save, Upload, Wallet } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import api, { ClientWorkspaceProfile, Order, User } from '../services/api';
import { toAbsoluteAssetUrl } from '../utils/assetUrl';
import { DashboardShell } from '../components/dashboard/DashboardShell';
import { getClientSidebarItems } from '../components/dashboard/dashboardNav';
import { useTranslation } from 'react-i18next';
import { formatDate, formatMoneyKGS } from '../utils/locale';

const EMPTY_PROFILE: ClientWorkspaceProfile = {
  company: '',
  website: '',
  phone: '',
  industry: '',
  teamSize: '',
  billingEmail: '',
  taxId: '',
  address: '',
  city: '',
  country: 'Kyrgyzstan',
  about: '',
};

function getClientStats(orders: Order[]) {
  const active = orders.filter((order) => ['PENDING', 'ACTIVE', 'SUBMITTED'].includes(order.status)).length;
  const completed = orders.filter((order) => order.status === 'COMPLETED').length;
  const spent = orders
    .filter((order) => order.status === 'COMPLETED')
    .reduce((sum, order) => sum + order.budget, 0);

  return { active, completed, spent };
}

export function ClientDashboardProfilePage() {
  const { t, i18n } = useTranslation();
  const { isDark } = useTheme();
  const { user, logout, refreshUser } = useAuth();

  const [name, setName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [orders, setOrders] = useState<Order[]>([]);
  const [profile, setProfile] = useState<ClientWorkspaceProfile>(EMPTY_PROFILE);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const applyUser = useCallback((currentUser: User) => {
    setName(currentUser.name || '');
    setAvatarUrl(toAbsoluteAssetUrl(currentUser.avatar));
  }, []);

  const loadProfile = useCallback(async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      setError(null);

      const [refreshedUser, ordersResult, workspaceProfile] = await Promise.all([
        refreshUser(),
        api.getOrders({ limit: 50 }),
        api.getClientWorkspaceProfile(),
      ]);

      applyUser(refreshedUser || user);
      setOrders(ordersResult.data);
      setProfile(workspaceProfile);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('profile.client.loadFailed', { defaultValue: 'Failed to load client profile' })
      );
    } finally {
      setIsLoading(false);
    }
  }, [applyUser, refreshUser, t, user]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const stats = useMemo(() => getClientStats(orders), [orders]);

  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'CLIENT') return <Navigate to="/dashboard/freelancer/profile" replace />;

  const handleAvatarUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingAvatar(true);
      setError(null);
      setSuccess(null);

      await api.uploadAvatar(file);
      const refreshed = await refreshUser();
      if (refreshed) applyUser(refreshed);

      setSuccess(t('profile.client.avatarUpdated', { defaultValue: 'Avatar updated' }));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('profile.client.avatarUpdateFailed', { defaultValue: 'Failed to update avatar' })
      );
    } finally {
      setIsUploadingAvatar(false);
      event.target.value = '';
    }
  };

  const handleProfileChange = <K extends keyof ClientWorkspaceProfile>(
    field: K,
    value: ClientWorkspaceProfile[K]
  ) => {
    setProfile((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();

    if (trimmedName.length < 2) {
      setError(t('profile.common.nameMin', { defaultValue: 'Name must contain at least 2 characters' }));
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      setSuccess(null);

      await api.updateMyProfile({ name: trimmedName });
      const savedProfile = await api.updateClientWorkspaceProfile({
        ...profile,
        company: profile.company.trim(),
        website: profile.website.trim(),
        phone: profile.phone.trim(),
        industry: profile.industry.trim(),
        teamSize: profile.teamSize.trim(),
        billingEmail: profile.billingEmail.trim(),
        taxId: profile.taxId.trim(),
        address: profile.address.trim(),
        city: profile.city.trim(),
        country: profile.country.trim() || 'Kyrgyzstan',
        about: profile.about.trim(),
      });

      setProfile(savedProfile);

      const refreshed = await refreshUser();
      if (refreshed) applyUser(refreshed);

      setSuccess(t('profile.client.profileUpdated', { defaultValue: 'Client profile updated' }));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('profile.client.profileUpdateFailed', { defaultValue: 'Failed to update client profile' })
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <DashboardShell
      isDark={isDark}
      sidebarTitle={user.name || t('orders.create.clientFallback')}
      sidebarSubtitle={t('topbar.workspace')}
      sidebarItems={getClientSidebarItems()}
      onLogout={logout}
    >
      <section className="surface p-5 sm:p-6">
        <h1 className="text-2xl font-bold text-[var(--color-text)]">
          {t('profile.client.title', { defaultValue: 'Client profile' })}
        </h1>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">
          {t('profile.client.subtitle', {
            defaultValue: 'Manage company data, billing contacts and public workspace identity from one place.',
          })}
        </p>
      </section>

      {error ? <Alert type="danger" text={error} /> : null}
      {success ? <Alert type="success" text={success} /> : null}

      <section className="surface p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-[var(--color-text)]">
          {t('profile.common.avatar', { defaultValue: 'Avatar' })}
        </h2>
        <div className="mt-4 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <img
            src={avatarUrl || '/vite.svg'}
            alt={name || t('profile.common.avatarAlt', { defaultValue: 'Avatar' })}
            className="h-20 w-20 rounded-[var(--radius-control)] border border-[var(--color-border)] object-cover"
          />

          <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-sm font-semibold text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-2)]">
            <Upload className="h-4 w-4" />
            {isUploadingAvatar
              ? t('common.loading', { defaultValue: 'Loading...' })
              : t('profile.common.uploadAvatar', { defaultValue: 'Upload avatar' })}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              disabled={isUploadingAvatar}
              onChange={handleAvatarUpload}
            />
          </label>
        </div>
      </section>

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="surface p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-[var(--color-text)]">
            {t('profile.client.accountData', { defaultValue: 'Account data' })}
          </h2>

          <div className="mt-4 grid min-h-[132px] grid-cols-1 gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-[var(--color-text)]">
                {t('auth.name', { defaultValue: 'Name' })}
              </span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className={inputClassName()}
                placeholder={t('auth.placeholderName', { defaultValue: 'Your name' })}
                disabled={isLoading}
              />
            </label>

            <div className="space-y-2">
              <span className="text-sm font-medium text-[var(--color-text)]">
                {t('auth.email', { defaultValue: 'Email' })}
              </span>
              <div className={readonlyClassName()}>
                <Mail className="h-4 w-4" />
                <span>{user.email}</span>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-sm font-medium text-[var(--color-text)]">
                {t('profile.client.registeredAt', { defaultValue: 'Registered at' })}
              </span>
              <div className={readonlyClassName()}>
                <CalendarDays className="h-4 w-4" />
                <span>
                  {user.createdAt
                    ? formatDate(user.createdAt, i18n.language, { dateStyle: 'long' })
                    : t('profile.common.unknown', { defaultValue: 'Unknown' })}
                </span>
              </div>
            </div>

            <label className="space-y-2">
              <span className="text-sm font-medium text-[var(--color-text)]">
                {t('profile.client.company', { defaultValue: 'Company' })}
              </span>
              <input
                value={profile.company}
                onChange={(event) => handleProfileChange('company', event.target.value)}
                className={inputClassName()}
                placeholder={t('profile.client.companyPlaceholder', { defaultValue: 'OsOO Digital Studio' })}
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-[var(--color-text)]">
                {t('profile.client.industry', { defaultValue: 'Industry' })}
              </span>
              <input
                value={profile.industry}
                onChange={(event) => handleProfileChange('industry', event.target.value)}
                className={inputClassName()}
                placeholder={t('profile.client.industryPlaceholder', { defaultValue: 'IT, marketplace, media' })}
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-[var(--color-text)]">
                {t('profile.client.teamSize', { defaultValue: 'Team size' })}
              </span>
              <input
                value={profile.teamSize}
                onChange={(event) => handleProfileChange('teamSize', event.target.value)}
                className={inputClassName()}
                placeholder={t('profile.client.teamSizePlaceholder', { defaultValue: '11-50 employees' })}
              />
            </label>
          </div>
        </section>

        <section className="surface p-5 sm:p-6">
          <h2 className="mb-2 inline-flex items-center gap-2 text-lg font-semibold text-[var(--color-text)]">
            <Building2 className="h-5 w-5" />
            {t('profile.client.companyProfile', { defaultValue: 'Company workspace profile' })}
          </h2>
          <p className="text-sm text-[var(--color-text-muted)]">
            {t('profile.client.companyProfileHint', {
              defaultValue: 'These fields are stored on the server and can be reused across billing, documents and support flows.',
            })}
          </p>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-[var(--color-text)]">
                {t('profile.client.companySite', { defaultValue: 'Website' })}
              </span>
              <input
                value={profile.website}
                onChange={(event) => handleProfileChange('website', event.target.value)}
                className={inputClassName()}
                placeholder={t('profile.client.companySitePlaceholder', { defaultValue: 'https://company.kg' })}
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-[var(--color-text)]">
                {t('profile.client.phone', { defaultValue: 'Phone' })}
              </span>
              <input
                value={profile.phone}
                onChange={(event) => handleProfileChange('phone', event.target.value)}
                className={inputClassName()}
                placeholder={t('profile.client.phonePlaceholder', { defaultValue: '+996 700 00 00 00' })}
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-[var(--color-text)]">
                {t('profile.client.billingEmail', { defaultValue: 'Billing email' })}
              </span>
              <input
                value={profile.billingEmail}
                onChange={(event) => handleProfileChange('billingEmail', event.target.value)}
                className={inputClassName()}
                placeholder={user.email}
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-[var(--color-text)]">
                {t('profile.client.taxId', { defaultValue: 'Tax ID / BIN' })}
              </span>
              <input
                value={profile.taxId}
                onChange={(event) => handleProfileChange('taxId', event.target.value)}
                className={inputClassName()}
                placeholder="12345678910123"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-[var(--color-text)]">
                {t('profile.client.city', { defaultValue: 'City' })}
              </span>
              <input
                value={profile.city}
                onChange={(event) => handleProfileChange('city', event.target.value)}
                className={inputClassName()}
                placeholder={t('profile.client.cityPlaceholder', { defaultValue: 'Bishkek' })}
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-[var(--color-text)]">
                {t('profile.client.country', { defaultValue: 'Country' })}
              </span>
              <input
                value={profile.country}
                onChange={(event) => handleProfileChange('country', event.target.value)}
                className={inputClassName()}
                placeholder={t('profile.client.countryPlaceholder', { defaultValue: 'Kyrgyzstan' })}
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium text-[var(--color-text)]">
                {t('profile.client.address', { defaultValue: 'Address' })}
              </span>
              <input
                value={profile.address}
                onChange={(event) => handleProfileChange('address', event.target.value)}
                className={inputClassName()}
                placeholder={t('profile.client.addressPlaceholder', { defaultValue: '109 Chui Avenue, office 4' })}
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium text-[var(--color-text)]">
                {t('profile.client.about', { defaultValue: 'About company' })}
              </span>
              <textarea
                value={profile.about}
                onChange={(event) => handleProfileChange('about', event.target.value)}
                className={textareaClassName()}
                rows={5}
                placeholder={t('profile.client.aboutPlaceholder', {
                  defaultValue: 'Describe your company, current hiring needs and the type of freelancers you work with.',
                })}
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={isLoading || isSaving}
            className="mt-6 inline-flex h-10 items-center gap-2 rounded-[var(--radius-control)] bg-[var(--color-primary)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {isSaving
              ? t('profile.common.saving', { defaultValue: 'Saving...' })
              : t('common.save', { defaultValue: 'Save' })}
          </button>
        </section>
      </form>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatsCard
          label={t('profile.client.activeOrders', { defaultValue: 'Active orders' })}
          value={stats.active.toString()}
          icon={<Briefcase className="h-4 w-4" />}
        />
        <StatsCard
          label={t('common.completed', { defaultValue: 'Completed' })}
          value={stats.completed.toString()}
          icon={<Briefcase className="h-4 w-4" />}
        />
        <StatsCard
          label={t('common.spent', { defaultValue: 'Spent' })}
          value={formatMoneyKGS(stats.spent, i18n.language)}
          icon={<Wallet className="h-4 w-4" />}
        />
      </section>

      <section className="surface p-5 sm:p-6">
        <h2 className="mb-3 inline-flex items-center gap-2 text-lg font-semibold text-[var(--color-text)]">
          <MapPin className="h-5 w-5" />
          {t('profile.client.workspaceShortcuts', { defaultValue: 'Workspace shortcuts' })}
        </h2>
        <div className="flex flex-wrap gap-3 text-sm">
          <Link to="/dashboard/client/messages" className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 font-semibold text-[var(--color-text)]">
            {t('profile.client.goMessages', { defaultValue: 'Messages' })}
          </Link>
          <Link to="/dashboard/client/finance" className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 font-semibold text-[var(--color-text)]">
            {t('finance.client.title', { defaultValue: 'Finance' })}
          </Link>
          <Link to="/dashboard/client/billing" className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 font-semibold text-[var(--color-text)]">
            {t('profile.client.goBilling', { defaultValue: 'Cards and wallets' })}
          </Link>
          <Link to="/dashboard/client/documents" className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 font-semibold text-[var(--color-text)]">
            {t('profile.client.goDocuments', { defaultValue: 'Documents' })}
          </Link>
          <Link to="/dashboard/client/support" className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 font-semibold text-[var(--color-text)]">
            {t('profile.client.goSupport', { defaultValue: 'Support center' })}
          </Link>
        </div>
      </section>
    </DashboardShell>
  );
}

function StatsCard({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="surface p-4">
      <div className="flex items-center gap-2">
        <div className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-primary)]">
          {icon}
        </div>
        <div>
          <p className="text-xs text-[var(--color-text-soft)]">{label}</p>
          <p className="font-semibold text-[var(--color-text)]">{value}</p>
        </div>
      </div>
    </div>
  );
}

function inputClassName() {
  return 'h-10 w-full rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 text-sm text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-ring)] disabled:opacity-70';
}

function textareaClassName() {
  return 'w-full rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-3 text-sm text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-ring)]';
}

function readonlyClassName() {
  return 'flex h-10 w-full items-center gap-2 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 text-sm text-[var(--color-text-muted)]';
}

function Alert({ type, text }: { type: 'danger' | 'success'; text: string }) {
  if (type === 'danger') {
    return (
      <div className="rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--color-danger)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_12%,transparent)] px-4 py-3 text-sm text-[var(--color-danger)]">
        {text}
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--color-success)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-success)_12%,transparent)] px-4 py-3 text-sm text-[var(--color-success)]">
      {text}
    </div>
  );
}
