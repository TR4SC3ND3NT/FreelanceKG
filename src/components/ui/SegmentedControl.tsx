import { cn } from '@/utils/cn';
import type { ReactNode } from 'react';

export interface SegmentedControlOption<T extends string> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  options: Array<SegmentedControlOption<T>>;
  onValueChange: (value: T) => void;
  className?: string;
  buttonClassName?: string;
  fullWidth?: boolean;
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onValueChange,
  className,
  buttonClassName,
  fullWidth = false,
}: SegmentedControlProps<T>) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-[999px] border border-[color-mix(in_srgb,var(--color-border)_70%,transparent)] bg-[var(--color-surface-2)] p-1',
        fullWidth && 'flex w-full',
        className
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            disabled={option.disabled}
            onClick={() => onValueChange(option.value)}
            className={cn(
              'h-9 rounded-[999px] px-3.5 text-[13px] font-semibold tracking-[0.01em] transition-[background-color,color,box-shadow,transform,border-color] duration-200',
              'disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.98]',
              fullWidth && 'flex-1',
              active
                ? 'border border-[color-mix(in_srgb,var(--color-border-strong)_72%,transparent)] bg-[var(--color-surface)] text-[var(--color-text)] shadow-[0_14px_24px_-20px_rgba(0,0,0,1)]'
                : 'border border-transparent text-[var(--color-text-muted)] hover:bg-[color-mix(in_srgb,var(--color-surface)_72%,transparent)] hover:text-[var(--color-text)]',
              buttonClassName
            )}
            aria-pressed={active}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
