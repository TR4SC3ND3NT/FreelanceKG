import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'bordered' | 'muted' | 'elevated';
  interactive?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', interactive = false, children, ...props }, ref) => {
    const variants: Record<NonNullable<CardProps['variant']>, string> = {
      default: 'surface',
      bordered:
        'border border-[color-mix(in_srgb,var(--color-border)_74%,transparent)] bg-[var(--color-surface)] shadow-[0_1px_0_rgba(255,255,255,0.2),0_20px_36px_-28px_rgba(0,0,0,1)]',
      muted: 'surface-muted',
      elevated: 'surface-elevated',
    };

    return (
      <div
        ref={ref}
        className={cn('rounded-[var(--radius-card)] p-5 sm:p-6', variants[variant], interactive && 'interactive-card', className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn('mb-4', className)} {...props}>
      {children}
    </div>
  )
);

CardHeader.displayName = 'CardHeader';

export const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, children, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn(
        'font-[var(--font-family-display)] text-[1.08rem] font-semibold leading-tight tracking-[-0.02em] text-[var(--color-text)]',
        className
      )}
      {...props}
    >
      {children}
    </h3>
  )
);

CardTitle.displayName = 'CardTitle';

export const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn(className)} {...props}>
      {children}
    </div>
  )
);

CardContent.displayName = 'CardContent';
