import { cn } from '../../utils/cn';
import { Order } from '../../services/api';
import { useTranslation } from 'react-i18next';

type OrderStatus = Order['status'];

const statusMap: Record<OrderStatus, { classes: string }> = {
  PENDING: {
    classes:
      'border-[color-mix(in_srgb,var(--color-warning)_42%,transparent)] bg-[color-mix(in_srgb,var(--color-warning)_16%,transparent)] text-[var(--color-warning)]',
  },
  ACTIVE: {
    classes:
      'border-[color-mix(in_srgb,var(--color-info)_42%,transparent)] bg-[color-mix(in_srgb,var(--color-info)_16%,transparent)] text-[var(--color-info)]',
  },
  SUBMITTED: {
    classes:
      'border-[color-mix(in_srgb,var(--color-info)_42%,transparent)] bg-[color-mix(in_srgb,var(--color-info)_16%,transparent)] text-[var(--color-info)]',
  },
  COMPLETED: {
    classes:
      'border-[color-mix(in_srgb,var(--color-success)_42%,transparent)] bg-[color-mix(in_srgb,var(--color-success)_16%,transparent)] text-[var(--color-success)]',
  },
  DISPUTED: {
    classes:
      'border-[color-mix(in_srgb,var(--color-danger)_42%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_16%,transparent)] text-[var(--color-danger)]',
  },
  CANCELLED: {
    classes: 'border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-muted)]',
  },
};

interface OrderStatusBadgeProps {
  status: OrderStatus;
  isDark: boolean;
  className?: string;
}

export function OrderStatusBadge({ status, isDark, className }: OrderStatusBadgeProps) {
  const { t } = useTranslation();
  void isDark;
  const info = statusMap[status] || statusMap.CANCELLED;
  const labels: Record<OrderStatus, string> = {
    PENDING: t('status.pending', { defaultValue: 'Pending' }),
    ACTIVE: t('status.active', { defaultValue: 'Active' }),
    SUBMITTED: t('status.submitted', { defaultValue: 'Submitted' }),
    COMPLETED: t('status.completed', { defaultValue: 'Completed' }),
    DISPUTED: t('status.disputed', { defaultValue: 'Disputed' }),
    CANCELLED: t('status.cancelled', { defaultValue: 'Cancelled' }),
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide',
        info.classes,
        className
      )}
    >
      {labels[status] || status}
    </span>
  );
}
