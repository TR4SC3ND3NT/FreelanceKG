import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  Activity,
  Briefcase,
  CreditCard,
  FileText,
  LifeBuoy,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users2,
  Wallet,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import api, {
  WorkspaceOverviewSummary,
  WorkspaceSubscriptionPlan,
  type WorkspaceOverviewTransaction,
} from '@/services/api';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { getClientSidebarItems, getFreelancerSidebarItems } from '@/components/dashboard/dashboardNav';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import {
  ActivityFeedList,
  MetricTrendCard,
  MiniBarChart,
  type Tone,
  TimelineRail,
} from '@/components/dashboard/WorkspaceInsights';
import { WORKSPACE_PATH } from '@/utils/routes';
import { formatDateTime, formatMoneyKGS } from '@/utils/locale';

const TIMEFRAMES = ['30D', '90D', 'YTD'] as const;
type Timeframe = (typeof TIMEFRAMES)[number];

function transactionTone(status: string): 'default' | 'success' | 'warning' | 'danger' | 'info' {
  if (status === 'COMPLETED' || status === 'PAID') return 'success';
  if (status === 'FAILED') return 'danger';
  if (status === 'PENDING') return 'warning';
  return 'info';
}

function deadlineTone(status: string): Tone {
  if (status === 'COMPLETED' || status === 'VERIFIED') return 'success';
  if (status === 'ACTION_REQUIRED') return 'danger';
  if (status === 'SUBMITTED' || status === 'UNDER_REVIEW') return 'warning';
  return 'info';
}

function activityTone(tone: WorkspaceOverviewSummary['activityFeed'][number]['tone']): Tone {
  if (tone === 'default') return 'primary';
  return tone;
}

function presentAction(action: string) {
  return action
    .split('_')
    .map((chunk) => `${chunk.slice(0, 1)}${chunk.slice(1).toLowerCase()}`)
    .join(' ');
}

function kpiIcon(id: string) {
  if (id.includes('escrow') || id.includes('cash') || id.includes('earnings')) return Wallet;
  if (id.includes('spend')) return CreditCard;
  if (id.includes('team')) return Users2;
  if (id.includes('rating')) return ShieldCheck;
  return Briefcase;
}

function formatKpiValue(id: string, value: string | number, language: string) {
  if (typeof value === 'number' && /(cash|spend|earnings|escrow)/i.test(id)) {
    return formatMoneyKGS(value, language);
  }
  return String(value);
}

const FALLBACK_SUBSCRIPTION: WorkspaceSubscriptionPlan = {
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

export function WorkspaceAnalyticsPage() {
  const { t, i18n } = useTranslation();
  const { isDark } = useTheme();
  const { user, logout } = useAuth();
  const [overview, setOverview] = useState<WorkspaceOverviewSummary | null>(null);
  const [subscription, setSubscription] = useState<WorkspaceSubscriptionPlan>(FALLBACK_SUBSCRIPTION);
  const [timeframe, setTimeframe] = useState<Timeframe>('90D');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isWorkspaceUser = user?.role === 'CLIENT' || user?.role === 'FREELANCER';
  const isFreelancer = user?.role === 'FREELANCER';
  const roleBase = isFreelancer ? '/dashboard/freelancer' : '/dashboard/client';
  const sidebarItems = useMemo(
    () => (isFreelancer ? getFreelancerSidebarItems() : getClientSidebarItems()),
    [isFreelancer]
  );

  const loadAnalytics = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [overviewResult, subscriptionResult] = await Promise.all([
        api.getWorkspaceOverview(),
        api.getWorkspaceSubscription(),
      ]);
      setOverview(overviewResult);
      setSubscription(subscriptionResult);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('analytics.loadFailed', { defaultValue: 'Failed to load analytics workspace.' })
      );
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  const transactionsColumns = useMemo<Array<DataTableColumn<WorkspaceOverviewTransaction>>>(
    () => [
      {
        key: 'type',
        header: t('common.type', { defaultValue: 'Type' }),
        render: (item) => (
          <div>
            <p className="font-semibold text-[var(--color-text)]">{item.type}</p>
            <p className="text-xs text-[var(--color-text-soft)]">{formatDateTime(item.createdAt, i18n.language)}</p>
          </div>
        ),
      },
      {
        key: 'order',
        header: t('common.order', { defaultValue: 'Order' }),
        render: (item) =>
          item.orderId ? (
            <Link to={`/orders/${item.orderId}`} className="font-medium text-[var(--color-primary)] hover:underline">
              {item.orderTitle || item.orderId}
            </Link>
          ) : (
            <span className="text-[var(--color-text-soft)]">{item.orderTitle || '-'}</span>
          ),
      },
      {
        key: 'amount',
        header: t('common.amount', { defaultValue: 'Amount' }),
        cellClassName: 'whitespace-nowrap',
        render: (item) => <span className="font-semibold text-[var(--color-text)]">{formatMoneyKGS(item.amount, i18n.language)}</span>,
      },
      {
        key: 'status',
        header: t('common.status', { defaultValue: 'Status' }),
        render: (item) => <Badge variant={transactionTone(item.status)}>{item.status}</Badge>,
      },
    ],
    [i18n.language, t]
  );

  const analyticsCards = useMemo(
    () =>
      (overview?.kpis || []).map((item, index) => (
        <MetricTrendCard
          key={item.id}
          label={item.label}
          value={formatKpiValue(item.id, item.value, i18n.language)}
          hint={item.helper}
          delta={`${item.delta >= 0 ? '+' : ''}${item.delta}`}
          tone={item.tone}
          icon={kpiIcon(item.id)}
          trend={
            /(cash|spend|earnings|escrow)/i.test(item.id)
              ? overview?.charts.cashflow.map((point) => point.value) || []
              : overview?.charts.volume.map((point) => point.value + (index % 2 === 0 ? 0 : point.secondaryValue || 0)) || []
          }
        />
      )),
    [i18n.language, overview]
  );

  const activityItems = useMemo(
    () =>
      (overview?.activityFeed || []).slice(0, 6).map((item) => ({
        id: item.id,
        title: presentAction(item.action),
        subtitle: item.description,
        meta: formatDateTime(item.createdAt, i18n.language),
        badge: item.entityType || item.action,
        tone: activityTone(item.tone),
      })),
    [i18n.language, overview]
  );

  const deadlineItems = useMemo(
    () =>
      (overview?.deadlines || []).map((item) => ({
        id: item.id,
        title: item.title,
        description: [item.counterparty, typeof item.amount === 'number' ? formatMoneyKGS(item.amount, i18n.language) : null]
          .filter(Boolean)
          .join(' • '),
        meta: formatDateTime(item.date, i18n.language),
        tone: deadlineTone(item.status),
      })),
    [i18n.language, overview]
  );

  const timelineItems = useMemo(
    () =>
      (overview?.timeline || []).slice(0, 6).map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        meta: formatDateTime(item.at, i18n.language),
        tone: deadlineTone(item.status),
      })),
    [i18n.language, overview]
  );

  const recentDocumentItems = useMemo(
    () =>
      (overview?.recentDocuments || []).slice(0, 4).map((item) => ({
        id: item.id,
        title: item.title,
        subtitle: [item.type, item.fileName].filter(Boolean).join(' • '),
        meta: formatDateTime(item.updatedAt, i18n.language),
        badge: item.status,
        tone:
          item.status === 'SIGNED'
            ? ('success' as const)
            : item.status === 'UNDER_REVIEW'
              ? ('warning' as const)
              : ('primary' as const),
      })),
    [i18n.language, overview]
  );

  if (!user) return <Navigate to="/login" replace />;
  if (!isWorkspaceUser) return <Navigate to={WORKSPACE_PATH} replace />;

  return (
    <DashboardShell
      isDark={isDark}
      sidebarTitle={user.name || t('topbar.user', { defaultValue: 'User' })}
      sidebarSubtitle={t('analytics.subtitle', { defaultValue: 'Revenue and operations intelligence' })}
      sidebarItems={sidebarItems}
      onLogout={logout}
    >
      <PageHeader
        title={t('analytics.title', { defaultValue: 'Analytics and reports' })}
        subtitle={t('analytics.pageSubtitle', {
          defaultValue: 'A dense reporting layer for volume, cashflow, support load, documents and workspace performance.',
        })}
        badges={
          <>
            <Badge variant="success">{subscription.planName}</Badge>
            <Badge variant="info">{timeframe}</Badge>
          </>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {TIMEFRAMES.map((item) => (
              <Button
                key={item}
                type="button"
                variant={timeframe === item ? 'outline' : 'ghost'}
                onClick={() => setTimeframe(item)}
              >
                {item}
              </Button>
            ))}
            <Button type="button" variant="outline" onClick={() => void loadAnalytics()} leftIcon={<RefreshCcw className="h-4 w-4" />}>
              {t('common.refresh', { defaultValue: 'Refresh' })}
            </Button>
          </div>
        }
      />

      {error ? (
        <div className="rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--color-danger)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_12%,transparent)] px-4 py-3 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      ) : null}

      <section className="surface-glow p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-soft)]">
              {t('analytics.heroKicker', { defaultValue: 'Workspace intelligence layer' })}
            </p>
            <h2 className="mt-2 font-[var(--font-family-display)] text-[clamp(1.75rem,3vw,2.45rem)] font-semibold leading-[1.02] tracking-[-0.04em] text-[var(--color-text)]">
              {t('analytics.heroTitle', { defaultValue: 'Monitor product, finance, compliance and support like a mature commercial SaaS.' })}
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-[var(--color-text-muted)]">
              {t('analytics.heroText', {
                defaultValue: 'This screen turns the local demo into an executive reporting console with velocity, cashflow, audit and SLA signals in one place.',
              })}
            </p>
          </div>

          <div className="grid w-full max-w-md grid-cols-2 gap-3">
            <div className="rounded-[18px] border border-[color-mix(in_srgb,var(--color-primary)_26%,transparent)] bg-[color-mix(in_srgb,var(--color-primary)_10%,transparent)] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-soft)]">
                {t('analytics.projects', { defaultValue: 'Active projects' })}
              </p>
              <p className="mt-2 text-xl font-semibold text-[var(--color-text)]">{subscription.usage.activeProjects}</p>
            </div>
            <div className="rounded-[18px] border border-[color-mix(in_srgb,var(--color-success)_24%,transparent)] bg-[color-mix(in_srgb,var(--color-success)_10%,transparent)] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-soft)]">
                {t('analytics.documents', { defaultValue: 'Stored documents' })}
              </p>
              <p className="mt-2 text-xl font-semibold text-[var(--color-text)]">{subscription.usage.storedDocuments}</p>
            </div>
            <div className="rounded-[18px] border border-[color-mix(in_srgb,var(--color-info)_24%,transparent)] bg-[color-mix(in_srgb,var(--color-info)_10%,transparent)] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-soft)]">
                {t('analytics.volume', { defaultValue: 'Monthly volume' })}
              </p>
              <p className="mt-2 text-xl font-semibold text-[var(--color-text)]">{formatMoneyKGS(subscription.usage.monthlyVolume, i18n.language)}</p>
            </div>
            <div className="rounded-[18px] border border-[color-mix(in_srgb,var(--color-warning)_24%,transparent)] bg-[color-mix(in_srgb,var(--color-warning)_10%,transparent)] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-soft)]">
                {t('analytics.renewal', { defaultValue: 'Plan renewal' })}
              </p>
              <p className="mt-2 text-xl font-semibold text-[var(--color-text)]">{formatDateTime(subscription.renewalDate, i18n.language)}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 xl:grid-cols-4">
        {[
          {
            label: t('analytics.commandReadiness', { defaultValue: 'Command readiness' }),
            value: `${overview?.quickStats.savedMethods || 0} rails • ${overview?.quickStats.teamMembers || 0} members`,
            tone: 'primary',
          },
          {
            label: t('analytics.supportLoad', { defaultValue: 'Support load' }),
            value: `${overview?.supportSummary.open || 0} open • ${overview?.supportSummary.urgent || 0} urgent`,
            tone: 'warning',
          },
          {
            label: t('analytics.approvalLane', { defaultValue: 'Approval lane' }),
            value: `${overview?.quickStats.pendingApprovals || 0} pending • ${overview?.quickStats.documentsInReview || 0} docs`,
            tone: 'info',
          },
          {
            label: t('analytics.alertDensity', { defaultValue: 'Alert density' }),
            value: `${overview?.quickStats.unreadNotifications || 0} unread signals`,
            tone: 'success',
          },
        ].map((item) => (
          <div
            key={item.label}
            className="surface-muted relative overflow-hidden px-4 py-4"
          >
            <span className={item.tone === 'warning' ? 'absolute inset-y-0 left-0 w-1 bg-[var(--color-warning)]' : item.tone === 'info' ? 'absolute inset-y-0 left-0 w-1 bg-[var(--color-info)]' : item.tone === 'success' ? 'absolute inset-y-0 left-0 w-1 bg-[var(--color-success)]' : 'absolute inset-y-0 left-0 w-1 bg-[var(--color-primary)]'} />
            <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-[var(--color-text-soft)]">{item.label}</p>
            <p className="mt-2 text-sm font-semibold text-[var(--color-text)]">{item.value}</p>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {analyticsCards}
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-8">
          <section className="grid grid-cols-1 gap-6 2xl:grid-cols-2">
            <section className="surface p-5 sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="section-title">{t('analytics.volumeChart', { defaultValue: 'Volume trend' })}</h2>
                  <p className="section-subtitle mt-1">
                    {t('analytics.volumeChartHint', { defaultValue: 'Order and workspace throughput across recent periods.' })}
                  </p>
                </div>
                <Badge variant="info">{overview?.charts.volume.length || 0}</Badge>
              </div>
              <MiniBarChart points={overview?.charts.volume || []} tone="info" />
            </section>

            <section className="surface p-5 sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="section-title">{t('analytics.cashflowChart', { defaultValue: 'Cashflow trend' })}</h2>
                  <p className="section-subtitle mt-1">
                    {t('analytics.cashflowChartHint', { defaultValue: 'Escrow, payouts and billing movement in one view.' })}
                  </p>
                </div>
                <Badge variant="success">{subscription.billingCycle}</Badge>
              </div>
              <MiniBarChart points={overview?.charts.cashflow || []} tone="success" />
            </section>
          </section>

          <section className="surface p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="section-title">{t('analytics.transactionsTitle', { defaultValue: 'Recent reportable transactions' })}</h2>
                <p className="section-subtitle mt-1">
                  {t('analytics.transactionsHint', { defaultValue: 'Finance and settlement operations surfaced for demo-ready reporting.' })}
                </p>
              </div>
              <Link to={`${roleBase}/finance`} className="text-sm font-semibold text-[var(--color-primary)] hover:underline">
                {t('analytics.openFinance', { defaultValue: 'Open finance center' })}
              </Link>
            </div>

            <DataTable
              columns={transactionsColumns}
              data={overview?.recentTransactions || []}
              rowKey={(row) => row.id}
              isLoading={isLoading}
              emptyTitle={t('analytics.transactionsEmpty', { defaultValue: 'No transactions yet' })}
              emptyDescription={t('analytics.transactionsEmptyHint', { defaultValue: 'Finance events will appear here after the first workflow run.' })}
            />
          </section>

          <section className="surface p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="section-title">{t('analytics.activityPulse', { defaultValue: 'Operational pulse' })}</h2>
                <p className="section-subtitle mt-1">
                  {t('analytics.activityPulseHint', { defaultValue: 'A compact stream of high-signal events across workspace systems.' })}
                </p>
              </div>
              <Link to={`${roleBase}/activity`} className="text-sm font-semibold text-[var(--color-primary)] hover:underline">
                {t('analytics.openActivity', { defaultValue: 'Open audit log' })}
              </Link>
            </div>
            <ActivityFeedList
              items={activityItems}
              emptyTitle={t('analytics.activityEmpty', { defaultValue: 'No activity yet' })}
              emptyDescription={t('analytics.activityEmptyHint', { defaultValue: 'Workspace operations will start appearing here once the product is used.' })}
            />
          </section>
        </div>

        <aside className="space-y-6 xl:col-span-4">
          <section className="surface p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="section-title">{t('analytics.healthCards', { defaultValue: 'Health signals' })}</h2>
              <Sparkles className="h-4 w-4 text-[var(--color-primary)]" />
            </div>
            <div className="mt-4 grid gap-3">
              {[
                {
                  label: t('analytics.unread', { defaultValue: 'Unread alerts' }),
                  value: overview?.quickStats.unreadNotifications || 0,
                  icon: Activity,
                },
                {
                  label: t('analytics.pending', { defaultValue: 'Pending approvals' }),
                  value: overview?.quickStats.pendingApprovals || 0,
                  icon: ShieldCheck,
                },
                {
                  label: t('analytics.supportOpen', { defaultValue: 'Open support' }),
                  value: overview?.quickStats.openCases || 0,
                  icon: LifeBuoy,
                },
                {
                  label: t('analytics.methods', { defaultValue: 'Saved methods' }),
                  value: overview?.quickStats.savedMethods || 0,
                  icon: CreditCard,
                },
                {
                  label: t('analytics.docsReview', { defaultValue: 'Docs in review' }),
                  value: overview?.quickStats.documentsInReview || 0,
                  icon: FileText,
                },
                {
                  label: t('analytics.teamCoverage', { defaultValue: 'Team members' }),
                  value: overview?.quickStats.teamMembers || 0,
                  icon: Users2,
                },
              ].map((item) => (
                <div key={item.label} className="surface-muted flex items-center justify-between gap-3 p-4">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-[14px] border border-[color-mix(in_srgb,var(--color-primary)_24%,transparent)] bg-[color-mix(in_srgb,var(--color-primary)_10%,transparent)] text-[var(--color-primary)]">
                      <item.icon className="h-5 w-5" />
                    </span>
                    <span className="text-sm font-semibold text-[var(--color-text)]">{item.label}</span>
                  </div>
                  <span className="text-lg font-semibold text-[var(--color-text)]">{item.value}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="surface p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="section-title">{t('analytics.deadlines', { defaultValue: 'Upcoming milestones' })}</h2>
              <Badge variant="warning">{deadlineItems.length}</Badge>
            </div>
            <TimelineRail items={deadlineItems} />
          </section>

          <section className="surface p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="section-title">{t('analytics.recentDocuments', { defaultValue: 'Recent documents' })}</h2>
              <Badge variant="info">{recentDocumentItems.length}</Badge>
            </div>
            <ActivityFeedList
              items={recentDocumentItems}
              emptyTitle={t('analytics.documentsEmpty', { defaultValue: 'No documents yet' })}
              emptyDescription={t('analytics.documentsEmptyHint', { defaultValue: 'Documents, statements and compliance packs will appear here.' })}
            />
          </section>

          <section className="surface p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="section-title">{t('analytics.timeline', { defaultValue: 'Recent timeline' })}</h2>
              <TrendingUp className="h-4 w-4 text-[var(--color-primary)]" />
            </div>
            <TimelineRail items={timelineItems} />
          </section>

          <section className="surface p-5 sm:p-6">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.08em] text-[var(--color-text-soft)]">
              {t('analytics.relatedLinks', { defaultValue: 'Related workspaces' })}
            </h3>
            <div className="grid gap-2">
              <Link to={`${roleBase}/subscription`} className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm font-medium text-[var(--color-text)]">
                {t('analytics.subscriptionLink', { defaultValue: 'Subscription and plan' })}
              </Link>
              <Link to={`${roleBase}/support`} className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm font-medium text-[var(--color-text)]">
                {t('analytics.supportLink', { defaultValue: 'Support center' })}
              </Link>
              <Link to={`${roleBase}/documents`} className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm font-medium text-[var(--color-text)]">
                {t('analytics.documentsLink', { defaultValue: 'Documents center' })}
              </Link>
            </div>
          </section>
        </aside>
      </section>
    </DashboardShell>
  );
}
