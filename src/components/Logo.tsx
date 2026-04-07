import { cn } from '@/utils/cn';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

export function Logo({ size = 'md', showIcon = true, className }: LogoProps) {
  const sizes = {
    sm: {
      icon: 'h-9 w-9 rounded-[12px]',
      iconText: 'text-[11px]',
      text: 'text-[1.12rem]',
      subtext: 'text-[9px]',
    },
    md: {
      icon: 'h-10 w-10 rounded-[13px]',
      iconText: 'text-[11px]',
      text: 'text-[1.3rem]',
      subtext: 'text-[10px]',
    },
    lg: {
      icon: 'h-12 w-12 rounded-[14px]',
      iconText: 'text-xs',
      text: 'text-[1.55rem]',
      subtext: 'text-[11px]',
    },
  };

  return (
    <div className={cn('inline-flex items-center gap-3', className)}>
      {showIcon && (
        <div
          className={cn(
            'relative inline-flex items-center justify-center border border-[color-mix(in_srgb,var(--color-primary)_38%,var(--color-border)_62%)]',
            'bg-[linear-gradient(145deg,color-mix(in_srgb,var(--color-primary)_16%,var(--color-surface)_84%)_0%,var(--color-surface)_100%)] text-[var(--color-primary)] shadow-[var(--shadow-soft)]',
            sizes[size].icon
          )}
        >
          <span className={cn('font-[var(--font-family-display)] font-bold uppercase tracking-[0.1em]', sizes[size].iconText)}>FK</span>
          <span className="pointer-events-none absolute inset-0 rounded-[inherit] border border-white/30 opacity-70" />
        </div>
      )}

      <div className="leading-none">
        <p className={cn('font-[var(--font-family-display)] font-semibold tracking-[-0.03em] text-[var(--color-text)]', sizes[size].text)}>
          Freelance<span className="text-[var(--color-primary)]">KG</span>
        </p>
        {size !== 'sm' ? (
          <p
            className={cn(
              'mt-1 uppercase tracking-[0.1em] text-[var(--color-text-soft)]',
              sizes[size].subtext
            )}
          >
            secure talent market
          </p>
        ) : null}
      </div>
    </div>
  );
}
