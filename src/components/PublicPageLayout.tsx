import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { PublicLayout } from '@/components/layout/PublicLayout';

interface PublicPageLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  contentClassName?: string;
  showFooter?: boolean;
  align?: 'center' | 'left';
}

export function PublicPageLayout({
  title,
  subtitle,
  children,
  contentClassName,
  showFooter = true,
  align = 'left',
}: PublicPageLayoutProps) {
  return (
    <PublicLayout showFooter={showFooter} contentClassName={contentClassName}>
      <div className={cn('mb-8 surface-elevated relative overflow-hidden p-6 sm:p-8', align === 'center' ? 'text-center' : 'text-left')}>
        <div className="pointer-events-none absolute right-[-130px] top-[-130px] h-[260px] w-[260px] rounded-full bg-[color-mix(in_srgb,var(--color-primary)_12%,transparent)] blur-[82px]" />
        <h1 className="page-title text-[var(--color-text)]">{title}</h1>
        {subtitle ? (
          <p className={cn('page-subtitle mt-3', align === 'center' ? 'mx-auto max-w-3xl' : 'max-w-4xl')}>{subtitle}</p>
        ) : null}
      </div>

      {children}
    </PublicLayout>
  );
}
