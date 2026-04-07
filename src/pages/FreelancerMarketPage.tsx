import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Filter, RefreshCcw, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import api, { Order } from '@/services/api';
import { formatMoneyKGS } from '@/utils/locale';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { getFreelancerSidebarItems } from '@/components/dashboard/dashboardNav';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { OrderStatusBadge } from '@/components/dashboard/OrderStatusBadge';
import { Badge } from '@/components/ui/Badge';

export function FreelancerMarketPage() {
  const { t, i18n } = useTranslation();
  const { isDark } = useTheme();
  const { user, logout } = useAuth();

  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [isTaking, setIsTaking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadMarket = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await api.getAvailableOrders({ limit: 100 });
      setOrders(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('orders.market.loadFailed', { defaultValue: 'Failed to load market orders' }));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadMarket();
  }, [loadMarket]);

  const categories = useMemo(() => {
    const unique = new Set<string>();
    for (const order of orders) {
      if (order.category) unique.add(order.category);
    }
    return ['ALL', ...Array.from(unique)];
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return orders.filter((order) => {
      const byCategory = category === 'ALL' || (order.category || t('orders.market.noCategory', { defaultValue: 'No category' })) === category;
      const bySearch =
        normalized.length === 0 ||
        order.title.toLowerCase().includes(normalized) ||
        (order.description || '').toLowerCase().includes(normalized) ||
        (order.category || '').toLowerCase().includes(normalized);
      return byCategory && bySearch;
    });
  }, [orders, search, category]);

  const categoryInsights = useMemo(() => {
    const stats = new Map<string, number>();
    for (const order of orders) {
      const key = order.category || t('orders.market.noCategory', { defaultValue: 'No category' });
      stats.set(key, (stats.get(key) || 0) + 1);
    }
    return Array.from(stats.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [orders, t]);

  const recommendedOrders = useMemo(() => {
    return [...orders]
      .sort((a, b) => {
        if (b.budget !== a.budget) return b.budget - a.budget;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      })
      .slice(0, 3);
  }, [orders]);

  const handleTakeOrder = async (orderId: string) => {
    try {
      setIsTaking(orderId);
      setError(null);
      await api.acceptOrder(orderId);
      await loadMarket();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('orders.market.takeFailed', { defaultValue: 'Failed to take order' }));
    } finally {
      setIsTaking(null);
    }
  };

  const columns = useMemo<Array<DataTableColumn<Order>>>(
    () => [
      {
        key: 'order',
        header: t('common.orders'),
        className: 'min-w-[300px]',
        render: (order) => (
          <div>
            <p className="font-semibold text-[var(--color-text)]">{order.title}</p>
            <p className="line-clamp-2 text-xs text-[var(--color-text-soft)]">{order.description}</p>
          </div>
        ),
      },
      {
        key: 'category',
        header: t('orders.create.category'),
        render: (order) => <span>{order.category || t('orders.market.noCategory', { defaultValue: 'No category' })}</span>,
      },
      {
        key: 'budget',
        header: t('common.amount'),
        render: (order) => <span className="font-semibold text-[var(--color-text)]">{formatMoneyKGS(order.budget, i18n.language)}</span>,
      },
      {
        key: 'escrow',
        header: t('common.inEscrow'),
        render: (order) => <span>{formatMoneyKGS(order.escrowAmount || 0, i18n.language)}</span>,
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
          <div className="inline-flex items-center gap-2">
            <Link
              to={`/orders/${order.id}`}
              className="inline-flex h-9 items-center rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-xs font-semibold text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-2)]"
            >
              {t('orders.market.details')}
            </Link>
            <button
              type="button"
              onClick={() => void handleTakeOrder(order.id)}
              disabled={isTaking === order.id}
              className="inline-flex h-9 items-center rounded-[10px] bg-[var(--color-primary)] px-3 text-xs font-semibold text-white transition-colors hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
            >
              {isTaking === order.id ? '...' : t('orders.market.take')}
            </button>
          </div>
        ),
      },
    ],
    [i18n.language, isDark, isTaking, t]
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
        title={t('orders.market.title')}
        subtitle={t('orders.market.subtitle')}
        badges={
          <>
            <Badge variant="success">{t('orders.market.paymentConfirmed', { defaultValue: 'Payment confirmed' })}</Badge>
            <Badge variant="info">{t('common.escrowProtection')}</Badge>
          </>
        }
        actions={
          <button
            type="button"
            onClick={() => void loadMarket()}
            className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-sm font-semibold text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-2)]"
          >
            <RefreshCcw className="h-4 w-4" />
            {t('common.refresh')}
          </button>
        }
      />

      {error ? (
        <div className="rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--color-danger)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_12%,transparent)] px-4 py-3 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      ) : null}

      <section className="surface p-5 sm:p-6">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="relative md:col-span-2">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-soft)]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('orders.market.searchPlaceholder', { defaultValue: 'Search by title, description or category' })}
              className="h-10 w-full rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] pl-10 pr-3.5 text-sm text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-ring)]"
            />
          </label>

          <label className="relative">
            <Filter className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-soft)]" />
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="h-10 w-full rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] pl-10 pr-3.5 text-sm text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-ring)]"
            >
              {categories.map((value) => (
                <option key={value} value={value}>
                  {value === 'ALL' ? t('landing.allCategories') : value}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_1fr]">
          <div className="surface-muted rounded-[var(--radius-card)] p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-[var(--color-text)]">{t('freelancersPage.filters')}</h2>
              <button
                type="button"
                onClick={() => setCategory('ALL')}
                className="text-xs font-semibold text-[var(--color-primary)] hover:underline"
              >
                {t('freelancersPage.reset')}
              </button>
            </div>
            {isLoading ? (
              <p className="text-xs text-[var(--color-text-muted)]">{t('orders.market.loading')}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setCategory('ALL')}
                  className={
                    category === 'ALL'
                      ? 'inline-flex h-8 items-center rounded-full border border-[var(--color-primary)] bg-[color-mix(in_srgb,var(--color-primary)_14%,transparent)] px-3 text-xs font-semibold text-[var(--color-primary)]'
                      : 'inline-flex h-8 items-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-xs font-semibold text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]'
                  }
                >
                  {t('landing.allCategories')}
                </button>
                {categoryInsights.map(([name, count]) => {
                  const active = category === name;
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setCategory(name)}
                      className={
                        active
                          ? 'inline-flex h-8 items-center rounded-full border border-[var(--color-primary)] bg-[color-mix(in_srgb,var(--color-primary)_14%,transparent)] px-3 text-xs font-semibold text-[var(--color-primary)]'
                          : 'inline-flex h-8 items-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-xs font-semibold text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]'
                      }
                    >
                      {name} ({count})
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="surface-muted rounded-[var(--radius-card)] p-4">
            <h2 className="mb-2 text-sm font-semibold text-[var(--color-text)]">{t('landing.ordersOfDay')}</h2>
            {isLoading ? (
              <p className="text-xs text-[var(--color-text-muted)]">{t('orders.market.loading')}</p>
            ) : recommendedOrders.length === 0 ? (
              <p className="text-xs text-[var(--color-text-muted)]">{t('orders.market.emptyDescription')}</p>
            ) : (
              <div className="space-y-2">
                {recommendedOrders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between gap-3 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-[var(--color-text)]">{order.title}</p>
                      <p className="truncate text-[11px] text-[var(--color-text-soft)]">{order.category || t('orders.market.noCategory')}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs font-semibold text-[var(--color-text)]">{formatMoneyKGS(order.budget, i18n.language)}</p>
                      <Link to={`/orders/${order.id}`} className="text-[11px] font-semibold text-[var(--color-primary)] hover:underline">
                        {t('orders.market.details')}
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-4">
          {isLoading ? (
            <div className="surface-muted p-4 text-sm text-[var(--color-text-muted)]">{t('orders.market.loading', { defaultValue: 'Loading market orders...' })}</div>
          ) : (
            <DataTable
              columns={columns}
              data={filteredOrders}
              rowKey={(row) => row.id}
              emptyTitle={t('orders.market.emptyTitle', { defaultValue: 'No matching orders' })}
              emptyDescription={t('orders.market.emptyDescription', { defaultValue: 'Try resetting filters or refresh later.' })}
            />
          )}
        </div>
      </section>
    </DashboardShell>
  );
}
