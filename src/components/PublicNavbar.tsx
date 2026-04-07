import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, LayoutDashboard, LogOut, Menu, UserCircle2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ThemeSwitcherCompact } from './ThemeSwitcher';
import { cn } from '../utils/cn';
import { toAbsoluteAssetUrl } from '../utils/assetUrl';
import { Logo } from './Logo';
import { getRoleHomePath, WORKSPACE_PATH } from '@/utils/routes';

interface PublicNavbarProps {
  showLinks?: boolean;
}

export function PublicNavbar({ showLinks = true }: PublicNavbarProps) {
  const { t } = useLanguage();
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const navLinks = useMemo(
    () => [
      { to: '/freelancers', label: t('navbar.freelancers') },
      { to: '/how-it-works', label: t('navbar.howItWorks') },
      { to: '/categories', label: t('navbar.categories') },
    ],
    [t]
  );

  useEffect(() => {
    setMenuOpen(false);
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    window.addEventListener('mousedown', onClickOutside);
    return () => window.removeEventListener('mousedown', onClickOutside);
  }, []);

  const profileLink =
    user?.role === 'FREELANCER'
      ? '/dashboard/freelancer/profile'
      : user?.role === 'ADMIN'
        ? '/admin'
        : '/dashboard/client/profile';
  const workspaceLink = isAuthenticated ? getRoleHomePath(user?.role) : WORKSPACE_PATH;
  const isLinkActive = (path: string) => location.pathname === path;

  const handleLogout = async () => {
    await logout();
    setMenuOpen(false);
    navigate('/');
  };

  return (
    <header className="fixed left-0 right-0 top-0 z-50 border-b border-[color-mix(in_srgb,var(--color-border)_66%,transparent)] bg-[color-mix(in_srgb,var(--color-bg-elevated)_78%,transparent)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-[var(--layout-public-width)] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link to="/" className="inline-flex items-center" onClick={() => setMobileOpen(false)}>
          <Logo size="sm" />
        </Link>

        {showLinks ? (
          <nav className="hidden items-center gap-1 rounded-[999px] border border-[color-mix(in_srgb,var(--color-border)_72%,transparent)] bg-[color-mix(in_srgb,var(--color-surface)_82%,transparent)] p-1 lg:flex">
            {navLinks.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  'rounded-[999px] px-4 py-2 text-[13px] font-semibold tracking-[0.01em] transition-[background-color,color] duration-200',
                  isLinkActive(item.to)
                    ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-[0_10px_20px_-18px_rgba(0,0,0,0.9)]'
                    : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]'
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        ) : null}

        <div className="hidden items-center gap-2 md:flex">
          <LanguageSwitcher />
          <ThemeSwitcherCompact />

          {!isAuthenticated ? (
            <>
              <Link
                to="/login"
                className="inline-flex h-10 items-center rounded-[999px] border border-[transparent] px-4 text-[13px] font-semibold tracking-[0.01em] text-[var(--color-text-muted)] transition-[background-color,color,border-color] duration-200 hover:border-[color-mix(in_srgb,var(--color-border)_70%,transparent)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]"
              >
                {t('navbar.login')}
              </Link>
              <Link
                to="/register"
                className="inline-flex h-10 items-center rounded-[999px] border border-[color-mix(in_srgb,var(--color-primary)_44%,transparent)] bg-[var(--color-primary)] px-4 text-[13px] font-semibold tracking-[0.01em] text-white transition-[transform,background-color] duration-200 active:scale-[0.98] hover:bg-[var(--color-primary-hover)]"
              >
                {t('navbar.register')}
              </Link>
            </>
          ) : (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((prev) => !prev)}
                className="inline-flex h-10 items-center gap-2 rounded-[999px] border border-[color-mix(in_srgb,var(--color-border)_72%,transparent)] bg-[var(--color-surface)] px-2.5 text-[13px] font-semibold text-[var(--color-text)] transition-[transform,background-color,border-color] duration-200 active:scale-[0.98] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-2)]"
              >
                {user?.avatar ? (
                  <img src={toAbsoluteAssetUrl(user.avatar)} alt={user.name} className="h-7 w-7 rounded-full object-cover" />
                ) : (
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-surface-2)] text-xs font-bold text-[var(--color-text)]">
                    {user?.name?.charAt(0).toUpperCase() || 'U'}
                  </span>
                )}
                <span className="max-w-28 truncate">{user?.name || 'User'}</span>
                <ChevronDown className={cn('h-4 w-4 text-[var(--color-text-soft)] transition-transform', menuOpen && 'rotate-180')} />
              </button>

              {menuOpen ? (
                <div className="absolute right-0 mt-2 w-56 rounded-[var(--radius-card)] border border-[color-mix(in_srgb,var(--color-border)_72%,transparent)] bg-[var(--color-surface)] p-2 shadow-[var(--shadow-raised)]">
                  <Link
                    to={profileLink}
                    className="flex items-center gap-2 rounded-[10px] px-3 py-2 text-[13px] font-semibold text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
                  >
                    <UserCircle2 className="h-4 w-4" />
                    {t('navbar.profile')}
                  </Link>
                  <Link
                    to={workspaceLink}
                    className="flex items-center gap-2 rounded-[10px] px-3 py-2 text-[13px] font-semibold text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    {t('navbar.dashboard')}
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[13px] font-semibold text-[var(--color-danger)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-danger)_12%,transparent)]"
                  >
                    <LogOut className="h-4 w-4" />
                    {t('navbar.logout')}
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen((prev) => !prev)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--color-border)_72%,transparent)] bg-[var(--color-surface)] text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-2)] md:hidden"
          aria-label={t('topbar.openMenu', { defaultValue: 'Open menu' })}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen ? (
        <div className="border-t border-[color-mix(in_srgb,var(--color-border)_62%,transparent)] bg-[color-mix(in_srgb,var(--color-surface)_95%,transparent)] px-4 py-4 md:hidden">
          {showLinks ? (
            <nav className="mb-4 grid grid-cols-1 gap-1">
              {navLinks.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    'rounded-[10px] px-3 py-2 text-[13px] font-semibold transition-colors',
                    isLinkActive(item.to)
                      ? 'bg-[var(--color-surface-2)] text-[var(--color-text)]'
                      : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]'
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          ) : null}

          <div className="mb-4 flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeSwitcherCompact />
          </div>

          {!isAuthenticated ? (
            <div className="grid grid-cols-2 gap-2">
              <Link
                to="/login"
                className="inline-flex h-10 items-center justify-center rounded-[10px] border border-[color-mix(in_srgb,var(--color-border)_72%,transparent)] bg-[var(--color-surface)] px-3 text-[13px] font-semibold text-[var(--color-text)]"
              >
                {t('navbar.login')}
              </Link>
              <Link
                to="/register"
                className="inline-flex h-10 items-center justify-center rounded-[10px] border border-[color-mix(in_srgb,var(--color-primary)_44%,transparent)] bg-[var(--color-primary)] px-3 text-[13px] font-semibold text-white"
              >
                {t('navbar.register')}
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-1">
              <Link
                to={profileLink}
                className="rounded-[10px] px-3 py-2 text-[13px] font-semibold text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
              >
                {t('navbar.profile')}
              </Link>
              <Link
                to={workspaceLink}
                className="rounded-[10px] px-3 py-2 text-[13px] font-semibold text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
              >
                {t('navbar.dashboard')}
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-[10px] px-3 py-2 text-left text-[13px] font-semibold text-[var(--color-danger)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-danger)_12%,transparent)]"
              >
                {t('navbar.logout')}
              </button>
            </div>
          )}
        </div>
      ) : null}
    </header>
  );
}
