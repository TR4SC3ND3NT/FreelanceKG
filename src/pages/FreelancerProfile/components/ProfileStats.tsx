import { Briefcase, Clock, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ProfileStatsProps {
  rating: number;
  reviewCount: number;
  completedOrders: number;
  isOnline: boolean;
}

export function ProfileStats({ rating, reviewCount, completedOrders, isOnline }: ProfileStatsProps) {
  const { t } = useTranslation();

  return (
    <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
      <article className="rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--color-border)_62%,transparent)] bg-[var(--color-surface-2)] p-3.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-soft)]">{t('freelancerProfile.rating')}</p>
        <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-text)]">
          <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
          {rating.toFixed(1)} ({reviewCount})
        </p>
      </article>

      <article className="rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--color-border)_62%,transparent)] bg-[var(--color-surface-2)] p-3.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-soft)]">{t('freelancerProfile.completedOrders')}</p>
        <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-text)]">
          <Briefcase className="h-3.5 w-3.5" />
          {completedOrders}
        </p>
      </article>

      <article className="rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--color-border)_62%,transparent)] bg-[var(--color-surface-2)] p-3.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-soft)]">{t('common.status')}</p>
        <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-text)]">
          <Clock className="h-3.5 w-3.5" />
          {isOnline ? t('freelancerProfile.online') : t('freelancerProfile.recentlyOnline')}
        </p>
      </article>
    </div>
  );
}
