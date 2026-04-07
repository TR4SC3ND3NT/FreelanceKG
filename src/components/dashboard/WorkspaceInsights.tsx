import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowUpRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/utils/cn';
import { EmptyState } from '@/components/ui/EmptyState';

export type Tone = 'primary' | 'success' | 'warning' | 'info' | 'danger';

interface MetricTrendCardProps {
  label: string;
  value: string | number;
  hint?: string;
  delta?: string;
  tone?: Tone;
  icon: LucideIcon;
  trend?: number[];
}

interface MiniBarChartProps {
  points: Array<{ label: string; value: number; secondaryValue?: number }>;
  tone?: Tone;
  className?: string;
}

interface ActivityFeedItem {
  id: string;
  title: string;
  subtitle?: string;
  meta?: string;
  badge?: string;
  tone?: Tone;
  to?: string;
}

interface TimelineItem {
  id: string;
  title: string;
  description?: string;
  meta?: string;
  tone?: Tone;
}

const toneClassMap: Record<Tone, string> = {
  primary: 'text-[var(--color-primary)] bg-[color-mix(in_srgb,var(--color-primary)_10%,transparent)] border-[color-mix(in_srgb,var(--color-primary)_20%,transparent)]',
  success: 'text-[var(--color-success)] bg-[color-mix(in_srgb,var(--color-success)_10%,transparent)] border-[color-mix(in_srgb,var(--color-success)_20%,transparent)]',
  warning: 'text-[var(--color-warning)] bg-[color-mix(in_srgb,var(--color-warning)_10%,transparent)] border-[color-mix(in_srgb,var(--color-warning)_20%,transparent)]',
  info: 'text-[var(--color-info)] bg-[color-mix(in_srgb,var(--color-info)_10%,transparent)] border-[color-mix(in_srgb,var(--color-info)_20%,transparent)]',
  danger: 'text-[var(--color-danger)] bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] border-[color-mix(in_srgb,var(--color-danger)_20%,transparent)]',
};

function resolveTone(tone: Tone = 'primary') {
  return toneClassMap[tone];
}

export function MetricTrendCard({
  label,
  value,
  hint,
  delta,
  tone = 'primary',
  icon: Icon,
  trend = [],
}: MetricTrendCardProps) {
  const maxTrend = Math.max(...trend, 1);
  const latestTrend = trend.length > 0 ? trend[trend.length - 1] : 0;
  const firstTrend = trend[0] || 0;
  const peakTrend = Math.max(...trend, 0);

  return (
    <div className="surface-elevated relative overflow-hidden p-5">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-surface)_10%,transparent)_0%,transparent_40%,color-mix(in_srgb,var(--color-surface)_18%,transparent)_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent_0%,color-mix(in_srgb,var(--color-primary)_30%,transparent)_50%,transparent_100%)]" />
      <div className="pointer-events-none absolute right-[-30px] top-[-30px] h-24 w-24 rounded-full bg-[color-mix(in_srgb,var(--color-primary)_10%,transparent)] blur-[42px]" />
      <div className="pointer-events-none absolute inset-y-5 right-5 w-24 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-border)_22%,transparent)_0%,transparent_100%)] [mask-image:linear-gradient(180deg,transparent,black_12%,black_88%,transparent)]" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-soft)]">{label}</p>
          <p className="mt-3 font-[var(--font-family-display)] text-[1.8rem] font-semibold leading-none tracking-[-0.04em] text-[var(--color-text)]">
            {value}
          </p>
          {hint ? <p className="mt-2 text-sm text-[var(--color-text-muted)]">{hint}</p> : null}
        </div>

        <span className={cn('inline-flex h-11 w-11 items-center justify-center rounded-[16px] border', resolveTone(tone))}>
          <Icon className="h-5 w-5" />
        </span>
      </div>

      <div className="mt-5 flex items-end justify-between gap-4">
        {trend.length > 0 ? (
          <div className="relative flex h-16 flex-1 items-end gap-1.5 rounded-[16px] border border-[color-mix(in_srgb,var(--color-border)_56%,transparent)] bg-[color-mix(in_srgb,var(--color-surface-2)_72%,transparent)] px-2 py-2">
            <div className="pointer-events-none absolute inset-x-2 bottom-2 top-2 grid grid-rows-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <span
                  key={index}
                  className="border-t border-dashed border-[color-mix(in_srgb,var(--color-border)_34%,transparent)] first:border-t-0"
                />
              ))}
            </div>
            {trend.map((point, index) => (
              <motion.span
                key={`${label}-${index}`}
                initial={{ height: 0, opacity: 0.5 }}
                animate={{ height: `${Math.max(12, (point / maxTrend) * 100)}%`, opacity: 1 }}
                transition={{ duration: 0.35, delay: index * 0.03, ease: 'easeOut' }}
                className={cn(
                  'relative z-[1] min-w-0 flex-1 rounded-full bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-primary)_70%,transparent)_0%,color-mix(in_srgb,var(--color-primary)_18%,transparent)_100%)] shadow-[0_10px_20px_-18px_color-mix(in_srgb,var(--color-primary)_72%,black)]',
                  tone === 'success' && 'bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-success)_72%,transparent)_0%,color-mix(in_srgb,var(--color-success)_18%,transparent)_100%)]',
                  tone === 'warning' && 'bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-warning)_72%,transparent)_0%,color-mix(in_srgb,var(--color-warning)_22%,transparent)_100%)]',
                  tone === 'info' && 'bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-info)_72%,transparent)_0%,color-mix(in_srgb,var(--color-info)_20%,transparent)_100%)]',
                  tone === 'danger' && 'bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-danger)_72%,transparent)_0%,color-mix(in_srgb,var(--color-danger)_20%,transparent)_100%)]'
                )}
              />
            ))}
          </div>
        ) : (
          <div className="flex-1" />
        )}

        {delta ? (
          <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold', resolveTone(tone))}>
            <ArrowUpRight className="h-3.5 w-3.5" />
            {delta}
          </span>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-[11px]">
        <div className="rounded-[14px] border border-[color-mix(in_srgb,var(--color-border)_60%,transparent)] bg-[color-mix(in_srgb,var(--color-surface)_86%,transparent)] px-3 py-2">
          <p className="uppercase tracking-[0.08em] text-[var(--color-text-soft)]">Latest</p>
          <p className="mt-1 font-semibold text-[var(--color-text)]">{latestTrend || value}</p>
        </div>
        <div className="rounded-[14px] border border-[color-mix(in_srgb,var(--color-border)_60%,transparent)] bg-[color-mix(in_srgb,var(--color-surface)_86%,transparent)] px-3 py-2">
          <p className="uppercase tracking-[0.08em] text-[var(--color-text-soft)]">Peak</p>
          <p className="mt-1 font-semibold text-[var(--color-text)]">{peakTrend || value}</p>
        </div>
        <div className="rounded-[14px] border border-[color-mix(in_srgb,var(--color-border)_60%,transparent)] bg-[color-mix(in_srgb,var(--color-surface)_86%,transparent)] px-3 py-2">
          <p className="uppercase tracking-[0.08em] text-[var(--color-text-soft)]">Delta</p>
          <p className="mt-1 font-semibold text-[var(--color-text)]">{latestTrend - firstTrend >= 0 ? '+' : ''}{latestTrend - firstTrend}</p>
        </div>
      </div>
    </div>
  );
}

export function MiniBarChart({ points, tone = 'primary', className }: MiniBarChartProps) {
  const max = Math.max(
    ...points.map((point) => Math.max(point.value, point.secondaryValue || 0)),
    1
  );
  const total = points.reduce((sum, point) => sum + point.value, 0);
  const peak = Math.max(...points.map((point) => point.value), 0);

  return (
    <div className={cn('space-y-4', className)}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-[14px] border border-[color-mix(in_srgb,var(--color-border)_60%,transparent)] bg-[color-mix(in_srgb,var(--color-surface-2)_78%,transparent)] px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-soft)]">Total</p>
          <p className="mt-1 text-sm font-semibold text-[var(--color-text)]">{total}</p>
        </div>
        <div className="rounded-[14px] border border-[color-mix(in_srgb,var(--color-border)_60%,transparent)] bg-[color-mix(in_srgb,var(--color-surface-2)_78%,transparent)] px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-soft)]">Peak</p>
          <p className="mt-1 text-sm font-semibold text-[var(--color-text)]">{peak}</p>
        </div>
        <div className="rounded-[14px] border border-[color-mix(in_srgb,var(--color-border)_60%,transparent)] bg-[color-mix(in_srgb,var(--color-surface-2)_78%,transparent)] px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-soft)]">Windows</p>
          <p className="mt-1 text-sm font-semibold text-[var(--color-text)]">{points.length}</p>
        </div>
        <div className="rounded-[14px] border border-[color-mix(in_srgb,var(--color-border)_60%,transparent)] bg-[color-mix(in_srgb,var(--color-surface-2)_78%,transparent)] px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-soft)]">Signal</p>
          <p className="mt-1 text-sm font-semibold text-[var(--color-text)]">{peak > 0 ? 'Live' : 'Quiet'}</p>
        </div>
      </div>

      <div className="grid grid-cols-6 gap-2">
      {points.map((point, index) => (
        <motion.div
          key={`${point.label}-${index}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, delay: index * 0.03, ease: 'easeOut' }}
          className="flex flex-col items-center gap-2"
        >
          <div className="relative flex h-36 w-full items-end rounded-[18px] border border-[color-mix(in_srgb,var(--color-border)_64%,transparent)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-surface-2)_86%,transparent)_0%,color-mix(in_srgb,var(--color-surface)_72%,transparent)_100%)] p-2">
            <div className="pointer-events-none absolute inset-x-2 bottom-2 top-2 grid grid-rows-5">
              {Array.from({ length: 5 }).map((_, gridIndex) => (
                <span
                  key={gridIndex}
                  className="border-t border-dashed border-[color-mix(in_srgb,var(--color-border)_34%,transparent)] first:border-t-0"
                />
              ))}
            </div>
            {typeof point.secondaryValue === 'number' ? (
              <div
                className="absolute bottom-2 left-2 right-2 rounded-[12px] border border-[color-mix(in_srgb,var(--color-border)_48%,transparent)] bg-[color-mix(in_srgb,var(--color-surface-3)_50%,transparent)]"
                style={{ height: `${Math.max(12, (point.secondaryValue / max) * 100)}%` }}
              />
            ) : null}
            <div
              className={cn(
                'relative z-[1] w-full rounded-[12px] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-primary)_68%,transparent)_0%,color-mix(in_srgb,var(--color-primary)_22%,transparent)_100%)] shadow-[0_18px_32px_-22px_color-mix(in_srgb,var(--color-primary)_78%,black)]',
                tone === 'success' && 'bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-success)_70%,transparent)_0%,color-mix(in_srgb,var(--color-success)_20%,transparent)_100%)]',
                tone === 'warning' && 'bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-warning)_70%,transparent)_0%,color-mix(in_srgb,var(--color-warning)_22%,transparent)_100%)]',
                tone === 'info' && 'bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-info)_72%,transparent)_0%,color-mix(in_srgb,var(--color-info)_22%,transparent)_100%)]',
                tone === 'danger' && 'bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-danger)_72%,transparent)_0%,color-mix(in_srgb,var(--color-danger)_22%,transparent)_100%)]'
              )}
              style={{ height: `${Math.max(12, (point.value / max) * 100)}%` }}
            />
          </div>
          <div className="text-center">
            <p className="text-xs font-semibold text-[var(--color-text)]">{point.value}</p>
            {typeof point.secondaryValue === 'number' ? (
              <p className="text-[10px] text-[var(--color-text-soft)]">{point.secondaryValue}</p>
            ) : null}
            <p className="text-[11px] text-[var(--color-text-soft)]">{point.label}</p>
          </div>
        </motion.div>
      ))}
      </div>
    </div>
  );
}

export function ActivityFeedList({
  items,
  emptyTitle,
  emptyDescription,
  emptyIcon,
}: {
  items: ActivityFeedItem[];
  emptyTitle: string;
  emptyDescription: string;
  emptyIcon?: ReactNode;
}) {
  if (items.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} icon={emptyIcon} compact />;
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => {
        const content = (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: index * 0.03, ease: 'easeOut' }}
            className="surface-muted group relative overflow-hidden p-4"
          >
            <span className={cn('absolute inset-y-4 left-0 w-1 rounded-r-full', item.tone === 'success' && 'bg-[var(--color-success)]', item.tone === 'warning' && 'bg-[var(--color-warning)]', item.tone === 'danger' && 'bg-[var(--color-danger)]', item.tone === 'info' && 'bg-[var(--color-info)]', (!item.tone || item.tone === 'primary') && 'bg-[var(--color-primary)]')} />
            <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-[linear-gradient(90deg,transparent_0%,color-mix(in_srgb,var(--color-border)_56%,transparent)_50%,transparent_100%)]" />
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 gap-3">
                <span className={cn('mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px] border text-[11px] font-semibold', resolveTone(item.tone || 'primary'))}>
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[var(--color-text)]">{item.title}</p>
                {item.subtitle ? <p className="mt-1 text-sm text-[var(--color-text-muted)]">{item.subtitle}</p> : null}
                </div>
              </div>
              {item.badge ? (
                <span className={cn('inline-flex shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em]', resolveTone(item.tone || 'primary'))}>
                  {item.badge}
                </span>
              ) : null}
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              {item.meta ? <p className="text-xs text-[var(--color-text-soft)]">{item.meta}</p> : <span />}
              {item.to ? <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-soft)]">Open</span> : null}
            </div>
          </motion.div>
        );

        if (item.to) {
          return (
            <Link key={item.id} to={item.to} className="block">
              {content}
            </Link>
          );
        }

        return <div key={item.id}>{content}</div>;
      })}
    </div>
  );
}

export function TimelineRail({ items }: { items: TimelineItem[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="No timeline events"
        description="Events from orders, finance, support and documents will appear here."
        compact
      />
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <motion.div
          key={item.id}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.22, delay: index * 0.03, ease: 'easeOut' }}
          className="relative pl-7"
        >
          <span className="absolute left-0 top-0 flex h-5 w-5 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--color-border)_72%,transparent)] bg-[var(--color-surface)] shadow-[var(--shadow-soft)]">
            <span className={cn('h-2.5 w-2.5 rounded-full', item.tone === 'success' && 'bg-[var(--color-success)]', item.tone === 'warning' && 'bg-[var(--color-warning)]', item.tone === 'danger' && 'bg-[var(--color-danger)]', item.tone === 'info' && 'bg-[var(--color-info)]', (!item.tone || item.tone === 'primary') && 'bg-[var(--color-primary)]')} />
          </span>
          {index < items.length - 1 ? (
            <span className="absolute left-[9px] top-5 h-[calc(100%+12px)] w-px bg-[color-mix(in_srgb,var(--color-border)_72%,transparent)]" />
          ) : null}

          <div className="surface-muted relative overflow-hidden p-4">
            <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-[linear-gradient(90deg,transparent_0%,color-mix(in_srgb,var(--color-border)_50%,transparent)_50%,transparent_100%)]" />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-[var(--color-text)]">{item.title}</p>
              {item.meta ? <span className={cn('inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em]', resolveTone(item.tone || 'primary'))}>{item.meta}</span> : null}
            </div>
            {item.description ? <p className="mt-2 text-sm text-[var(--color-text-muted)]">{item.description}</p> : null}
          </div>
        </motion.div>
      ))}
    </div>
  );
}
