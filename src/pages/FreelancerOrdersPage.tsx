import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Briefcase, Filter, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import api, { Order } from '@/services/api';
import { formatDate, formatMoneyKGS } from '@/utils/locale';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { getFreelancerSidebarItems } from '@/components/dashboard/dashboardNav';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { OrderStatusBadge } from '@/components/dashboard/OrderStatusBadge';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

const STATUS_OPTIONS = ['ALL', 'PENDING', 'ACTIVE', 'SUBMITTED', 'COMPLETED', 'DISPUTED', 'CANCELLED'] as const;
type StatusFilter = (typeof STATUS_OPTIONS)[number];

export function FreelancerOrdersPage() {
  const { t, i18n } = useTranslation();
  const { isDark } = useTheme();
  const { user, logout } = useAuth();

  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await api.getOrders({ limit: 100 });
      setOrders(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('orders.my.loadFailed', { defaultValue: 'Failed to load orders' }));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const filteredOrders = useMemo(() => {
    const normalized = search.trim().toLowerCase();

    return orders.filter((order) => {
      const byStatus = statusFilter === 'ALL' || order.status === statusFilter;
      const bySearch =
        normalized.length === 0 ||
        order.title.toLowerCase().includes(normalized) ||
        (order.category || '').toLowerCase().includes(normalized) ||
        order.client.name.toLowerCase().includes(normalized);

      return byStatus && bySearch;
    });
  }, [orders, search, statusFilter]);

  const columns = useMemo<Array<DataTableColumn<Order>>>(
    () => [
      {
        key: 'order',
        header: t('common.orders'),
        className: 'min-w-[280px]',
        render: (order) => (
          <div>
            <p className="font-semibold text-[var(--color-text)]">{order.title}</p>
            <p className="text-xs text-[var(--color-text-soft)]">{order.category || t('orders.my.noCategory', { defaultValue: 'No category' })}</p>
          </div>
        ),
      },
      {
        key: 'client',
        header: t('orders.details.client'),
        render: (order) => <span>{order.client.name}</span>,
      },
      {
        key: 'budget',
        header: t('common.amount'),
        render: (order) => <span className="font-semibold text-[var(--color-text)]">{formatMoneyKGS(order.budget, i18n.language)}</span>,
      },
      {
        key: 'deadline',
        header: t('orders.create.deadline'),
        render: (order) => (order.deadline ? formatDate(order.deadline, i18n.language) : t('orders.my.noDeadline', { defaultValue: 'Not set' })),
      },
      {
        key: 'status',
        header: t('common.status'),
        render: (order) => <OrderStatusBadge status={order.status} isDark={isDark} />,
      },
      {
        key: 'actions',
        header: t('common.actions'),
        className: 'text-right',
        cellClassName: 'text-right',
        render: (order) => (
          <Link
            to={`/orders/${order.id}`}
            aria-label={`${t('common.open')} ${order.title}`}
            className="inline-flex h-9 items-center rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-xs font-semibold text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-2)]"
          >
            {t('common.open')}
          </Link>
        ),
      },
    ],
    [i18n.language, isDark, t]
  );

  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'FREELANCER') return <Navigate to="/dashboard/client/orders" replace />;

  return (
    <DashboardShell
      isDark={isDark}
      sidebarTitle={user.name || t('topbar.user', { defaultValue: 'User' })}
      sidebarSubtitle="Freelancer workspace"
      sidebarItems={getFreelancerSidebarItems()}
      onLogout={logout}
    >
      <PageHeader
        title={t('orders.my.title')}
        subtitle={t('orders.my.subtitle')}
        badges={
          <>
            <Badge variant="success">{t('common.safeDeal')}</Badge>
            <Badge variant="info">{t('common.escrowProtection')}</Badge>
          </>
        }
      />

      {error ? (
        <div className="rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--color-danger)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_12%,transparent)] px-4 py-3 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      ) : null}

      <section className="surface p-5 sm:p-6">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Input
            leftIcon={<Search className="h-4 w-4" />}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('orders.my.searchPlaceholder', { defaultValue: 'Search by title, category or client' })}
            aria-label={t('orders.my.searchPlaceholder', { defaultValue: 'Search by title, category or client' })}
            className="md:col-span-2"
          />

          <label className="relative">
            <Filter className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-soft)]" />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              aria-label={t('common.status')}
              className="h-10 w-full rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] pl-10 pr-3.5 text-sm text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-ring)]"
            >
              <option value="ALL">{t('common.allStatuses')}</option>
              {STATUS_OPTIONS.filter((value) => value !== 'ALL').map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-[var(--color-text-muted)]">
          <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2.5 py-1">
            <Briefcase className="h-3.5 w-3.5" />
            {t('orders.my.total')}: {orders.length}
          </span>
          <span className="inline-flex items-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2.5 py-1">
            {t('orders.my.filtered')}: {filteredOrders.length}
          </span>
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          {error ? (
            <Button variant="danger" size="sm" onClick={() => void loadOrders()}>
              {t('common.retry', { defaultValue: 'Retry' })}
            </Button>
          ) : (
            <Badge variant="success">{t('common.ready', { defaultValue: 'Ready' })}</Badge>
          )}
        </div>

        <div className="mt-4">
          <DataTable
            columns={columns}
            data={filteredOrders}
            rowKey={(row) => row.id}
            isLoading={isLoading}
            skeletonRows={7}
            ariaLabel={t('orders.my.title')}
            emptyTitle={t('orders.my.emptyTitle', { defaultValue: 'No orders found' })}
            emptyDescription={t('orders.my.emptyDescription', { defaultValue: 'Adjust filters or take one in available orders.' })}
          />
        </div>
      </section>
    </DashboardShell>
  );
}
