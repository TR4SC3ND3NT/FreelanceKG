import { Rocket, ShieldCheck, Users } from 'lucide-react';
import { PublicPageLayout } from '../components/PublicPageLayout';
import { Card } from '@/components/ui/Card';
import { useTranslation } from 'react-i18next';

export function AboutPage() {
  const { t } = useTranslation();

  return (
    <PublicPageLayout
      title={t('aboutPage.title')}
      subtitle={t('aboutPage.subtitle')}
    >
      <div className="mb-8 grid grid-cols-1 gap-5 lg:grid-cols-3">
        {[
          {
            icon: Rocket,
            title: t('aboutPage.cards.history.title'),
            text: t('aboutPage.cards.history.text'),
          },
          {
            icon: ShieldCheck,
            title: t('aboutPage.cards.mission.title'),
            text: t('aboutPage.cards.mission.text'),
          },
          {
            icon: Users,
            title: t('aboutPage.cards.team.title'),
            text: t('aboutPage.cards.team.text'),
          },
        ].map((item) => (
          <Card key={item.title} className="p-6">
            <div className="mb-4 inline-flex h-10 w-11 items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-primary)]">
              <item.icon className="h-5 w-5" />
            </div>
            <h2 className="mb-2 section-title">{item.title}</h2>
            <p className="text-sm leading-relaxed text-[var(--color-text-muted)]">{item.text}</p>
          </Card>
        ))}
      </div>

      <section className="surface p-7">
        <h3 className="mb-3 section-title">{t('aboutPage.whatsNextTitle')}</h3>
        <p className="mb-3 text-sm leading-relaxed text-[var(--color-text-muted)]">
          {t('aboutPage.whatsNextText1')}
        </p>
        <p className="text-sm leading-relaxed text-[var(--color-text-muted)]">
          {t('aboutPage.whatsNextText2')}
        </p>
      </section>
    </PublicPageLayout>
  );
}
