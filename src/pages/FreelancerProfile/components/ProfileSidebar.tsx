import { Link } from 'react-router-dom';
import { MessageSquare, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ProfileSidebarProps {
  freelancerId: string;
}

export function ProfileSidebar({ freelancerId }: ProfileSidebarProps) {
  const { t } = useTranslation();

  return (
    <aside className="xl:col-span-4">
      <section className="surface sticky top-24 animate-fadeUp-delay p-6">
        <h2 className="section-title">{t('freelancerProfile.startCooperation')}</h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-muted)]">{t('freelancerProfile.startHint')}</p>

        <div className="mt-5 space-y-2.5">
          <Link
            to={`/orders/new?freelancerId=${freelancerId}`}
            className="inline-flex h-10 w-full items-center justify-center rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--color-primary)_42%,transparent)] bg-[var(--color-primary)] px-4 text-[13px] font-semibold text-white transition-[transform,background-color] duration-200 active:scale-[0.98] hover:bg-[var(--color-primary-hover)]"
          >
            {t('dashboard.client.newOrder')}
          </Link>
          <Link
            to={`/orders/new?freelancerId=${freelancerId}`}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--color-border)_72%,transparent)] bg-[var(--color-surface)] px-4 text-[13px] font-semibold text-[var(--color-text)] transition-[transform,background-color,border-color] duration-200 active:scale-[0.98] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-2)]"
          >
            <MessageSquare className="h-4 w-4" />
            {t('freelancerProfile.discussProject')}
          </Link>
        </div>

        <div className="mt-6 rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--color-success)_34%,transparent)] bg-[color-mix(in_srgb,var(--color-success)_12%,transparent)] p-3.5">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.08em] text-[var(--color-success)]">
            <ShieldCheck className="h-4 w-4" />
            {t('freelancerProfile.escrowPayment')}
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-[var(--color-text-muted)]">{t('freelancerProfile.escrowPaymentHint')}</p>
        </div>
      </section>
    </aside>
  );
}
