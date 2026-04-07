import { type ReactNode, useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Activity,
  ClipboardList,
  FileText,
  RefreshCw,
  Scale,
  Search,
  Settings2,
  ShieldAlert,
  Users,
  Wallet,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import api, {
  AdminDisputeRow,
  AdminOrderRow,
  AdminStatsResponse,
  AdminUserRow,
  ApiError,
  AuditLogItem,
  LedgerEntryRow,
  LedgerSummaryResponse,
  PlatformFlagsResponse,
} from '@/services/api';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { getAdminSidebarItems } from '@/components/dashboard/dashboardNav';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { Badge, getOrderStatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SegmentedControl, type SegmentedControlOption } from '@/components/ui/SegmentedControl';
import { EmptyState } from '@/components/ui/EmptyState';
import { Switch } from '@/components/ui/Switch';
import { getErrorMessage } from '@/utils/errorMessage';
import { formatDateTime, formatMoneyKGS } from '@/utils/locale';
import { WORKSPACE_PATH } from '@/utils/routes';

type UserRoleFilter = 'all' | AdminUserRow['role'];
type OrderStatusFilter = 'all' | AdminOrderRow['status'];
type DisputeStatusFilter = 'all' | 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'CLOSED';
type LedgerAccountFilter =
  | 'all'
  | 'ESCROW'
  | 'USER_BALANCE'
  | 'PLATFORM_REVENUE'
  | 'WITHDRAWAL_HOLD'
  | 'WITHDRAWAL_PAID'
  | 'REFUND_RESERVE';

const AUDIT_FLAG_KEY = 'audit_panel.enabled';
const LEDGER_FLAG_KEY = 'ledger.enabled';

interface SectionHeaderProps {
  title: string;
  subtitle: string;
  count?: number;
  action?: ReactNode;
}

function SectionHeader({ title, subtitle, count, action }: SectionHeaderProps) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-[var(--color-text)]">{title}</h2>
          {typeof count === 'number' ? (
            <Badge variant="default" size="sm">
              {count}
            </Badge>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">{subtitle}</p>
      </div>

      {action ? <div className="flex items-center gap-2 self-start">{action}</div> : null}
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--color-danger)_38%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_12%,transparent)] px-4 py-3 text-sm text-[var(--color-danger)]">
      {message}
    </div>
  );
}

function getRoleBadgeVariant(role: AdminUserRow['role']) {
  if (role === 'ADMIN') return 'info';
  if (role === 'FREELANCER') return 'success';
  return 'default';
}

function getDisputeBadgeVariant(status: string) {
  if (status === 'OPEN' || status === 'IN_REVIEW') return 'warning';
  if (status === 'RESOLVED') return 'success';
  if (status === 'CLOSED') return 'default';
  return 'info';
}

function isFeatureDisabledError(error: unknown, flagKey: string): boolean {
  return error instanceof ApiError && error.status === 503 && error.message.includes(flagKey);
}

function getFeatureFlagLabel(key: string): string {
  const labels: Record<string, string> = {
    'escrow.enabled': 'Escrow',
    'withdrawals.enabled': 'Withdrawals',
    'disputes.enabled': 'Disputes',
    'milestones.enabled': 'Milestones',
    'change_requests.enabled': 'Change requests',
    'proposals.enabled': 'Proposals',
    'support_cases.enabled': 'Support cases',
    'telegram.enabled': 'Telegram',
    'recommendations.enabled': 'Recommendations',
    [AUDIT_FLAG_KEY]: 'Audit panel',
    [LEDGER_FLAG_KEY]: 'Ledger',
  };

  return labels[key] || key;
}

function getFeatureFlagDescription(key: string): string {
  const descriptions: Record<string, string> = {
    'escrow.enabled': 'Controls escrow-backed order funding and release flows.',
    'withdrawals.enabled': 'Allows balance withdrawal requests and approval operations.',
    'disputes.enabled': 'Keeps dispute opening and resolution flows available platform-wide.',
    'milestones.enabled': 'Enables milestone-based delivery workflows for orders.',
    'change_requests.enabled': 'Turns on scoped change request workflows for active orders.',
    'proposals.enabled': 'Shows marketplace proposals and proposal response flows.',
    'support_cases.enabled': 'Keeps support ticket intake and case handling active.',
    'telegram.enabled': 'Enables Telegram linking and bot-driven delivery notifications.',
    'recommendations.enabled': 'Controls recommendation surfaces and related ranking logic.',
    [AUDIT_FLAG_KEY]: 'Exposes privileged action history in the admin console.',
    [LEDGER_FLAG_KEY]: 'Exposes double-entry finance visibility and accounting summaries.',
  };

  return descriptions[key] || 'Platform capability toggle controlled from SystemSetting.';
}

function getLedgerAccountLabel(account: string): string {
  return account
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function AdminPage() {
  const { t, i18n } = useTranslation();
  const { isDark } = useTheme();
  const { user, logout } = useAuth();

  const [stats, setStats] = useState<AdminStatsResponse | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);

  const [orders, setOrders] = useState<AdminOrderRow[]>([]);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  const [disputes, setDisputes] = useState<AdminDisputeRow[]>([]);
  const [disputesTotal, setDisputesTotal] = useState(0);
  const [disputesLoading, setDisputesLoading] = useState(true);
  const [disputesError, setDisputesError] = useState<string | null>(null);

  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditLoading, setAuditLoading] = useState(true);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditDisabled, setAuditDisabled] = useState(false);

  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntryRow[]>([]);
  const [ledgerSummary, setLedgerSummary] = useState<LedgerSummaryResponse | null>(null);
  const [ledgerTotal, setLedgerTotal] = useState(0);
  const [ledgerLoading, setLedgerLoading] = useState(true);
  const [ledgerError, setLedgerError] = useState<string | null>(null);
  const [ledgerDisabled, setLedgerDisabled] = useState(false);

  const [platformFlags, setPlatformFlags] = useState<PlatformFlagsResponse | null>(null);
  const [flagsLoading, setFlagsLoading] = useState(true);
  const [flagsError, setFlagsError] = useState<string | null>(null);

  const [actionLoadingKey, setActionLoadingKey] = useState<string | null>(null);
  const [refreshingAll, setRefreshingAll] = useState(false);

  const [usersSearch, setUsersSearch] = useState('');
  const [usersRoleFilter, setUsersRoleFilter] = useState<UserRoleFilter>('all');
  const [ordersStatusFilter, setOrdersStatusFilter] = useState<OrderStatusFilter>('all');
  const [disputesStatusFilter, setDisputesStatusFilter] = useState<DisputeStatusFilter>('OPEN');
  const [auditActionFilter, setAuditActionFilter] = useState('');
  const [auditEntityFilter, setAuditEntityFilter] = useState('');
  const [ledgerAccountFilter, setLedgerAccountFilter] = useState<LedgerAccountFilter>('all');
  const [ledgerUserFilter, setLedgerUserFilter] = useState('');
  const [ledgerOrderFilter, setLedgerOrderFilter] = useState('');

  const deferredUsersSearch = useDeferredValue(usersSearch);
  const deferredAuditActionFilter = useDeferredValue(auditActionFilter);
  const deferredAuditEntityFilter = useDeferredValue(auditEntityFilter);
  const deferredLedgerUserFilter = useDeferredValue(ledgerUserFilter);
  const deferredLedgerOrderFilter = useDeferredValue(ledgerOrderFilter);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError(null);

    try {
      const response = await api.getAdminStats();
      setStats(response);
    } catch (error) {
      setStatsError(getErrorMessage(error, t('common.loadFailed', { defaultValue: 'Failed to load admin statistics' })));
    } finally {
      setStatsLoading(false);
    }
  }, [t]);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersError(null);

    try {
      const response = await api.getAdminUsers({
        limit: 50,
        role: usersRoleFilter === 'all' ? undefined : usersRoleFilter,
        search: deferredUsersSearch.trim() || undefined,
      });

      setUsers(response.users || []);
      setUsersTotal(response.pagination?.total || 0);
    } catch (error) {
      setUsersError(getErrorMessage(error, t('common.loadFailed', { defaultValue: 'Failed to load users' })));
    } finally {
      setUsersLoading(false);
    }
  }, [deferredUsersSearch, t, usersRoleFilter]);

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    setOrdersError(null);

    try {
      const response = await api.getAdminOrders({
        limit: 50,
        status: ordersStatusFilter === 'all' ? undefined : ordersStatusFilter,
      });

      setOrders(response.orders || []);
      setOrdersTotal(response.pagination?.total || 0);
    } catch (error) {
      setOrdersError(getErrorMessage(error, t('common.loadFailed', { defaultValue: 'Failed to load orders' })));
    } finally {
      setOrdersLoading(false);
    }
  }, [ordersStatusFilter, t]);

  const loadDisputes = useCallback(async () => {
    setDisputesLoading(true);
    setDisputesError(null);

    try {
      const response = await api.getAdminDisputes({
        limit: 50,
        status: disputesStatusFilter === 'all' ? 'all' : disputesStatusFilter,
      });

      setDisputes(response.disputes || []);
      setDisputesTotal(response.pagination?.total || 0);
    } catch (error) {
      setDisputesError(getErrorMessage(error, t('common.loadFailed', { defaultValue: 'Failed to load disputes' })));
    } finally {
      setDisputesLoading(false);
    }
  }, [disputesStatusFilter, t]);

  const loadPlatformFlags = useCallback(async (): Promise<PlatformFlagsResponse | null> => {
    setFlagsLoading(true);
    setFlagsError(null);

    try {
      const response = await api.getPlatformFlags();
      setPlatformFlags(response);
      return response;
    } catch (error) {
      setPlatformFlags(null);
      setFlagsError(getErrorMessage(error, t('common.loadFailed', { defaultValue: 'Failed to load feature flags' })));
      return null;
    } finally {
      setFlagsLoading(false);
    }
  }, [t]);

  const loadAuditLogs = useCallback(async () => {
    setAuditLoading(true);
    setAuditError(null);

    try {
      const response = await api.getAdminAuditLogs({
        limit: 50,
        action: deferredAuditActionFilter.trim() || undefined,
        entityType: deferredAuditEntityFilter.trim() || undefined,
      });

      setAuditDisabled(false);
      setAuditLogs(response.data || []);
      setAuditTotal(response.pagination?.total || 0);
    } catch (error) {
      if (isFeatureDisabledError(error, AUDIT_FLAG_KEY)) {
        setAuditDisabled(true);
        setAuditLogs([]);
        setAuditTotal(0);
        setAuditError(null);
      } else {
        setAuditDisabled(false);
        setAuditError(getErrorMessage(error, t('common.loadFailed', { defaultValue: 'Failed to load audit log' })));
      }
    } finally {
      setAuditLoading(false);
    }
  }, [deferredAuditActionFilter, deferredAuditEntityFilter, t]);

  const loadLedger = useCallback(async () => {
    setLedgerLoading(true);
    setLedgerError(null);

    try {
      const [summaryResponse, entriesResponse] = await Promise.all([
        api.getAdminLedgerSummary({
          userId: deferredLedgerUserFilter.trim() || undefined,
          orderId: deferredLedgerOrderFilter.trim() || undefined,
        }),
        api.getAdminLedgerEntries({
          limit: 50,
          account: ledgerAccountFilter === 'all' ? undefined : ledgerAccountFilter,
          userId: deferredLedgerUserFilter.trim() || undefined,
          orderId: deferredLedgerOrderFilter.trim() || undefined,
        }),
      ]);

      setLedgerDisabled(false);
      setLedgerSummary(summaryResponse);
      setLedgerEntries(entriesResponse.data || []);
      setLedgerTotal(entriesResponse.pagination?.total || 0);
    } catch (error) {
      if (isFeatureDisabledError(error, LEDGER_FLAG_KEY)) {
        setLedgerDisabled(true);
        setLedgerSummary(null);
        setLedgerEntries([]);
        setLedgerTotal(0);
        setLedgerError(null);
      } else {
        setLedgerDisabled(false);
        setLedgerError(getErrorMessage(error, t('common.loadFailed', { defaultValue: 'Failed to load ledger' })));
      }
    } finally {
      setLedgerLoading(false);
    }
  }, [deferredLedgerOrderFilter, deferredLedgerUserFilter, ledgerAccountFilter, t]);

  const refreshAll = useCallback(async () => {
    setRefreshingAll(true);

    try {
      const flags = await loadPlatformFlags();

      await Promise.all([loadStats(), loadUsers(), loadOrders(), loadDisputes()]);

      if (!flags || flags.flags[AUDIT_FLAG_KEY] !== false) {
        await loadAuditLogs();
      } else {
        setAuditDisabled(true);
        setAuditLoading(false);
        setAuditError(null);
        setAuditLogs([]);
        setAuditTotal(0);
      }

      if (!flags || flags.flags[LEDGER_FLAG_KEY] !== false) {
        await loadLedger();
      } else {
        setLedgerDisabled(true);
        setLedgerLoading(false);
        setLedgerError(null);
        setLedgerEntries([]);
        setLedgerSummary(null);
        setLedgerTotal(0);
      }
    } finally {
      setRefreshingAll(false);
    }
  }, [loadAuditLogs, loadDisputes, loadLedger, loadOrders, loadPlatformFlags, loadStats, loadUsers]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    void loadDisputes();
  }, [loadDisputes]);

  useEffect(() => {
    void loadPlatformFlags();
  }, [loadPlatformFlags]);

  useEffect(() => {
    if (platformFlags?.flags[AUDIT_FLAG_KEY] === false) {
      setAuditDisabled(true);
      setAuditLoading(false);
      setAuditError(null);
      setAuditLogs([]);
      setAuditTotal(0);
      return;
    }

    void loadAuditLogs();
  }, [loadAuditLogs, platformFlags?.flags[AUDIT_FLAG_KEY]]);

  useEffect(() => {
    if (platformFlags?.flags[LEDGER_FLAG_KEY] === false) {
      setLedgerDisabled(true);
      setLedgerLoading(false);
      setLedgerError(null);
      setLedgerEntries([]);
      setLedgerSummary(null);
      setLedgerTotal(0);
      return;
    }

    void loadLedger();
  }, [loadLedger, platformFlags?.flags[LEDGER_FLAG_KEY]]);

  const toggleUserBan = useCallback(
    async (row: AdminUserRow) => {
      if (row.role === 'ADMIN') return;

      try {
        setActionLoadingKey(`user:${row.id}`);
        await api.updateAdminUser(row.id, { isBanned: !row.isBanned });
        await Promise.all([loadUsers(), loadStats(), loadAuditLogs()]);
      } catch (error) {
        setUsersError(getErrorMessage(error, t('common.actionFailed', { defaultValue: 'Failed to update user' })));
      } finally {
        setActionLoadingKey(null);
      }
    },
    [loadAuditLogs, loadStats, loadUsers, t]
  );

  const resolveDispute = useCallback(
    async (row: AdminDisputeRow, target: 'client' | 'freelancer') => {
      if (row.status === 'RESOLVED' || row.status === 'CLOSED') return;

      try {
        setActionLoadingKey(`dispute:${row.id}:${target}`);
        if (target === 'client') {
          await api.resolveDisputeToClient(row.id, 'Решение админа: возврат клиенту');
        } else {
          await api.resolveDisputeToFreelancer(row.id, 'Решение админа: выплата фрилансеру');
        }

        const reloads: Array<Promise<unknown>> = [loadDisputes(), loadStats(), loadOrders()];
        if (platformFlags?.flags[AUDIT_FLAG_KEY] !== false) reloads.push(loadAuditLogs());
        if (platformFlags?.flags[LEDGER_FLAG_KEY] !== false) reloads.push(loadLedger());
        await Promise.all(reloads);
      } catch (error) {
        setDisputesError(getErrorMessage(error, t('common.actionFailed', { defaultValue: 'Failed to resolve dispute' })));
      } finally {
        setActionLoadingKey(null);
      }
    },
    [loadAuditLogs, loadDisputes, loadLedger, loadOrders, loadStats, platformFlags?.flags, t]
  );

  const updateFeatureFlag = useCallback(
    async (key: string, enabled: boolean) => {
      try {
        setActionLoadingKey(`flag:${key}`);
        const response = await api.updatePlatformFlag(key, enabled);

        setPlatformFlags((current) =>
          current
            ? {
                ...current,
                flags: {
                  ...current.flags,
                  [response.key]: response.enabled,
                },
              }
            : current
        );
      } catch (error) {
        setFlagsError(getErrorMessage(error, t('common.actionFailed', { defaultValue: 'Failed to update feature flag' })));
      } finally {
        setActionLoadingKey(null);
      }
    },
    [t]
  );

  const roleOptions = useMemo<Array<SegmentedControlOption<UserRoleFilter>>>(
    () => [
      { value: 'all', label: t('common.all', { defaultValue: 'All' }) },
      { value: 'CLIENT', label: 'Client' },
      { value: 'FREELANCER', label: 'Freelancer' },
      { value: 'ADMIN', label: 'Admin' },
    ],
    [t]
  );

  const orderStatusOptions = useMemo<Array<SegmentedControlOption<OrderStatusFilter>>>(
    () => [
      { value: 'all', label: t('common.all', { defaultValue: 'All' }) },
      { value: 'PENDING', label: 'Pending' },
      { value: 'ACTIVE', label: 'Active' },
      { value: 'SUBMITTED', label: 'Submitted' },
      { value: 'COMPLETED', label: 'Completed' },
      { value: 'DISPUTED', label: 'Disputed' },
      { value: 'CANCELLED', label: 'Cancelled' },
    ],
    [t]
  );

  const disputeStatusOptions = useMemo<Array<SegmentedControlOption<DisputeStatusFilter>>>(
    () => [
      { value: 'OPEN', label: 'Open' },
      { value: 'IN_REVIEW', label: 'In review' },
      { value: 'RESOLVED', label: 'Resolved' },
      { value: 'CLOSED', label: 'Closed' },
      { value: 'all', label: t('common.all', { defaultValue: 'All' }) },
    ],
    [t]
  );

  const ledgerAccountOptions = useMemo<Array<SegmentedControlOption<LedgerAccountFilter>>>(
    () => [
      { value: 'all', label: t('common.all', { defaultValue: 'All accounts' }) },
      { value: 'ESCROW', label: 'Escrow' },
      { value: 'USER_BALANCE', label: 'User balance' },
      { value: 'PLATFORM_REVENUE', label: 'Revenue' },
      { value: 'WITHDRAWAL_HOLD', label: 'Hold' },
      { value: 'WITHDRAWAL_PAID', label: 'Paid' },
      { value: 'REFUND_RESERVE', label: 'Reserve' },
    ],
    [t]
  );

  const recentOrderColumns = useMemo<Array<DataTableColumn<NonNullable<AdminStatsResponse['recentOrders']>[number]>>>(
    () => [
      {
        key: 'title',
        header: t('common.orders', { defaultValue: 'Orders' }),
        render: (row) => (
          <div>
            <p className="font-semibold text-[var(--color-text)]">{row.title}</p>
            <p className="text-xs text-[var(--color-text-soft)]">
              {row.client?.name || '-'} {row.freelancer?.name ? `-> ${row.freelancer.name}` : ''}
            </p>
          </div>
        ),
      },
      {
        key: 'status',
        header: t('common.status', { defaultValue: 'Status' }),
        render: (row) => {
          const badge = getOrderStatusBadge(row.status as AdminOrderRow['status']);
          return <Badge variant={badge.variant}>{badge.label}</Badge>;
        },
      },
      {
        key: 'budget',
        header: t('common.budget', { defaultValue: 'Budget' }),
        render: (row) => <span className="font-semibold text-[var(--color-text)]">{formatMoneyKGS(row.budget, i18n.language)}</span>,
      },
      {
        key: 'createdAt',
        header: t('common.createdAt', { defaultValue: 'Created' }),
        render: (row) => <span className="text-sm text-[var(--color-text-muted)]">{formatDateTime(row.createdAt, i18n.language)}</span>,
      },
    ],
    [i18n.language, t]
  );

  const recentUserColumns = useMemo<Array<DataTableColumn<NonNullable<AdminStatsResponse['recentUsers']>[number]>>>(
    () => [
      {
        key: 'user',
        header: t('common.user', { defaultValue: 'User' }),
        render: (row) => (
          <div>
            <p className="font-semibold text-[var(--color-text)]">{row.name}</p>
            <p className="text-xs text-[var(--color-text-soft)]">{row.email}</p>
          </div>
        ),
      },
      {
        key: 'role',
        header: t('common.role', { defaultValue: 'Role' }),
        render: (row) => <Badge variant={getRoleBadgeVariant(row.role as AdminUserRow['role'])}>{row.role}</Badge>,
      },
      {
        key: 'createdAt',
        header: t('common.createdAt', { defaultValue: 'Created' }),
        render: (row) => <span className="text-sm text-[var(--color-text-muted)]">{formatDateTime(row.createdAt, i18n.language)}</span>,
      },
    ],
    [i18n.language, t]
  );

  const userColumns = useMemo<Array<DataTableColumn<AdminUserRow>>>(
    () => [
      {
        key: 'user',
        header: t('common.user', { defaultValue: 'User' }),
        render: (row) => (
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-[var(--color-text)]">{row.name}</p>
              {row.role === 'ADMIN' ? <Badge variant="info">Protected</Badge> : null}
              {row.id === user?.id ? <Badge variant="default">Current session</Badge> : null}
            </div>
            <p className="text-xs text-[var(--color-text-soft)]">{row.email}</p>
          </div>
        ),
      },
      {
        key: 'role',
        header: t('common.role', { defaultValue: 'Role' }),
        render: (row) => <Badge variant={getRoleBadgeVariant(row.role)}>{row.role}</Badge>,
      },
      {
        key: 'orders',
        header: t('common.orders', { defaultValue: 'Orders' }),
        render: (row) => (
          <span className="font-semibold text-[var(--color-text)]">
            {(row._count?.ordersAsClient || 0) + (row._count?.ordersAsFreelancer || 0)}
          </span>
        ),
      },
      {
        key: 'createdAt',
        header: t('common.createdAt', { defaultValue: 'Created' }),
        render: (row) => <span className="text-sm text-[var(--color-text-muted)]">{formatDateTime(row.createdAt, i18n.language)}</span>,
      },
      {
        key: 'status',
        header: t('common.status', { defaultValue: 'Status' }),
        render: (row) =>
          row.isBanned ? (
            <Badge variant="danger">{t('admin.blocked', { defaultValue: 'Blocked' })}</Badge>
          ) : (
            <Badge variant="success">{t('admin.active', { defaultValue: 'Active' })}</Badge>
          ),
      },
      {
        key: 'actions',
        header: t('common.actions', { defaultValue: 'Actions' }),
        render: (row) =>
          row.role === 'ADMIN' ? (
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-soft)]">
              Protected
            </span>
          ) : (
            <Button
              type="button"
              size="sm"
              variant={row.isBanned ? 'secondary' : 'danger'}
              isLoading={actionLoadingKey === `user:${row.id}`}
              onClick={() => void toggleUserBan(row)}
            >
              {row.isBanned ? t('admin.unblock', { defaultValue: 'Unblock' }) : t('admin.block', { defaultValue: 'Block' })}
            </Button>
          ),
      },
    ],
    [actionLoadingKey, i18n.language, t, toggleUserBan, user?.id]
  );

  const orderColumns = useMemo<Array<DataTableColumn<AdminOrderRow>>>(
    () => [
      {
        key: 'order',
        header: t('common.orders', { defaultValue: 'Orders' }),
        render: (row) => (
          <div>
            <p className="font-semibold text-[var(--color-text)]">{row.title}</p>
            <p className="text-xs text-[var(--color-text-soft)]">{row.id}</p>
          </div>
        ),
      },
      {
        key: 'participants',
        header: t('common.participants', { defaultValue: 'Participants' }),
        render: (row) => (
          <div className="text-xs text-[var(--color-text-muted)]">
            <p>Client: {row.client?.name || '-'}</p>
            <p>Freelancer: {row.freelancer?.name || '-'}</p>
          </div>
        ),
      },
      {
        key: 'budget',
        header: t('common.amount', { defaultValue: 'Amounts' }),
        render: (row) => (
          <div className="text-sm">
            <p className="font-semibold text-[var(--color-text)]">{formatMoneyKGS(row.budget, i18n.language)}</p>
            <p className="text-xs text-[var(--color-text-soft)]">
              Escrow: {formatMoneyKGS(row.escrowAmount || 0, i18n.language)}
            </p>
          </div>
        ),
      },
      {
        key: 'status',
        header: t('common.status', { defaultValue: 'Status' }),
        render: (row) => {
          const badge = getOrderStatusBadge(row.status);
          return <Badge variant={badge.variant}>{badge.label}</Badge>;
        },
      },
      {
        key: 'createdAt',
        header: t('common.createdAt', { defaultValue: 'Created' }),
        render: (row) => <span className="text-sm text-[var(--color-text-muted)]">{formatDateTime(row.createdAt, i18n.language)}</span>,
      },
    ],
    [i18n.language, t]
  );

  const disputeColumns = useMemo<Array<DataTableColumn<AdminDisputeRow>>>(
    () => [
      {
        key: 'order',
        header: t('common.orders', { defaultValue: 'Orders' }),
        render: (row) => (
          <div>
            <p className="font-semibold text-[var(--color-text)]">{row.order?.title || row.orderId}</p>
            <p className="text-xs text-[var(--color-text-soft)]">{row.reason}</p>
          </div>
        ),
      },
      {
        key: 'participants',
        header: t('common.participants', { defaultValue: 'Participants' }),
        render: (row) => (
          <div className="text-xs text-[var(--color-text-muted)]">
            <p>Client: {row.order?.client?.name || '-'}</p>
            <p>Freelancer: {row.order?.freelancer?.name || '-'}</p>
            <p>Opened by: {row.openedBy?.name || '-'}</p>
          </div>
        ),
      },
      {
        key: 'status',
        header: t('common.status', { defaultValue: 'Status' }),
        render: (row) => <Badge variant={getDisputeBadgeVariant(row.status)}>{row.status}</Badge>,
      },
      {
        key: 'createdAt',
        header: t('common.createdAt', { defaultValue: 'Created' }),
        render: (row) => <span className="text-sm text-[var(--color-text-muted)]">{formatDateTime(row.createdAt, i18n.language)}</span>,
      },
      {
        key: 'actions',
        header: t('common.actions', { defaultValue: 'Actions' }),
        render: (row) => {
          const isClosed = row.status === 'RESOLVED' || row.status === 'CLOSED';

          return (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="danger"
                isLoading={actionLoadingKey === `dispute:${row.id}:client`}
                disabled={isClosed}
                onClick={() => void resolveDispute(row, 'client')}
              >
                {t('admin.refundClient', { defaultValue: 'Refund client' })}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="primary"
                isLoading={actionLoadingKey === `dispute:${row.id}:freelancer`}
                disabled={isClosed}
                onClick={() => void resolveDispute(row, 'freelancer')}
              >
                {t('admin.payFreelancer', { defaultValue: 'Release to freelancer' })}
              </Button>
            </div>
          );
        },
      },
    ],
    [actionLoadingKey, i18n.language, resolveDispute, t]
  );

  const auditColumns = useMemo<Array<DataTableColumn<AuditLogItem>>>(
    () => [
      {
        key: 'action',
        header: t('common.action', { defaultValue: 'Action' }),
        render: (row) => (
          <div>
            <p className="font-semibold text-[var(--color-text)]">{row.action}</p>
            <p className="text-xs text-[var(--color-text-soft)]">{row.requestId || '-'}</p>
          </div>
        ),
      },
      {
        key: 'actor',
        header: t('common.actor', { defaultValue: 'Actor' }),
        render: (row) => (
          <div>
            <p className="text-sm text-[var(--color-text)]">{row.actorId || 'system'}</p>
            <p className="text-xs text-[var(--color-text-soft)]">{row.actorRole || '-'}</p>
          </div>
        ),
      },
      {
        key: 'entity',
        header: t('common.entity', { defaultValue: 'Entity' }),
        render: (row) => (
          <div>
            <p className="text-sm text-[var(--color-text)]">{row.entityType || '-'}</p>
            <p className="text-xs text-[var(--color-text-soft)]">{row.entityId || '-'}</p>
          </div>
        ),
      },
      {
        key: 'context',
        header: t('common.context', { defaultValue: 'Context' }),
        render: (row) => (
          <div className="text-xs text-[var(--color-text-muted)]">
            <p>{row.ip || 'No IP'}</p>
            <p className="line-clamp-2 max-w-[22rem]">{row.userAgent || 'No user agent'}</p>
          </div>
        ),
      },
      {
        key: 'createdAt',
        header: t('common.createdAt', { defaultValue: 'Created' }),
        render: (row) => <span className="text-sm text-[var(--color-text-muted)]">{formatDateTime(row.createdAt, i18n.language)}</span>,
      },
    ],
    [i18n.language, t]
  );

  const ledgerColumns = useMemo<Array<DataTableColumn<LedgerEntryRow>>>(
    () => [
      {
        key: 'account',
        header: t('admin.account', { defaultValue: 'Account' }),
        render: (row) => (
          <div>
            <p className="font-semibold text-[var(--color-text)]">{getLedgerAccountLabel(row.account)}</p>
            <p className="text-xs text-[var(--color-text-soft)]">{row.batchId}</p>
          </div>
        ),
      },
      {
        key: 'direction',
        header: t('common.direction', { defaultValue: 'Direction' }),
        render: (row) => <Badge variant={row.direction === 'CREDIT' ? 'success' : 'warning'}>{row.direction}</Badge>,
      },
      {
        key: 'amount',
        header: t('common.amount', { defaultValue: 'Amount' }),
        render: (row) => <span className="font-semibold text-[var(--color-text)]">{formatMoneyKGS(row.amount, i18n.language)}</span>,
      },
      {
        key: 'reference',
        header: t('common.reference', { defaultValue: 'Reference' }),
        render: (row) => (
          <div className="text-xs text-[var(--color-text-muted)]">
            <p>{row.referenceType || '-'}</p>
            <p>{row.referenceId || row.orderId || row.userId || '-'}</p>
          </div>
        ),
      },
      {
        key: 'createdAt',
        header: t('common.createdAt', { defaultValue: 'Created' }),
        render: (row) => <span className="text-sm text-[var(--color-text-muted)]">{formatDateTime(row.createdAt, i18n.language)}</span>,
      },
    ],
    [i18n.language, t]
  );

  const ledgerAccountSummaries = useMemo(
    () => Object.entries(ledgerSummary?.summary || {}).sort(([left], [right]) => left.localeCompare(right)),
    [ledgerSummary]
  );

  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'ADMIN') return <Navigate to={WORKSPACE_PATH} replace />;

  return (
    <DashboardShell
      isDark={isDark}
      sidebarTitle={user.name || 'Admin'}
      sidebarSubtitle={t('admin.subtitle', { defaultValue: 'Platform command center' })}
      sidebarItems={getAdminSidebarItems()}
      onLogout={logout}
    >
      <div id="overview">
        <PageHeader
          title={t('admin.title', { defaultValue: 'Admin panel' })}
          subtitle={t('admin.subtitleExtended', {
            defaultValue: 'Operate platform health, user controls, disputes, finance visibility and release toggles from one place.',
          })}
          badges={
            <>
              <Badge variant="info">ADMIN only</Badge>
              <Badge variant="default">{getAdminSidebarItems().length} modules</Badge>
            </>
          }
          actions={
            <Button
              type="button"
              variant="outline"
              leftIcon={<RefreshCw className="h-4 w-4" />}
              isLoading={refreshingAll}
              onClick={() => void refreshAll()}
            >
              {t('common.refresh', { defaultValue: 'Refresh all' })}
            </Button>
          }
        />
      </div>

      {statsError ? <ErrorBanner message={statsError} /> : null}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          icon={Users}
          label={t('admin.totalUsers', { defaultValue: 'Total users' })}
          value={String(stats?.stats.users.total || 0)}
          hint={t('admin.userMix', {
            defaultValue: `Clients ${stats?.stats.users.clients || 0} / Freelancers ${stats?.stats.users.freelancers || 0}`,
          })}
          tone="primary"
        />
        <StatCard
          icon={ClipboardList}
          label={t('common.orders', { defaultValue: 'Orders' })}
          value={String(stats?.stats.orders.total || 0)}
          hint={t('admin.ordersMix', {
            defaultValue: `Active ${stats?.stats.orders.active || 0} / Completed ${stats?.stats.orders.completed || 0}`,
          })}
          tone="info"
        />
        <StatCard
          icon={ShieldAlert}
          label={t('admin.openDisputes', { defaultValue: 'Open disputes' })}
          value={String(stats?.stats.openDisputes || 0)}
          hint={t('admin.disputedOrders', {
            defaultValue: `Disputed orders ${stats?.stats.orders.disputed || 0}`,
          })}
          tone="warning"
        />
        <StatCard
          icon={Wallet}
          label={t('admin.escrowSum', { defaultValue: 'Escrow holding' })}
          value={formatMoneyKGS(stats?.stats.finance.escrowHolding || 0, i18n.language)}
          hint={t('admin.revenue', {
            defaultValue: `Revenue ${formatMoneyKGS(stats?.stats.finance.revenue || 0, i18n.language)}`,
          })}
          tone="primary"
        />
        <StatCard
          icon={Activity}
          label={t('admin.platformFee', { defaultValue: 'Platform fee' })}
          value={formatMoneyKGS(stats?.stats.finance.platformFee || 0, i18n.language)}
          hint={t('admin.completedOrders', {
            defaultValue: `Completed ${stats?.stats.orders.completed || 0}`,
          })}
          tone="success"
        />
        <StatCard
          icon={Scale}
          label={t('admin.moderationFocus', { defaultValue: 'Moderation focus' })}
          value={disputesStatusFilter === 'all' ? t('common.all', { defaultValue: 'All' }) : disputesStatusFilter}
          hint={t('admin.moderationHint', { defaultValue: 'Current dispute filter applied to the ops queue' })}
          tone="warning"
        />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="surface p-5 sm:p-6">
          <SectionHeader
            title={t('admin.recentOrders', { defaultValue: 'Recent orders' })}
            subtitle={t('admin.recentOrdersHint', { defaultValue: 'Newest order records visible from admin statistics.' })}
            count={stats?.recentOrders.length || 0}
          />
          {statsLoading ? (
            <div className="mt-4 text-sm text-[var(--color-text-muted)]">{t('common.loading', { defaultValue: 'Loading...' })}</div>
          ) : (
            <div className="mt-4">
              <DataTable
                columns={recentOrderColumns}
                data={stats?.recentOrders || []}
                rowKey={(row) => row.id}
                dense
                ariaLabel={t('admin.recentOrders', { defaultValue: 'Recent orders' })}
              />
            </div>
          )}
        </section>

        <section className="surface p-5 sm:p-6">
          <SectionHeader
            title={t('admin.recentUsers', { defaultValue: 'Recent users' })}
            subtitle={t('admin.recentUsersHint', { defaultValue: 'Latest account creation activity across the platform.' })}
            count={stats?.recentUsers.length || 0}
          />
          {statsLoading ? (
            <div className="mt-4 text-sm text-[var(--color-text-muted)]">{t('common.loading', { defaultValue: 'Loading...' })}</div>
          ) : (
            <div className="mt-4">
              <DataTable
                columns={recentUserColumns}
                data={stats?.recentUsers || []}
                rowKey={(row) => row.id}
                dense
                ariaLabel={t('admin.recentUsers', { defaultValue: 'Recent users' })}
              />
            </div>
          )}
        </section>
      </section>

      <section id="users" className="surface p-5 sm:p-6">
        <SectionHeader
          title={t('admin.users', { defaultValue: 'Users' })}
          subtitle={t('admin.usersSectionHint', { defaultValue: 'Search users, review roles and apply safe account controls.' })}
          count={usersTotal}
        />

        <div className="mt-5 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <Input
            label={t('common.search', { defaultValue: 'Search' })}
            placeholder={t('admin.userSearchPlaceholder', { defaultValue: 'Search by name or email' })}
            value={usersSearch}
            onChange={(event) => setUsersSearch(event.target.value)}
            leftIcon={<Search className="h-4 w-4" />}
          />

          <div className="overflow-x-auto pb-1">
            <div className="text-sm font-semibold text-[var(--color-text)]">{t('common.role', { defaultValue: 'Role' })}</div>
            <SegmentedControl
              value={usersRoleFilter}
              options={roleOptions}
              onValueChange={setUsersRoleFilter}
              className="mt-2 min-w-max"
            />
          </div>
        </div>

        {usersError ? <div className="mt-4"><ErrorBanner message={usersError} /></div> : null}

        <div className="mt-5">
          <DataTable
            columns={userColumns}
            data={users}
            rowKey={(row) => row.id}
            isLoading={usersLoading}
            emptyTitle={t('admin.noUsers', { defaultValue: 'No users match the current filters' })}
            emptyDescription={t('admin.noUsersHint', { defaultValue: 'Adjust the role filter or search query to expand results.' })}
            ariaLabel={t('admin.users', { defaultValue: 'Users' })}
          />
        </div>
      </section>

      <section id="orders" className="surface p-5 sm:p-6">
        <SectionHeader
          title={t('admin.orders', { defaultValue: 'Orders' })}
          subtitle={t('admin.ordersSectionHint', { defaultValue: 'Review order lifecycle, ownership and escrow exposure.' })}
          count={ordersTotal}
        />

        <div className="mt-5 overflow-x-auto pb-1">
          <SegmentedControl
            value={ordersStatusFilter}
            options={orderStatusOptions}
            onValueChange={setOrdersStatusFilter}
            className="min-w-max"
          />
        </div>

        {ordersError ? <div className="mt-4"><ErrorBanner message={ordersError} /></div> : null}

        <div className="mt-5">
          <DataTable
            columns={orderColumns}
            data={orders}
            rowKey={(row) => row.id}
            isLoading={ordersLoading}
            emptyTitle={t('admin.noOrders', { defaultValue: 'No orders for the selected status' })}
            emptyDescription={t('admin.noOrdersHint', { defaultValue: 'Switch the status filter to review a different slice of the queue.' })}
            ariaLabel={t('admin.orders', { defaultValue: 'Orders' })}
          />
        </div>
      </section>

      <section id="disputes" className="surface p-5 sm:p-6">
        <SectionHeader
          title={t('admin.disputes', { defaultValue: 'Disputes' })}
          subtitle={t('admin.disputesSectionHint', { defaultValue: 'Resolve escrow conflicts with visible participant context and safe actions.' })}
          count={disputesTotal}
        />

        <div className="mt-5 overflow-x-auto pb-1">
          <SegmentedControl
            value={disputesStatusFilter}
            options={disputeStatusOptions}
            onValueChange={setDisputesStatusFilter}
            className="min-w-max"
          />
        </div>

        {disputesError ? <div className="mt-4"><ErrorBanner message={disputesError} /></div> : null}

        <div className="mt-5">
          <DataTable
            columns={disputeColumns}
            data={disputes}
            rowKey={(row) => row.id}
            isLoading={disputesLoading}
            emptyTitle={t('admin.noDisputes', { defaultValue: 'No disputes found' })}
            emptyDescription={t('admin.noDisputesHint', { defaultValue: 'The current moderation filter does not return any dispute cases.' })}
            ariaLabel={t('admin.disputes', { defaultValue: 'Disputes' })}
          />
        </div>
      </section>

      <section id="audit" className="surface p-5 sm:p-6">
        <SectionHeader
          title={t('admin.auditLogs', { defaultValue: 'Audit log' })}
          subtitle={t('admin.auditSectionHint', { defaultValue: 'Track admin and system actions across protected operations.' })}
          count={auditTotal}
        />

        <div className="mt-5 grid grid-cols-1 gap-3 xl:grid-cols-2">
          <Input
            label={t('common.action', { defaultValue: 'Action' })}
            placeholder={t('admin.auditActionPlaceholder', { defaultValue: 'Filter by action name' })}
            value={auditActionFilter}
            onChange={(event) => setAuditActionFilter(event.target.value)}
            leftIcon={<Search className="h-4 w-4" />}
          />
          <Input
            label={t('common.entity', { defaultValue: 'Entity' })}
            placeholder={t('admin.auditEntityPlaceholder', { defaultValue: 'Filter by entity type' })}
            value={auditEntityFilter}
            onChange={(event) => setAuditEntityFilter(event.target.value)}
            leftIcon={<FileText className="h-4 w-4" />}
          />
        </div>

        {auditError ? <div className="mt-4"><ErrorBanner message={auditError} /></div> : null}

        <div className="mt-5">
          {auditDisabled ? (
            <EmptyState
              title={t('admin.auditDisabled', { defaultValue: 'Audit panel is disabled' })}
              description={t('admin.auditDisabledHint', {
                defaultValue: 'Enable the audit feature flag to load privileged action history in this section.',
              })}
              icon={<FileText className="h-4 w-4" />}
              compact
            />
          ) : (
            <DataTable
              columns={auditColumns}
              data={auditLogs}
              rowKey={(row) => row.id}
              isLoading={auditLoading}
              dense
              emptyTitle={t('admin.noAuditRows', { defaultValue: 'No audit events match the current filters' })}
              emptyDescription={t('admin.noAuditRowsHint', { defaultValue: 'Broaden the filters or wait for new privileged activity.' })}
              ariaLabel={t('admin.auditLogs', { defaultValue: 'Audit log' })}
            />
          )}
        </div>
      </section>

      <section id="ledger" className="surface p-5 sm:p-6">
        <SectionHeader
          title={t('admin.ledger', { defaultValue: 'Ledger' })}
          subtitle={t('admin.ledgerSectionHint', { defaultValue: 'Inspect double-entry flows, balances and underlying references.' })}
          count={ledgerTotal}
        />

        <div className="mt-5 space-y-4">
          <div className="overflow-x-auto pb-1">
            <SegmentedControl
              value={ledgerAccountFilter}
              options={ledgerAccountOptions}
              onValueChange={setLedgerAccountFilter}
              className="min-w-max"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            <Input
              label={t('admin.userId', { defaultValue: 'User ID' })}
              placeholder={t('admin.userIdPlaceholder', { defaultValue: 'Filter ledger by user id' })}
              value={ledgerUserFilter}
              onChange={(event) => setLedgerUserFilter(event.target.value)}
              leftIcon={<Users className="h-4 w-4" />}
            />
            <Input
              label={t('admin.orderId', { defaultValue: 'Order ID' })}
              placeholder={t('admin.orderIdPlaceholder', { defaultValue: 'Filter ledger by order id' })}
              value={ledgerOrderFilter}
              onChange={(event) => setLedgerOrderFilter(event.target.value)}
              leftIcon={<ClipboardList className="h-4 w-4" />}
            />
          </div>
        </div>

        {ledgerError ? <div className="mt-4"><ErrorBanner message={ledgerError} /></div> : null}

        <div className="mt-5 space-y-5">
          {ledgerDisabled ? (
            <EmptyState
              title={t('admin.ledgerDisabled', { defaultValue: 'Ledger view is disabled' })}
              description={t('admin.ledgerDisabledHint', {
                defaultValue: 'Enable the ledger feature flag to expose summary cards and accounting entries.',
              })}
              icon={<Wallet className="h-4 w-4" />}
              compact
            />
          ) : (
            <>
              <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <StatCard
                  icon={Wallet}
                  label={t('admin.totalDebit', { defaultValue: 'Total debit' })}
                  value={formatMoneyKGS(ledgerSummary?.totals.debit || 0, i18n.language)}
                  tone="warning"
                />
                <StatCard
                  icon={Wallet}
                  label={t('admin.totalCredit', { defaultValue: 'Total credit' })}
                  value={formatMoneyKGS(ledgerSummary?.totals.credit || 0, i18n.language)}
                  tone="success"
                />
                <StatCard
                  icon={Activity}
                  label={t('admin.netMovement', { defaultValue: 'Net movement' })}
                  value={formatMoneyKGS(ledgerSummary?.totals.net || 0, i18n.language)}
                  tone="info"
                />
              </section>

              {ledgerAccountSummaries.length > 0 ? (
                <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {ledgerAccountSummaries.map(([account, totals]) => (
                    <StatCard
                      key={account}
                      icon={Wallet}
                      label={getLedgerAccountLabel(account)}
                      value={formatMoneyKGS(totals.net, i18n.language)}
                      hint={`${t('admin.debit', { defaultValue: 'Debit' })} ${formatMoneyKGS(totals.debit, i18n.language)} • ${t('admin.credit', { defaultValue: 'Credit' })} ${formatMoneyKGS(totals.credit, i18n.language)}`}
                      tone={totals.net >= 0 ? 'success' : 'warning'}
                    />
                  ))}
                </section>
              ) : null}

              <DataTable
                columns={ledgerColumns}
                data={ledgerEntries}
                rowKey={(row) => row.id}
                isLoading={ledgerLoading}
                dense
                emptyTitle={t('admin.noLedgerRows', { defaultValue: 'No ledger entries match the current filters' })}
                emptyDescription={t('admin.noLedgerRowsHint', { defaultValue: 'Adjust account, user or order filters to broaden the result set.' })}
                ariaLabel={t('admin.ledger', { defaultValue: 'Ledger' })}
              />
            </>
          )}
        </div>
      </section>

      <section id="flags" className="surface p-5 sm:p-6">
        <SectionHeader
          title={t('admin.featureFlags', { defaultValue: 'Feature flags' })}
          subtitle={t('admin.featureFlagsSectionHint', { defaultValue: 'Toggle platform capabilities in-place without changing the current architecture.' })}
          count={platformFlags?.availableKeys.length || 0}
        />

        {flagsError ? <div className="mt-4"><ErrorBanner message={flagsError} /></div> : null}

        <div className="mt-5">
          {flagsLoading ? (
            <div className="text-sm text-[var(--color-text-muted)]">{t('common.loading', { defaultValue: 'Loading...' })}</div>
          ) : platformFlags ? (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {platformFlags.availableKeys.map((key) => {
                const enabled = Boolean(platformFlags.flags[key]);
                const isDefault = platformFlags.defaults[key] === enabled;

                return (
                  <article key={key} className="surface-muted p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-[var(--color-text)]">{getFeatureFlagLabel(key)}</h3>
                          <Badge variant={enabled ? 'success' : 'default'}>{enabled ? 'Enabled' : 'Disabled'}</Badge>
                          <Badge variant={isDefault ? 'default' : 'warning'}>{isDefault ? 'Default' : 'Override'}</Badge>
                        </div>
                        <p className="mt-2 text-sm text-[var(--color-text-muted)]">{getFeatureFlagDescription(key)}</p>
                        <p className="mt-2 text-xs font-medium uppercase tracking-[0.08em] text-[var(--color-text-soft)]">{key}</p>
                      </div>

                      <Switch
                        checked={enabled}
                        disabled={actionLoadingKey === `flag:${key}`}
                        onCheckedChange={(nextValue) => {
                          void updateFeatureFlag(key, nextValue);
                        }}
                      />
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title={t('admin.flagsUnavailable', { defaultValue: 'Feature flags are unavailable' })}
              description={t('admin.flagsUnavailableHint', { defaultValue: 'The admin console could not load platform flags for this session.' })}
              icon={<Settings2 className="h-4 w-4" />}
              compact
            />
          )}
        </div>
      </section>
    </DashboardShell>
  );
}
