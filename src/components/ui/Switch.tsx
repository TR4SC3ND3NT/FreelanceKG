import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

interface SwitchProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
  size?: 'sm' | 'md';
}

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked, onCheckedChange, className, size = 'md', disabled, onClick, ...props }, ref) => {
    const sizes: Record<NonNullable<SwitchProps['size']>, { root: string; thumb: string; shift: string }> = {
      sm: {
        root: 'h-8 w-14',
        thumb: 'h-6 w-6',
        shift: 'translate-x-6',
      },
      md: {
        root: 'h-10 w-16',
        thumb: 'h-8 w-8',
        shift: 'translate-x-6',
      },
    };

    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={(event) => {
          onClick?.(event);
          if (event.defaultPrevented || disabled) return;
          onCheckedChange?.(!checked);
        }}
        className={cn(
          'relative inline-flex items-center rounded-full border p-1 transition-[background-color,border-color,box-shadow] duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)]',
          'disabled:cursor-not-allowed disabled:opacity-60',
          sizes[size].root,
          checked
            ? 'border-[color-mix(in_srgb,var(--color-primary)_54%,transparent)] bg-[color-mix(in_srgb,var(--color-primary)_22%,transparent)] shadow-[0_10px_24px_-20px_color-mix(in_srgb,var(--color-primary)_66%,black)]'
            : 'border-[color-mix(in_srgb,var(--color-border)_68%,transparent)] bg-[var(--color-surface)]',
          className
        )}
        {...props}
      >
        <span
          className={cn(
            'rounded-full border border-transparent bg-[var(--color-text-soft)] shadow-[0_1px_2px_rgba(15,23,42,0.2)] transition-[transform,background-color] duration-200',
            checked && 'bg-[var(--color-primary)]',
            sizes[size].thumb,
            checked ? sizes[size].shift : 'translate-x-0'
          )}
        />
      </button>
    );
  }
);

Switch.displayName = 'Switch';
