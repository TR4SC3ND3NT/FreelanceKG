import { type ChangeEvent, type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { FileCheck2, Lock, Save, ShieldCheck, Trash2, Upload } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import api, { User } from '../services/api';
import { DashboardShell } from '../components/dashboard/DashboardShell';
import { toAbsoluteAssetUrl } from '../utils/assetUrl';
import { getFreelancerSidebarItems } from '../components/dashboard/dashboardNav';
import { useTranslation } from 'react-i18next';

const CATEGORY_OPTIONS = [
  { value: 'development' },
  { value: 'design' },
  { value: 'marketing' },
  { value: 'copywriting' },
  { value: 'video' },
  { value: 'translation' },
] as const;

interface ProfileFormState {
  name: string;
  bio: string;
  skills: string;
  category: string;
  hourlyRate: string;
}

interface PortfolioItemDraft {
  id: string;
  title: string;
  description?: string;
  imageUrl: string;
}

const DEFAULT_FORM: ProfileFormState = {
  name: '',
  bio: '',
  skills: '',
  category: '',
  hourlyRate: '',
};

function extractFormState(currentUser: User): ProfileFormState {
  return {
    name: currentUser.name || '',
    bio: currentUser.freelancerProfile?.bio || '',
    skills: (currentUser.freelancerProfile?.skills || []).join(', '),
    category: currentUser.freelancerProfile?.category || '',
    hourlyRate: currentUser.freelancerProfile?.hourlyRate ? String(Math.round(currentUser.freelancerProfile.hourlyRate)) : '',
  };
}

function parseSkills(value: string): string[] {
  return value
    .split(',')
    .map((skill) => skill.trim())
    .filter(Boolean);
}

function parsePortfolio(raw: unknown): PortfolioItemDraft[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null;
      const source = item as Record<string, unknown>;
      const imageUrl = typeof source.imageUrl === 'string' ? source.imageUrl : typeof source.image === 'string' ? source.image : '';
      if (!imageUrl) return null;

      return {
        id: typeof source.id === 'string' ? source.id : `portfolio-${index}`,
        title: typeof source.title === 'string' ? source.title : `Work ${index + 1}`,
        description: typeof source.description === 'string' ? source.description : undefined,
        imageUrl,
      };
    })
    .filter(Boolean) as PortfolioItemDraft[];
}

export function FreelancerDashboardProfilePage() {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const { user, logout, refreshUser } = useAuth();

  const [form, setForm] = useState<ProfileFormState>(DEFAULT_FORM);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItemDraft[]>([]);
  const [portfolioError, setPortfolioError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingPortfolio, setIsUploadingPortfolio] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const applyUser = useCallback((currentUser: User) => {
    setForm(extractFormState(currentUser));
    setAvatarUrl(toAbsoluteAssetUrl(currentUser.avatar));
    setPortfolioItems(parsePortfolio(currentUser.freelancerProfile?.portfolio));
  }, []);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const refreshed = await refreshUser();
        if (refreshed) applyUser(refreshed);
      } catch (err) {
        setError(err instanceof Error ? err.message : t('profile.freelancer.loadFailed'));
      } finally {
        setIsLoading(false);
      }
    };

    void loadProfile();
  }, [applyUser, refreshUser, t]);

  const sidebarItems = getFreelancerSidebarItems();
  const skillsPreview = useMemo(() => parseSkills(form.skills), [form.skills]);

  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'FREELANCER') return <Navigate to="/dashboard/client" replace />;

  const onAvatarUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingAvatar(true);
      setError(null);
      setSuccess(null);

      await api.uploadAvatar(file);
      const refreshed = await refreshUser();
      if (refreshed) applyUser(refreshed);

      setSuccess(t('profile.freelancer.avatarUpdated'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('profile.freelancer.avatarUpdateFailed'));
    } finally {
      setIsUploadingAvatar(false);
      event.target.value = '';
    }
  };

  const onPortfolioUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';

    if (files.length === 0) return;

    const remainingSlots = Math.max(0, 5 - portfolioItems.length);
    if (remainingSlots === 0) {
      setPortfolioError(t('profile.freelancer.portfolioLimit', { defaultValue: 'Maximum 5 works in portfolio' }));
      return;
    }

    const uploadQueue = files.slice(0, remainingSlots);

    try {
      setPortfolioError(null);
      setIsUploadingPortfolio(true);

      const uploaded: PortfolioItemDraft[] = [];

      for (const file of uploadQueue) {
        const result = await api.uploadFile(file);
        uploaded.push({
          id: `portfolio-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          title: file.name.replace(/\.[^/.]+$/, ''),
          imageUrl: result.url,
        });
      }

      setPortfolioItems((prev) => [...prev, ...uploaded]);
    } catch (err) {
      setPortfolioError(err instanceof Error ? err.message : t('profile.freelancer.portfolioUploadFailed', { defaultValue: 'Failed to upload portfolio image' }));
    } finally {
      setIsUploadingPortfolio(false);
    }
  };

  const removePortfolioItem = (portfolioId: string) => {
    setPortfolioItems((prev) => prev.filter((item) => item.id !== portfolioId));
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const name = form.name.trim();
    const bio = form.bio.trim();
    const skills = parseSkills(form.skills);
    const hourlyRate = form.hourlyRate ? Number(form.hourlyRate) : undefined;

    if (name.length < 2) {
      setError(t('profile.common.nameMin'));
      return;
    }

    if (bio.length > 0 && bio.length < 10) {
      setError(t('profile.freelancer.bioMin'));
      return;
    }

    if (hourlyRate !== undefined && Number.isNaN(hourlyRate)) {
      setError(t('profile.freelancer.rateNumber'));
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      setSuccess(null);

      await api.updateFreelancerProfile({
        name,
        bio: bio || undefined,
        skills: skills.length > 0 ? skills : undefined,
        category: form.category || undefined,
        hourlyRate,
        portfolio: portfolioItems.map((item) => ({
          id: item.id,
          title: item.title || 'Project',
          description: item.description,
          imageUrl: item.imageUrl,
        })),
      });

      const refreshed = await refreshUser();
      if (refreshed) applyUser(refreshed);
      setSuccess(t('profile.freelancer.profileSaved'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('profile.freelancer.profileSaveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <DashboardShell
      isDark={isDark}
      sidebarTitle={user.name || t('dashboard.freelancer.title')}
      sidebarSubtitle={t('topbar.workspace')}
      sidebarItems={sidebarItems}
      onLogout={logout}
    >
      <section className="surface p-5 sm:p-6">
        <h1 className="text-2xl font-bold text-[var(--color-text)]">{t('profile.freelancer.title')}</h1>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">{t('profile.freelancer.subtitle')}</p>
      </section>

      {error && <Alert type="danger" text={error} />}
      {success && <Alert type="success" text={success} />}

      <form onSubmit={onSubmit} className="space-y-6">
        <section className="surface p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-[var(--color-text)]">{t('profile.common.avatar')}</h2>

          <div className="mt-4 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <img src={avatarUrl || '/vite.svg'} alt={form.name || t('profile.common.avatarAlt')} className="h-20 w-20 rounded-[var(--radius-control)] border border-[var(--color-border)] object-cover" />

            <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-sm font-semibold text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-2)]">
              <Upload className="h-4 w-4" />
              {isUploadingAvatar ? t('common.loading') : t('profile.common.uploadAvatar')}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                disabled={isUploadingAvatar}
                onChange={onAvatarUpload}
              />
            </label>
          </div>
        </section>

        <section className="surface p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-[var(--color-text)]">{t('profile.freelancer.publicData')}</h2>

          <div className="mt-4 grid min-h-[224px] grid-cols-1 gap-4 md:grid-cols-2">
            <Field label={t('auth.name')}>
              <input
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder={t('auth.placeholderName')}
                className={inputClassName()}
                disabled={isLoading}
              />
            </Field>

            <Field label={t('orders.create.category')}>
              <select
                value={form.category}
                onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
                className={inputClassName()}
                disabled={isLoading}
              >
                <option value="">{t('orders.create.categoryPlaceholder')}</option>
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(`categories.${option.value}`)}
                  </option>
                ))}
              </select>
            </Field>

            <Field label={t('profile.freelancer.hourlyRate')}>
              <input
                type="number"
                min={100}
                max={100000}
                value={form.hourlyRate}
                onChange={(event) => setForm((prev) => ({ ...prev, hourlyRate: event.target.value }))}
                placeholder={t('profile.freelancer.hourlyRatePlaceholder')}
                className={inputClassName()}
                disabled={isLoading}
              />
            </Field>

            <Field label={t('profile.freelancer.skills')}>
              <input
                value={form.skills}
                onChange={(event) => setForm((prev) => ({ ...prev, skills: event.target.value }))}
                placeholder={t('profile.freelancer.skillsPlaceholder')}
                className={inputClassName()}
                disabled={isLoading}
              />
            </Field>

            <div className="md:col-span-2">
              <Field label={t('profile.freelancer.bio')}>
                <textarea
                  value={form.bio}
                  onChange={(event) => setForm((prev) => ({ ...prev, bio: event.target.value }))}
                  rows={5}
                  placeholder={t('profile.freelancer.bioPlaceholder')}
                  className={`${inputClassName()} h-auto py-2.5`}
                  disabled={isLoading}
                />
              </Field>
            </div>
          </div>

          {skillsPreview.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {skillsPreview.map((skill) => (
                <span
                  key={skill}
                  className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-1 text-xs font-semibold text-[var(--color-text-muted)]"
                >
                  {skill}
                </span>
              ))}
            </div>
          )}

          <div className="mt-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-[var(--color-text)]">
                  {t('profile.freelancer.myWorks', { defaultValue: 'Мои работы' })}
                </h3>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                  {t('profile.freelancer.myWorksHint', { defaultValue: 'Upload up to 5 images to show your experience.' })}
                </p>
              </div>
              <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-xs font-semibold text-[var(--color-text)] hover:bg-[var(--color-surface-2)]">
                <Upload className="h-3.5 w-3.5" />
                {isUploadingPortfolio
                  ? t('common.loading')
                  : t('profile.freelancer.uploadWork', { defaultValue: 'Upload image' })}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  multiple
                  className="hidden"
                  disabled={isUploadingPortfolio || portfolioItems.length >= 5}
                  onChange={onPortfolioUpload}
                />
              </label>
            </div>

            {portfolioError ? (
              <p className="mt-3 rounded-[10px] border border-[color-mix(in_srgb,var(--color-danger)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_12%,transparent)] px-3 py-2 text-xs text-[var(--color-danger)]">
                {portfolioError}
              </p>
            ) : null}

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {portfolioItems.map((item) => (
                <article
                  key={item.id}
                  className="overflow-hidden rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)]"
                >
                  <div className="relative aspect-video">
                    <img
                      src={toAbsoluteAssetUrl(item.imageUrl) || '/vite.svg'}
                      alt={item.title}
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removePortfolioItem(item.id)}
                      className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-[8px] border border-white/30 bg-black/45 text-white"
                      aria-label={t('common.remove', { defaultValue: 'Remove' })}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="p-3">
                    <p className="truncate text-xs font-semibold text-[var(--color-text)]">{item.title}</p>
                  </div>
                </article>
              ))}

              {portfolioItems.length === 0 ? (
                <div className="rounded-[var(--radius-control)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-6 text-center text-xs text-[var(--color-text-soft)] sm:col-span-2 xl:col-span-3">
                  {t('profile.freelancer.noPortfolio', { defaultValue: 'No uploaded works yet.' })}
                </div>
              ) : null}
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || isSaving}
            className="mt-6 inline-flex h-10 items-center gap-2 rounded-[var(--radius-control)] bg-[var(--color-primary)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {isSaving ? t('profile.common.saving') : t('common.save')}
          </button>
        </section>
      </form>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article className="surface p-5 sm:p-6">
          <h2 className="mb-2 inline-flex items-center gap-2 text-lg font-semibold text-[var(--color-text)]">
            <ShieldCheck className="h-5 w-5" />
            {t('profile.freelancer.verification')}
          </h2>
          <p className="text-sm text-[var(--color-text-muted)]">
            {t('profile.freelancer.verificationHint')}
          </p>
          <Link
            to="/dashboard/freelancer/resume"
            className="mt-4 inline-flex h-10 items-center rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 text-sm font-semibold text-[var(--color-text)]"
          >
            {t('common.resume')}
          </Link>
        </article>

        <article className="surface p-5 sm:p-6">
          <h2 className="mb-2 inline-flex items-center gap-2 text-lg font-semibold text-[var(--color-text)]">
            <Lock className="h-5 w-5" />
            {t('dashboard.settings.security')}
          </h2>
          <p className="text-sm text-[var(--color-text-muted)]">
            {t('profile.freelancer.securityHint')}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to="/dashboard/freelancer/settings"
              className="inline-flex h-10 items-center rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 text-sm font-semibold text-[var(--color-text)]"
            >
              {t('profile.freelancer.securityCenter')}
            </Link>
            <Link
              to="/dashboard/freelancer/documents"
              className="inline-flex h-10 items-center gap-1.5 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 text-sm font-semibold text-[var(--color-text)]"
            >
              <FileCheck2 className="h-4 w-4" />
              {t('common.documents')}
            </Link>
          </div>
        </article>
      </section>
    </DashboardShell>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-[var(--color-text)]">{label}</span>
      {children}
    </label>
  );
}

function inputClassName() {
  return 'h-10 w-full rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 text-sm text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-ring)] disabled:opacity-70';
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
