import { Clock, DollarSign, User as UserIcon } from 'lucide-react';
import { Order } from '@/types';
import { Badge, getOrderStatusBadge } from '../ui/Badge';
import { cn } from '@/utils/cn';

interface OrderCardProps {
  order: Order;
  onClick?: () => void;
  variant?: 'default' | 'compact';
}

export function OrderCard({ order, onClick, variant = 'default' }: OrderCardProps) {
  const statusBadge = getOrderStatusBadge(order.status);

  if (variant === 'compact') {
    return (
      <div
        onClick={onClick}
        className="cursor-pointer border-b border-[var(--color-border)] px-4 py-3 transition-colors last:border-b-0 hover:bg-[var(--color-surface-2)]"
      >
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <h4 className="truncate font-medium text-[var(--color-text)]">{order.title}</h4>
            <div className="flex items-center gap-3 mt-1">
              <span className="flex items-center gap-1 text-sm text-[var(--color-text-muted)]">
                <UserIcon className="w-3.5 h-3.5" />
                {order.client?.name || 'Клиент'}
              </span>
              <span className="text-sm font-medium text-[var(--color-primary)]">
                {order.budget.toLocaleString()} сом
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3 ml-4">
            {order.deadline && (
              <span className="flex items-center gap-1 text-sm text-[var(--color-text-muted)]">
                <Clock className="w-4 h-4" />
                {new Date(order.deadline).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
              </span>
            )}
            <Badge variant={statusBadge.variant} size="sm">
              {statusBadge.label}
            </Badge>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={cn(
        'surface cursor-pointer p-5 transition-colors hover:bg-[var(--color-surface-2)]',
        'hover:border-[color-mix(in_srgb,var(--color-primary)_40%,var(--color-border))]'
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-lg font-semibold text-[var(--color-text)]">{order.title}</h3>
        <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
      </div>

      <p className="mb-4 text-sm text-[var(--color-text-muted)] line-clamp-2">
        {order.description}
      </p>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-[var(--color-text-muted)]">
            <DollarSign className="w-4 h-4" />
            <span className="font-medium text-[var(--color-text)]">
              {order.budget.toLocaleString()} сом
            </span>
          </div>
          
          {order.deadline && (
            <div className="flex items-center gap-1.5 text-[var(--color-text-muted)]">
              <Clock className="w-4 h-4" />
              <span>
                {new Date(order.deadline).toLocaleDateString('ru-RU')}
              </span>
            </div>
          )}
        </div>

        {order.escrowAmount > 0 && (
          <div className="rounded-full border border-[color-mix(in_srgb,var(--color-success)_45%,transparent)] bg-[color-mix(in_srgb,var(--color-success)_16%,transparent)] px-2 py-1 text-xs font-medium text-[var(--color-success)]">
            В эскроу: {order.escrowAmount.toLocaleString()} сом
          </div>
        )}
      </div>
    </div>
  );
}
