import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  Briefcase,
  CreditCard,
  FileCheck2,
  Rocket,
  ShieldCheck,
  Sparkles,
  Star,
  Wallet,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import api, {
  FreelancerBalanceStats,
  NotificationItem,
  Order,
  PaymentTransaction,
  SupportCase,
  WorkspaceActivityEntry,
  WorkspaceDocument,
  WorkspaceSubscriptionPlan,
  WorkspaceVerificationProfile,
} from '@/services/api';
import { formatDateTime, formatMoneyKGS } from '@/utils/locale';
import { buildMonthSeries, countByStatus, relativeDaysFromNow, sortByNewest } from '@/utils/dashboard';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { getFreelancerSidebarItems } from '@/components/dashboard/dashboardNav';
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
  planCode: 'growth',
  planName: 'Growth Studio',
  billingCycle: 'MONTHLY',
  priceMonthly: 79,
  renewalDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 18).toISOString(),
  seatsIncluded: 4,
  seatsUsed: 2,
  usage: {
    activeProjects: 3,
    storedDocuments: 9,
    monthlyVolume: 98000,
  },
  addons: [
    {
      id: 'priority-payouts',
      name: 'Priority payouts',
      status: 'ACTIVE',
      priceMonthly: 19,
      usage: 'Weekly payouts',
    },
    {
      id: 'verification-lane',
      name: 'Verification lane',
      status: 'TRIAL',
      priceMonthly: 12,
      usage: 'Identity fast-track',
    },
  ],
  invoices: [
    {
      id: 'invoice-current',
      title: 'Growth Studio subscription',
      amount: 79,
      status: 'PAID',
      issuedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12).toISOString(),
      dueAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 11).toISOString(),
    },
  ],
};

const FALLBACK_VERIFICATION: WorkspaceVerificationProfile = {
  status: 'VERIFIED',
  level: 'BUSINESS',
  ownerName: 'Freelancer owner',
  legalEntityName: 'Independent contractor profile',
  country: 'Kyrgyzstan',
  documentType: 'Passport',
  documentNumberMasked: '•••• 9041',
  riskLevel: 'LOW',
  nextStep: 'Verification is complete. Payout methods and premium finance tools are available.',
  checks: [],
};

function asFulfilled<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === 'fulfilled' ? result.value : fallback;
}

function notificationTone(type: string): Tone {
  if (type.includes('COMPLETED') || type.includes('PAYMENT')) return 'success';
  if (type.includes('DISPUTE')) return 'danger';
  if (type.includes('CANCELLED')) return 'warning';
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

export function FreelancerDashboardPage() {
  const { t, i18n } = useTranslation();
  const { isDark } = useTheme();
  const { user, logout } = useAuth();

  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [marketOrders, setMarketOrders] = useState<Order[]>([]);
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [documents, setDocuments] = useState<WorkspaceDocument[]>([]);
  const [supportCases, setSupportCases] = useState<SupportCase[]>([]);
  const [subscription, setSubscription] = useState<WorkspaceSubscriptionPlan>(FALLBACK_SUBSCRIPTION);
  const [verification, setVerification] = useState<WorkspaceVerificationProfile>(FALLBACK_VERIFICATION);
  const [activityLog, setActivityLog] = useState<WorkspaceActivityEntry[]>([]);
  const [balance, setBalance] = useState<FreelancerBalanceStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [
        myOrdersResult,
        marketOrdersResult,
        transactionsResult,
        notificationsResult,
        documentsResult,
        supportResult,
        subscriptionResult,
        verificationResult,
        activityResult,
        balanceResult,
      ] = await Promise.allSettled([
        api.getOrders({ limit: 50 }),
        api.getAvailableOrders({ limit: 30 }),
        api.getTransactions({ limit: 20 }),
        api.getNotifications({ limit: 8 }),
        api.getWorkspaceDocuments(),
        api.getMySupportCases({ limit: 12 }),
        api.getWorkspaceSubscription(),
        api.getWorkspaceVerification(),
        api.getWorkspaceActivityLog({ limit: 10 }),
        api.getFreelancerBalance(),
      ]);

      setMyOrders(asFulfilled(myOrdersResult, { data: [], pagination: { page: 1, limit: 0, total: 0, pages: 1 } }).data);
      setMarketOrders(asFulfilled(marketOrdersResult, { data: [], pagination: { page: 1, limit: 0, total: 0, pages: 1 } }).data);
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
      setSubscription(asFulfilled(subscriptionResult, FALLBACK_SUBSCRIPTION));
      setVerification(asFulfilled(verificationResult, FALLBACK_VERIFICATION));
      setActivityLog(asFulfilled(activityResult, []));
      setBalance(asFulfilled(balanceResult, null));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('dashboard.freelancer.loadFailed', { defaultValue: 'Failed to load dashboard' })
      );
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const deliverySeries = useMemo(
    () => buildMonthSeries(myOrders, i18n.language, { getDate: (order) => order.createdAt }),
    [i18n.language, myOrders]
  );
  const earningsSeries = useMemo(
    () => buildMonthSeries(transactions, i18n.language, { getDate: (tx) => tx.createdAt, getValue: (tx) => tx.amount }),
    [i18n.language, transactions]
  );

  const stats = useMemo(() => {
    const active = myOrders.filter((order) => ['ACTIVE', 'SUBMITTED'].includes(order.status)).length;
    const submitted = myOrders.filter((order) => order.status === 'SUBMITTED').length;
    const available = marketOrders.length;
    const documentsReview = documents.filter((item) => item.status === 'UNDER_REVIEW').length;
    const openCases = supportCases.filter((item) => !['RESOLVED', 'CLOSED'].includes(item.status)).length;
    const completed = myOrders.filter((order) => order.status === 'COMPLETED').length;
    const totalEarned = transactions
      .filter((tx) => ['ESCROW_RELEASE', 'WITHDRAWAL', 'PAYMENT_RECEIVED'].includes(tx.type))
      .reduce((sum, tx) => sum + tx.amount, 0);

    return { active, submitted, available, documentsReview, openCases, completed, totalEarned };
  }, [documents, marketOrders.length, myOrders, supportCases, transactions]);

  const supportSummary = useMemo(() => countByStatus(supportCases, (item) => item.status), [supportCases]);

  const upcomingDeadlines = useMemo(
    () =>
      [...myOrders]
        .filter((order) => ['ACTIVE', 'SUBMITTED'].includes(order.status) && order.deadline)
        .sort((left, right) => new Date(left.deadline || 0).getTime() - new Date(right.deadline || 0).getTime())
        .slice(0, 5)
        .map((order) => ({
          id: order.id,
          title: order.title,
          description: `${order.client.name} • ${formatMoneyKGS(order.budget, i18n.language)}`,
          meta:
            relativeDaysFromNow(order.deadline) !== null
              ? t('dashboard.freelancer.deadlineIn', {
                  defaultValue: '{{days}} days left',
                  days: relativeDaysFromNow(order.deadline),
                })
              : undefined,
          tone: order.status === 'SUBMITTED' ? ('warning' as const) : ('info' as const),
        })),
    [i18n.language, myOrders, t]
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
        ...myOrders.map((item) => ({
          id: item.id,
          createdAt: item.createdAt,
          title: item.title,
          subtitle: item.status,
          badge: item.status,
          tone:
            item.status === 'COMPLETED'
              ? ('success' as const)
              : item.status === 'SUBMITTED'
                ? ('warning' as const)
                : ('info' as const),
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
  }, [activityLog, i18n.language, myOrders, notifications]);

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

  const marketSnapshot = useMemo(
    () =>
      marketOrders.slice(0, 4).map((item) => ({
        id: item.id,
        title: item.title,
        subtitle: item.category || t('dashboard.freelancer.noCategory', { defaultValue: 'No category' }),
        meta: formatMoneyKGS(item.budget, i18n.language),
        badge: item.status,
        tone: 'info' as const,
        to: `/orders/${item.id}`,
      })),
    [i18n.language, marketOrders, t]
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
  if (user.role !== 'FREELANCER') return <Navigate to="/dashboard/client/overview" replace />;

  return (
    <DashboardShell
      isDark={isDark}
      sidebarTitle={user.name || t('topbar.user', { defaultValue: 'User' })}
      sidebarSubtitle={t('dashboard.freelancer.workspaceSubtitle', { defaultValue: 'Freelancer operating system' })}
      sidebarItems={getFreelancerSidebarItems()}
      onLogout={logout}
    >
      <PageHeader
        title={t('dashboard.freelancer.title', { defaultValue: 'Revenue cockpit' })}
        subtitle={t('dashboard.freelancer.subtitle', {
          defaultValue: 'Track revenue, delivery pressure, payout readiness and market opportunities from one premium freelancer cockpit.',
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
              to="/dashboard/freelancer/market"
              className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-control)] bg-[var(--color-primary)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-hover)]"
            >
              <Rocket className="h-4 w-4" />
              {t('dashboard.freelancer.marketAll', { defaultValue: 'Open marketplace' })}
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
          label={t('dashboard.freelancer.activeOrders', { defaultValue: 'Live delivery' })}
          value={String(stats.active)}
          hint={t('dashboard.freelancer.activeOrdersHint', { defaultValue: 'Orders in active execution' })}
          delta={t('dashboard.freelancer.activeOrdersDelta', { defaultValue: 'Pipeline loaded' })}
          icon={Briefcase}
          trend={deliverySeries.map((item) => item.value)}
        />
        <MetricTrendCard
          label={t('dashboard.freelancer.pendingApprovals', { defaultValue: 'Pending approvals' })}
          value={String(stats.submitted)}
          hint={t('dashboard.freelancer.pendingApprovalsHint', { defaultValue: 'Delivered work waiting for sign-off' })}
          delta={t('dashboard.freelancer.pendingApprovalsDelta', { defaultValue: 'Client action needed' })}
          tone="warning"
          icon={ShieldCheck}
          trend={deliverySeries.map((item) => Math.max(1, Math.round(item.value * 0.45)))}
        />
        <MetricTrendCard
          label={t('common.available', { defaultValue: 'Available balance' })}
          value={formatMoneyKGS(balance?.available || 0, i18n.language)}
          hint={t('dashboard.freelancer.balanceHint', { defaultValue: 'Ready for payout request' })}
          delta={t('dashboard.freelancer.balanceDelta', { defaultValue: 'Payout ready' })}
          tone="success"
          icon={Wallet}
          trend={earningsSeries.map((item) => item.value)}
        />
        <MetricTrendCard
          label={t('common.earned', { defaultValue: 'Total earned' })}
          value={formatMoneyKGS(stats.totalEarned, i18n.language)}
          hint={t('dashboard.freelancer.earnedHint', { defaultValue: 'Completed payouts and releases' })}
          delta={t('dashboard.freelancer.earnedDelta', { defaultValue: '+14% MoM' })}
          tone="info"
          icon={CreditCard}
          trend={earningsSeries.map((item) => item.value)}
        />
        <MetricTrendCard
          label={t('documents.review', { defaultValue: 'Docs in review' })}
          value={String(stats.documentsReview)}
          hint={t('dashboard.freelancer.docsHint', { defaultValue: 'Files waiting for compliance or signature' })}
          delta={t('dashboard.freelancer.docsDelta', { defaultValue: 'Verification lane' })}
          tone="primary"
          icon={FileCheck2}
          trend={documents.slice(0, 6).map((_, index) => 2 + index)}
        />
        <MetricTrendCard
          label={t('dashboard.freelancer.marketDemand', { defaultValue: 'Market demand' })}
          value={String(stats.available)}
          hint={t('dashboard.freelancer.marketDemandHint', { defaultValue: 'Available client opportunities' })}
          delta={`${unreadNotifications} ${t('dashboard.freelancer.unreadAlerts', { defaultValue: 'alerts' })}`}
          tone="danger"
          icon={Star}
          trend={marketOrders.slice(0, 6).map((_, index) => 2 + ((index + 1) % 4))}
        />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-8">
          <section className="surface-glow p-5 sm:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-soft)]">
                  {t('dashboard.freelancer.heroKicker', { defaultValue: 'Freelancer operating layer' })}
                </p>
                <h2 className="mt-2 font-[var(--font-family-display)] text-[clamp(1.75rem,3vw,2.45rem)] font-semibold leading-[1.02] tracking-[-0.04em] text-[var(--color-text)]">
                  {t('dashboard.freelancer.heroTitle', {
                    defaultValue: 'Manage delivery, trust and payouts like a premium commercial platform.',
                  })}
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-[var(--color-text-muted)]">
                  {t('dashboard.freelancer.heroText', {
                    defaultValue: 'This cockpit fuses pipeline visibility, payout readiness, compliance and market demand into a dense freelancer SaaS experience built for local demo.',
                  })}
                </p>
              </div>

              <div className="grid w-full max-w-md grid-cols-2 gap-3">
                <div className="rounded-[18px] border border-[color-mix(in_srgb,var(--color-success)_24%,transparent)] bg-[color-mix(in_srgb,var(--color-success)_10%,transparent)] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-soft)]">
                    {t('dashboard.freelancer.verification', { defaultValue: 'Verification' })}
                  </p>
                  <p className="mt-2 text-xl font-semibold text-[var(--color-text)]">{verification.status}</p>
                </div>
                <div className="rounded-[18px] border border-[color-mix(in_srgb,var(--color-primary)_24%,transparent)] bg-[color-mix(in_srgb,var(--color-primary)_10%,transparent)] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-soft)]">
                    {t('dashboard.freelancer.plan', { defaultValue: 'Plan' })}
                  </p>
                  <p className="mt-2 text-xl font-semibold text-[var(--color-text)]">{subscription.planName}</p>
                </div>
                <div className="rounded-[18px] border border-[color-mix(in_srgb,var(--color-info)_24%,transparent)] bg-[color-mix(in_srgb,var(--color-info)_10%,transparent)] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-soft)]">
                    {t('dashboard.freelancer.inEscrow', { defaultValue: 'In escrow' })}
                  </p>
                  <p className="mt-2 text-xl font-semibold text-[var(--color-text)]">
                    {formatMoneyKGS(balance?.inEscrow || 0, i18n.language)}
                  </p>
                </div>
                <div className="rounded-[18px] border border-[color-mix(in_srgb,var(--color-warning)_24%,transparent)] bg-[color-mix(in_srgb,var(--color-warning)_10%,transparent)] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-soft)]">
                    {t('dashboard.freelancer.pendingPayout', { defaultValue: 'Pending payout' })}
                  </p>
                  <p className="mt-2 text-xl font-semibold text-[var(--color-text)]">
                    {formatMoneyKGS(balance?.pending || 0, i18n.language)}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-6 2xl:grid-cols-2">
            <section className="surface p-5 sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="section-title">{t('dashboard.freelancer.deliveryFlow', { defaultValue: 'Delivery flow' })}</h2>
                  <p className="section-subtitle mt-1">
                    {t('dashboard.freelancer.deliveryFlowHint', { defaultValue: 'Monthly intake and execution tempo.' })}
                  </p>
                </div>
                <Badge variant="info">{myOrders.length}</Badge>
              </div>
              <MiniBarChart points={deliverySeries} tone="info" />
            </section>

            <section className="surface p-5 sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="section-title">{t('dashboard.freelancer.earningsFlow', { defaultValue: 'Earnings flow' })}</h2>
                  <p className="section-subtitle mt-1">
                    {t('dashboard.freelancer.earningsFlowHint', { defaultValue: 'Recent payout and release activity.' })}
                  </p>
                </div>
                <Badge variant="success">{transactions.length}</Badge>
              </div>
              <MiniBarChart points={earningsSeries} tone="success" />
            </section>
          </section>

          <section className="surface p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="section-title">{t('dashboard.freelancer.activityFeed', { defaultValue: 'Recent activity' })}</h2>
                <p className="section-subtitle mt-1">
                  {t('dashboard.freelancer.activityFeedHint', { defaultValue: 'Notifications, delivery actions and product activity in one stream.' })}
                </p>
              </div>
              <Link to="/dashboard/freelancer/activity" className="text-sm font-semibold text-[var(--color-primary)] hover:underline">
                {t('dashboard.freelancer.openActivity', { defaultValue: 'Open activity log' })}
              </Link>
            </div>
            <ActivityFeedList
              items={activityItems}
              emptyTitle={t('dashboard.freelancer.activityEmpty', { defaultValue: 'No recent events' })}
              emptyDescription={t('dashboard.freelancer.activityEmptyHint', { defaultValue: 'Workspace activity will appear here.' })}
            />
          </section>

          <section className="surface p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="section-title">{t('dashboard.freelancer.transactionsTitle', { defaultValue: 'Recent transactions' })}</h2>
                <p className="section-subtitle mt-1">
                  {t('dashboard.freelancer.transactionsHint', { defaultValue: 'Latest releases, withdrawals and payout events.' })}
                </p>
              </div>
              <Link to="/dashboard/freelancer/finance" className="text-sm font-semibold text-[var(--color-primary)] hover:underline">
                {t('dashboard.freelancer.openFinance', { defaultValue: 'Open finance' })}
              </Link>
            </div>
            <DataTable
              columns={transactionsColumns}
              data={transactions.slice(0, 6)}
              rowKey={(row) => row.id}
              isLoading={isLoading}
              emptyTitle={t('dashboard.freelancer.transactionsEmpty', { defaultValue: 'No transactions yet' })}
              emptyDescription={t('dashboard.freelancer.transactionsEmptyHint', { defaultValue: 'Payout activity will appear after first completed order.' })}
            />
          </section>
        </div>

        <aside className="space-y-6 xl:col-span-4">
          <section className="surface p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="section-title">{t('dashboard.freelancer.quickActions', { defaultValue: 'Quick actions' })}</h2>
              <Sparkles className="h-4 w-4 text-[var(--color-primary)]" />
            </div>
            <div className="mt-4 grid gap-3">
              {[
                {
                  to: '/dashboard/freelancer/market',
                  title: t('dashboard.freelancer.marketAll', { defaultValue: 'Marketplace' }),
                  hint: t('dashboard.freelancer.marketHint', { defaultValue: 'Open available client opportunities.' }),
                  icon: Rocket,
                },
                {
                  to: '/dashboard/freelancer/payouts',
                  title: t('dashboard.freelancer.payoutCenter', { defaultValue: 'Payout methods' }),
                  hint: t('dashboard.freelancer.payoutCenterHint', { defaultValue: 'Cards, wallets and bank payouts.' }),
                  icon: CreditCard,
                },
                {
                  to: '/dashboard/freelancer/resume',
                  title: t('dashboard.freelancer.resumeCenter', { defaultValue: 'Resume center' }),
                  hint: t('dashboard.freelancer.resumeCenterHint', { defaultValue: 'Strengthen your public delivery profile.' }),
                  icon: Briefcase,
                },
                {
                  to: '/dashboard/freelancer/verification',
                  title: t('dashboard.freelancer.verificationCenter', { defaultValue: 'Verification center' }),
                  hint: t('dashboard.freelancer.verificationCenterHint', { defaultValue: 'Identity, payouts and compliance.' }),
                  icon: ShieldCheck,
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
              <h2 className="section-title">{t('dashboard.freelancer.deadlines', { defaultValue: 'Delivery pressure' })}</h2>
              <Badge variant="warning">{upcomingDeadlines.length}</Badge>
            </div>
            <TimelineRail items={upcomingDeadlines} />
          </section>

          <section className="surface p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="section-title">{t('dashboard.freelancer.marketSnapshot', { defaultValue: 'Market snapshot' })}</h2>
              <Link to="/dashboard/freelancer/market" className="text-sm font-semibold text-[var(--color-primary)] hover:underline">
                {t('common.open', { defaultValue: 'Open' })}
              </Link>
            </div>
            <ActivityFeedList
              items={marketSnapshot}
              emptyTitle={t('dashboard.freelancer.marketEmpty', { defaultValue: 'No marketplace orders' })}
              emptyDescription={t('dashboard.freelancer.marketEmptyHint', { defaultValue: 'Client demand will appear here.' })}
            />
          </section>

          <section className="surface p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="section-title">{t('dashboard.freelancer.docsSupport', { defaultValue: 'Docs and support' })}</h2>
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
              <h2 className="section-title">{t('dashboard.freelancer.recentDocuments', { defaultValue: 'Recent documents' })}</h2>
              <Link to="/dashboard/freelancer/documents" className="text-sm font-semibold text-[var(--color-primary)] hover:underline">
                {t('common.open', { defaultValue: 'Open' })}
              </Link>
            </div>
            <ActivityFeedList
              items={recentDocuments}
              emptyTitle={t('dashboard.freelancer.documentsEmpty', { defaultValue: 'No documents yet' })}
              emptyDescription={t('dashboard.freelancer.documentsEmptyHint', { defaultValue: 'Upload contracts, reports and payout records to populate this feed.' })}
            />
          </section>
        </aside>
      </section>
    </DashboardShell>
  );
}
