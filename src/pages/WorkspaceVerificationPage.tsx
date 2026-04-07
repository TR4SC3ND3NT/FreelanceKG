import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { BadgeCheck, Building2, FileBadge2, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import api, { WorkspaceVerificationCheck, WorkspaceVerificationProfile } from '@/services/api';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { getClientSidebarItems, getFreelancerSidebarItems } from '@/components/dashboard/dashboardNav';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ActivityFeedList, MetricTrendCard, type Tone } from '@/components/dashboard/WorkspaceInsights';
import { WORKSPACE_PATH } from '@/utils/routes';
import { formatDateTime } from '@/utils/locale';

const FALLBACK_VERIFICATION: WorkspaceVerificationProfile = {
  status: 'UNDER_REVIEW',
  level: 'BUSINESS',
  ownerName: 'Workspace owner',
  legalEntityName: 'FreelanceKG Demo Workspace',
  country: 'Kyrgyzstan',
  documentType: 'Business certificate',
  documentNumberMasked: '•••• 2841',
  riskLevel: 'LOW',
  submittedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
  approvedAt: undefined,
  nextStep: 'Primary business document uploaded. Payout ownership proof attached and waiting for final compliance review.',
  checks: [
    { id: 'identity', title: 'Identity owner', status: 'APPROVED', updatedAt: new Date().toISOString() },
    { id: 'business', title: 'Business registration', status: 'UNDER_REVIEW', updatedAt: new Date().toISOString() },
    { id: 'bank', title: 'Payout ownership', status: 'APPROVED', updatedAt: new Date().toISOString() },
  ],
};

function verificationTone(status: WorkspaceVerificationCheck['status']): Tone {
  if (status === 'APPROVED') return 'success';
  if (status === 'UNDER_REVIEW') return 'warning';
  if (status === 'REQUIRES_UPDATE') return 'danger';
  return 'info';
}

export function WorkspaceVerificationPage() {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const { user, logout } = useAuth();
  const [verification, setVerification] = useState<WorkspaceVerificationProfile>(FALLBACK_VERIFICATION);
  const [notesText, setNotesText] = useState(FALLBACK_VERIFICATION.nextStep);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isWorkspaceUser = user?.role === 'CLIENT' || user?.role === 'FREELANCER';
  const isFreelancer = user?.role === 'FREELANCER';
  const sidebarItems = useMemo(
    () => (isFreelancer ? getFreelancerSidebarItems() : getClientSidebarItems()),
    [isFreelancer]
  );

  const loadVerification = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await api.getWorkspaceVerification();
      setVerification(result);
      setNotesText(result.nextStep);
    } catch (err) {
      setVerification(FALLBACK_VERIFICATION);
      setNotesText(FALLBACK_VERIFICATION.nextStep);
      setError(err instanceof Error ? err.message : t('verification.loadFailed', { defaultValue: 'Failed to load verification profile' }));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadVerification();
  }, [loadVerification]);

  const completedChecks = verification.checks.filter((item) => item.status === 'APPROVED').length;

  const saveVerification = async (nextStatus?: WorkspaceVerificationProfile['status']) => {
    try {
      setIsSaving(true);
      setError(null);
      setSuccess(null);
      const payload: WorkspaceVerificationProfile = {
        ...verification,
        status: nextStatus || verification.status,
        nextStep: notesText.trim() || verification.nextStep,
        submittedAt:
          nextStatus === 'UNDER_REVIEW' && !verification.submittedAt
            ? new Date().toISOString()
            : verification.submittedAt,
      };
      const updated = await api.updateWorkspaceVerification(payload);
      setVerification(updated);
      setNotesText(updated.nextStep);
      setSuccess(t('verification.saved', { defaultValue: 'Verification profile updated' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('verification.saveFailed', { defaultValue: 'Failed to save verification profile' }));
    } finally {
      setIsSaving(false);
    }
  };

  const updateCheckStatus = (check: WorkspaceVerificationCheck, status: WorkspaceVerificationCheck['status']) => {
    setVerification((prev) => ({
      ...prev,
      checks: prev.checks.map((item) =>
        item.id === check.id
          ? {
              ...item,
              status,
              updatedAt: new Date().toISOString(),
            }
          : item
      ),
    }));
  };

  const checksFeed = verification.checks.map((item) => ({
    id: item.id,
    title: item.title,
    subtitle: item.note,
    meta: item.updatedAt ? formatDateTime(item.updatedAt, 'ru') : undefined,
    badge: item.status,
    tone: verificationTone(item.status),
  }));

  if (!user) return <Navigate to="/login" replace />;
  if (!isWorkspaceUser) return <Navigate to={WORKSPACE_PATH} replace />;

  return (
    <DashboardShell
      isDark={isDark}
      sidebarTitle={user.name || t('topbar.user', { defaultValue: 'User' })}
      sidebarSubtitle={t('verification.subtitle', { defaultValue: 'KYC and compliance lane' })}
      sidebarItems={sidebarItems}
      onLogout={logout}
    >
      <PageHeader
        title={t('verification.title', { defaultValue: 'Verification center' })}
        subtitle={t('verification.pageSubtitle', {
          defaultValue: 'Coordinate identity, business, payout and compliance checks in a realistic KYC workflow.',
        })}
        badges={
          <>
            <Badge variant={verification.status === 'VERIFIED' ? 'success' : verification.status === 'UNDER_REVIEW' ? 'warning' : 'info'}>
              {verification.status}
            </Badge>
            <Badge variant="info">{verification.level}</Badge>
          </>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => void saveVerification('UNDER_REVIEW')}>
              {t('verification.submitReview', { defaultValue: 'Submit for review' })}
            </Button>
            <Button type="button" isLoading={isSaving} onClick={() => void saveVerification()}>
              {t('common.save', { defaultValue: 'Save' })}
            </Button>
          </div>
        }
      />

      {error ? (
        <div className="rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--color-danger)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_12%,transparent)] px-4 py-3 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--color-success)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-success)_12%,transparent)] px-4 py-3 text-sm text-[var(--color-success)]">
          {success}
        </div>
      ) : null}

      <section className="surface-glow p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-soft)]">
              {t('verification.heroKicker', { defaultValue: 'Compliance orchestration lane' })}
            </p>
            <h2 className="mt-2 font-[var(--font-family-display)] text-[clamp(1.6rem,2.8vw,2.25rem)] font-semibold leading-[1.04] tracking-[-0.04em] text-[var(--color-text)]">
              {t('verification.heroTitle', { defaultValue: 'Make trust, KYC and payout validation feel like part of a serious platform.' })}
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-[var(--color-text-muted)]">
              {t('verification.heroText', { defaultValue: 'This workspace shows a believable compliance flow with clear ownership, status progression and next-step guidance.' })}
            </p>
          </div>

          <div className="grid w-full max-w-md grid-cols-2 gap-3">
            <div className="rounded-[18px] border border-[color-mix(in_srgb,var(--color-success)_24%,transparent)] bg-[color-mix(in_srgb,var(--color-success)_10%,transparent)] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-soft)]">{t('verification.completedChecks', { defaultValue: 'Completed checks' })}</p>
              <p className="mt-2 text-lg font-semibold text-[var(--color-text)]">{completedChecks}/{verification.checks.length}</p>
            </div>
            <div className="rounded-[18px] border border-[color-mix(in_srgb,var(--color-primary)_24%,transparent)] bg-[color-mix(in_srgb,var(--color-primary)_10%,transparent)] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-soft)]">{t('verification.level', { defaultValue: 'Level' })}</p>
              <p className="mt-2 text-lg font-semibold text-[var(--color-text)]">{verification.level}</p>
            </div>
            <div className="rounded-[18px] border border-[color-mix(in_srgb,var(--color-info)_24%,transparent)] bg-[color-mix(in_srgb,var(--color-info)_10%,transparent)] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-soft)]">{t('verification.documentType', { defaultValue: 'Document type' })}</p>
              <p className="mt-2 text-lg font-semibold text-[var(--color-text)]">{verification.documentType}</p>
            </div>
            <div className="rounded-[18px] border border-[color-mix(in_srgb,var(--color-warning)_24%,transparent)] bg-[color-mix(in_srgb,var(--color-warning)_10%,transparent)] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-soft)]">{t('verification.status', { defaultValue: 'Status' })}</p>
              <p className="mt-2 text-lg font-semibold text-[var(--color-text)]">{verification.status}</p>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-[18px] border border-[color-mix(in_srgb,var(--color-border)_66%,transparent)] bg-[color-mix(in_srgb,var(--color-surface)_74%,transparent)] px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-soft)]">{t('verification.nextSteps', { defaultValue: 'Next step' })}</p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--color-text)]">{verification.nextStep}</p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricTrendCard label={t('verification.level', { defaultValue: 'Level' })} value={verification.level} icon={BadgeCheck} tone="primary" trend={[1, 1, 2, 2, 2, 3]} />
        <MetricTrendCard label={t('verification.completedChecks', { defaultValue: 'Completed checks' })} value={`${completedChecks}/${verification.checks.length}`} icon={ShieldCheck} tone="success" trend={[1, 1, 2, 2, completedChecks, completedChecks]} />
        <MetricTrendCard label={t('verification.riskLevel', { defaultValue: 'Risk level' })} value={verification.riskLevel} icon={Building2} tone={verification.riskLevel === 'LOW' ? 'success' : verification.riskLevel === 'MEDIUM' ? 'warning' : 'danger'} trend={[3, 2, 2, 1, 1, verification.riskLevel === 'LOW' ? 1 : 3]} />
        <MetricTrendCard label={t('verification.status', { defaultValue: 'Status' })} value={verification.status} icon={FileBadge2} tone={verification.status === 'VERIFIED' ? 'success' : 'warning'} trend={[1, 1, 2, 2, 3, 3]} />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-8">
          <section className="surface p-5 sm:p-6">
            <h2 className="section-title mb-4">{t('verification.profileData', { defaultValue: 'Verification profile data' })}</h2>
            {isLoading ? (
              <div className="text-sm text-[var(--color-text-muted)]">{t('common.loading', { defaultValue: 'Loading...' })}</div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-[var(--color-text)]">{t('verification.legalName', { defaultValue: 'Owner name' })}</span>
                  <input value={verification.ownerName} onChange={(event) => setVerification((prev) => ({ ...prev, ownerName: event.target.value }))} className={inputClassName()} />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-[var(--color-text)]">{t('verification.businessType', { defaultValue: 'Legal entity' })}</span>
                  <input value={verification.legalEntityName} onChange={(event) => setVerification((prev) => ({ ...prev, legalEntityName: event.target.value }))} className={inputClassName()} />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-[var(--color-text)]">{t('verification.country', { defaultValue: 'Country' })}</span>
                  <input value={verification.country} onChange={(event) => setVerification((prev) => ({ ...prev, country: event.target.value }))} className={inputClassName()} />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-[var(--color-text)]">{t('verification.documentType', { defaultValue: 'Document type' })}</span>
                  <input value={verification.documentType} onChange={(event) => setVerification((prev) => ({ ...prev, documentType: event.target.value }))} className={inputClassName()} />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-[var(--color-text)]">{t('verification.documentNumber', { defaultValue: 'Document number' })}</span>
                  <input value={verification.documentNumberMasked} onChange={(event) => setVerification((prev) => ({ ...prev, documentNumberMasked: event.target.value }))} className={inputClassName()} />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-[var(--color-text)]">{t('verification.level', { defaultValue: 'Level' })}</span>
                  <select value={verification.level} onChange={(event) => setVerification((prev) => ({ ...prev, level: event.target.value as WorkspaceVerificationProfile['level'] }))} className={inputClassName()}>
                    <option value="BASIC">BASIC</option>
                    <option value="BUSINESS">BUSINESS</option>
                    <option value="ENTERPRISE">ENTERPRISE</option>
                  </select>
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-[var(--color-text)]">{t('verification.status', { defaultValue: 'Status' })}</span>
                  <select value={verification.status} onChange={(event) => setVerification((prev) => ({ ...prev, status: event.target.value as WorkspaceVerificationProfile['status'] }))} className={inputClassName()}>
                    <option value="NOT_STARTED">NOT_STARTED</option>
                    <option value="UNDER_REVIEW">UNDER_REVIEW</option>
                    <option value="VERIFIED">VERIFIED</option>
                    <option value="ACTION_REQUIRED">ACTION_REQUIRED</option>
                  </select>
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-[var(--color-text)]">{t('verification.riskLevel', { defaultValue: 'Risk level' })}</span>
                  <select value={verification.riskLevel} onChange={(event) => setVerification((prev) => ({ ...prev, riskLevel: event.target.value as WorkspaceVerificationProfile['riskLevel'] }))} className={inputClassName()}>
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                  </select>
                </label>
                <label className="block space-y-2 md:col-span-2">
                  <span className="text-sm font-semibold text-[var(--color-text)]">{t('verification.notes', { defaultValue: 'Compliance notes' })}</span>
                  <textarea rows={5} value={notesText} onChange={(event) => setNotesText(event.target.value)} className={textareaClassName()} />
                </label>
              </div>
            )}
          </section>

          <section className="surface p-5 sm:p-6">
            <h2 className="section-title mb-4">{t('verification.checksTitle', { defaultValue: 'Verification checks' })}</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {verification.checks.map((check) => (
                <div key={check.id} className="surface-muted p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[var(--color-text)]">{check.title}</p>
                      {check.updatedAt ? <p className="text-xs text-[var(--color-text-soft)]">{formatDateTime(check.updatedAt, 'ru')}</p> : null}
                    </div>
                    <Badge variant={check.status === 'APPROVED' ? 'success' : check.status === 'UNDER_REVIEW' ? 'warning' : check.status === 'REQUIRES_UPDATE' ? 'danger' : 'info'}>
                      {check.status}
                    </Badge>
                  </div>

                  {check.note ? (
                    <p className="mt-3 text-sm text-[var(--color-text-muted)]">{check.note}</p>
                  ) : (
                    <p className="mt-3 text-sm text-[var(--color-text-muted)]">{verification.nextStep}</p>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {(['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REQUIRES_UPDATE'] as const).map((status) => (
                      <Button key={status} type="button" size="sm" variant={check.status === status ? 'primary' : 'outline'} onClick={() => updateCheckStatus(check, status)}>
                        {status}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-6 xl:col-span-4">
          <section className="surface p-5 sm:p-6">
            <h2 className="section-title mb-4">{t('verification.auditFeed', { defaultValue: 'Compliance feed' })}</h2>
            <ActivityFeedList
              items={checksFeed}
              emptyTitle={t('verification.emptyChecks', { defaultValue: 'No checks yet' })}
              emptyDescription={t('verification.emptyChecksHint', { defaultValue: 'Verification checks will appear here.' })}
            />
          </section>

          <section className="surface p-5 sm:p-6">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.08em] text-[var(--color-text-soft)]">
              {t('verification.nextSteps', { defaultValue: 'Next steps' })}
            </h3>
            <div className="space-y-2 text-sm text-[var(--color-text-muted)]">
              <p>{t('verification.step1', { defaultValue: 'Upload legal entity and payout ownership details to move from in-progress to under-review.' })}</p>
              <p>{t('verification.step2', { defaultValue: 'Use the security center to show linked risk controls and session policy.' })}</p>
              <p>{t('verification.step3', { defaultValue: 'Pair this page with documents and activity log for a realistic compliance workflow.' })}</p>
            </div>
            <div className="mt-4 grid gap-2">
              <Link to={isFreelancer ? '/dashboard/freelancer/documents' : '/dashboard/client/documents'} className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm font-medium text-[var(--color-text)]">
                {t('sidebar.items.documents', { defaultValue: 'Documents' })}
              </Link>
              <Link to={isFreelancer ? '/dashboard/freelancer/security' : '/dashboard/client/security'} className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm font-medium text-[var(--color-text)]">
                {t('topbar.securityCenter', { defaultValue: 'Security center' })}
              </Link>
            </div>
          </section>
        </aside>
      </section>
    </DashboardShell>
  );
}

function inputClassName() {
  return 'h-11 w-full rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--color-border)_72%,transparent)] bg-[var(--color-surface)] px-3.5 text-sm text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-ring)]';
}

function textareaClassName() {
  return 'w-full rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--color-border)_72%,transparent)] bg-[var(--color-surface)] px-3.5 py-3 text-sm text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-ring)]';
}
