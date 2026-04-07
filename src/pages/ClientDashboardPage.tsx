import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  Briefcase,
  Building2,
  Clock3,
  CreditCard,
  FileCheck2,
  LifeBuoy,
  Plus,
  ShieldCheck,
  Sparkles,
  Users2,
  Wallet,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import api, {
  NotificationItem,
  Order,
  PaymentTransaction,
  SupportCase,
  WorkspaceActivityEntry,
  WorkspaceDocument,
  WorkspaceSubscriptionPlan,
  WorkspaceTeamMember,
  WorkspaceVerificationProfile,
} from '@/services/api';
import { formatDateTime, formatMoneyKGS } from '@/utils/locale';
import { buildMonthSeries, countByStatus, relativeDaysFromNow, sortByNewest } from '@/utils/dashboard';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { getClientSidebarItems } from '@/components/dashboard/dashboardNav';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import {
  ActivityFeedList,
  MetricTrendCard,
  MiniBarChart,
  type Tone,
  TimelineRail,
} from '@/components/dashboard/WorkspaceInsights';

const FALLBACK_SUBSCRIPTION: WorkspaceSubscriptionPlan = {
  planCode: 'scale',
  planName: 'Scale Workspace',
  billingCycle: 'MONTHLY',
  priceMonthly: 149,
  renewalDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 22).toISOString(),
  seatsIncluded: 8,
  seatsUsed: 3,
  usage: {
    activeProjects: 4,
    storedDocuments: 18,
    monthlyVolume: 245000,
  },
  addons: [
    {
      id: 'priority-support',
      name: 'Priority support',
      status: 'ACTIVE',
      priceMonthly: 39,
      usage: '24/7 SLA',
    },
    {
      id: 'advanced-compliance',
      name: 'Advanced compliance',
      status: 'TRIAL',
      priceMonthly: 29,
      usage: '7 days left',
    },
  ],
  invoices: [
    {
      id: 'invoice-current',
      title: 'Workspace subscription',
      amount: 149,
      status: 'PAID',
      issuedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12).toISOString(),
      dueAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 11).toISOString(),
    },
  ],
};

const FALLBACK_VERIFICATION: WorkspaceVerificationProfile = {
  status: 'UNDER_REVIEW',
  level: 'BUSINESS',
  ownerName: 'Workspace owner',
  legalEntityName: 'FreelanceKG Demo Workspace',
  country: 'Kyrgyzstan',
  documentType: 'Business certificate',
  documentNumberMasked: '•••• 2841',
  riskLevel: 'LOW',
  nextStep: 'Awaiting final compliance approval and bank ownership confirmation.',
  checks: [],
};

function asFulfilled<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === 'fulfilled' ? result.value : fallback;
}

function notificationTone(type: string): Tone {
  if (type.includes('COMPLETED')) return 'success';
  if (type.includes('CANCELLED')) return 'warning';
  if (type.includes('DISPUTE')) return 'danger';
  if (type.includes('MESSAGE')) return 'info';
  return 'primary';
}

function activityTone(tone: WorkspaceActivityEntry['tone'] | undefined): Tone {
  if (!tone || tone === 'default') return 'primary';
  return tone;
}

function documentTone(status: WorkspaceDocument['status']): Tone {
  if (status === 'SIGNED') return 'success';
  if (status === 'UNDER_REVIEW') return 'warning';
  return 'primary';
}

function actionTitle(action: string): string {
  return action
    .split('_')
    .map((part) => `${part.slice(0, 1)}${part.slice(1).toLowerCase()}`)
    .join(' ');
}

export function ClientDashboardPage() {
  const { t, i18n } = useTranslation();
  const { isDark } = useTheme();
  const { user, logout } = useAuth();

  const [orders, setOrders] = useState<Order[]>([]);
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [documents, setDocuments] = useState<WorkspaceDocument[]>([]);
  const [supportCases, setSupportCases] = useState<SupportCase[]>([]);
  const [teamMembers, setTeamMembers] = useState<WorkspaceTeamMember[]>([]);
  const [subscription, setSubscription] = useState<WorkspaceSubscriptionPlan>(FALLBACK_SUBSCRIPTION);
  const [verification, setVerification] = useState<WorkspaceVerificationProfile>(FALLBACK_VERIFICATION);
  const [activityLog, setActivityLog] = useState<WorkspaceActivityEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [
        ordersResult,
        transactionsResult,
        notificationsResult,
        documentsResult,
        supportResult,
        teamResult,
        subscriptionResult,
        verificationResult,
        activityResult,
      ] = await Promise.allSettled([
        api.getOrders({ limit: 50 }),
        api.getTransactions({ limit: 20 }),
        api.getNotifications({ limit: 8 }),
        api.getWorkspaceDocuments(),
        api.getMySupportCases({ limit: 12 }),
        api.getWorkspaceTeamMembers(),
        api.getWorkspaceSubscription(),
        api.getWorkspaceVerification(),
        api.getWorkspaceActivityLog({ limit: 10 }),
      ]);

      setOrders(asFulfilled(ordersResult, { data: [], pagination: { page: 1, limit: 0, total: 0, pages: 1 } }).data);
      setTransactions(
        asFulfilled(transactionsResult, { data: [], pagination: { page: 1, limit: 0, total: 0, pages: 1 } }).data
      );

      const notificationsData = asFulfilled(notificationsResult, {
        data: [],
        unreadCount: 0,
        pagination: { page: 1, limit: 0, total: 0, pages: 1 },
      });
      setNotifications(notificationsData.data);
      setUnreadNotifications(notificationsData.unreadCount);

      setDocuments(asFulfilled(documentsResult, []));
      setSupportCases(
        asFulfilled(supportResult, { data: [], pagination: { page: 1, limit: 0, total: 0, pages: 1 } }).data
      );
      setTeamMembers(asFulfilled(teamResult, []));
      setSubscription(asFulfilled(subscriptionResult, FALLBACK_SUBSCRIPTION));
      setVerification(asFulfilled(verificationResult, FALLBACK_VERIFICATION));
      setActivityLog(asFulfilled(activityResult, []));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('dashboard.client.loadFailed', { defaultValue: 'Failed to load dashboard' }));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const orderSeries = useMemo(
    () => buildMonthSeries(orders, i18n.language, { getDate: (order) => order.createdAt }),
    [i18n.language, orders]
  );
  const spendSeries = useMemo(
    () => buildMonthSeries(transactions, i18n.language, { getDate: (tx) => tx.createdAt, getValue: (tx) => tx.amount }),
    [i18n.language, transactions]
  );

  const stats = useMemo(() => {
    const active = orders.filter((order) => ['PENDING', 'ACTIVE'].includes(order.status)).length;
    const pendingApprovals = orders.filter((order) => order.status === 'SUBMITTED').length;
    const completed = orders.filter((order) => order.status === 'COMPLETED').length;
    const escrow = orders
      .filter((order) => ['ACTIVE', 'SUBMITTED'].includes(order.status))
      .reduce((sum, order) => sum + (order.escrowAmount || 0), 0);
    const spent = transactions
      .filter((tx) => ['ESCROW_HOLD', 'ESCROW_RELEASE', 'DEPOSIT'].includes(tx.type))
      .reduce((sum, tx) => sum + tx.amount, 0);
    const documentsReview = documents.filter((item) => item.status === 'UNDER_REVIEW').length;
    const openCases = supportCases.filter((item) => !['RESOLVED', 'CLOSED'].includes(item.status)).length;

    return { active, pendingApprovals, completed, escrow, spent, documentsReview, openCases };
  }, [documents, orders, supportCases, transactions]);

  const supportSummary = useMemo(() => countByStatus(supportCases, (item) => item.status), [supportCases]);

  const upcomingDeadlines = useMemo(
    () =>
      [...orders]
        .filter((order) => ['ACTIVE', 'SUBMITTED', 'PENDING'].includes(order.status) && order.deadline)
        .sort((left, right) => new Date(left.deadline || 0).getTime() - new Date(right.deadline || 0).getTime())
        .slice(0, 5)
        .map((order) => ({
          id: order.id,
          title: order.title,
          description: `${order.client.name} • ${formatMoneyKGS(order.budget, i18n.language)}`,
          meta:
            relativeDaysFromNow(order.deadline) !== null
              ? t('dashboard.client.deadlineIn', {
                  defaultValue: '{{days}} days left',
                  days: relativeDaysFromNow(order.deadline),
                })
              : undefined,
          tone:
            order.status === 'SUBMITTED'
              ? ('warning' as const)
              : order.status === 'ACTIVE'
                ? ('info' as const)
                : ('primary' as const),
        })),
    [i18n.language, orders, t]
  );

  const activityItems = useMemo(() => {
    if (activityLog.length > 0) {
      return activityLog.slice(0, 6).map((item) => ({
        id: item.id,
        title: actionTitle(item.action),
        subtitle: item.description,
        meta: formatDateTime(item.createdAt, i18n.language),
        badge: item.action,
        tone: activityTone(item.tone),
      }));
    }

    return sortByNewest(
      [
        ...notifications.map((item) => ({
          id: item.id,
          createdAt: item.createdAt,
          title: item.title,
          subtitle: item.message,
          badge: item.type,
          tone: notificationTone(item.type),
        })),
        ...supportCases.map((item) => ({
          id: item.id,
          createdAt: item.createdAt,
          title: item.title,
          subtitle: item.description,
          badge: item.status,
          tone: item.status === 'OPEN' ? ('warning' as const) : ('info' as const),
        })),
      ],
      (item) => item.createdAt
    )
      .slice(0, 6)
      .map((item) => ({
        id: item.id,
        title: item.title,
        subtitle: item.subtitle,
        badge: item.badge,
        meta: formatDateTime(item.createdAt, i18n.language),
        tone: item.tone as Tone,
      }));
  }, [activityLog, i18n.language, notifications, supportCases]);

  const recentDocuments = useMemo(
    () =>
      sortByNewest(documents, (item) => item.updatedAt).slice(0, 4).map((item) => ({
        id: item.id,
        title: item.title,
        subtitle: [item.type, item.fileName].filter(Boolean).join(' • '),
        meta: formatDateTime(item.updatedAt, i18n.language),
        badge: item.status,
        tone: documentTone(item.status),
      })),
    [documents, i18n.language]
  );

  const transactionsColumns = useMemo<Array<DataTableColumn<PaymentTransaction>>>(
    () => [
      {
        key: 'type',
        header: t('common.type', { defaultValue: 'Type' }),
        render: (tx) => (
          <div>
            <p className="font-semibold text-[var(--color-text)]">{tx.type}</p>
            <p className="text-xs text-[var(--color-text-soft)]">{formatDateTime(tx.createdAt, i18n.language)}</p>
          </div>
        ),
      },
      {
        key: 'order',
        header: t('common.order', { defaultValue: 'Order' }),
        render: (tx) =>
          tx.order?.id ? (
            <Link to={`/orders/${tx.order.id}`} className="font-medium text-[var(--color-primary)] hover:underline">
              {tx.order.title}
            </Link>
          ) : (
            <span className="text-[var(--color-text-soft)]">-</span>
          ),
      },
      {
        key: 'amount',
        header: t('common.amount', { defaultValue: 'Amount' }),
        cellClassName: 'whitespace-nowrap',
        render: (tx) => <span className="font-semibold text-[var(--color-text)]">{formatMoneyKGS(tx.amount, i18n.language)}</span>,
      },
      {
        key: 'status',
        header: t('common.status', { defaultValue: 'Status' }),
        render: (tx) => (
          <Badge variant={tx.status === 'COMPLETED' ? 'success' : tx.status === 'FAILED' ? 'danger' : 'warning'}>
            {tx.status}
          </Badge>
        ),
      },
    ],
    [i18n.language, t]
  );

  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'FREELANCER') return <Navigate to="/dashboard/freelancer/overview" replace />;

  return (
    <DashboardShell
      isDark={isDark}
      sidebarTitle={user.name || t('topbar.user', { defaultValue: 'User' })}
      sidebarSubtitle={t('dashboard.client.workspaceSubtitle', { defaultValue: 'Executive client workspace' })}
      sidebarItems={getClientSidebarItems()}
      onLogout={logout}
    >
      <PageHeader
        title={t('dashboard.client.title', { defaultValue: 'Control tower' })}
        subtitle={t('dashboard.client.subtitle', {
          defaultValue: 'Finance, approvals, documents, support and workspace access are coordinated from one premium client cockpit.',
        })}
        badges={
          <>
            <Badge variant="success">{subscription.planName}</Badge>
            <Badge variant={verification.status === 'VERIFIED' ? 'success' : 'warning'}>
              {verification.status}
            </Badge>
          </>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void loadDashboard()} variant="outline">
              {t('common.refresh', { defaultValue: 'Refresh' })}
            </Button>
            <Link
              to="/orders/new"
              className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-control)] bg-[var(--color-primary)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-hover)]"
            >
              <Plus className="h-4 w-4" />
              {t('dashboard.client.newOrder', { defaultValue: 'Create order' })}
            </Link>
          </div>
        }
      />

      {error ? (
        <div className="rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--color-danger)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_12%,transparent)] px-4 py-3 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <MetricTrendCard
          label={t('dashboard.client.activeOrders', { defaultValue: 'Active operations' })}
          value={String(stats.active)}
          hint={t('dashboard.client.activeOrdersHint', { defaultValue: 'Contracts in live execution' })}
          delta={t('dashboard.client.deltaOrders', { defaultValue: '+12% this cycle' })}
          icon={Briefcase}
          trend={orderSeries.map((item) => item.value)}
        />
        <MetricTrendCard
          label={t('dashboard.client.pendingApprovals', { defaultValue: 'Pending approvals' })}
          value={String(stats.pendingApprovals)}
          hint={t('dashboard.client.pendingApprovalsHint', { defaultValue: 'Submissions waiting for acceptance' })}
          delta={t('dashboard.client.pendingApprovalsDelta', { defaultValue: 'Needs attention' })}
          tone="warning"
          icon={Clock3}
          trend={orderSeries.map((item) => Math.max(1, Math.round(item.value * 0.5)))}
        />
        <MetricTrendCard
          label={t('common.inEscrow', { defaultValue: 'In escrow' })}
          value={formatMoneyKGS(stats.escrow, i18n.language)}
          hint={t('dashboard.client.escrowHint', { defaultValue: 'Protected budget still on hold' })}
          delta={t('dashboard.client.escrowDelta', { defaultValue: 'Protected flow' })}
          tone="info"
          icon={ShieldCheck}
          trend={spendSeries.map((item) => item.value)}
        />
        <MetricTrendCard
          label={t('common.spent', { defaultValue: 'Spend velocity' })}
          value={formatMoneyKGS(stats.spent, i18n.language)}
          hint={t('dashboard.client.spendHint', { defaultValue: 'Escrow and settlement outflow' })}
          delta={t('dashboard.client.spendDelta', { defaultValue: '+8% MoM' })}
          tone="primary"
          icon={Wallet}
          trend={spendSeries.map((item) => item.value)}
        />
        <MetricTrendCard
          label={t('documents.review', { defaultValue: 'Docs in review' })}
          value={String(stats.documentsReview)}
          hint={t('dashboard.client.docsHint', { defaultValue: 'Agreements and briefs under verification' })}
          delta={t('dashboard.client.docsDelta', { defaultValue: 'Compliance lane' })}
          tone="success"
          icon={FileCheck2}
          trend={documents.slice(0, 6).map((_, index) => 2 + index)}
        />
        <MetricTrendCard
          label={t('support.open', { defaultValue: 'Open support' })}
          value={String(stats.openCases)}
          hint={t('dashboard.client.supportHint', { defaultValue: 'Billing and delivery incidents' })}
          delta={`${unreadNotifications} ${t('dashboard.client.unreadAlerts', { defaultValue: 'alerts' })}`}
          tone="danger"
          icon={LifeBuoy}
          trend={supportCases.slice(0, 6).map((_, index) => 1 + ((index + 1) % 3))}
        />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-8">
          <section className="surface-glow p-5 sm:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-soft)]">
                  {t('dashboard.client.heroKicker', { defaultValue: 'Workspace command layer' })}
                </p>
                <h2 className="mt-2 font-[var(--font-family-display)] text-[clamp(1.75rem,3vw,2.45rem)] font-semibold leading-[1.02] tracking-[-0.04em] text-[var(--color-text)]">
                  {t('dashboard.client.heroTitle', {
                    defaultValue: 'Run finance, approvals and team access like a polished commercial SaaS.',
                  })}
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-[var(--color-text-muted)]">
                  {t('dashboard.client.heroText', {
                    defaultValue: 'This cockpit combines escrow visibility, compliance workflow, billing methods, support SLA and workspace permissions into one client-facing product layer.',
                  })}
                </p>
              </div>

              <div className="grid w-full max-w-md grid-cols-2 gap-3">
                <div className="rounded-[18px] border border-[color-mix(in_srgb,var(--color-primary)_26%,transparent)] bg-[color-mix(in_srgb,var(--color-primary)_10%,transparent)] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-soft)]">
                    {t('dashboard.client.teamSeats', { defaultValue: 'Seats used' })}
                  </p>
                  <p className="mt-2 text-xl font-semibold text-[var(--color-text)]">
                    {subscription.seatsUsed}/{subscription.seatsIncluded}
                  </p>
                </div>
                <div className="rounded-[18px] border border-[color-mix(in_srgb,var(--color-success)_24%,transparent)] bg-[color-mix(in_srgb,var(--color-success)_10%,transparent)] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-soft)]">
                    {t('dashboard.client.verification', { defaultValue: 'Verification' })}
                  </p>
                  <p className="mt-2 text-xl font-semibold text-[var(--color-text)]">{verification.status}</p>
                </div>
                <div className="rounded-[18px] border border-[color-mix(in_srgb,var(--color-info)_24%,transparent)] bg-[color-mix(in_srgb,var(--color-info)_10%,transparent)] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-soft)]">
                    {t('dashboard.client.planValue', { defaultValue: 'Plan value' })}
                  </p>
                  <p className="mt-2 text-xl font-semibold text-[var(--color-text)]">
                    {subscription.priceMonthly} / mo
                  </p>
                </div>
                <div className="rounded-[18px] border border-[color-mix(in_srgb,var(--color-warning)_24%,transparent)] bg-[color-mix(in_srgb,var(--color-warning)_10%,transparent)] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-soft)]">
                    {t('dashboard.client.unreadAlerts', { defaultValue: 'Unread alerts' })}
                  </p>
                  <p className="mt-2 text-xl font-semibold text-[var(--color-text)]">{unreadNotifications}</p>
                </div>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-6 2xl:grid-cols-2">
            <section className="surface p-5 sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="section-title">{t('dashboard.client.orderFlow', { defaultValue: 'Order flow' })}</h2>
                  <p className="section-subtitle mt-1">
                    {t('dashboard.client.orderFlowHint', { defaultValue: 'Monthly contract creation and demand consistency.' })}
                  </p>
                </div>
                <Badge variant="info">{orders.length}</Badge>
              </div>
              <MiniBarChart points={orderSeries} tone="info" />
            </section>

            <section className="surface p-5 sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="section-title">{t('dashboard.client.spendFlow', { defaultValue: 'Spend flow' })}</h2>
                  <p className="section-subtitle mt-1">
                    {t('dashboard.client.spendFlowHint', { defaultValue: 'Escrow and payment volume across recent months.' })}
                  </p>
                </div>
                <Badge variant="success">{transactions.length}</Badge>
              </div>
              <MiniBarChart points={spendSeries} tone="success" />
            </section>
          </section>

          <section className="surface p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="section-title">{t('dashboard.client.activityFeed', { defaultValue: 'Recent activity feed' })}</h2>
                <p className="section-subtitle mt-1">
                  {t('dashboard.client.activityFeedHint', { defaultValue: 'Notifications, support events and workspace operations in one stream.' })}
                </p>
              </div>
              <Link to="/dashboard/client/activity" className="text-sm font-semibold text-[var(--color-primary)] hover:underline">
                {t('dashboard.client.openActivity', { defaultValue: 'Open activity log' })}
              </Link>
            </div>
            <ActivityFeedList
              items={activityItems}
              emptyTitle={t('dashboard.client.activityEmpty', { defaultValue: 'No recent events' })}
              emptyDescription={t('dashboard.client.activityEmptyHint', { defaultValue: 'Workspace activity will appear here.' })}
            />
          </section>

          <section className="surface p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="section-title">{t('dashboard.client.transactionsTitle', { defaultValue: 'Recent transactions' })}</h2>
                <p className="section-subtitle mt-1">
                  {t('dashboard.client.transactionsHint', { defaultValue: 'Last escrow and settlement operations touching this workspace.' })}
                </p>
              </div>
              <Link to="/dashboard/client/finance" className="text-sm font-semibold text-[var(--color-primary)] hover:underline">
                {t('dashboard.client.financeCenter', { defaultValue: 'Finance center' })}
              </Link>
            </div>

            <DataTable
              columns={transactionsColumns}
              data={transactions.slice(0, 6)}
              rowKey={(row) => row.id}
              isLoading={isLoading}
              emptyTitle={t('dashboard.client.transactionsEmpty', { defaultValue: 'No transactions yet' })}
              emptyDescription={t('dashboard.client.transactionsEmptyHint', { defaultValue: 'Escrow transactions will surface after first payment flow.' })}
            />
          </section>
        </div>

        <aside className="space-y-6 xl:col-span-4">
          <section className="surface p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="section-title">{t('dashboard.client.quickActions', { defaultValue: 'Quick actions' })}</h2>
              <Sparkles className="h-4 w-4 text-[var(--color-primary)]" />
            </div>
            <div className="mt-4 grid gap-3">
              {[
                {
                  to: '/orders/new',
                  title: t('dashboard.client.newOrder', { defaultValue: 'Create order' }),
                  hint: t('dashboard.client.newOrderHint', { defaultValue: 'Launch new escrow production work.' }),
                  icon: Plus,
                },
                {
                  to: '/dashboard/client/billing',
                  title: t('dashboard.client.billingCenter', { defaultValue: 'Billing center' }),
                  hint: t('dashboard.client.billingCenterHint', { defaultValue: 'Cards, wallets and checkout methods.' }),
                  icon: CreditCard,
                },
                {
                  to: '/dashboard/client/team',
                  title: t('dashboard.client.teamCenter', { defaultValue: 'Team access' }),
                  hint: t('dashboard.client.teamCenterHint', { defaultValue: 'Invite stakeholders and reviewers.' }),
                  icon: Users2,
                },
                {
                  to: '/dashboard/client/verification',
                  title: t('dashboard.client.verificationCenter', { defaultValue: 'Verification center' }),
                  hint: t('dashboard.client.verificationCenterHint', { defaultValue: 'KYC, business checks and compliance.' }),
                  icon: Building2,
                },
              ].map((item) => (
                <Link key={item.to} to={item.to} className="surface-muted flex items-start gap-3 p-4 transition-colors hover:bg-[var(--color-surface)]">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-[14px] border border-[color-mix(in_srgb,var(--color-primary)_24%,transparent)] bg-[color-mix(in_srgb,var(--color-primary)_10%,transparent)] text-[var(--color-primary)]">
                    <item.icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-[var(--color-text)]">{item.title}</span>
                    <span className="mt-1 block text-xs leading-relaxed text-[var(--color-text-soft)]">{item.hint}</span>
                  </span>
                </Link>
              ))}
            </div>
          </section>

          <section className="surface p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="section-title">{t('dashboard.client.upcoming', { defaultValue: 'Upcoming deadlines' })}</h2>
              <Badge variant="warning">{upcomingDeadlines.length}</Badge>
            </div>
            <TimelineRail items={upcomingDeadlines} />
          </section>

          <section className="surface p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="section-title">{t('dashboard.client.documentsSupport', { defaultValue: 'Docs and support' })}</h2>
              <Badge variant="info">{stats.documentsReview + stats.openCases}</Badge>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[16px] border border-[color-mix(in_srgb,var(--color-warning)_22%,transparent)] bg-[color-mix(in_srgb,var(--color-warning)_10%,transparent)] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-soft)]">
                  {t('documents.review', { defaultValue: 'In review' })}
                </p>
                <p className="mt-2 text-2xl font-semibold text-[var(--color-text)]">{stats.documentsReview}</p>
              </div>
              <div className="rounded-[16px] border border-[color-mix(in_srgb,var(--color-danger)_22%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-soft)]">
                  {t('support.open', { defaultValue: 'Open cases' })}
                </p>
                <p className="mt-2 text-2xl font-semibold text-[var(--color-text)]">{stats.openCases}</p>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {Object.entries(supportSummary).slice(0, 4).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm">
                  <span className="text-[var(--color-text-muted)]">{status}</span>
                  <span className="font-semibold text-[var(--color-text)]">{count}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="surface p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="section-title">{t('dashboard.client.recentDocuments', { defaultValue: 'Recent documents' })}</h2>
              <Link to="/dashboard/client/documents" className="text-sm font-semibold text-[var(--color-primary)] hover:underline">
                {t('common.open', { defaultValue: 'Open' })}
              </Link>
            </div>
            <ActivityFeedList
              items={recentDocuments}
              emptyTitle={t('dashboard.client.documentsEmpty', { defaultValue: 'No documents yet' })}
              emptyDescription={t('dashboard.client.documentsEmptyHint', { defaultValue: 'Upload agreements and briefs to populate this feed.' })}
            />
          </section>

          <section className="surface p-5 sm:p-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="section-title">{t('dashboard.client.workspaceReadiness', { defaultValue: 'Workspace readiness' })}</h2>
              <Badge variant="success">{teamMembers.length}</Badge>
            </div>
            <div className="space-y-2">
              {[
                [t('dashboard.client.seatUsage', { defaultValue: 'Seat usage' }), `${subscription.seatsUsed}/${subscription.seatsIncluded}`],
                [t('dashboard.client.verificationStatus', { defaultValue: 'Verification' }), verification.status],
                [t('dashboard.client.planName', { defaultValue: 'Plan' }), subscription.planName],
                [t('dashboard.client.supportSla', { defaultValue: 'Billing cycle' }), subscription.billingCycle],
              ].map(([label, value]) => (
                <div key={String(label)} className="flex items-center justify-between rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm">
                  <span className="text-[var(--color-text-muted)]">{label}</span>
                  <span className="font-semibold text-[var(--color-text)]">{value}</span>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </section>
    </DashboardShell>
  );
}
