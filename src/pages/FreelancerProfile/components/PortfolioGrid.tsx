import { ExternalLink, FolderKanban } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/ui/EmptyState';
import { toAbsoluteAssetUrl } from '@/utils/assetUrl';
import type { PortfolioItem } from '../hooks/useFreelancerProfile';

interface PortfolioGridProps {
  portfolio: PortfolioItem[];
}

export function PortfolioGrid({ portfolio }: PortfolioGridProps) {
  const { t } = useTranslation();

  if (portfolio.length === 0) {
    return (
      <EmptyState
        title={t('freelancerProfile.noPortfolio')}
        description={t('freelancerProfile.startHint')}
        icon={<FolderKanban className="h-4 w-4" />}
        compact
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {portfolio.map((item, index) => {
        const preview = toAbsoluteAssetUrl(item.imageUrl || item.image);

        return (
          <article
            key={item.id || index}
            className="interactive-card overflow-hidden rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--color-border)_64%,transparent)] bg-[var(--color-surface)]"
          >
            <div className="relative aspect-video">
              {preview ? (
                <img src={preview} alt={item.title || t('freelancerProfile.tabs.portfolio')} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-[var(--color-surface-2)] text-xs text-[var(--color-text-soft)]">
                  {t('freelancerProfile.noPreview')}
                </div>
              )}

              <div className="pointer-events-none absolute bottom-2 right-2 rounded-[10px] bg-[color-mix(in_srgb,var(--color-surface)_80%,transparent)] p-1.5 text-[var(--color-text-soft)]">
                <ExternalLink className="h-3.5 w-3.5" />
              </div>
            </div>

            <div className="p-3.5">
              <h3 className="text-sm font-semibold text-[var(--color-text)]">{item.title || t('freelancerProfile.project')}</h3>
              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--color-text-muted)]">
                {item.description || t('freelancerProfile.noProjectDescription')}
              </p>
            </div>
          </article>
        );
      })}
    </div>
  );
}
