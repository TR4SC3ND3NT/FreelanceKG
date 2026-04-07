import { cn } from '@/utils/cn';
import type { HTMLAttributes } from 'react';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn('skeleton-sheen rounded-[var(--radius-control)]', className)} aria-hidden="true" />;
}

interface SkeletonBlockProps extends HTMLAttributes<HTMLDivElement> {
  lines?: number;
}

export function SkeletonText({ className, lines = 3, ...props }: SkeletonBlockProps) {
  return (
    <div className={cn('space-y-2', className)} {...props} aria-hidden="true">
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton key={index} className={cn('h-3.5', index === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: SkeletonProps) {
  return (
    <div className={cn('surface-muted p-4', className)} aria-hidden="true">
      <Skeleton className="h-5 w-2/5" />
      <SkeletonText className="mt-4" lines={3} />
      <div className="mt-5 flex items-center gap-2">
        <Skeleton className="h-9 w-24 rounded-[var(--radius-control)]" />
        <Skeleton className="h-9 w-28 rounded-[var(--radius-control)]" />
      </div>
    </div>
  );
}

export function SkeletonTable({ className, rows = 5 }: { className?: string; rows?: number }) {
  return (
    <div className={cn('surface-muted overflow-hidden p-3', className)} aria-hidden="true">
      <div className="grid grid-cols-4 gap-2 px-2 pb-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-3 w-12" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="grid grid-cols-4 gap-2 rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--color-border)_52%,transparent)] bg-[var(--color-surface)] px-2 py-2.5">
            <Skeleton className="h-3.5 w-4/5" />
            <Skeleton className="h-3.5 w-4/6" />
            <Skeleton className="h-3.5 w-3/6" />
            <Skeleton className="h-3.5 w-4/6" />
          </div>
        ))}
      </div>
    </div>
  );
}
