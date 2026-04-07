import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle, ChevronDown, Filter, Search, SlidersHorizontal, Star, X } from 'lucide-react';
import { CATEGORIES } from '@/data/mockData';
import api, { Freelancer } from '@/services/api';
import { toAbsoluteAssetUrl } from '@/utils/assetUrl';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useTranslation } from 'react-i18next';
import { formatMoneyKGS } from '@/utils/locale';

export function FreelancersPage() {
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [minRating, setMinRating] = useState<number>(0);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [freelancersData, setFreelancersData] = useState<Freelancer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const categoryById = useMemo(
    () => Object.fromEntries(CATEGORIES.map((category) => [category.id, t(`categories.${category.id}`, { defaultValue: category.name })])),
    [t]
  );

  useEffect(() => {
    const loadFreelancers = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const result = await api.getFreelancers({ limit: 200 });
        setFreelancersData(result.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : t('freelancersPage.loadFailed'));
      } finally {
        setIsLoading(false);
      }
    };

    void loadFreelancers();
  }, [t]);

  useEffect(() => {
    const categoryFromQuery = searchParams.get('category');
    if (categoryFromQuery && CATEGORIES.some((category) => category.id === categoryFromQuery)) {
      setSelectedCategory(categoryFromQuery);
    }

    const query = searchParams.get('search');
    if (query) {
      setSearchQuery(query);
    }
  }, [searchParams]);

  useEffect(() => {
    const currentCategory = searchParams.get('category') || '';
    if (selectedCategory === currentCategory) return;

    const nextParams = new URLSearchParams(searchParams);
    if (selectedCategory) {
      nextParams.set('category', selectedCategory);
    } else {
      nextParams.delete('category');
    }

    setSearchParams(nextParams, { replace: true });
  }, [searchParams, selectedCategory, setSearchParams]);

  const allSkills = useMemo(() => {
    const skills = new Set<string>();
    freelancersData.forEach((freelancer) => freelancer.skills.forEach((skill) => skills.add(skill)));
    return Array.from(skills).sort((a, b) => a.localeCompare(b));
  }, [freelancersData]);

  const filteredFreelancers = useMemo(() => {
    return freelancersData.filter((freelancer) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = freelancer.name.toLowerCase().includes(query);
        const matchesSkills = freelancer.skills.some((skill) => skill.toLowerCase().includes(query));
        if (!matchesName && !matchesSkills) return false;
      }

      if (selectedCategory) {
        const selectedCategoryLabel = categoryById[selectedCategory];
        const normalizedCategory = (freelancer.category || '').toLowerCase();
        if (
          normalizedCategory !== selectedCategory.toLowerCase() &&
          normalizedCategory !== (selectedCategoryLabel || '').toLowerCase()
        ) {
          return false;
        }
      }

      if (minRating && freelancer.rating < minRating) return false;

      const hourlyRate = freelancer.hourlyRate ?? 0;
      if (hourlyRate < priceRange[0] || hourlyRate > priceRange[1]) return false;

      if (selectedSkills.length > 0) {
        const hasAllSkills = selectedSkills.every((skill) =>
          freelancer.skills.some((candidate) => candidate.toLowerCase() === skill.toLowerCase())
        );
        if (!hasAllSkills) return false;
      }

      return true;
    });
  }, [categoryById, freelancersData, minRating, priceRange, searchQuery, selectedCategory, selectedSkills]);

  const columns = useMemo<Array<DataTableColumn<Freelancer>>>(
    () => [
      {
        key: 'name',
        header: t('freelancersPage.columns.freelancer'),
        className: 'min-w-[220px]',
        render: (freelancer) => (
          <div className="flex items-center gap-3">
            <img
              src={toAbsoluteAssetUrl(freelancer.avatar) || '/vite.svg'}
              alt={freelancer.name}
              className="h-10 w-10 rounded-[10px] object-cover"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="truncate font-semibold text-[var(--color-text)]">{freelancer.name}</p>
                {freelancer.isVerified ? <CheckCircle className="h-4 w-4 text-[var(--color-success)]" /> : null}
              </div>
              <p className="text-xs text-[var(--color-text-soft)]">{freelancer.category || t('landing.noCategory')}</p>
            </div>
          </div>
        ),
      },
      {
        key: 'skills',
        header: t('freelancersPage.columns.skills'),
        className: 'min-w-[220px]',
        render: (freelancer) => (
          <div className="flex flex-wrap gap-1">
            {freelancer.skills.slice(0, 3).map((skill) => (
              <Badge key={skill} variant="default" size="sm">
                {skill}
              </Badge>
            ))}
          </div>
        ),
      },
      {
        key: 'rate',
        header: t('freelancersPage.columns.rate'),
        render: (freelancer) => (
          <span className="font-semibold text-[var(--color-text)]">
            {formatMoneyKGS(freelancer.hourlyRate || 0, i18n.language)}/{t('landing.perHour')}
          </span>
        ),
      },
      {
        key: 'rating',
        header: t('freelancersPage.columns.rating'),
        render: (freelancer) => (
          <span className="inline-flex items-center gap-1 text-[var(--color-text)]">
            <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
            {freelancer.rating.toFixed(1)} ({freelancer.reviewCount || 0})
          </span>
        ),
      },
      {
        key: 'actions',
        header: t('common.actions'),
        className: 'text-right',
        cellClassName: 'text-right',
        render: (freelancer) => (
          <Link
            to={`/freelancers/${freelancer.id}`}
            className="inline-flex h-9 items-center rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-xs font-semibold text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-2)]"
          >
            {t('freelancersPage.openProfile')}
          </Link>
        ),
      },
    ],
    [i18n.language, t]
  );

  const addSkill = (skill: string) => {
    if (!selectedSkills.includes(skill)) {
      setSelectedSkills((prev) => [...prev, skill]);
    }
  };

  const removeSkill = (skill: string) => {
    setSelectedSkills((prev) => prev.filter((value) => value !== skill));
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('');
    setMinRating(0);
    setPriceRange([0, 10000]);
    setSelectedSkills([]);

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('category');
    nextParams.delete('search');
    setSearchParams(nextParams, { replace: true });
  };

  return (
    <PublicLayout containerClassName="max-w-[1280px]">
      <div className="mb-6 surface p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="page-title text-[var(--color-text)]">{t('freelancersPage.title')}</h1>
            <p className="page-subtitle mt-2 max-w-3xl">
              {t('freelancersPage.subtitle')}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="success">{t('common.safeDeal')}</Badge>
            <Badge variant="info">{t('common.escrowProtection')}</Badge>
          </div>
        </div>
      </div>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <div>
          <Input
            leftIcon={<Search className="h-4 w-4" />}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={t('freelancersPage.searchPlaceholder')}
            aria-label={t('freelancersPage.searchPlaceholder')}
            className="w-full sm:min-w-[420px]"
          />
        </div>
      </div>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row lg:hidden">
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowFilters((prev) => !prev)}
          aria-label={t('freelancersPage.filters')}
          aria-expanded={showFilters}
          aria-controls="freelancers-filters"
          leftIcon={<SlidersHorizontal className="h-4 w-4" />}
        >
          {t('freelancersPage.filters')}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <aside id="freelancers-filters" className={showFilters ? 'lg:col-span-3' : 'hidden lg:block lg:col-span-3'}>
          <div className="surface sticky top-24 p-5">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[var(--color-text-soft)]">
                <Filter className="h-4 w-4" />
                {t('freelancersPage.filters')}
              </h2>
              <button
                type="button"
                onClick={clearFilters}
                aria-label={t('freelancersPage.reset')}
                className="text-xs font-semibold text-[var(--color-primary)] hover:underline"
              >
                {t('freelancersPage.reset')}
              </button>
            </div>

            <div className="mb-5">
              <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">{t('orders.create.category')}</label>
              <div className="relative">
                <select
                  value={selectedCategory}
                  onChange={(event) => setSelectedCategory(event.target.value)}
                  className="h-10 w-full appearance-none rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 text-sm text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-ring)]"
                >
                  <option value="">{t('freelancersPage.allCategories')}</option>
                  {CATEGORIES.map((category) => (
                    <option key={category.id} value={category.id}>
                      {t(`categories.${category.id}`, { defaultValue: category.name })}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-soft)]" />
              </div>
            </div>

            <div className="mb-5">
              <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">{t('freelancersPage.minRating')}</label>
              <div className="grid grid-cols-4 gap-1.5">
                {[0, 3, 4, 4.5].map((rating) => (
                  <button
                    key={rating}
                    type="button"
                    onClick={() => setMinRating(rating)}
                    aria-label={rating === 0 ? t('freelancersPage.all') : `${rating}+`}
                    className={
                      minRating === rating
                        ? 'h-9 rounded-[var(--radius-control)] border border-[var(--color-primary)] bg-[color-mix(in_srgb,var(--color-primary)_12%,transparent)] text-xs font-semibold text-[var(--color-primary)]'
                        : 'h-9 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] text-xs font-semibold text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-2)]'
                    }
                  >
                    {rating === 0 ? t('freelancersPage.all') : `${rating}+`}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-5">
              <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">
                {t('freelancersPage.priceRange')}: {priceRange[0]} - {priceRange[1]}
              </label>
              <input
                type="range"
                min="0"
                max="10000"
                step="100"
                value={priceRange[1]}
                onChange={(event) => setPriceRange([priceRange[0], Number(event.target.value)])}
                className="w-full accent-[var(--color-primary)]"
                aria-label={t('freelancersPage.priceRange')}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">{t('freelancersPage.columns.skills')}</label>

              {selectedSkills.length > 0 ? (
                <div className="mb-3 flex flex-wrap gap-2">
                  {selectedSkills.map((skill) => (
                    <span
                      key={skill}
                      className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2.5 py-1 text-xs font-semibold text-[var(--color-text-muted)]"
                    >
                      {skill}
                      <button type="button" onClick={() => removeSkill(skill)} aria-label={`${t('common.remove', { defaultValue: 'Remove' })} ${skill}`}>
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                {allSkills
                  .slice(0, 14)
                  .filter((skill) => !selectedSkills.includes(skill))
                  .map((skill) => (
                    <button
                      key={skill}
                      type="button"
                      onClick={() => addSkill(skill)}
                      aria-label={`${t('common.add', { defaultValue: 'Add' })} ${skill}`}
                      className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-xs font-medium text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-2)]"
                    >
                      + {skill}
                    </button>
                  ))}
              </div>
            </div>
          </div>
        </aside>

        <div className="lg:col-span-9">
          {error ? (
            <div className="mb-4 rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--color-danger)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_12%,transparent)] px-4 py-3 text-sm text-[var(--color-danger)]">
              {error}
            </div>
          ) : null}

          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm text-[var(--color-text-muted)]">
              {t('freelancersPage.found')}: <span className="font-semibold text-[var(--color-text)]">{filteredFreelancers.length}</span>
            </p>
            {error ? <Badge variant="danger">{t('common.error', { defaultValue: 'Error' })}</Badge> : <Badge variant="default">{t('freelancersPage.readOnly')}</Badge>}
          </div>

          <DataTable
            columns={columns}
            data={filteredFreelancers}
            rowKey={(row) => row.id}
            isLoading={isLoading}
            skeletonRows={6}
            ariaLabel={t('freelancersPage.title')}
            emptyTitle={t('freelancersPage.emptyTitle')}
            emptyDescription={t('freelancersPage.emptyDescription')}
          />
        </div>
      </div>
    </PublicLayout>
  );
}
