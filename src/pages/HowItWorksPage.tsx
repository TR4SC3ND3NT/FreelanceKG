import { CheckCircle2, Search, Shield } from 'lucide-react';
import { PublicPageLayout } from '../components/PublicPageLayout';
import { Card } from '@/components/ui/Card';
import { useTranslation } from 'react-i18next';

export function HowItWorksPage() {
  const { t } = useTranslation();

  const steps = [
    {
      icon: Search,
      title: t('howItWorksPage.steps.findTitle'),
      text: t('howItWorksPage.steps.findText'),
    },
    {
      icon: Shield,
      title: t('howItWorksPage.steps.escrowTitle'),
      text: t('howItWorksPage.steps.escrowText'),
    },
    {
      icon: CheckCircle2,
      title: t('howItWorksPage.steps.doneTitle'),
      text: t('howItWorksPage.steps.doneText'),
    },
  ];

  return (
    <PublicPageLayout
      title={t('howItWorksPage.title')}
      subtitle={t('howItWorksPage.subtitle')}
    >
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {steps.map((step, index) => (
          <Card key={step.title} className="p-6">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-soft)]">0{index + 1}</div>
            <div className="mb-4 inline-flex h-10 w-11 items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-primary)]">
              <step.icon className="h-5 w-5" />
            </div>
            <h2 className="mb-2 section-title">{step.title}</h2>
            <p className="text-sm leading-relaxed text-[var(--color-text-muted)]">{step.text}</p>
          </Card>
        ))}
      </div>
    </PublicPageLayout>
  );
}
