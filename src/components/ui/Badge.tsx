import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/utils/cn';
import { OrderStatus } from '@/types';
import i18n from '@/i18n';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md';
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', size = 'md', children, ...props }, ref) => {
    const variants: Record<NonNullable<BadgeProps['variant']>, string> = {
      default:
        'border border-[color-mix(in_srgb,var(--color-border)_72%,transparent)] bg-[var(--color-surface-2)] text-[var(--color-text-muted)]',
      success:
        'border border-[color-mix(in_srgb,var(--color-success)_32%,transparent)] bg-[color-mix(in_srgb,var(--color-success)_14%,transparent)] text-[var(--color-success)]',
      warning:
        'border border-[color-mix(in_srgb,var(--color-warning)_34%,transparent)] bg-[color-mix(in_srgb,var(--color-warning)_14%,transparent)] text-[var(--color-warning)]',
      danger:
        'border border-[color-mix(in_srgb,var(--color-danger)_34%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_14%,transparent)] text-[var(--color-danger)]',
      info:
        'border border-[color-mix(in_srgb,var(--color-info)_34%,transparent)] bg-[color-mix(in_srgb,var(--color-info)_14%,transparent)] text-[var(--color-info)]',
    };

    const sizes: Record<NonNullable<BadgeProps['size']>, string> = {
      sm: 'px-2 py-0.5 text-[10px]',
      md: 'px-2.5 py-1 text-[11px]',
    };

    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center rounded-full font-semibold uppercase tracking-[0.075em]',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

export function getOrderStatusBadge(status: OrderStatus): {
  variant: BadgeProps['variant'];
  label: string;
} {
  const statusMap: Record<OrderStatus, { variant: BadgeProps['variant']; label: string }> = {
    PENDING: { variant: 'warning', label: i18n.t('status.pending', { defaultValue: 'Pending' }) },
    ACTIVE: { variant: 'info', label: i18n.t('status.active', { defaultValue: 'Active' }) },
    SUBMITTED: { variant: 'info', label: i18n.t('status.submitted', { defaultValue: 'Submitted' }) },
    COMPLETED: { variant: 'success', label: i18n.t('status.completed', { defaultValue: 'Completed' }) },
    DISPUTED: { variant: 'danger', label: i18n.t('status.disputed', { defaultValue: 'Disputed' }) },
    CANCELLED: { variant: 'default', label: i18n.t('status.cancelled', { defaultValue: 'Cancelled' }) },
  };

  return statusMap[status] || { variant: 'default', label: status };
}
