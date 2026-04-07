import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { AlertTriangle, KeyRound, LockKeyhole, Shield, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import api, { WorkspaceSecuritySettings } from '@/services/api';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { getClientSidebarItems, getFreelancerSidebarItems } from '@/components/dashboard/dashboardNav';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { MetricTrendCard, type Tone, TimelineRail } from '@/components/dashboard/WorkspaceInsights';
import { WORKSPACE_PATH } from '@/utils/routes';
import { formatDateTime } from '@/utils/locale';

const FALLBACK_SECURITY: WorkspaceSecuritySettings = {
  sessionTimeoutMinutes: 45,
  enforceMfa: true,
  requireDeviceApproval: true,
  anomalyAlerts: true,
  auditRetentionDays: 180,
  ipAllowlist: ['185.39.79.0/24'],
  allowedCountries: ['Kyrgyzstan', 'Kazakhstan'],
  apiKeysCount: 2,
  backupCodesGenerated: true,
  lastKeyRotationAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 28).toISOString(),
  securityScore: 92,
};

export function WorkspaceSecurityPage() {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const { user, logout } = useAuth();
  const [security, setSecurity] = useState<WorkspaceSecuritySettings>(FALLBACK_SECURITY);
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

  const loadSecurity = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await api.getWorkspaceSecurity();
      setSecurity(result);
    } catch (err) {
      setSecurity(FALLBACK_SECURITY);
      setError(err instanceof Error ? err.message : t('security.loadFailed', { defaultValue: 'Failed to load security settings' }));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadSecurity();
  }, [loadSecurity]);

  const toggleField = (
    field: keyof Pick<
      WorkspaceSecuritySettings,
      'enforceMfa' | 'requireDeviceApproval' | 'anomalyAlerts' | 'backupCodesGenerated'
    >
  ) => {
    setSecurity((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const saveSecurity = async () => {
    try {
      setIsSaving(true);
      setError(null);
      setSuccess(null);
      const updated = await api.updateWorkspaceSecurity(security);
      setSecurity(updated);
      setSuccess(t('security.saved', { defaultValue: 'Security settings updated' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('security.saveFailed', { defaultValue: 'Failed to update security settings' }));
    } finally {
      setIsSaving(false);
    }
  };

  const timelineItems: Array<{
    id: string;
    title: string;
    description: string;
    meta: string;
    tone: Tone;
  }> = [
    {
      id: 'review',
      title: t('security.review', { defaultValue: 'Last security review' }),
      description: t('security.reviewHint', { defaultValue: 'Workspace policies, devices and audit retention were reviewed.' }),
      meta: `${security.auditRetentionDays} ${t('security.reviewDays', { defaultValue: 'days retained' })}`,
      tone: 'info' as const,
    },
    {
      id: 'rotation',
      title: t('security.rotation', { defaultValue: 'Password rotation' }),
      description: t('security.rotationHint', { defaultValue: 'Operational credentials and owner access were rotated.' }),
      meta: security.lastKeyRotationAt ? formatDateTime(security.lastKeyRotationAt, 'ru') : '-',
      tone: 'warning' as const,
    },
    {
      id: 'score',
      title: t('security.riskLevel', { defaultValue: 'Current security score' }),
      description: t('security.riskHint', { defaultValue: 'Security score is derived from MFA, device approvals, network controls and audit settings.' }),
      meta: `${security.securityScore}/100`,
      tone: security.securityScore >= 85 ? 'success' : security.securityScore >= 70 ? 'warning' : 'danger',
    },
  ];

  if (!user) return <Navigate to="/login" replace />;
  if (!isWorkspaceUser) return <Navigate to={WORKSPACE_PATH} replace />;

  return (
    <DashboardShell
      isDark={isDark}
      sidebarTitle={user.name || t('topbar.user', { defaultValue: 'User' })}
      sidebarSubtitle={t('security.subtitle', { defaultValue: 'Fintech-grade security posture' })}
      sidebarItems={sidebarItems}
      onLogout={logout}
    >
      <PageHeader
        title={t('security.title', { defaultValue: 'Security center' })}
        subtitle={t('security.pageSubtitle', {
          defaultValue: 'Manage MFA, session policy, API exposure, withdrawals and network controls in one premium security console.',
        })}
        badges={
          <>
            <Badge variant={security.securityScore >= 85 ? 'success' : security.securityScore >= 70 ? 'warning' : 'danger'}>
              {security.securityScore}/100
            </Badge>
            <Badge variant="info">API keys: {security.apiKeysCount}</Badge>
          </>
        }
        actions={
          <Button type="button" isLoading={isSaving} onClick={() => void saveSecurity()}>
            {t('common.save', { defaultValue: 'Save' })}
          </Button>
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

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricTrendCard label={t('security.riskLevel', { defaultValue: 'Security score' })} value={`${security.securityScore}/100`} icon={AlertTriangle} tone={security.securityScore >= 85 ? 'success' : security.securityScore >= 70 ? 'warning' : 'danger'} trend={[72, 76, 80, 83, 87, security.securityScore]} />
        <MetricTrendCard label={t('security.sessionTimeout', { defaultValue: 'Session timeout' })} value={`${security.sessionTimeoutMinutes}m`} icon={LockKeyhole} tone="info" trend={[20, 25, 30, 35, 40, security.sessionTimeoutMinutes]} />
        <MetricTrendCard label={t('security.apiKeys', { defaultValue: 'API keys' })} value={String(security.apiKeysCount)} icon={KeyRound} tone="primary" trend={[1, 1, 2, 2, 2, security.apiKeysCount]} />
        <MetricTrendCard label={t('security.networkPolicy', { defaultValue: 'Allowed countries' })} value={String(security.allowedCountries.length)} icon={ShieldCheck} tone="success" trend={[1, 1, 2, 2, security.allowedCountries.length, security.allowedCountries.length]} />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-8">
          <section className="surface p-5 sm:p-6">
            <h2 className="section-title mb-4">{t('security.controls', { defaultValue: 'Core controls' })}</h2>
            {isLoading ? (
              <div className="text-sm text-[var(--color-text-muted)]">{t('common.loading', { defaultValue: 'Loading...' })}</div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {[
                  ['enforceMfa', t('security.mfa', { defaultValue: 'Enforce MFA' }), t('security.mfaHint', { defaultValue: 'Require second factor for privileged members.' })],
                  ['requireDeviceApproval', t('security.deviceApprovals', { defaultValue: 'Device approvals' }), t('security.deviceApprovalsHint', { defaultValue: 'Approve sensitive actions from trusted devices only.' })],
                  ['anomalyAlerts', t('security.loginAlerts', { defaultValue: 'Anomaly alerts' }), t('security.loginAlertsHint', { defaultValue: 'Notify on unusual sign-ins, access drift and suspicious behavior.' })],
                  ['backupCodesGenerated', t('security.apiAccess', { defaultValue: 'Backup codes' }), t('security.apiAccessHint', { defaultValue: 'Generate recovery codes for workspace owners and finance leads.' })],
                ].map(([key, label, hint]) => {
                  const field = key as keyof Pick<
                    WorkspaceSecuritySettings,
                    'enforceMfa' | 'requireDeviceApproval' | 'anomalyAlerts' | 'backupCodesGenerated'
                  >;
                  return (
                    <button
                      key={field}
                      type="button"
                      onClick={() => toggleField(field)}
                      className="surface-muted flex items-start justify-between gap-4 p-4 text-left transition-colors hover:bg-[var(--color-surface)]"
                    >
                      <div>
                        <p className="font-semibold text-[var(--color-text)]">{label}</p>
                        <p className="mt-1 text-sm text-[var(--color-text-muted)]">{hint}</p>
                      </div>
                      <span className={security[field] ? 'inline-flex rounded-full border border-[color-mix(in_srgb,var(--color-success)_28%,transparent)] bg-[color-mix(in_srgb,var(--color-success)_10%,transparent)] px-2.5 py-1 text-xs font-semibold text-[var(--color-success)]' : 'inline-flex rounded-full border border-[color-mix(in_srgb,var(--color-border)_72%,transparent)] bg-[var(--color-surface)] px-2.5 py-1 text-xs font-semibold text-[var(--color-text-soft)]'}>
                        {security[field] ? t('common.enabled', { defaultValue: 'Enabled' }) : t('common.disabled', { defaultValue: 'Disabled' })}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className="surface p-5 sm:p-6">
            <h2 className="section-title mb-4">{t('security.networkAndSessions', { defaultValue: 'Network and session policy' })}</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--color-text)]">{t('security.sessionTimeout', { defaultValue: 'Session timeout (minutes)' })}</span>
                <input
                  type="number"
                  min={10}
                  step={5}
                  value={security.sessionTimeoutMinutes}
                  onChange={(event) => setSecurity((prev) => ({ ...prev, sessionTimeoutMinutes: Number(event.target.value) || 0 }))}
                  className={inputClassName()}
                />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--color-text)]">{t('security.riskLevel', { defaultValue: 'Audit retention (days)' })}</span>
                <select
                  value={security.auditRetentionDays}
                  onChange={(event) => setSecurity((prev) => ({ ...prev, auditRetentionDays: Number(event.target.value) || prev.auditRetentionDays }))}
                  className={inputClassName()}
                >
                  <option value={90}>90</option>
                  <option value={180}>180</option>
                  <option value={365}>365</option>
                  <option value={730}>730</option>
                </select>
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--color-text)]">{t('security.allowedCountries', { defaultValue: 'Allowed countries' })}</span>
                <textarea
                  rows={5}
                  value={security.allowedCountries.join('\n')}
                  onChange={(event) => setSecurity((prev) => ({ ...prev, allowedCountries: event.target.value.split('\n').map((item) => item.trim()).filter(Boolean) }))}
                  className={textareaClassName()}
                />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--color-text)]">{t('security.ipAllowlist', { defaultValue: 'IP allowlist' })}</span>
                <textarea
                  rows={5}
                  value={security.ipAllowlist.join('\n')}
                  onChange={(event) => setSecurity((prev) => ({ ...prev, ipAllowlist: event.target.value.split('\n').map((item) => item.trim()).filter(Boolean) }))}
                  className={textareaClassName()}
                />
              </label>
            </div>
          </section>
        </div>

        <aside className="space-y-6 xl:col-span-4">
          <section className="surface p-5 sm:p-6">
            <h2 className="section-title mb-4">{t('security.timeline', { defaultValue: 'Security timeline' })}</h2>
            <TimelineRail items={timelineItems} />
          </section>

          <section className="surface p-5 sm:p-6">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.08em] text-[var(--color-text-soft)]">
              {t('security.linkedSections', { defaultValue: 'Linked sections' })}
            </h3>
            <div className="grid gap-2">
              <Link to={isFreelancer ? '/dashboard/freelancer/verification' : '/dashboard/client/verification'} className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm font-medium text-[var(--color-text)]">
                {t('dashboard.client.verificationCenter', { defaultValue: 'Verification center' })}
              </Link>
              <Link to={isFreelancer ? '/dashboard/freelancer/activity' : '/dashboard/client/activity'} className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm font-medium text-[var(--color-text)]">
                {t('team.activityLog', { defaultValue: 'Activity log' })}
              </Link>
              <Link to={isFreelancer ? '/dashboard/freelancer/settings' : '/dashboard/client/settings'} className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm font-medium text-[var(--color-text)]">
                {t('common.settings', { defaultValue: 'Settings' })}
              </Link>
            </div>
          </section>

          <section className="surface p-5 sm:p-6">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
              <Shield className="h-4 w-4 text-[var(--color-primary)]" />
              {t('security.opsChecklist', { defaultValue: 'Ops checklist' })}
            </div>
            <div className="mt-3 space-y-2 text-sm text-[var(--color-text-muted)]">
              <p>{t('security.ops1', { defaultValue: 'Keep MFA and withdrawal approvals enabled during local demo.' })}</p>
              <p>{t('security.ops2', { defaultValue: 'Use IP allowlist and country controls to show enterprise compliance posture.' })}</p>
              <p>{t('security.ops3', { defaultValue: 'Pair this page with verification and activity log to demonstrate auditability.' })}</p>
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
