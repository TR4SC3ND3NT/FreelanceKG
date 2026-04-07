import { Link } from 'react-router-dom';
import { LifeBuoy, Mail, MessageCircleQuestion } from 'lucide-react';
import { PublicPageLayout } from '../components/PublicPageLayout';
import { FAQAccordion } from '../components/FAQAccordion';
import { getFaqItems } from '../data/helpFaq';
import { Card } from '@/components/ui/Card';
import { useTranslation } from 'react-i18next';

export function HelpPage() {
  const { t } = useTranslation();
  const faqItems = getFaqItems(t);

  return (
    <PublicPageLayout title={t('helpPage.title')} subtitle={t('helpPage.subtitle')}>
      <div className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-3">
        {[
          {
            icon: MessageCircleQuestion,
            title: t('helpPage.cards.knowledge.title'),
            text: t('helpPage.cards.knowledge.text'),
          },
          {
            icon: LifeBuoy,
            title: t('helpPage.cards.support.title'),
            text: t('helpPage.cards.support.text'),
          },
          {
            icon: Mail,
            title: t('helpPage.cards.contacts.title'),
            text: t('helpPage.cards.contacts.text'),
          },
        ].map((card) => (
          <Card key={card.title} className="p-6">
            <div className="mb-4 inline-flex h-10 w-11 items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-primary)]">
              <card.icon className="h-5 w-5" />
            </div>
            <h2 className="mb-2 section-title">{card.title}</h2>
            <p className="text-sm text-[var(--color-text-muted)]">{card.text}</p>
          </Card>
        ))}
      </div>

      <FAQAccordion items={faqItems} />

      <div className="mt-8 text-center">
        <Link
          to="/contact"
          className="inline-flex h-10 items-center rounded-[var(--radius-control)] bg-[var(--color-primary)] px-5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-hover)]"
        >
          {t('helpPage.contactSupport')}
        </Link>
      </div>
    </PublicPageLayout>
  );
}
