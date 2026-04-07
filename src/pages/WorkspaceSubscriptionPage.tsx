import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  CreditCard,
  Crown,
  Layers3,
  RefreshCcw,
  Rocket,
  ShieldCheck,
  Sparkles,
  Users2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import api, { WorkspaceOverviewSummary, WorkspaceSubscriptionPlan } from '@/services/api';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { getClientSidebarItems, getFreelancerSidebarItems } from '@/components/dashboard/dashboardNav';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { MetricTrendCard } from '@/components/dashboard/WorkspaceInsights';
import { WORKSPACE_PATH } from '@/utils/routes';
import { formatDateTime, formatMoneyKGS } from '@/utils/locale';

const FALLBACK_PLAN: WorkspaceSubscriptionPlan = {
  planCode: 'scale',
  planName: 'Scale Workspace',
  billingCycle: 'MONTHLY',
  priceMonthly: 149,
  seatsIncluded: 8,
  seatsUsed: 3,
  renewalDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 18).toISOString(),
  usage: {
    activeProjects: 4,
    storedDocuments: 18,
    monthlyVolume: 245000,
  },
  addons: [],
  invoices: [],
};

export function WorkspaceSubscriptionPage() {
  const { t, i18n } = useTranslation();
  const { isDark } = useTheme();
  const { user, logout } = useAuth();
  const [plan, setPlan] = useState<WorkspaceSubscriptionPlan>(FALLBACK_PLAN);
  const [overview, setOverview] = useState<WorkspaceOverviewSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isWorkspaceUser = user?.role === 'CLIENT' || user?.role === 'FREELANCER';
  const isFreelancer = user?.role === 'FREELANCER';
  const roleBase = isFreelancer ? '/dashboard/freelancer' : '/dashboard/client';
  const sidebarItems = useMemo(
    () => (isFreelancer ? getFreelancerSidebarItems() : getClientSidebarItems()),
    [isFreelancer]
  );

  const loadSubscription = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [planResult, overviewResult] = await Promise.all([
        api.getWorkspaceSubscription(),
        api.getWorkspaceOverview(),
      ]);
      setPlan(planResult);
      setOverview(overviewResult);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('subscription.loadFailed', { defaultValue: 'Failed to load workspace subscription.' })
      );
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadSubscription();
  }, [loadSubscription]);

  const savePlan = async () => {
    try {
      setIsSaving(true);
      setError(null);
      setSuccess(null);
      const updated = await api.updateWorkspaceSubscription(plan);
      setPlan(updated);
      setSuccess(t('subscription.saved', { defaultValue: 'Subscription settings updated.' }));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('subscription.saveFailed', { defaultValue: 'Failed to update subscription.' })
      );
    } finally {
      setIsSaving(false);
    }
  };

  const invoiceColumns = useMemo<Array<DataTableColumn<WorkspaceSubscriptionPlan['invoices'][number]>>>(
    () => [
      {
        key: 'title',
        header: t('subscription.invoice', { defaultValue: 'Invoice' }),
        render: (item) => (
          <div>
            <p className="font-semibold text-[var(--color-text)]">{item.title}</p>
            <p className="text-xs text-[var(--color-text-soft)]">{formatDateTime(item.issuedAt, i18n.language)}</p>
          </div>
        ),
      },
      {
        key: 'amount',
        header: t('common.amount', { defaultValue: 'Amount' }),
        render: (item) => <span className="font-semibold text-[var(--color-text)]">{formatMoneyKGS(item.amount, i18n.language)}</span>,
      },
      {
        key: 'dueAt',
        header: t('subscription.dueAt', { defaultValue: 'Due at' }),
        render: (item) => <span className="text-sm text-[var(--color-text-muted)]">{formatDateTime(item.dueAt, i18n.language)}</span>,
      },
      {
        key: 'status',
        header: t('common.status', { defaultValue: 'Status' }),
        render: (item) => <Badge variant={item.status === 'PAID' ? 'success' : 'warning'}>{item.status}</Badge>,
      },
    ],
    [i18n.language, t]
  );

  if (!user) return <Navigate to="/login" replace />;
  if (!isWorkspaceUser) return <Navigate to={WORKSPACE_PATH} replace />;

  return (
    <DashboardShell
      isDark={isDark}
      sidebarTitle={user.name || t('topbar.user', { defaultValue: 'User' })}
      sidebarSubtitle={t('subscription.subtitle', { defaultValue: 'Plan, seats and entitlements' })}
      sidebarItems={sidebarItems}
      onLogout={logout}
    >
      <PageHeader
        title={t('subscription.title', { defaultValue: 'Subscription and plan' })}
        subtitle={t('subscription.pageSubtitle', {
          defaultValue: 'Manage plan tier, billing cadence, entitlements and addon coverage from a premium workspace control panel.',
        })}
        badges={
          <>
            <Badge variant="success">{plan.planName}</Badge>
            <Badge variant="info">{plan.billingCycle}</Badge>
          </>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => void loadSubscription()} leftIcon={<RefreshCcw className="h-4 w-4" />}>
              {t('common.refresh', { defaultValue: 'Refresh' })}
            </Button>
            <Button type="button" isLoading={isSaving} onClick={() => void savePlan()}>
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
              {t('subscription.heroKicker', { defaultValue: 'Workspace monetization layer' })}
            </p>
            <h2 className="mt-2 font-[var(--font-family-display)] text-[clamp(1.75rem,3vw,2.45rem)] font-semibold leading-[1.02] tracking-[-0.04em] text-[var(--color-text)]">
              {t('subscription.heroTitle', { defaultValue: 'Show a real SaaS billing layer with seats, add-ons, invoices and usage limits.' })}
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-[var(--color-text-muted)]">
              {t('subscription.heroText', {
                defaultValue: 'This section makes the platform feel commercially mature by linking billing cycle, workspace capacity, entitlement packs and invoices into one control surface.',
              })}
            </p>
          </div>

          <div className="grid w-full max-w-md grid-cols-2 gap-3">
            <div className="rounded-[18px] border border-[color-mix(in_srgb,var(--color-primary)_26%,transparent)] bg-[color-mix(in_srgb,var(--color-primary)_10%,transparent)] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-soft)]">
                {t('subscription.price', { defaultValue: 'Monthly price' })}
              </p>
              <p className="mt-2 text-xl font-semibold text-[var(--color-text)]">{plan.priceMonthly} / mo</p>
            </div>
            <div className="rounded-[18px] border border-[color-mix(in_srgb,var(--color-success)_24%,transparent)] bg-[color-mix(in_srgb,var(--color-success)_10%,transparent)] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-soft)]">
                {t('subscription.seats', { defaultValue: 'Seat usage' })}
              </p>
              <p className="mt-2 text-xl font-semibold text-[var(--color-text)]">{plan.seatsUsed}/{plan.seatsIncluded}</p>
            </div>
            <div className="rounded-[18px] border border-[color-mix(in_srgb,var(--color-info)_24%,transparent)] bg-[color-mix(in_srgb,var(--color-info)_10%,transparent)] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-soft)]">
                {t('subscription.volume', { defaultValue: 'Monthly volume' })}
              </p>
              <p className="mt-2 text-xl font-semibold text-[var(--color-text)]">{formatMoneyKGS(plan.usage.monthlyVolume, i18n.language)}</p>
            </div>
            <div className="rounded-[18px] border border-[color-mix(in_srgb,var(--color-warning)_24%,transparent)] bg-[color-mix(in_srgb,var(--color-warning)_10%,transparent)] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-soft)]">
                {t('subscription.renewal', { defaultValue: 'Renewal' })}
              </p>
              <p className="mt-2 text-xl font-semibold text-[var(--color-text)]">{formatDateTime(plan.renewalDate, i18n.language)}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricTrendCard label={t('subscription.planTier', { defaultValue: 'Plan tier' })} value={plan.planName} icon={Crown} trend={[1, 1, 2, 2, 3, 3]} />
        <MetricTrendCard label={t('subscription.activeProjects', { defaultValue: 'Active projects' })} value={String(plan.usage.activeProjects)} icon={Rocket} tone="info" trend={[1, 2, 2, 3, 3, plan.usage.activeProjects]} />
        <MetricTrendCard label={t('subscription.documents', { defaultValue: 'Stored documents' })} value={String(plan.usage.storedDocuments)} icon={Layers3} tone="warning" trend={[4, 6, 7, 9, 12, plan.usage.storedDocuments]} />
        <MetricTrendCard label={t('subscription.addons', { defaultValue: 'Enabled add-ons' })} value={String(plan.addons.length)} icon={Sparkles} tone="success" trend={[0, 1, 1, 2, 2, plan.addons.length]} />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-8">
          <section className="surface p-5 sm:p-6">
            <h2 className="section-title mb-4">{t('subscription.planConfig', { defaultValue: 'Plan configuration' })}</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--color-text)]">{t('subscription.planCode', { defaultValue: 'Plan code' })}</span>
                <select value={plan.planCode} onChange={(event) => setPlan((prev) => ({ ...prev, planCode: event.target.value as WorkspaceSubscriptionPlan['planCode'] }))} className={inputClassName()}>
                  <option value="growth">growth</option>
                  <option value="scale">scale</option>
                  <option value="enterprise">enterprise</option>
                </select>
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--color-text)]">{t('subscription.planName', { defaultValue: 'Plan name' })}</span>
                <input value={plan.planName} onChange={(event) => setPlan((prev) => ({ ...prev, planName: event.target.value }))} className={inputClassName()} />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--color-text)]">{t('subscription.billingCycle', { defaultValue: 'Billing cycle' })}</span>
                <select value={plan.billingCycle} onChange={(event) => setPlan((prev) => ({ ...prev, billingCycle: event.target.value as WorkspaceSubscriptionPlan['billingCycle'] }))} className={inputClassName()}>
                  <option value="MONTHLY">MONTHLY</option>
                  <option value="ANNUAL">ANNUAL</option>
                </select>
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--color-text)]">{t('subscription.price', { defaultValue: 'Monthly price' })}</span>
                <input type="number" value={plan.priceMonthly} onChange={(event) => setPlan((prev) => ({ ...prev, priceMonthly: Number(event.target.value) || 0 }))} className={inputClassName()} />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--color-text)]">{t('subscription.seatsIncluded', { defaultValue: 'Seats included' })}</span>
                <input type="number" value={plan.seatsIncluded} onChange={(event) => setPlan((prev) => ({ ...prev, seatsIncluded: Number(event.target.value) || 0 }))} className={inputClassName()} />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--color-text)]">{t('subscription.seatsUsed', { defaultValue: 'Seats used' })}</span>
                <input type="number" value={plan.seatsUsed} onChange={(event) => setPlan((prev) => ({ ...prev, seatsUsed: Number(event.target.value) || 0 }))} className={inputClassName()} />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--color-text)]">{t('subscription.activeProjects', { defaultValue: 'Active projects' })}</span>
                <input type="number" value={plan.usage.activeProjects} onChange={(event) => setPlan((prev) => ({ ...prev, usage: { ...prev.usage, activeProjects: Number(event.target.value) || 0 } }))} className={inputClassName()} />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--color-text)]">{t('subscription.documents', { defaultValue: 'Stored documents' })}</span>
                <input type="number" value={plan.usage.storedDocuments} onChange={(event) => setPlan((prev) => ({ ...prev, usage: { ...prev.usage, storedDocuments: Number(event.target.value) || 0 } }))} className={inputClassName()} />
              </label>
              <label className="block space-y-2 md:col-span-2">
                <span className="text-sm font-semibold text-[var(--color-text)]">{t('subscription.volume', { defaultValue: 'Monthly volume' })}</span>
                <input type="number" value={plan.usage.monthlyVolume} onChange={(event) => setPlan((prev) => ({ ...prev, usage: { ...prev.usage, monthlyVolume: Number(event.target.value) || 0 } }))} className={inputClassName()} />
              </label>
            </div>
          </section>

          <section className="surface p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="section-title">{t('subscription.addonsTitle', { defaultValue: 'Add-on entitlements' })}</h2>
                <p className="section-subtitle mt-1">
                  {t('subscription.addonsHint', { defaultValue: 'Premium workspace modules that make the product feel commercially complete.' })}
                </p>
              </div>
              <Badge variant="info">{plan.addons.length}</Badge>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {plan.addons.length === 0 ? (
                <div className="surface-muted p-4 text-sm text-[var(--color-text-muted)]">
                  {t('subscription.addonsEmpty', { defaultValue: 'No add-ons configured yet.' })}
                </div>
              ) : (
                plan.addons.map((item) => (
                  <div key={item.id} className="surface-muted p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[var(--color-text)]">{item.name}</p>
                        <p className="mt-1 text-sm text-[var(--color-text-muted)]">{item.usage}</p>
                      </div>
                      <Badge variant={item.status === 'ACTIVE' ? 'success' : item.status === 'TRIAL' ? 'info' : 'warning'}>
                        {item.status}
                      </Badge>
                    </div>
                    <p className="mt-4 text-sm font-semibold text-[var(--color-text)]">{item.priceMonthly} / mo</p>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="surface p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="section-title">{t('subscription.invoicesTitle', { defaultValue: 'Invoices and renewals' })}</h2>
                <p className="section-subtitle mt-1">
                  {t('subscription.invoicesHint', { defaultValue: 'Billing records that make the workspace feel tied to a real revenue engine.' })}
                </p>
              </div>
              <Badge variant="success">{plan.invoices.length}</Badge>
            </div>
            <DataTable
              columns={invoiceColumns}
              data={plan.invoices}
              rowKey={(row) => row.id}
              isLoading={isLoading}
              emptyTitle={t('subscription.invoicesEmpty', { defaultValue: 'No invoices yet' })}
              emptyDescription={t('subscription.invoicesEmptyHint', { defaultValue: 'Upcoming renewals and charges will appear here.' })}
            />
          </section>
        </div>

        <aside className="space-y-6 xl:col-span-4">
          <section className="surface p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="section-title">{t('subscription.workspaceImpact', { defaultValue: 'Workspace impact' })}</h2>
              <Sparkles className="h-4 w-4 text-[var(--color-primary)]" />
            </div>
            <div className="mt-4 grid gap-3">
              {[
                {
                  title: t('subscription.quickProjects', { defaultValue: 'Active projects' }),
                  value: plan.usage.activeProjects,
                  icon: Rocket,
                },
                {
                  title: t('subscription.quickTeam', { defaultValue: 'Team members' }),
                  value: overview?.quickStats.teamMembers || 0,
                  icon: Users2,
                },
                {
                  title: t('subscription.quickMethods', { defaultValue: 'Saved methods' }),
                  value: overview?.quickStats.savedMethods || 0,
                  icon: CreditCard,
                },
                {
                  title: t('subscription.quickCompliance', { defaultValue: 'Docs in review' }),
                  value: overview?.quickStats.documentsInReview || 0,
                  icon: ShieldCheck,
                },
              ].map((item) => (
                <div key={item.title} className="surface-muted flex items-center justify-between gap-3 p-4">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-[14px] border border-[color-mix(in_srgb,var(--color-primary)_24%,transparent)] bg-[color-mix(in_srgb,var(--color-primary)_10%,transparent)] text-[var(--color-primary)]">
                      <item.icon className="h-5 w-5" />
                    </span>
                    <span className="text-sm font-semibold text-[var(--color-text)]">{item.title}</span>
                  </div>
                  <span className="text-sm font-semibold text-[var(--color-text)]">{item.value}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="surface p-5 sm:p-6">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.08em] text-[var(--color-text-soft)]">
              {t('subscription.quickLinks', { defaultValue: 'Connected sections' })}
            </h3>
            <div className="grid gap-2">
              <Link to={isFreelancer ? '/dashboard/freelancer/payouts' : '/dashboard/client/billing'} className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm font-medium text-[var(--color-text)]">
                {t('subscription.billingLink', { defaultValue: 'Billing center' })}
              </Link>
              <Link to={`${roleBase}/team`} className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm font-medium text-[var(--color-text)]">
                {t('subscription.teamLink', { defaultValue: 'Team access' })}
              </Link>
              <Link to={`${roleBase}/security`} className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm font-medium text-[var(--color-text)]">
                {t('subscription.securityLink', { defaultValue: 'Security center' })}
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
