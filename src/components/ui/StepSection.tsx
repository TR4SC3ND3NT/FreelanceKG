import type { ReactNode } from 'react';

interface StepSectionProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  children: ReactNode;
}

export function StepSection({ title, subtitle, icon, children }: StepSectionProps) {
  return (
    <div className="surface relative overflow-hidden p-6 sm:p-7">
      <div className="pointer-events-none absolute right-[-110px] top-[-110px] h-[220px] w-[220px] rounded-full bg-[color-mix(in_srgb,var(--color-primary)_10%,transparent)] blur-[80px]" />
      <div className="mb-6 flex items-start gap-3">
        {icon ? (
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--color-primary)_35%,transparent)] bg-[color-mix(in_srgb,var(--color-primary)_10%,var(--color-surface)_90%)] text-[var(--color-primary)]">
            {icon}
          </span>
        ) : null}
        <div>
          <h2 className="section-title">{title}</h2>
          {subtitle ? <p className="section-subtitle mt-1">{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </div>
  );
}
