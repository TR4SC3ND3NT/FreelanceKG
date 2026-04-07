import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/utils/cn';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, leftIcon, rightIcon, ...props }, ref) => {
    return (
      <label className="block space-y-2">
        {label ? <span className="text-sm font-semibold tracking-[0.01em] text-[var(--color-text)]">{label}</span> : null}

        <span className="relative block">
          {leftIcon && (
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-soft)]">
              {leftIcon}
            </span>
          )}

          <input
            ref={ref}
            className={cn(
              'h-11 w-full rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--color-border)_72%,transparent)] bg-[var(--color-surface)] text-[var(--color-text)]',
              'placeholder:text-[var(--color-text-soft)] transition-[border-color,box-shadow,background-color] duration-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]',
              'focus:border-[var(--color-ring)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-ring)_30%,transparent)]',
              leftIcon ? 'pl-10 pr-3.5' : 'px-3.5',
              rightIcon ? 'pr-10' : '',
              error && 'border-[var(--color-danger)] focus:border-[var(--color-danger)] focus:ring-[color-mix(in_srgb,var(--color-danger)_25%,transparent)]',
              className
            )}
            {...props}
          />

          {rightIcon && (
            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-soft)]">
              {rightIcon}
            </span>
          )}
        </span>

        {error && <span className="text-sm text-[var(--color-danger)]">{error}</span>}
      </label>
    );
  }
);

Input.displayName = 'Input';
