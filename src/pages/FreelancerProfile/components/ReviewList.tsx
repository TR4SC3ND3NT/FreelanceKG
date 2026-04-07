import { MessageSquareText, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Review } from '@/services/api';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDate } from '@/utils/locale';
import { toAbsoluteAssetUrl } from '@/utils/assetUrl';

interface ReviewListProps {
  reviews: Review[];
  language: string;
}

function formatReviewDate(value: string, language: string, fallback: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return formatDate(date, language, { day: 'numeric', month: 'long', year: 'numeric' });
}

export function ReviewList({ reviews, language }: ReviewListProps) {
  const { t } = useTranslation();

  if (reviews.length === 0) {
    return (
      <EmptyState
        title={t('freelancerProfile.noReviews')}
        description={t('freelancerProfile.startHint')}
        icon={<MessageSquareText className="h-4 w-4" />}
        compact
      />
    );
  }

  return (
    <div className="space-y-4">
      {reviews.map((review) => (
        <article key={review.id} className="surface-muted interactive-card p-4">
          <div className="flex items-start gap-3">
            <img
              src={toAbsoluteAssetUrl(review.author.avatar) || '/vite.svg'}
              alt={review.author.name}
              className="h-10 w-10 rounded-[10px] border border-[color-mix(in_srgb,var(--color-border)_65%,transparent)] object-cover"
            />

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-[var(--color-text)]">{review.author.name}</h4>
                <div className="flex items-center gap-0.5">
                  {[...Array(5)].map((_, index) => (
                    <Star
                      key={index}
                      className={
                        index < review.rating
                          ? 'h-3.5 w-3.5 fill-amber-500 text-amber-500'
                          : 'h-3.5 w-3.5 text-[var(--color-border-strong)]'
                      }
                    />
                  ))}
                </div>
              </div>

              <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-muted)]">{review.comment || t('freelancerProfile.noComment')}</p>
              <p className="mt-2 text-xs text-[var(--color-text-soft)]">
                {formatReviewDate(review.createdAt, language, t('freelancerProfile.recently'))}
              </p>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
