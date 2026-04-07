import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Briefcase,
  CheckCircle,
  Clock3,
  CreditCard,
  Search,
  ShieldCheck,
  Star,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { CATEGORIES, mockOrders, stats } from '@/data/mockData';
import api, { Freelancer } from '@/services/api';
import { toAbsoluteAssetUrl } from '@/utils/assetUrl';
import { formatMoneyKGS } from '@/utils/locale';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { Badge, getOrderStatusBadge } from '@/components/ui/Badge';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useTranslation } from 'react-i18next';
import { getErrorMessage } from '@/utils/errorMessage';

function getFallbackOrders(t: (key: string, options?: Record<string, unknown>) => string) {
  return [
    {
      id: 'day-1',
      title: t('landing.fallbackOrders.logisticsLandingTitle'),
      category: t('categories.development'),
      budget: 45000,
      createdAt: t('landing.today', { defaultValue: 'Today' }),
    },
    {
      id: 'day-2',
      title: t('landing.fallbackOrders.mobileRedesignTitle'),
      category: t('categories.design'),
      budget: 38000,
      createdAt: t('landing.today', { defaultValue: 'Today' }),
    },
    {
      id: 'day-3',
      title: t('landing.fallbackOrders.adsManagementTitle'),
      category: t('categories.marketing'),
      budget: 25000,
      createdAt: t('landing.today', { defaultValue: 'Today' }),
    },
  ];
}

function getEscrowSteps(t: (key: string, options?: Record<string, unknown>) => string) {
  return [
    {
      title: t('landing.escrowSteps.createTitle', { defaultValue: 'Client creates an order' }),
      text: t('landing.escrowSteps.createText', { defaultValue: 'Terms and budget are fixed before work starts.' }),
    },
    {
      title: t('landing.escrowSteps.holdTitle', { defaultValue: 'Funds are held in escrow' }),
      text: t('landing.escrowSteps.holdText', { defaultValue: 'Freelancer sees funds are reserved.' }),
    },
    {
      title: t('landing.escrowSteps.releaseTitle', { defaultValue: 'Release after approval' }),
      text: t('landing.escrowSteps.releaseText', { defaultValue: 'Funds are released after acceptance.' }),
    },
  ];
}

export function LandingPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [searchMode, setSearchMode] = useState<'freelancer' | 'order'>('freelancer');
  const [query, setQuery] = useState('');
  const [topFreelancers, setTopFreelancers] = useState<Freelancer[]>([]);
  const [isTopFreelancersLoading, setIsTopFreelancersLoading] = useState(true);

  useEffect(() => {
    const loadTopFreelancers = async () => {
      try {
        setIsTopFreelancersLoading(true);
        const result = await api.getFreelancers({ limit: 6 });
        setTopFreelancers(result.data);
      } catch (err) {
        const message = getErrorMessage(err, t('landing.topFreelancersLoadFailed', { defaultValue: 'Failed to load freelancers' }));
        toast.error(message);
        setTopFreelancers([]);
      } finally {
        setIsTopFreelancersLoading(false);
      }
    };

    void loadTopFreelancers();
  }, [t]);

  const ordersOfDay = [...mockOrders.map((order) => ({
    id: order.id,
    title: order.title,
    category: order.category,
    budget: order.budget,
    createdAt: t('landing.today', { defaultValue: 'Today' }),
  })), ...getFallbackOrders(t)].slice(0, 6);

  const escrowSteps = getEscrowSteps(t);

  const featuredFreelancers = topFreelancers.slice(0, 6);
  const searchOptions = [
    { value: 'freelancer' as const, label: t('landing.tabFindFreelancer') },
    { value: 'order' as const, label: t('landing.tabFindOrder') },
  ];

  const handleSearch = () => {
    if (searchMode === 'freelancer') {
      const search = query.trim();
      navigate(search ? `/freelancers?search=${encodeURIComponent(search)}` : '/freelancers');
      return;
    }

    navigate(isAuthenticated ? '/dashboard/freelancer#available-orders' : '/login');
  };

  return (
    <PublicLayout containerClassName="max-w-[1340px]" contentClassName="pb-24">
      <section className="surface-elevated relative mb-8 animate-fadeUp overflow-hidden p-6 sm:p-8 lg:p-10">
        <div className="pointer-events-none absolute right-[-140px] top-[-150px] h-[340px] w-[340px] rounded-full bg-[color-mix(in_srgb,var(--color-primary)_18%,transparent)] blur-[86px]" />
        <div className="pointer-events-none absolute bottom-[-190px] left-[-120px] h-[380px] w-[380px] rounded-full bg-[color-mix(in_srgb,var(--color-info)_14%,transparent)] blur-[100px]" />

        <div className="grid grid-cols-1 gap-8 xl:grid-cols-12">
          <div className="xl:col-span-7">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Badge variant="success">{t('common.safeDeal')}</Badge>
              <Badge variant="info">{t('common.escrowProtection')}</Badge>
              <Badge variant="default">{t('landing.localPlatform', { defaultValue: 'Platform for Kyrgyzstan' })}</Badge>
            </div>

            <h1 className="font-[var(--font-family-display)] text-[clamp(2.2rem,6vw,4.1rem)] font-semibold leading-[0.96] tracking-[-0.04em] text-[var(--color-text)]">
              {t('landing.heroTitlePart1', { defaultValue: 'Find freelancers or orders' })}
              <br />
              <span className="text-[var(--color-primary)]">
                {t('landing.heroTitlePart2', { defaultValue: 'with secure escrow deals' })}
              </span>
            </h1>

            <p className="mt-5 max-w-2xl text-base leading-relaxed text-[var(--color-text-muted)]">{t('landing.heroSubtitle')}</p>

            <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                {
                  icon: ShieldCheck,
                  title: t('common.safeDeal'),
                  subtitle: t('landing.escrowSubtitle'),
                },
                {
                  icon: Briefcase,
                  title: t('landing.metrics.orders'),
                  subtitle: t('landing.marketOpen', { defaultValue: 'Market open' }),
                },
                {
                  icon: Users,
                  title: t('landing.metrics.freelancers'),
                  subtitle: t('landing.marketWithoutLogin'),
                },
              ].map((item) => (
                <article key={item.title} className="surface-muted p-3.5">
                  <span className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-[10px] border border-[color-mix(in_srgb,var(--color-border)_72%,transparent)] bg-[var(--color-surface)] text-[var(--color-primary)]">
                    <item.icon className="h-4 w-4" />
                  </span>
                  <p className="text-sm font-semibold text-[var(--color-text)]">{item.title}</p>
                  <p className="mt-1 text-xs text-[var(--color-text-soft)]">{item.subtitle}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="xl:col-span-5">
            <div className="surface-glow p-4 sm:p-5">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-soft)]">
                {t('landing.searchButton', { defaultValue: 'Search' })}
              </p>
              <SegmentedControl
                value={searchMode}
                options={searchOptions}
                onValueChange={setSearchMode}
                fullWidth
                className="mb-3 w-full"
              />

              <label className="relative block">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-soft)]" />
                <input
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      handleSearch();
                    }
                  }}
                  placeholder={
                    searchMode === 'freelancer'
                      ? t('landing.searchPlaceholderFreelancer')
                      : t('landing.searchPlaceholderOrder')
                  }
                  className="h-12 w-full rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--color-border)_72%,transparent)] bg-[var(--color-surface)] pl-10 pr-3.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-soft)] outline-none transition-[border-color,box-shadow] duration-200 focus:border-[var(--color-ring)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-ring)_28%,transparent)]"
                />
              </label>

              <button
                type="button"
                onClick={handleSearch}
                className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--color-primary)_44%,transparent)] bg-[var(--color-primary)] px-4 text-[13px] font-semibold text-white transition-[transform,background-color] duration-200 active:scale-[0.98] hover:bg-[var(--color-primary-hover)]"
              >
                {t('landing.searchButton')}
                <ArrowRight className="h-4 w-4" />
              </button>

              <p className="mt-3 text-xs text-[var(--color-text-soft)]">{t('landing.marketWithoutLogin')}</p>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <Link
                  to="/register"
                  className="inline-flex h-10 items-center justify-center rounded-[10px] border border-[color-mix(in_srgb,var(--color-border)_72%,transparent)] bg-[var(--color-surface)] px-3 text-xs font-semibold text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-2)]"
                >
                  {t('landing.ctaRegister')}
                </Link>
                <Link
                  to="/freelancers"
                  className="inline-flex h-10 items-center justify-center rounded-[10px] border border-[color-mix(in_srgb,var(--color-border)_72%,transparent)] bg-[var(--color-surface)] px-3 text-xs font-semibold text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-2)]"
                >
                  {t('landing.viewMarket')}
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label={t('landing.metrics.freelancers')} value={`${stats.freelancers}+`} icon={Users} />
          <MetricCard label={t('landing.metrics.orders')} value={`${stats.orders}+`} icon={Briefcase} />
          <MetricCard label={t('landing.metrics.clients')} value="620+" icon={Users} />
          <MetricCard label={t('landing.metrics.escrowDeals')} value="1 900+" icon={ShieldCheck} />
        </div>
      </section>

      <section className="mb-8 grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <div className="surface p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="font-[var(--font-family-display)] text-[1.55rem] font-semibold tracking-[-0.024em] text-[var(--color-text)]">
                {t('landing.ordersOfDay')}
              </h2>
              <Badge variant="info">{t('landing.marketOpen')}</Badge>
            </div>

            <div className="space-y-3">
              {ordersOfDay.map((order) => {
                const statusBadge = getOrderStatusBadge('PENDING');

                return (
                  <article key={order.id} className="surface-muted interactive-card p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-semibold text-[var(--color-text)]">{order.title}</h3>
                        <p className="mt-1 text-sm text-[var(--color-text-muted)]">{order.category}</p>
                        <div className="mt-2 flex items-center gap-2">
                          <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
                          <Badge variant="success">{t('common.escrowProtection')}</Badge>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-xs uppercase tracking-[0.08em] text-[var(--color-text-soft)]">{t('landing.budget')}</p>
                          <p className="text-lg font-semibold text-[var(--color-text)]">
                            {formatMoneyKGS(order.budget, i18n.language)}
                          </p>
                        </div>
                        <Link
                          to={isAuthenticated ? '/dashboard/freelancer#available-orders' : '/login'}
                          className="inline-flex h-10 items-center rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--color-primary)_44%,transparent)] bg-[var(--color-primary)] px-4 text-[13px] font-semibold text-white transition-[transform,background-color] duration-200 active:scale-[0.98] hover:bg-[var(--color-primary-hover)]"
                        >
                          {t('landing.respond')}
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>

        <div className="xl:col-span-4">
          <div className="surface p-5 sm:p-6">
            <h2 className="font-[var(--font-family-display)] text-xl font-semibold tracking-[-0.02em] text-[var(--color-text)]">
              {t('landing.howEscrowWorks')}
            </h2>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">{t('landing.escrowSubtitle')}</p>

            <ol className="mt-4 space-y-3">
              {escrowSteps.map((step, index) => (
                <li
                  key={step.title}
                  className="rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--color-border)_62%,transparent)] bg-[var(--color-surface-2)] p-3.5"
                >
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--color-primary)_45%,transparent)] bg-[var(--color-primary)] text-xs font-bold text-white">
                      {index + 1}
                    </span>
                    <p className="text-sm font-semibold text-[var(--color-text)]">{step.title}</p>
                  </div>
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">{step.text}</p>
                </li>
              ))}
            </ol>

            <Link
              to="/how-it-works"
              className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--color-border)_72%,transparent)] bg-[var(--color-surface)] px-4 text-[13px] font-semibold text-[var(--color-text)] transition-[transform,background-color,border-color] duration-200 active:scale-[0.98] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-2)]"
            >
              {t('landing.escrowMore')}
            </Link>
          </div>
        </div>
      </section>

      <section className="mb-8 surface p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-[var(--font-family-display)] text-[1.55rem] font-semibold tracking-[-0.024em] text-[var(--color-text)]">
            {t('landing.popularCategories')}
          </h2>
          <Link to="/categories" className="text-sm font-semibold text-[var(--color-primary)] hover:underline">
            {t('landing.allCategories')}
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {CATEGORIES.map((category) => (
            <Link
              key={category.id}
              to={`/freelancers?category=${category.id}`}
              className="interactive-card rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--color-border)_62%,transparent)] bg-[var(--color-surface-2)] p-3.5"
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-[color-mix(in_srgb,var(--color-border)_72%,transparent)] bg-[var(--color-surface)] text-base">
                {category.icon}
              </span>
              <p className="mt-2 text-sm font-semibold text-[var(--color-text)]">{category.name}</p>
              <p className="text-xs text-[var(--color-text-soft)]">
                {category.count} {t('landing.specialists', { defaultValue: 'specialists' })}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mb-8 surface p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-[var(--font-family-display)] text-[1.55rem] font-semibold tracking-[-0.024em] text-[var(--color-text)]">
            {t('landing.topFreelancers')}
          </h2>
          <Link to="/freelancers" className="text-sm font-semibold text-[var(--color-primary)] hover:underline">
            {t('landing.viewMarket')}
          </Link>
        </div>

        {isTopFreelancersLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <article key={index} className="surface-muted p-4">
                <div className="flex items-start gap-3">
                  <Skeleton className="h-12 w-12 rounded-[10px]" />
                  <div className="min-w-0 flex-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="mt-2 h-3.5 w-24" />
                    <Skeleton className="mt-3 h-3.5 w-40" />
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between gap-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-9 w-20 rounded-[10px]" />
                </div>
              </article>
            ))}
          </div>
        ) : featuredFreelancers.length === 0 ? (
          <EmptyState
            title={t('landing.topFreelancersEmpty', { defaultValue: 'Top freelancers will appear here soon' })}
            description={t('landing.marketWithoutLogin')}
            compact
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {featuredFreelancers.map((freelancer) => (
              <article key={freelancer.id} className="surface-muted interactive-card p-4">
                <div className="flex items-start gap-3">
                  <img
                    src={toAbsoluteAssetUrl(freelancer.avatar) || '/vite.svg'}
                    alt={freelancer.name}
                    className="h-12 w-12 rounded-[10px] object-cover"
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-sm font-semibold text-[var(--color-text)]">{freelancer.name}</h3>
                      {freelancer.isVerified ? <CheckCircle className="h-4 w-4 text-[var(--color-success)]" /> : null}
                    </div>

                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                      {freelancer.category || t('landing.noCategory', { defaultValue: 'No category' })}
                    </p>

                    <div className="mt-2 flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
                      <span className="inline-flex items-center gap-1">
                        <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                        {freelancer.rating.toFixed(1)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock3 className="h-3.5 w-3.5" />
                        {freelancer.completedOrders} {t('landing.ordersCount', { defaultValue: 'orders' })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[var(--color-text)]">
                    {formatMoneyKGS(freelancer.hourlyRate || 0, i18n.language)}/{t('landing.perHour', { defaultValue: 'hour' })}
                  </p>
                  <Link
                    to={`/freelancers/${freelancer.id}`}
                    className="inline-flex h-9 items-center rounded-[10px] border border-[color-mix(in_srgb,var(--color-border)_72%,transparent)] bg-[var(--color-surface)] px-3 text-xs font-semibold text-[var(--color-text)] transition-[transform,background-color,border-color] duration-200 active:scale-[0.98] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-2)]"
                  >
                    {t('landing.profile', { defaultValue: 'Profile' })}
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="surface-elevated relative overflow-hidden p-6 sm:p-8">
        <div className="pointer-events-none absolute left-[-90px] top-[-120px] h-[250px] w-[250px] rounded-full bg-[color-mix(in_srgb,var(--color-primary)_14%,transparent)] blur-[88px]" />
        <div className="mx-auto max-w-3xl text-center">
          <div className="mx-auto mb-3 inline-flex items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--color-success)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-success)_14%,transparent)] px-3 py-1 text-xs font-semibold text-[var(--color-success)]">
            <CreditCard className="h-3.5 w-3.5" />
            {t('landing.escrowActive')}
          </div>

          <h2 className="font-[var(--font-family-display)] text-3xl font-semibold tracking-[-0.03em] text-[var(--color-text)]">
            {t('landing.ctaTitle')}
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-[var(--color-text-muted)]">{t('landing.ctaSubtitle')}</p>

          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/register"
              className="inline-flex h-10 items-center rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--color-primary)_44%,transparent)] bg-[var(--color-primary)] px-5 text-[13px] font-semibold text-white transition-[transform,background-color] duration-200 active:scale-[0.98] hover:bg-[var(--color-primary-hover)]"
            >
              {t('landing.ctaRegister')}
            </Link>
            <Link
              to="/freelancers"
              className="inline-flex h-10 items-center rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--color-border)_72%,transparent)] bg-[var(--color-surface)] px-5 text-[13px] font-semibold text-[var(--color-text)] transition-[transform,background-color,border-color] duration-200 active:scale-[0.98] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-2)]"
            >
              {t('landing.ctaFreelancers')}
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Users;
}) {
  return (
    <article className="surface-muted interactive-card p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-soft)]">{label}</p>
          <p className="mt-1 font-[var(--font-family-display)] text-[1.45rem] font-semibold tracking-[-0.028em] text-[var(--color-text)]">{value}</p>
        </div>
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--color-border)_72%,transparent)] bg-[var(--color-surface)] text-[var(--color-primary)]">
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </article>
  );
}
