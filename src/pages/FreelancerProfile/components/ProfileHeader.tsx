import { CheckCircle } from 'lucide-react';
import type { Freelancer } from '@/services/api';
import { Badge } from '@/components/ui/Badge';
import { toAbsoluteAssetUrl } from '@/utils/assetUrl';
import { formatMoneyKGS } from '@/utils/locale';
import { useTranslation } from 'react-i18next';
import { ProfileStats } from './ProfileStats';

interface ProfileHeaderProps {
  freelancer: Freelancer;
  language: string;
}

export function ProfileHeader({ freelancer, language }: ProfileHeaderProps) {
  const { t } = useTranslation();

  return (
    <section className="surface-elevated animate-fadeUp p-6 md:p-7">
      <div className="flex flex-col gap-5 md:flex-row">
        <div className="relative shrink-0">
          <img
            src={toAbsoluteAssetUrl(freelancer.avatar) || '/vite.svg'}
            alt={freelancer.name}
            className="h-28 w-28 rounded-[var(--radius-soft)] border border-[color-mix(in_srgb,var(--color-border)_72%,transparent)] object-cover"
          />
          {freelancer.isOnline ? (
            <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-2 border-[var(--color-surface)] bg-[var(--color-success)]" />
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-[var(--font-family-display)] text-[clamp(2rem,2.8vw,2.6rem)] font-semibold tracking-[-0.034em] text-[var(--color-text)]">
              {freelancer.name}
            </h1>
            {freelancer.isVerified ? <CheckCircle className="h-5 w-5 text-[var(--color-success)]" /> : null}
          </div>

          <p className="mt-1 text-sm text-[var(--color-text-muted)]">{freelancer.category || t('landing.noCategory')}</p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge variant="default">{formatMoneyKGS(freelancer.hourlyRate || 0, language)}/{t('landing.perHour')}</Badge>
            {freelancer.isVerified ? <Badge variant="success">{t('freelancerProfile.verified')}</Badge> : null}
          </div>

          <ProfileStats
            rating={freelancer.rating}
            reviewCount={freelancer.reviewCount || 0}
            completedOrders={freelancer.completedOrders}
            isOnline={freelancer.isOnline}
          />
        </div>
      </div>
    </section>
  );
}
