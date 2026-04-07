import { type ReactNode, useMemo, useState } from 'react';
import { cn } from '@/utils/cn';
import { useAuth } from '@/context/AuthContext';
import { DashboardNavItem, DashboardSidebar } from './DashboardSidebar';
import { DashboardTopbar } from './DashboardTopbar';
import { useTranslation } from 'react-i18next';
import { getRoleHomePath } from '@/utils/routes';

interface DashboardShellProps {
  isDark: boolean;
  sidebarTitle: string;
  sidebarSubtitle?: string;
  sidebarItems: DashboardNavItem[];
  onLogout: () => void | Promise<void>;
  children: ReactNode;
}

export function DashboardShell({
  isDark,
  sidebarTitle,
  sidebarSubtitle,
  sidebarItems,
  onLogout,
  children,
}: DashboardShellProps) {
  const { t } = useTranslation();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { user } = useAuth();

  const links = useMemo(() => {
    const role = user?.role;
    if (role === 'FREELANCER') {
      return {
        profileLink: '/dashboard/freelancer/profile',
        settingsLink: '/dashboard/freelancer/settings',
        dashboardLink: getRoleHomePath(role),
      };
    }

    if (role === 'ADMIN') {
      return {
        profileLink: '/admin',
        settingsLink: '/admin',
        dashboardLink: '/admin',
      };
    }

    return {
      profileLink: '/dashboard/client/profile',
      settingsLink: '/dashboard/client/settings',
      dashboardLink: getRoleHomePath(role),
    };
  }, [user?.role]);

  return (
    <div className="relative min-h-screen app-background">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-160px] top-[90px] h-[420px] w-[420px] rounded-full bg-[color-mix(in_srgb,var(--color-primary)_16%,transparent)] blur-[104px]" />
        <div className="absolute right-[8%] top-[60px] h-[260px] w-[260px] rounded-full bg-[color-mix(in_srgb,var(--color-warning)_10%,transparent)] blur-[96px]" />
        <div className="absolute bottom-[-180px] right-[-140px] h-[460px] w-[460px] rounded-full bg-[color-mix(in_srgb,var(--color-info)_12%,transparent)] blur-[122px]" />
      </div>

      <div className="fixed inset-y-0 left-0 z-40 hidden w-[320px] lg:block">
        <DashboardSidebar
          isDark={isDark}
          title={sidebarTitle}
          subtitle={sidebarSubtitle}
          items={sidebarItems}
          className="h-full"
        />
      </div>

      <div className="relative z-10 lg:pl-[320px]">
        <DashboardTopbar
          userName={user?.name || t('topbar.user', { defaultValue: 'User' })}
          userAvatar={user?.avatar}
          profileLink={links.profileLink}
          settingsLink={links.settingsLink}
          dashboardLink={links.dashboardLink}
          sidebarItems={sidebarItems}
          onLogout={onLogout}
          onOpenSidebar={() => setMobileSidebarOpen(true)}
        />

        <main className="px-4 pb-12 pt-[102px] sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-[var(--layout-dashboard-width)] space-y-6">{children}</div>
        </main>
      </div>

      {mobileSidebarOpen ? (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/65 backdrop-blur-[2px]"
            onClick={() => setMobileSidebarOpen(false)}
            aria-label={t('topbar.closeMenu', { defaultValue: 'Close menu' })}
          />

          <div className="absolute inset-y-0 left-0 w-[88vw] max-w-xs">
            <DashboardSidebar
              isDark={isDark}
              title={sidebarTitle}
              subtitle={sidebarSubtitle}
              items={sidebarItems}
              onNavigate={() => setMobileSidebarOpen(false)}
              className={cn('h-full')}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
