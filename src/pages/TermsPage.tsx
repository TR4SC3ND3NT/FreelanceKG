import { PublicPageLayout } from '../components/PublicPageLayout';
import { useTranslation } from 'react-i18next';

export function TermsPage() {
  const { t } = useTranslation();
  const sections = [
    {
      title: t('termsPage.sections.general.title'),
      text: t('termsPage.sections.general.text'),
    },
    {
      title: t('termsPage.sections.account.title'),
      text: t('termsPage.sections.account.text'),
    },
    {
      title: t('termsPage.sections.orders.title'),
      text: t('termsPage.sections.orders.text'),
    },
    {
      title: t('termsPage.sections.disputes.title'),
      text: t('termsPage.sections.disputes.text'),
    },
    {
      title: t('termsPage.sections.liability.title'),
      text: t('termsPage.sections.liability.text'),
    },
  ];

  return (
    <PublicPageLayout title={t('termsPage.title')} subtitle={t('termsPage.subtitle')} align="left">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <aside className="xl:col-span-3">
          <div className="surface sticky top-24 p-4">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-soft)]">Contents</p>
            <nav className="space-y-1.5">
              {sections.map((section, index) => (
                <a
                  key={section.title}
                  href={`#terms-${index + 1}`}
                  className="block rounded-[10px] px-2.5 py-2 text-sm font-medium text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
                >
                  {section.title}
                </a>
              ))}
            </nav>
          </div>
        </aside>

        <div className="space-y-3 xl:col-span-9">
          {sections.map((section, index) => (
            <section key={section.title} id={`terms-${index + 1}`} className="surface p-6">
              <h2 className="mb-2 section-title">{section.title}</h2>
              <p className="text-sm leading-relaxed text-[var(--color-text-muted)]">{section.text}</p>
            </section>
          ))}
        </div>
      </div>
    </PublicPageLayout>
  );
}
