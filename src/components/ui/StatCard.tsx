import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/utils/cn';

interface StatCardProps {
  label: string;
  value: string;
  icon?: LucideIcon;
  hint?: string;
  tone?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
  action?: ReactNode;
  className?: string;
}

const toneMap: Record<NonNullable<StatCardProps['tone']>, string> = {
  primary: 'text-[var(--color-primary)]',
  success: 'text-[var(--color-success)]',
  warning: 'text-[var(--color-warning)]',
  danger: 'text-[var(--color-danger)]',
  info: 'text-[var(--color-info)]',
};

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  tone = 'primary',
  action,
  className,
}: StatCardProps) {
  return (
    <article className={cn('surface interactive-card relative overflow-hidden p-4 sm:p-5', className)}>
      <div className="pointer-events-none absolute right-[-90px] top-[-90px] h-[190px] w-[190px] rounded-full bg-[color-mix(in_srgb,var(--color-primary)_8%,transparent)] blur-[72px]" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-soft)]">{label}</p>
          <p className="mt-1.5 truncate font-[var(--font-family-display)] text-[1.95rem] font-semibold leading-[1.02] tracking-[-0.028em] text-[var(--color-text)]">{value}</p>
          {hint ? <p className="mt-1.5 text-xs leading-relaxed text-[var(--color-text-muted)]">{hint}</p> : null}
        </div>

        {Icon ? (
          <span
            className={cn(
              'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--color-border)_72%,transparent)] bg-[var(--color-surface-2)]',
              toneMap[tone]
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
        ) : null}
      </div>

      {action ? <div className="mt-3">{action}</div> : null}
    </article>
  );
}
