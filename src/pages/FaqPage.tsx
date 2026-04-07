import { PublicPageLayout } from '../components/PublicPageLayout';
import { FAQAccordion } from '../components/FAQAccordion';
import { getFaqItems } from '../data/helpFaq';
import { useTranslation } from 'react-i18next';

export function FaqPage() {
  const { t } = useTranslation();
  const faqItems = getFaqItems(t);

  return (
    <PublicPageLayout title="FAQ" subtitle={t('faqPage.subtitle')} align="left">
      <section className="surface p-5 sm:p-6">
        <FAQAccordion items={faqItems} />
      </section>
    </PublicPageLayout>
  );
}
