import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
  compact?: boolean;
}

export function EmptyState({ title, description, action, icon, className, compact = false }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'surface-muted relative overflow-hidden text-center',
        compact ? 'p-5' : 'p-8',
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-primary)_6%,transparent)_0%,transparent_48%,color-mix(in_srgb,var(--color-info)_8%,transparent)_100%)]" />
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-[linear-gradient(90deg,transparent_0%,color-mix(in_srgb,var(--color-border)_54%,transparent)_50%,transparent_100%)]" />
      <div className="relative">
      {icon ? (
        <div className="mx-auto mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--color-border)_72%,transparent)] bg-[var(--color-surface)] text-[var(--color-primary)] shadow-[var(--shadow-soft)]">
          {icon}
        </div>
      ) : null}
      <div className="mb-3 flex justify-center gap-2">
        <span className="inline-flex rounded-full border border-[color-mix(in_srgb,var(--color-primary)_24%,transparent)] bg-[color-mix(in_srgb,var(--color-primary)_10%,transparent)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-primary)]">
          Workspace Ready
        </span>
        <span className="inline-flex rounded-full border border-[color-mix(in_srgb,var(--color-border)_72%,transparent)] bg-[var(--color-surface)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-soft)]">
          Demo Friendly
        </span>
      </div>
      <h3 className="font-[var(--font-family-display)] text-lg font-semibold tracking-[-0.018em] text-[var(--color-text)]">{title}</h3>
      {description ? <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-[var(--color-text-muted)]">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
      </div>
    </div>
  );
}
