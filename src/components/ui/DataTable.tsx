import type { ReactNode } from 'react';
import { EmptyState } from './EmptyState';
import { SkeletonTable } from './Skeleton';
import { cn } from '@/utils/cn';
import { useTranslation } from 'react-i18next';
import { Database } from 'lucide-react';
import { motion } from 'framer-motion';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  className?: string;
  cellClassName?: string;
  render: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: Array<DataTableColumn<T>>;
  data: T[];
  rowKey: (row: T, index: number) => string;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: ReactNode;
  isLoading?: boolean;
  skeletonRows?: number;
  className?: string;
  dense?: boolean;
  ariaLabel?: string;
}

export function DataTable<T>({
  columns,
  data,
  rowKey,
  emptyTitle,
  emptyDescription,
  emptyIcon,
  isLoading = false,
  skeletonRows = 5,
  className,
  dense = false,
  ariaLabel,
}: DataTableProps<T>) {
  const { t } = useTranslation();

  const resolvedEmptyTitle = emptyTitle || t('common.empty');

  if (isLoading) {
    return <SkeletonTable className={className} rows={skeletonRows} />;
  }

  if (data.length === 0) {
    return <EmptyState title={resolvedEmptyTitle} description={emptyDescription} icon={emptyIcon || <Database className="h-4 w-4" />} compact />;
  }

  return (
    <div
      className={cn(
        'rounded-[var(--radius-card)] border border-[color-mix(in_srgb,var(--color-border)_68%,transparent)] bg-[var(--color-surface)] shadow-[var(--shadow-soft)]',
        className
      )}
      aria-label={ariaLabel || resolvedEmptyTitle}
    >
      <div className="space-y-3 p-3 lg:hidden">
        {data.map((row, rowIndex) => (
          <motion.article
            key={rowKey(row, rowIndex)}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut', delay: rowIndex * 0.02 }}
            className="surface-muted p-3"
            aria-rowindex={rowIndex + 2}
          >
            <div className="space-y-2.5">
              {columns.map((column) => (
                <div key={column.key} className={cn('grid grid-cols-1 gap-1', column.cellClassName)}>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-soft)]">
                    {column.header}
                  </p>
                  <div className="text-sm text-[var(--color-text-muted)]">{column.render(row)}</div>
                </div>
              ))}
            </div>
          </motion.article>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, ease: 'easeOut' }}
        className="hidden overflow-x-auto lg:block"
      >
        <table className="min-w-full text-sm">
          <thead className="border-b border-[color-mix(in_srgb,var(--color-border)_58%,transparent)] bg-[color-mix(in_srgb,var(--color-surface-2)_88%,var(--color-surface)_12%)] text-left">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn(
                    'px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-soft)]',
                    column.className
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {data.map((row, rowIndex) => (
              <tr
                key={rowKey(row, rowIndex)}
                aria-rowindex={rowIndex + 2}
                className={cn(
                  'border-b border-[color-mix(in_srgb,var(--color-border)_52%,transparent)] last:border-b-0 hover:bg-[color-mix(in_srgb,var(--color-surface-2)_78%,transparent)]',
                  rowIndex % 2 === 1 && 'bg-[color-mix(in_srgb,var(--color-surface)_84%,var(--color-surface-2)_16%)]'
                )}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      dense ? 'px-3 py-2.5' : 'px-3 py-3',
                      'align-middle text-[var(--color-text-muted)]',
                      column.cellClassName
                    )}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </motion.div>
    </div>
  );
}
