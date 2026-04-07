import { Link, useLocation } from 'react-router-dom';
import { type LucideIcon, ChevronRight, Command, ShieldCheck, Sparkles } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useTranslation } from 'react-i18next';
import { Logo } from '@/components/Logo';
import { useAuth } from '@/context/AuthContext';

export interface DashboardNavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  group?: string;
  caption?: string;
  badge?: string;
}

interface DashboardSidebarProps {
  isDark?: boolean;
  title: string;
  subtitle?: string;
  items: DashboardNavItem[];
  onNavigate?: () => void;
  className?: string;
}

function isItemActive(pathname: string, hash: string, to: string): boolean {
  const [targetPath, targetHashFragment] = to.split('#');
  const targetHash = targetHashFragment ? `#${targetHashFragment}` : '';

  if (!pathname.startsWith(targetPath)) return false;
  if (!targetHash) return true;
  return hash === targetHash;
}

export function DashboardSidebar({ isDark, title, subtitle, items, onNavigate, className }: DashboardSidebarProps) {
  const location = useLocation();
  const { t } = useTranslation();
  const { user } = useAuth();

  const groupedItems = items.reduce<Record<string, DashboardNavItem[]>>((acc, item) => {
    const group = item.group || t('sidebar.groups.navigation', { defaultValue: 'Navigation' });
    if (!acc[group]) {
      acc[group] = [];
    }
    acc[group].push(item);
    return acc;
  }, {});
  const totalSections = Object.keys(groupedItems).length;
  const totalModules = items.length;

  const roleMeta =
    user?.role === 'FREELANCER'
      ? {
          workspaceType: t('sidebar.meta.freelancer', { defaultValue: 'Freelancer OS' }),
          plan: t('sidebar.meta.proPlan', { defaultValue: 'Pro plan' }),
          status: t('sidebar.meta.payoutReady', { defaultValue: 'Payout ready' }),
        }
      : user?.role === 'ADMIN'
        ? {
            workspaceType: t('sidebar.meta.admin', { defaultValue: 'Admin command' }),
            plan: t('sidebar.meta.adminPlan', { defaultValue: 'Superuser access' }),
            status: t('sidebar.meta.adminStatus', { defaultValue: 'Controls live' }),
          }
      : {
          workspaceType: t('sidebar.meta.client', { defaultValue: 'Client workspace' }),
          plan: t('sidebar.meta.growthPlan', { defaultValue: 'Growth plan' }),
          status: t('sidebar.meta.escrowLive', { defaultValue: 'Escrow live' }),
        };

  return (
    <aside
      data-theme={isDark ? 'dark' : 'light'}
      className={cn(
        'flex h-full flex-col border-r border-[color-mix(in_srgb,var(--color-border)_68%,transparent)]',
        'bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-surface)_96%,var(--color-bg)_4%)_0%,color-mix(in_srgb,var(--color-surface)_88%,var(--color-surface-2)_12%)_100%)] backdrop-blur-xl',
        className
      )}
    >
      <div className="border-b border-[color-mix(in_srgb,var(--color-border)_66%,transparent)] px-4 pb-5 pt-5">
        <div className="rounded-[24px] border border-[color-mix(in_srgb,var(--color-border-strong)_60%,transparent)] bg-[linear-gradient(160deg,color-mix(in_srgb,var(--color-surface)_92%,white_8%)_0%,color-mix(in_srgb,var(--color-surface-2)_90%,var(--color-surface-3)_10%)_100%)] p-4 shadow-[var(--shadow-raised)]">
          <div className="flex items-start justify-between gap-3">
            <Logo size="sm" />
            <span className="inline-flex items-center gap-1 rounded-full border border-[color-mix(in_srgb,var(--color-primary)_32%,transparent)] bg-[color-mix(in_srgb,var(--color-primary)_10%,transparent)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-primary)]">
              <Sparkles className="h-3 w-3" />
              OS
            </span>
          </div>

          <div className="mt-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-soft)]">
              {roleMeta.workspaceType}
            </p>
            <p className="mt-2 font-[var(--font-family-display)] text-[1.05rem] font-semibold leading-tight tracking-[-0.02em] text-[var(--color-text)]">
              {title}
            </p>
            {subtitle ? (
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">{subtitle}</p>
            ) : null}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-[14px] border border-[color-mix(in_srgb,var(--color-border)_70%,transparent)] bg-[var(--color-surface)] px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-soft)]">
                {t('sidebar.meta.plan', { defaultValue: 'Plan' })}
              </p>
              <p className="mt-1 text-xs font-semibold text-[var(--color-text)]">{roleMeta.plan}</p>
            </div>
            <div className="rounded-[14px] border border-[color-mix(in_srgb,var(--color-success)_26%,transparent)] bg-[color-mix(in_srgb,var(--color-success)_10%,transparent)] px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-soft)]">
                {t('sidebar.meta.status', { defaultValue: 'Status' })}
              </p>
              <p className="mt-1 text-xs font-semibold text-[var(--color-success)]">{roleMeta.status}</p>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-[18px] border border-[color-mix(in_srgb,var(--color-border)_64%,transparent)] bg-[color-mix(in_srgb,var(--color-surface-2)_88%,transparent)] px-3 py-3">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-soft)]">
            <Command className="h-3.5 w-3.5" />
            {t('sidebar.commandTitle', { defaultValue: 'Command search' })}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-[var(--color-text-muted)]">
            {t('sidebar.commandHint', {
              defaultValue: 'Use the topbar search to jump across analytics, billing, support and compliance sections.',
            })}
          </p>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-[12px] border border-[color-mix(in_srgb,var(--color-border)_68%,transparent)] bg-[var(--color-surface)] px-2.5 py-2 text-center">
              <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-soft)]">Modules</p>
              <p className="mt-1 text-sm font-semibold text-[var(--color-text)]">{totalModules}</p>
            </div>
            <div className="rounded-[12px] border border-[color-mix(in_srgb,var(--color-border)_68%,transparent)] bg-[var(--color-surface)] px-2.5 py-2 text-center">
              <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-soft)]">Stacks</p>
              <p className="mt-1 text-sm font-semibold text-[var(--color-text)]">{totalSections}</p>
            </div>
            <div className="rounded-[12px] border border-[color-mix(in_srgb,var(--color-primary)_26%,transparent)] bg-[color-mix(in_srgb,var(--color-primary)_10%,transparent)] px-2.5 py-2 text-center">
              <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-soft)]">Mode</p>
              <p className="mt-1 text-sm font-semibold text-[var(--color-primary)]">Live</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-5">
        {Object.entries(groupedItems).map(([group, section]) => (
          <section key={group} className="mb-5 last:mb-0">
            <div className="mb-2 flex items-center justify-between px-2">
              <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-soft)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[color-mix(in_srgb,var(--color-primary)_66%,transparent)]" />
                {group}
              </p>
              <span className="text-[10px] font-semibold text-[var(--color-text-soft)]">{section.length}</span>
            </div>

            <nav className="space-y-1.5">
              {section.map((item) => {
                const isActive = isItemActive(location.pathname, location.hash, item.to);

                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={onNavigate}
                    className={cn(
                      'group relative block overflow-hidden rounded-[18px] border p-3 transition-[background-color,border-color,color,transform,box-shadow] duration-200',
                      'active:scale-[0.985]',
                      isActive
                        ? 'border-[color-mix(in_srgb,var(--color-primary)_36%,var(--color-border)_64%)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-primary)_18%,var(--color-surface)_82%)_0%,color-mix(in_srgb,var(--color-surface-2)_88%,var(--color-surface)_12%)_100%)] shadow-[var(--shadow-glow)]'
                        : 'border-transparent bg-transparent hover:border-[color-mix(in_srgb,var(--color-border)_68%,transparent)] hover:bg-[var(--color-surface-2)]'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border transition-colors',
                          isActive
                            ? 'border-[color-mix(in_srgb,var(--color-primary)_32%,transparent)] bg-[var(--color-surface)] text-[var(--color-primary)]'
                            : 'border-[color-mix(in_srgb,var(--color-border)_70%,transparent)] bg-[var(--color-surface)] text-[var(--color-text-soft)] group-hover:text-[var(--color-text)]'
                        )}
                      >
                        <item.icon className="h-4 w-4" />
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={cn('truncate text-[13px] font-semibold', isActive ? 'text-[var(--color-text)]' : 'text-[var(--color-text-muted)] group-hover:text-[var(--color-text)]')}>
                            {item.label}
                          </span>
                          {item.badge ? (
                            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--color-primary)_12%,transparent)] px-1.5 text-[10px] font-semibold text-[var(--color-primary)]">
                              {item.badge}
                            </span>
                          ) : null}
                        </div>
                        {item.caption ? (
                          <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-[var(--color-text-soft)]">
                            {item.caption}
                          </p>
                        ) : null}
                      </div>

                      <ChevronRight
                        className={cn(
                          'mt-1 h-4 w-4 shrink-0 transition-all',
                          isActive ? 'translate-x-0 text-[var(--color-primary)]' : 'text-[var(--color-text-soft)] opacity-0 group-hover:translate-x-0.5 group-hover:opacity-100'
                        )}
                      />
                    </div>

                    {isActive ? (
                      <span className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-[var(--color-primary)]" />
                    ) : null}
                  </Link>
                );
              })}
            </nav>
          </section>
        ))}
      </div>

      <div className="border-t border-[color-mix(in_srgb,var(--color-border)_66%,transparent)] px-4 py-4">
        <div className="rounded-[20px] border border-[color-mix(in_srgb,var(--color-success)_24%,transparent)] bg-[linear-gradient(145deg,color-mix(in_srgb,var(--color-success)_12%,transparent)_0%,color-mix(in_srgb,var(--color-surface)_88%,transparent)_100%)] p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
            <ShieldCheck className="h-4 w-4 text-[var(--color-success)]" />
            {t('sidebar.auditReady', { defaultValue: 'Audit and escrow ready' })}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-[var(--color-text-muted)]">
            {t('sidebar.auditReadyHint', {
              defaultValue: 'Finance, support, documents and activity are connected into one local demo-ready workspace.',
            })}
          </p>
        </div>
      </div>
    </aside>
  );
}
