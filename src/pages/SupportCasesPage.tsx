import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Headset, LifeBuoy, MessageSquareWarning, RefreshCcw } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import api, { SupportCase } from '@/services/api';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { getClientSidebarItems, getFreelancerSidebarItems } from '@/components/dashboard/dashboardNav';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { MetricTrendCard } from '@/components/dashboard/WorkspaceInsights';
import { useTranslation } from 'react-i18next';
import { formatDateTime } from '@/utils/locale';
import { WORKSPACE_PATH } from '@/utils/routes';

interface SupportFormState {
  title: string;
  description: string;
  orderId: string;
  priority: SupportCase['priority'];
}

const DEFAULT_FORM: SupportFormState = {
  title: '',
  description: '',
  orderId: '',
  priority: 'MEDIUM',
};

function statusVariant(status: SupportCase['status']): 'default' | 'success' | 'warning' | 'danger' | 'info' {
  switch (status) {
    case 'RESOLVED':
    case 'CLOSED':
      return 'success';
    case 'WAITING_CUSTOMER':
      return 'warning';
    case 'IN_PROGRESS':
      return 'info';
    default:
      return 'default';
  }
}

function priorityVariant(priority: SupportCase['priority']): 'default' | 'success' | 'warning' | 'danger' | 'info' {
  switch (priority) {
    case 'URGENT':
      return 'danger';
    case 'HIGH':
      return 'warning';
    case 'MEDIUM':
      return 'info';
    default:
      return 'default';
  }
}

export function SupportCasesPage() {
  const { t, i18n } = useTranslation();
  const { isDark } = useTheme();
  const { user, logout } = useAuth();
  const [cases, setCases] = useState<SupportCase[]>([]);
  const [form, setForm] = useState<SupportFormState>(DEFAULT_FORM);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [busyCaseId, setBusyCaseId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isWorkspaceUser = user?.role === 'CLIENT' || user?.role === 'FREELANCER';

  const loadCases = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await api.getMySupportCases({ limit: 50 });
      setCases(result.data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('support.loadFailed', { defaultValue: 'Failed to load support cases' })
      );
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadCases();
  }, [loadCases]);

  const sidebarItems = useMemo(() => {
    if (!user) return [];
    return user.role === 'FREELANCER' ? getFreelancerSidebarItems() : getClientSidebarItems();
  }, [user]);

  const openCount = useMemo(
    () => cases.filter((item) => !['RESOLVED', 'CLOSED'].includes(item.status)).length,
    [cases]
  );
  const urgentCount = useMemo(
    () => cases.filter((item) => ['HIGH', 'URGENT'].includes(item.priority) && !['RESOLVED', 'CLOSED'].includes(item.status)).length,
    [cases]
  );
  const resolvedCount = useMemo(
    () => cases.filter((item) => ['RESOLVED', 'CLOSED'].includes(item.status)).length,
    [cases]
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const created = await api.createSupportCase({
        title: form.title.trim(),
        description: form.description.trim(),
        orderId: form.orderId.trim() || undefined,
        priority: form.priority,
      });
      setCases((prev) => [created, ...prev]);
      setForm(DEFAULT_FORM);
      setSuccess(t('support.created', { defaultValue: 'Support case created' }));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('support.createFailed', { defaultValue: 'Failed to create support case' })
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (supportCase: SupportCase, status: SupportCase['status']) => {
    setBusyCaseId(supportCase.id);
    setError(null);
    try {
      const updated = await api.updateSupportCaseStatus(supportCase.id, { status });
      setCases((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('support.statusFailed', { defaultValue: 'Failed to update support case status' })
      );
    } finally {
      setBusyCaseId(null);
    }
  };

  if (!user) return <Navigate to="/login" replace />;
  if (!isWorkspaceUser) return <Navigate to={WORKSPACE_PATH} replace />;

  return (
    <DashboardShell
      isDark={isDark}
      sidebarTitle={user.name || t('topbar.user')}
      sidebarSubtitle={t('topbar.workspace')}
      sidebarItems={sidebarItems}
      onLogout={logout}
    >
      <PageHeader
        title={t('support.title', { defaultValue: 'Support Center' })}
        subtitle={t('support.subtitle', { defaultValue: 'Track issues, billing questions and order incidents from one place.' })}
        badges={
          <>
            <Badge variant="info">
              {t('support.total', { defaultValue: 'Cases' })}: {cases.length}
            </Badge>
            <Badge variant="warning">
              {t('support.open', { defaultValue: 'Open' })}: {openCount}
            </Badge>
          </>
        }
        actions={
          <Button type="button" variant="outline" onClick={() => void loadCases()} leftIcon={<RefreshCcw className="h-4 w-4" />}>
            {t('common.refresh')}
          </Button>
        }
      />

      {error ? (
        <div className="mb-6 rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--color-danger)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_12%,transparent)] px-4 py-3 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="mb-6 rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--color-success)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-success)_12%,transparent)] px-4 py-3 text-sm text-[var(--color-success)]">
          {success}
        </div>
      ) : null}

      <section className="surface-glow mb-6 p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-soft)]">
              {t('support.heroKicker', { defaultValue: 'Client operations support' })}
            </p>
            <h2 className="mt-2 font-[var(--font-family-display)] text-[clamp(1.55rem,2.7vw,2.1rem)] font-semibold leading-[1.05] tracking-[-0.04em] text-[var(--color-text)]">
              {t('support.heroTitle', { defaultValue: 'Present incident handling, billing questions and SLA flow like a real support operation.' })}
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-[var(--color-text-muted)]">
              {t('support.heroText', { defaultValue: 'This screen now reads as a proper ops console with issue density, urgency and workflow state immediately visible.' })}
            </p>
          </div>

          <div className="grid w-full max-w-md grid-cols-2 gap-3">
            <div className="rounded-[18px] border border-[color-mix(in_srgb,var(--color-warning)_24%,transparent)] bg-[color-mix(in_srgb,var(--color-warning)_10%,transparent)] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-soft)]">{t('support.open', { defaultValue: 'Open' })}</p>
              <p className="mt-2 text-lg font-semibold text-[var(--color-text)]">{openCount}</p>
            </div>
            <div className="rounded-[18px] border border-[color-mix(in_srgb,var(--color-danger)_24%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-soft)]">{t('support.priority', { defaultValue: 'Urgent' })}</p>
              <p className="mt-2 text-lg font-semibold text-[var(--color-text)]">{urgentCount}</p>
            </div>
            <div className="rounded-[18px] border border-[color-mix(in_srgb,var(--color-success)_24%,transparent)] bg-[color-mix(in_srgb,var(--color-success)_10%,transparent)] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-soft)]">{t('support.markResolved', { defaultValue: 'Resolved' })}</p>
              <p className="mt-2 text-lg font-semibold text-[var(--color-text)]">{resolvedCount}</p>
            </div>
            <div className="rounded-[18px] border border-[color-mix(in_srgb,var(--color-primary)_24%,transparent)] bg-[color-mix(in_srgb,var(--color-primary)_10%,transparent)] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-soft)]">{t('support.total', { defaultValue: 'Cases' })}</p>
              <p className="mt-2 text-lg font-semibold text-[var(--color-text)]">{cases.length}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricTrendCard
          label={t('support.total', { defaultValue: 'Cases' })}
          value={String(cases.length)}
          icon={Headset}
          trend={[1, 2, 3, 4, 5, cases.length]}
        />
        <MetricTrendCard
          label={t('support.open', { defaultValue: 'Open' })}
          value={String(openCount)}
          icon={LifeBuoy}
          tone="warning"
          trend={[1, 1, 2, 2, 3, openCount]}
        />
        <MetricTrendCard
          label={t('support.priority', { defaultValue: 'Urgent' })}
          value={String(urgentCount)}
          icon={MessageSquareWarning}
          tone="danger"
          trend={[0, 1, 1, 1, 2, urgentCount]}
        />
        <MetricTrendCard
          label={t('support.markResolved', { defaultValue: 'Resolved' })}
          value={String(resolvedCount)}
          icon={RefreshCcw}
          tone="success"
          trend={[0, 1, 1, 2, 2, resolvedCount]}
        />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-8">
          <section className="surface p-5 sm:p-6">
            <h2 className="mb-4 text-lg font-semibold text-[var(--color-text)]">
              {t('support.caseFeed', { defaultValue: 'Your cases' })}
            </h2>

            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="surface-muted p-4">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="mt-3 h-3.5 w-full" />
                    <Skeleton className="mt-2 h-3.5 w-2/3" />
                  </div>
                ))}
              </div>
            ) : cases.length === 0 ? (
              <EmptyState
                title={t('support.emptyTitle', { defaultValue: 'No support cases yet' })}
                description={t('support.emptyDescription', { defaultValue: 'Create a support case for billing, disputes, document verification or order incidents.' })}
                icon={<Headset className="h-5 w-5" />}
              />
            ) : (
              <div className="space-y-3">
                {cases.map((item) => (
                  <article key={item.id} className="surface-muted p-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-[var(--color-text)]">
                            #{item.caseNumber} {item.title}
                          </p>
                          <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
                          <Badge variant={priorityVariant(item.priority)}>{item.priority}</Badge>
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-muted)]">
                          {item.description}
                        </p>
                        <p className="mt-3 text-xs text-[var(--color-text-soft)]">
                          {formatDateTime(item.createdAt, i18n.language)}
                        </p>
                        {item.resolution ? (
                          <div className="mt-3 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-muted)]">
                            {item.resolution}
                          </div>
                        ) : null}
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-2">
                        {!['RESOLVED', 'CLOSED'].includes(item.status) ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busyCaseId === item.id}
                            onClick={() => void handleStatusChange(item, 'RESOLVED')}
                            leftIcon={<LifeBuoy className="h-4 w-4" />}
                          >
                            {t('support.markResolved', { defaultValue: 'Mark resolved' })}
                          </Button>
                        ) : null}
                        {item.status === 'RESOLVED' ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={busyCaseId === item.id}
                            onClick={() => void handleStatusChange(item, 'CLOSED')}
                          >
                            {t('support.closeCase', { defaultValue: 'Close case' })}
                          </Button>
                        ) : null}
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
            <h2 className="mb-4 text-lg font-semibold text-[var(--color-text)]">
              {t('support.newCase', { defaultValue: 'New support case' })}
            </h2>
            <form className="space-y-3" onSubmit={handleSubmit}>
              <Input
                label={t('support.caseTitle', { defaultValue: 'Title' })}
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder={t('support.caseTitlePlaceholder', { defaultValue: 'Payment issue on order' })}
              />
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--color-text)]">
                  {t('support.description', { defaultValue: 'Description' })}
                </span>
                <textarea
                  value={form.description}
                  onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                  rows={5}
                  className="w-full rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--color-border)_72%,transparent)] bg-[var(--color-surface)] px-3.5 py-3 text-sm text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-ring)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-ring)_30%,transparent)]"
                  placeholder={t('support.descriptionPlaceholder', { defaultValue: 'Describe the issue, current status and what outcome you expect.' })}
                />
              </label>
              <Input
                label={t('support.orderId', { defaultValue: 'Order ID (optional)' })}
                value={form.orderId}
                onChange={(event) => setForm((prev) => ({ ...prev, orderId: event.target.value }))}
                placeholder="c6cd0295-0ca7-48ca-ae13-12a8dd89b444"
              />
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--color-text)]">
                  {t('support.priority', { defaultValue: 'Priority' })}
                </span>
                <select
                  value={form.priority}
                  onChange={(event) => setForm((prev) => ({ ...prev, priority: event.target.value as SupportCase['priority'] }))}
                  className="h-11 w-full rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--color-border)_72%,transparent)] bg-[var(--color-surface)] px-3.5 text-sm text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-ring)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-ring)_30%,transparent)]"
                >
                  {(['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const).map((priority) => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
                </select>
              </label>

              <Button type="submit" isLoading={isSaving} className="w-full" leftIcon={<MessageSquareWarning className="h-4 w-4" />}>
                {t('support.createAction', { defaultValue: 'Create case' })}
              </Button>
            </form>
          </section>

          <section className="surface p-5 sm:p-6">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.08em] text-[var(--color-text-soft)]">
              {t('support.policyTitle', { defaultValue: 'Ops workflow' })}
            </h3>
            <div className="space-y-2 text-sm text-[var(--color-text-muted)]">
              <p>{t('support.policyLine1', { defaultValue: 'Cases can be linked to orders, payments, disputes and document verification.' })}</p>
              <p>{t('support.policyLine2', { defaultValue: 'During local demo you can create, resolve and close cases to show a support backoffice workflow.' })}</p>
            </div>
          </section>
        </aside>
      </section>
    </DashboardShell>
  );
}
