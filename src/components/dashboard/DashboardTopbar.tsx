import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  ChevronDown,
  Command,
  CreditCard,
  FilePlus2,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Plus,
  Search,
  Send,
  Settings,
  Sparkles,
  Shield,
  UserCircle2,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ThemeSwitcherCompact } from '@/components/ThemeSwitcher';
import { toAbsoluteAssetUrl } from '@/utils/assetUrl';
import api from '@/services/api';
import { useTranslation } from 'react-i18next';
import { WORKSPACE_PATH } from '@/utils/routes';
import { type DashboardNavItem } from './DashboardSidebar';

interface DashboardTopbarProps {
  userName: string;
  userAvatar?: string;
  profileLink: string;
  settingsLink: string;
  dashboardLink: string;
  sidebarItems: DashboardNavItem[];
  onLogout: () => void | Promise<void>;
  onOpenSidebar: () => void;
}

interface QuickActionItem {
  label: string;
  hint: string;
  to: string;
  icon: LucideIcon;
}

export function DashboardTopbar({
  userName,
  userAvatar,
  profileLink,
  settingsLink,
  dashboardLink,
  sidebarItems,
  onLogout,
  onOpenSidebar,
}: DashboardTopbarProps) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [isOpeningTelegram, setIsOpeningTelegram] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [openCases, setOpenCases] = useState(0);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const quickActionsRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) {
        setMenuOpen(false);
      }
      if (quickActionsRef.current && !quickActionsRef.current.contains(target)) {
        setQuickActionsOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(target)) {
        setSearchOpen(false);
      }
    };

    const handleCommandFocus = (event: KeyboardEvent) => {
      if (event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        const active = document.activeElement;
        const isTypingElement =
          active instanceof HTMLInputElement ||
          active instanceof HTMLTextAreaElement ||
          active instanceof HTMLSelectElement ||
          (active instanceof HTMLElement && active.isContentEditable);

        if (!isTypingElement) {
          event.preventDefault();
          searchInputRef.current?.focus();
          setSearchOpen(true);
        }
      }
    };

    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleCommandFocus);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleCommandFocus);
    };
  }, []);

  useEffect(() => {
    const loadCounters = async () => {
      try {
        const [notifications, messages, cases] = await Promise.all([
          api.getUnreadNotificationsCount(),
          api.getUnreadMessagesCount(),
          api.getMySupportCases({ limit: 1 }),
        ]);

        setUnreadNotifications(notifications);
        setUnreadMessages(messages);
        setOpenCases(cases.pagination.total);
      } catch {
        setUnreadNotifications(0);
        setUnreadMessages(0);
        setOpenCases(0);
      }
    };

    void loadCounters();
  }, [location.pathname]);

  const activeItem =
    sidebarItems.find((item) => location.pathname.startsWith(item.to.split('#')[0])) || sidebarItems[0];
  const workspacePulse = unreadNotifications + unreadMessages + openCases;

  const isFreelancer = location.pathname.includes('/freelancer/');

  const quickActions = useMemo<QuickActionItem[]>(
    () =>
      isFreelancer
        ? [
            {
              label: t('topbar.quick.market', { defaultValue: 'Open market' }),
              hint: t('topbar.quick.marketHint', { defaultValue: 'Browse fresh client demand' }),
              to: '/dashboard/freelancer/market',
              icon: LayoutDashboard,
            },
            {
              label: t('topbar.quick.payout', { defaultValue: 'Add payout method' }),
              hint: t('topbar.quick.payoutHint', { defaultValue: 'Configure bank or wallet' }),
              to: '/dashboard/freelancer/payouts',
              icon: CreditCard,
            },
            {
              label: t('topbar.quick.resume', { defaultValue: 'Update resume' }),
              hint: t('topbar.quick.resumeHint', { defaultValue: 'Refresh your production profile' }),
              to: '/dashboard/freelancer/resume',
              icon: UserCircle2,
            },
            {
              label: t('topbar.quick.documents', { defaultValue: 'Upload document' }),
              hint: t('topbar.quick.documentsHint', { defaultValue: 'Add signed files and briefs' }),
              to: '/dashboard/freelancer/documents',
              icon: FilePlus2,
            },
          ]
        : [
            {
              label: t('topbar.quick.order', { defaultValue: 'Create order' }),
              hint: t('topbar.quick.orderHint', { defaultValue: 'Launch a new escrow deal' }),
              to: '/orders/new',
              icon: Plus,
            },
            {
              label: t('topbar.quick.billing', { defaultValue: 'Open billing' }),
              hint: t('topbar.quick.billingHint', { defaultValue: 'Add cards and wallets' }),
              to: '/dashboard/client/billing',
              icon: CreditCard,
            },
            {
              label: t('topbar.quick.team', { defaultValue: 'Manage team' }),
              hint: t('topbar.quick.teamHint', { defaultValue: 'Invite workspace access' }),
              to: '/dashboard/client/team',
              icon: Users,
            },
            {
              label: t('topbar.quick.documents', { defaultValue: 'Upload document' }),
              hint: t('topbar.quick.documentsHint', { defaultValue: 'Add briefs and agreements' }),
              to: '/dashboard/client/documents',
              icon: FilePlus2,
            },
          ],
    [isFreelancer, t]
  );

  const commandItems = useMemo(() => {
    const merged = [
      ...sidebarItems.map((item) => ({
        label: item.label,
        hint: item.caption || item.group || t('sidebar.groups.navigation', { defaultValue: 'Navigation' }),
        to: item.to,
        icon: item.icon,
      })),
      ...quickActions,
    ];

    const query = searchValue.trim().toLowerCase();
    if (!query) return merged.slice(0, 8);

    return merged
      .filter((item) =>
        [item.label, item.hint, item.to].some((value) => value.toLowerCase().includes(query))
      )
      .slice(0, 8);
  }, [quickActions, searchValue, sidebarItems, t]);

  const handleLogout = async () => {
    await onLogout();
    setMenuOpen(false);
    navigate('/');
  };

  const handleOpenTelegram = async () => {
    try {
      setIsOpeningTelegram(true);
      const payload = await api.getTelegramDeepLink();
      const popup = window.open('', '_blank', 'noopener,noreferrer');
      if (popup) {
        popup.location.href = payload.deepLink;
      } else {
        window.location.assign(payload.deepLink);
      }
    } catch {
      navigate(`${settingsLink}#telegram`);
    } finally {
      setIsOpeningTelegram(false);
    }
  };

  const handleSearchSelect = (to: string) => {
    navigate(to);
    setSearchValue('');
    setSearchOpen(false);
  };

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (commandItems[0]) {
      handleSearchSelect(commandItems[0].to);
    }
  };

  return (
    <header className="fixed left-0 right-0 top-0 z-40 h-[86px] border-b border-[color-mix(in_srgb,var(--color-border)_64%,transparent)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-bg-elevated)_88%,transparent)_0%,color-mix(in_srgb,var(--color-bg-elevated)_74%,transparent)_100%)] backdrop-blur-xl lg:left-[320px]">
      <div className="mx-auto flex h-full w-full max-w-[var(--layout-dashboard-width)] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button
            type="button"
            onClick={onOpenSidebar}
            className="inline-flex h-11 w-11 items-center justify-center rounded-[16px] border border-[color-mix(in_srgb,var(--color-border)_72%,transparent)] bg-[var(--color-surface)] text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-2)] lg:hidden"
            aria-label={t('topbar.openMenu', { defaultValue: 'Open menu' })}
          >
            <Menu className="h-4 w-4" />
          </button>

          <div className="hidden min-w-0 xl:block">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-soft)]">
              <Link to={WORKSPACE_PATH} className="hover:text-[var(--color-text)]">
                {t('topbar.workspace', { defaultValue: 'Workspace' })}
              </Link>
              <span>/</span>
              <span>{activeItem?.group || t('sidebar.groups.navigation', { defaultValue: 'Navigation' })}</span>
            </div>
            <p className="mt-1 truncate font-[var(--font-family-display)] text-[1.05rem] font-semibold tracking-[-0.02em] text-[var(--color-text)]">
              {activeItem?.label || t('topbar.workspace', { defaultValue: 'Workspace' })}
            </p>
            {activeItem?.caption ? (
              <p className="mt-1 max-w-sm truncate text-xs text-[var(--color-text-soft)]">{activeItem.caption}</p>
            ) : null}
          </div>

          <div className="hidden 2xl:flex items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-[16px] border border-[color-mix(in_srgb,var(--color-primary)_24%,transparent)] bg-[color-mix(in_srgb,var(--color-primary)_10%,transparent)] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-primary)]">
              <Sparkles className="h-3.5 w-3.5" />
              {workspacePulse > 0 ? `${workspacePulse} live signals` : 'workspace calm'}
            </span>
            <span className="inline-flex items-center gap-2 rounded-[16px] border border-[color-mix(in_srgb,var(--color-border)_72%,transparent)] bg-[var(--color-surface)] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-soft)]">
              {sidebarItems.length} modules
            </span>
          </div>

          <div ref={searchRef} className="relative min-w-0 flex-1">
            <form onSubmit={handleSearchSubmit} className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-soft)]" />
              <input
                ref={searchInputRef}
                value={searchValue}
                onChange={(event) => {
                  setSearchValue(event.target.value);
                  setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
                placeholder={t('topbar.searchPlaceholder', {
                  defaultValue: 'Search analytics, billing, support, team, security...',
                })}
                className="h-12 w-full rounded-[18px] border border-[color-mix(in_srgb,var(--color-border)_72%,transparent)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-surface)_96%,transparent)_0%,color-mix(in_srgb,var(--color-surface-2)_52%,transparent)_100%)] pl-11 pr-12 text-sm text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-ring)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-ring)_28%,transparent)]"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 items-center gap-1 rounded-full border border-[color-mix(in_srgb,var(--color-border)_76%,transparent)] bg-[var(--color-surface-2)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-soft)] sm:inline-flex">
                <Command className="h-3 w-3" />/
              </span>
            </form>

            {searchOpen && commandItems.length > 0 ? (
              <div className="absolute left-0 right-0 top-[calc(100%+10px)] rounded-[22px] border border-[color-mix(in_srgb,var(--color-border)_72%,transparent)] bg-[color-mix(in_srgb,var(--color-surface)_97%,transparent)] p-2 shadow-[var(--shadow-raised)]">
                <div className="px-2 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-soft)]">
                  {t('topbar.searchResults', { defaultValue: 'Jump to section' })}
                </div>
                <div className="space-y-1">
                  {commandItems.map((item) => (
                    <button
                      key={`${item.to}-${item.label}`}
                      type="button"
                      onClick={() => handleSearchSelect(item.to)}
                      className="flex w-full items-center gap-3 rounded-[16px] px-3 py-3 text-left transition-colors hover:bg-[var(--color-surface-2)]"
                    >
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-[12px] border border-[color-mix(in_srgb,var(--color-border)_72%,transparent)] bg-[var(--color-surface)] text-[var(--color-primary)]">
                        <item.icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-[var(--color-text)]">{item.label}</span>
                        <span className="block truncate text-xs text-[var(--color-text-soft)]">{item.hint}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            to={isFreelancer ? '/dashboard/freelancer/messages' : '/dashboard/client/messages'}
            className="hidden h-11 items-center gap-2 rounded-[16px] border border-[color-mix(in_srgb,var(--color-border)_72%,transparent)] bg-[var(--color-surface)] px-3 text-sm font-semibold text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)] lg:inline-flex"
          >
            <MessageCircle className="h-4 w-4" />
            {unreadMessages > 0 ? unreadMessages : t('topbar.messages', { defaultValue: 'Messages' })}
          </Link>
          <Link
            to={isFreelancer ? '/dashboard/freelancer/notifications' : '/dashboard/client/notifications'}
            className="hidden h-11 items-center gap-2 rounded-[16px] border border-[color-mix(in_srgb,var(--color-border)_72%,transparent)] bg-[var(--color-surface)] px-3 text-sm font-semibold text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)] lg:inline-flex"
          >
            <Bell className="h-4 w-4" />
            {unreadNotifications > 0 ? unreadNotifications : t('topbar.alerts', { defaultValue: 'Alerts' })}
          </Link>
          <Link
            to={isFreelancer ? '/dashboard/freelancer/support' : '/dashboard/client/support'}
            className="hidden h-11 items-center gap-2 rounded-[16px] border border-[color-mix(in_srgb,var(--color-warning)_24%,transparent)] bg-[color-mix(in_srgb,var(--color-warning)_8%,transparent)] px-3 text-sm font-semibold text-[var(--color-text-muted)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-warning)_14%,transparent)] lg:inline-flex"
          >
            <Shield className="h-4 w-4 text-[var(--color-warning)]" />
            {openCases > 0 ? openCases : t('topbar.support', { defaultValue: 'Support' })}
          </Link>

          <div ref={quickActionsRef} className="relative">
            <button
              type="button"
              onClick={() => setQuickActionsOpen((prev) => !prev)}
              className="inline-flex h-11 items-center gap-2 rounded-[16px] border border-[color-mix(in_srgb,var(--color-primary)_32%,transparent)] bg-[color-mix(in_srgb,var(--color-primary)_10%,transparent)] px-3 text-sm font-semibold text-[var(--color-primary)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-primary)_16%,transparent)]"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">{t('topbar.quickActions', { defaultValue: 'Quick actions' })}</span>
            </button>

            {quickActionsOpen ? (
              <div className="absolute right-0 mt-2 w-80 rounded-[22px] border border-[color-mix(in_srgb,var(--color-border)_72%,transparent)] bg-[var(--color-surface)] p-2 shadow-[var(--shadow-raised)]">
                <div className="px-2 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-soft)]">
                  {t('topbar.quickActionsMenu', { defaultValue: 'Launch workflow' })}
                </div>
                <div className="space-y-1">
                  {quickActions.map((item) => (
                    <button
                      key={item.to}
                      type="button"
                      onClick={() => {
                        setQuickActionsOpen(false);
                        navigate(item.to);
                      }}
                      className="flex w-full items-center gap-3 rounded-[16px] px-3 py-3 text-left transition-colors hover:bg-[var(--color-surface-2)]"
                    >
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-[12px] border border-[color-mix(in_srgb,var(--color-border)_72%,transparent)] bg-[var(--color-surface-2)] text-[var(--color-primary)]">
                        <item.icon className="h-4 w-4" />
                      </span>
                      <span>
                        <span className="block text-sm font-semibold text-[var(--color-text)]">{item.label}</span>
                        <span className="block text-xs text-[var(--color-text-soft)]">{item.hint}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => void handleOpenTelegram()}
            disabled={isOpeningTelegram}
            className="inline-flex h-11 w-11 items-center justify-center rounded-[16px] border border-[color-mix(in_srgb,var(--color-border)_72%,transparent)] bg-[var(--color-surface)] text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)] disabled:opacity-60"
            aria-label={t('topbar.telegram', { defaultValue: 'Telegram' })}
          >
            <Send className="h-4 w-4" />
          </button>

          <LanguageSwitcher />
          <ThemeSwitcherCompact />

          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              className="inline-flex h-11 items-center gap-2 rounded-[18px] border border-[color-mix(in_srgb,var(--color-border)_72%,transparent)] bg-[var(--color-surface)] px-2.5 text-[13px] font-semibold text-[var(--color-text)] transition-[transform,background-color,border-color] duration-200 active:scale-[0.98] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-2)]"
            >
              {userAvatar ? (
                <img src={toAbsoluteAssetUrl(userAvatar)} alt={userName} className="h-8 w-8 rounded-[12px] object-cover" />
              ) : (
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-[12px] bg-[var(--color-surface-2)] text-xs font-bold text-[var(--color-text)]">
                  {userName.charAt(0).toUpperCase() || 'U'}
                </span>
              )}
              <span className="hidden max-w-[130px] truncate lg:inline">{userName || t('topbar.user', { defaultValue: 'User' })}</span>
              <ChevronDown className={cn('h-4 w-4 text-[var(--color-text-soft)] transition-transform', menuOpen && 'rotate-180')} />
            </button>

            {menuOpen ? (
              <div className="absolute right-0 mt-2 w-64 rounded-[22px] border border-[color-mix(in_srgb,var(--color-border)_72%,transparent)] bg-[var(--color-surface)] p-2 shadow-[var(--shadow-raised)]">
                <Link
                  to={dashboardLink}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 rounded-[16px] px-3 py-3 text-[13px] font-semibold text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  {t('navbar.dashboard')}
                </Link>
                <Link
                  to={profileLink}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 rounded-[16px] px-3 py-3 text-[13px] font-semibold text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
                >
                  <UserCircle2 className="h-4 w-4" />
                  {t('navbar.profile')}
                </Link>
                <Link
                  to={isFreelancer ? '/dashboard/freelancer/security' : '/dashboard/client/security'}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 rounded-[16px] px-3 py-3 text-[13px] font-semibold text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
                >
                  <Shield className="h-4 w-4" />
                  {t('topbar.securityCenter', { defaultValue: 'Security center' })}
                </Link>
                <Link
                  to={settingsLink}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 rounded-[16px] px-3 py-3 text-[13px] font-semibold text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
                >
                  <Settings className="h-4 w-4" />
                  {t('common.settings')}
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 rounded-[16px] px-3 py-3 text-left text-[13px] font-semibold text-[var(--color-danger)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-danger)_12%,transparent)]"
                >
                  <LogOut className="h-4 w-4" />
                  {t('navbar.logout')}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
