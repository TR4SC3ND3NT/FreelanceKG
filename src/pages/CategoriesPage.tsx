import { Link } from 'react-router-dom';
import { Clapperboard, Code2, Languages, Palette, PenLine, TrendingUp } from 'lucide-react';
import { PublicPageLayout } from '../components/PublicPageLayout';
import { Card } from '@/components/ui/Card';
import { useTranslation } from 'react-i18next';

export function CategoriesPage() {
  const { t } = useTranslation();

  const categories = [
    { id: 'development', title: t('categories.development'), count: 320, icon: Code2 },
    { id: 'design', title: t('categories.design'), count: 210, icon: Palette },
    { id: 'marketing', title: t('categories.marketing'), count: 174, icon: TrendingUp },
    { id: 'copywriting', title: t('categories.copywriting'), count: 126, icon: PenLine },
    { id: 'video', title: t('categoriesPage.videoEditing'), count: 96, icon: Clapperboard },
    { id: 'translation', title: t('categories.translation'), count: 84, icon: Languages },
  ];

  return (
    <PublicPageLayout title={t('categoriesPage.title')} subtitle={t('categoriesPage.subtitle')}>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((item) => (
          <Card key={item.id} className="p-0 transition-colors hover:bg-[var(--color-surface-2)]">
            <Link to={`/freelancers?category=${item.id}`} className="block p-6">
              <div className="mb-4 inline-flex h-10 w-11 items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-primary)]">
                <item.icon className="h-5 w-5" />
              </div>
              <h2 className="mb-1 section-title">{item.title}</h2>
              <p className="text-sm text-[var(--color-text-muted)]">{item.count} {t('landing.metrics.freelancers').toLowerCase()}</p>
              <span className="mt-4 inline-block text-sm font-semibold text-[var(--color-primary)]">{t('categoriesPage.viewSpecialists')}</span>
            </Link>
          </Card>
        ))}
      </div>
    </PublicPageLayout>
  );
}
