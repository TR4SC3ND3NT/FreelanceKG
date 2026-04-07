import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  badges?: ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, actions, badges, className }: PageHeaderProps) {
  return (
    <section className={cn('surface-elevated relative overflow-hidden p-6 sm:p-7', className)}>
      <div className="pointer-events-none absolute right-[-120px] top-[-120px] h-[240px] w-[240px] rounded-full bg-[color-mix(in_srgb,var(--color-primary)_12%,transparent)] blur-[80px]" />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          {badges ? <div className="mb-2 flex flex-wrap items-center gap-2">{badges}</div> : null}
          <h1 className="font-[var(--font-family-display)] text-[clamp(1.9rem,3vw,2.35rem)] font-semibold leading-[1.02] tracking-[-0.03em] text-[var(--color-text)]">
            {title}
          </h1>
          {subtitle ? <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--color-text-muted)]">{subtitle}</p> : null}
        </div>

        {actions ? <div className="flex items-center gap-2 self-start">{actions}</div> : null}
      </div>
    </section>
  );
}
