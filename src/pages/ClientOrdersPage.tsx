import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Filter, Plus, Search, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import api, { Freelancer, Order } from '@/services/api';
import { formatMoneyKGS } from '@/utils/locale';
import { toAbsoluteAssetUrl } from '@/utils/assetUrl';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { getClientSidebarItems } from '@/components/dashboard/dashboardNav';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { OrderStatusBadge } from '@/components/dashboard/OrderStatusBadge';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

const STATUS_OPTIONS = ['ALL', 'PENDING', 'ACTIVE', 'SUBMITTED', 'COMPLETED', 'DISPUTED', 'CANCELLED'] as const;
type StatusFilter = (typeof STATUS_OPTIONS)[number];

export function ClientOrdersPage() {
  const { t, i18n } = useTranslation();
  const { isDark } = useTheme();
  const { user, logout } = useAuth();

  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recommendedFreelancers, setRecommendedFreelancers] = useState<Freelancer[]>([]);
  const [recommendationCategory, setRecommendationCategory] = useState('ALL');
  const [isRecommendationsLoading, setIsRecommendationsLoading] = useState(true);
  const [recommendationsError, setRecommendationsError] = useState<string | null>(null);

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

  const loadRecommendations = useCallback(async () => {
    try {
      setIsRecommendationsLoading(true);
      setRecommendationsError(null);
      const result = await api.getFreelancers({ limit: 24, minRating: 4 });
      const ranked = [...result.data].sort((a, b) => {
        if (b.rating !== a.rating) return b.rating - a.rating;
        return b.completedOrders - a.completedOrders;
      });
      setRecommendedFreelancers(ranked.slice(0, 8));
    } catch (err) {
      setRecommendationsError(err instanceof Error ? err.message : t('freelancersPage.loadFailed', { defaultValue: 'Failed to load freelancers list' }));
    } finally {
      setIsRecommendationsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadRecommendations();
  }, [loadRecommendations]);

  const filteredOrders = useMemo(() => {
    const normalized = search.trim().toLowerCase();

    return orders.filter((order) => {
      const byStatus = statusFilter === 'ALL' || order.status === statusFilter;
      const bySearch =
        normalized.length === 0 ||
        order.title.toLowerCase().includes(normalized) ||
        (order.category || '').toLowerCase().includes(normalized) ||
        (order.freelancer?.name || '').toLowerCase().includes(normalized);
      return byStatus && bySearch;
    });
  }, [orders, search, statusFilter]);

  const isOrdersFilterPristine = search.trim().length === 0 && statusFilter === 'ALL';
  const showClientFirstOrderState = !isLoading && filteredOrders.length === 0 && isOrdersFilterPristine;

  const recommendationCategories = useMemo(() => {
    const unique = new Set<string>();
    for (const freelancer of recommendedFreelancers) {
      if (freelancer.category) unique.add(freelancer.category);
    }
    return ['ALL', ...Array.from(unique)];
  }, [recommendedFreelancers]);

  const filteredRecommendations = useMemo(() => {
    return recommendedFreelancers.filter((freelancer) => {
      if (recommendationCategory === 'ALL') return true;
      return (freelancer.category || t('landing.noCategory', { defaultValue: 'No category' })) === recommendationCategory;
    });
  }, [recommendedFreelancers, recommendationCategory, t]);

  const columns = useMemo<Array<DataTableColumn<Order>>>(
    () => [
      {
        key: 'order',
        header: t('common.orders'),
        className: 'min-w-[260px]',
        render: (order) => (
          <div>
            <p className="font-semibold text-[var(--color-text)]">{order.title}</p>
            <p className="text-xs text-[var(--color-text-soft)]">{order.category || t('orders.my.noCategory', { defaultValue: 'No category' })}</p>
          </div>
        ),
      },
      {
        key: 'freelancer',
        header: t('orders.details.freelancer'),
        render: (order) => <span>{order.freelancer?.name || t('orders.details.notAssigned', { defaultValue: 'Not assigned' })}</span>,
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
        key: 'action',
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
  if (user.role !== 'CLIENT') return <Navigate to="/dashboard/freelancer/orders" replace />;

  return (
    <DashboardShell
      isDark={isDark}
      sidebarTitle={user.name || t('topbar.user', { defaultValue: 'User' })}
      sidebarSubtitle="Client workspace"
      sidebarItems={getClientSidebarItems()}
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
        actions={
          <Link
            to="/orders/new"
            className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-control)] bg-[var(--color-primary)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-hover)]"
          >
            <Plus className="h-4 w-4" />
            {t('dashboard.client.newOrder')}
          </Link>
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
            placeholder={t('orders.my.searchPlaceholderClient', { defaultValue: 'Search by title, category, freelancer' })}
            aria-label={t('orders.my.searchPlaceholderClient', { defaultValue: 'Search by title, category, freelancer' })}
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

        <div className="mt-4 flex items-center justify-between gap-2">
          <p className="text-xs text-[var(--color-text-muted)]">
            {t('orders.my.filtered', { defaultValue: 'Filtered' })}: <span className="font-semibold text-[var(--color-text)]">{filteredOrders.length}</span>
          </p>
          {error ? (
            <Button variant="danger" size="sm" onClick={() => void loadOrders()}>
              {t('common.retry', { defaultValue: 'Retry' })}
            </Button>
          ) : (
            <Badge variant="success">{t('common.ready', { defaultValue: 'Ready' })}</Badge>
          )}
        </div>

        {showClientFirstOrderState ? (
          <div className="mt-4 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-5 sm:p-6">
            <h3 className="text-base font-semibold text-[var(--color-text)]">
              {t('orders.my.emptyDescriptionClient', { defaultValue: 'Create your first order to start getting offers.' })}
            </h3>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">{t('dashboard.client.subtitle')}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                to="/orders/new"
                className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-control)] bg-[var(--color-primary)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-hover)]"
              >
                <Plus className="h-4 w-4" />
                {t('dashboard.client.newOrder')}
              </Link>
              <Link
                to="/freelancers"
                className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-sm font-semibold text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-2)]"
              >
                {t('landing.ctaFreelancers')}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <DataTable
              columns={columns}
              data={filteredOrders}
              rowKey={(row) => row.id}
              isLoading={isLoading}
              skeletonRows={7}
              ariaLabel={t('orders.my.title')}
              emptyTitle={t('orders.my.emptyTitle', { defaultValue: 'No orders found' })}
              emptyDescription={t('orders.my.emptyDescription', { defaultValue: 'Create an order or change filters.' })}
            />
          </div>
        )}
      </section>

      <section className="surface p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="section-title">{t('landing.topFreelancers')}</h2>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">{t('freelancersPage.searchPlaceholder')}</p>
          </div>
          <Link
            to="/freelancers"
            className="inline-flex h-9 items-center rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-xs font-semibold text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-2)]"
          >
            {t('landing.ctaFreelancers')}
          </Link>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {recommendationCategories.map((value) => {
            const active = recommendationCategory === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setRecommendationCategory(value)}
                className={
                  active
                    ? 'inline-flex h-8 items-center rounded-full border border-[var(--color-primary)] bg-[color-mix(in_srgb,var(--color-primary)_14%,transparent)] px-3 text-xs font-semibold text-[var(--color-primary)]'
                    : 'inline-flex h-8 items-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-xs font-semibold text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]'
                }
              >
                {value === 'ALL' ? t('landing.allCategories') : value}
              </button>
            );
          })}
        </div>

        {recommendationsError ? (
          <div className="rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--color-danger)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_12%,transparent)] px-4 py-3 text-sm text-[var(--color-danger)]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>{recommendationsError}</span>
              <Button variant="danger" size="sm" onClick={() => void loadRecommendations()}>
                {t('common.retry', { defaultValue: 'Retry' })}
              </Button>
            </div>
          </div>
        ) : null}

        {isRecommendationsLoading ? (
          <div className="surface-muted p-4 text-sm text-[var(--color-text-muted)]">{t('freelancersPage.loading')}</div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {filteredRecommendations.map((freelancer) => (
              <article
                key={freelancer.id}
                className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
              >
                <div className="flex items-start gap-3">
                  <img
                    src={toAbsoluteAssetUrl(freelancer.avatar) || '/vite.svg'}
                    alt={freelancer.name}
                    className="h-10 w-10 rounded-[10px] object-cover"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="truncate text-sm font-semibold text-[var(--color-text)]">{freelancer.name}</h3>
                      {freelancer.isVerified ? <CheckCircle2 className="h-4 w-4 text-[var(--color-success)]" /> : null}
                    </div>
                    <p className="truncate text-xs text-[var(--color-text-soft)]">{freelancer.category || t('landing.noCategory')}</p>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
                  <span className="inline-flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                    {freelancer.rating.toFixed(1)}
                  </span>
                  <span>{t('freelancerProfile.completedOrders')}: {freelancer.completedOrders}</span>
                </div>

                <p className="mt-2 line-clamp-2 text-xs text-[var(--color-text-soft)]">
                  {freelancer.bio || t('freelancerProfile.noDescription')}
                </p>

                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-[var(--color-text)]">
                    {freelancer.hourlyRate
                      ? `${formatMoneyKGS(freelancer.hourlyRate, i18n.language)}/${t('landing.perHour')}`
                      : '-'}
                  </span>
                  <Link
                    to={`/freelancers/${freelancer.id}`}
                    className="inline-flex h-8 items-center rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2.5 text-xs font-semibold text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface)]"
                  >
                    {t('freelancersPage.openProfile')}
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}

        {!isRecommendationsLoading && filteredRecommendations.length === 0 ? (
          <div className="mt-4 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3 text-sm text-[var(--color-text-muted)]">
            {t('freelancersPage.emptyDescription')}
          </div>
        ) : null}
      </section>
    </DashboardShell>
  );
}
