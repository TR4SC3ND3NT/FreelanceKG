import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { PublicNavbar } from '@/components/PublicNavbar';
import { PublicFooter } from '@/components/PublicFooter';

interface PublicLayoutProps {
  children: ReactNode;
  showFooter?: boolean;
  contentClassName?: string;
  containerClassName?: string;
}

export function PublicLayout({
  children,
  showFooter = true,
  contentClassName,
  containerClassName,
}: PublicLayoutProps) {
  return (
    <div className="relative min-h-screen app-background text-[var(--color-text)]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-140px] top-[120px] h-[360px] w-[360px] rounded-full bg-[color-mix(in_srgb,var(--color-primary)_12%,transparent)] blur-[88px]" />
        <div className="absolute bottom-[-160px] right-[-120px] h-[420px] w-[420px] rounded-full bg-[color-mix(in_srgb,var(--color-info)_10%,transparent)] blur-[120px]" />
      </div>

      <PublicNavbar />

      <main className={cn('relative z-10 px-4 pb-20 pt-24 sm:px-6 lg:px-8', contentClassName)}>
        <div className={cn('mx-auto w-full max-w-[var(--layout-public-width)]', containerClassName)}>{children}</div>
      </main>

      {showFooter && <PublicFooter />}
    </div>
  );
}
