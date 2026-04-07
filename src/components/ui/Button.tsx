import { forwardRef, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/utils/cn';
import { motion, type HTMLMotionProps } from 'framer-motion';

interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  children?: ReactNode;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const styles: Record<NonNullable<ButtonProps['variant']>, string> = {
      primary:
        'border border-[color-mix(in_srgb,var(--color-primary)_44%,transparent)] bg-[var(--color-primary)] text-white shadow-[0_14px_26px_-18px_color-mix(in_srgb,var(--color-primary)_65%,black)] hover:bg-[var(--color-primary-hover)]',
      secondary:
        'border border-[color-mix(in_srgb,var(--color-border)_76%,transparent)] bg-[var(--color-surface-2)] text-[var(--color-text)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-3)]',
      outline:
        'border border-[color-mix(in_srgb,var(--color-border)_76%,transparent)] bg-[var(--color-surface)] text-[var(--color-text)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-2)]',
      ghost:
        'border border-transparent bg-transparent text-[var(--color-text-muted)] hover:bg-[color-mix(in_srgb,var(--color-surface-2)_76%,transparent)] hover:text-[var(--color-text)]',
      danger:
        'border border-[color-mix(in_srgb,var(--color-danger)_45%,transparent)] bg-[var(--color-danger)] text-white hover:bg-[color-mix(in_srgb,var(--color-danger)_85%,black_15%)]',
      destructive:
        'border border-[color-mix(in_srgb,var(--color-danger)_45%,transparent)] bg-[var(--color-danger)] text-white hover:bg-[color-mix(in_srgb,var(--color-danger)_85%,black_15%)]',
    };

    const sizes: Record<NonNullable<ButtonProps['size']>, string> = {
      sm: 'h-9 px-3.5 text-xs',
      md: 'h-10 px-4 text-[13px]',
      lg: 'h-11 px-5 text-sm',
    };

    return (
      <motion.button
        ref={ref}
        disabled={disabled || isLoading}
        whileTap={{ scale: 0.98 }}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] font-semibold tracking-[0.015em]',
          'transition-[transform,background-color,border-color,color,box-shadow] duration-200 ease-out',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface-inset)]',
          'disabled:cursor-not-allowed disabled:opacity-60',
          styles[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : leftIcon}
        {children}
        {!isLoading && rightIcon}
      </motion.button>
    );
  }
);

Button.displayName = 'Button';
