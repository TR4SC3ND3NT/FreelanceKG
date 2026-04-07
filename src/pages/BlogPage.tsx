import { ArrowRight, CalendarDays } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PublicPageLayout } from '../components/PublicPageLayout';
import { Card } from '@/components/ui/Card';
import { useTranslation } from 'react-i18next';

export function BlogPage() {
  const { t } = useTranslation();

  const articles = [
    {
      id: 'how-to-hire',
      title: t('blogPage.articles.hire.title'),
      excerpt: t('blogPage.articles.hire.excerpt'),
      date: t('blogPage.articles.hire.date'),
    },
    {
      id: 'escrow-basics',
      title: t('blogPage.articles.escrow.title'),
      excerpt: t('blogPage.articles.escrow.excerpt'),
      date: t('blogPage.articles.escrow.date'),
    },
    {
      id: 'freelancer-profile',
      title: t('blogPage.articles.profile.title'),
      excerpt: t('blogPage.articles.profile.excerpt'),
      date: t('blogPage.articles.profile.date'),
    },
  ];

  return (
    <PublicPageLayout title={t('blogPage.title')} subtitle={t('blogPage.subtitle')}>
      <div className="space-y-4">
        {articles.map((article) => (
          <Card key={article.id} className="p-6">
            <div className="mb-3 flex items-center gap-2 text-sm text-[var(--color-text-soft)]">
              <CalendarDays className="h-4 w-4" />
              <span>{article.date}</span>
            </div>
            <h2 className="mb-2 section-title">{article.title}</h2>
            <p className="mb-4 text-sm leading-relaxed text-[var(--color-text-muted)]">{article.excerpt}</p>
            <Link to="/blog" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-primary)] hover:underline">
              {t('blogPage.readArticle')}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Card>
        ))}
      </div>
    </PublicPageLayout>
  );
}
