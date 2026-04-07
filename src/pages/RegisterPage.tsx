import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Briefcase, Eye, EyeOff, Loader2, Lock, Mail, User, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ThemeSwitcher } from '../components/ThemeSwitcher';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { useLanguage } from '../context/LanguageContext';
import { cn } from '../utils/cn';
import { WORKSPACE_PATH } from '@/utils/routes';
import { API_BASE } from '@/config/runtime';

type Role = 'CLIENT' | 'FREELANCER';

export function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<Role | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [validationError, setValidationError] = useState('');

  const { register, isLoading, error: authError, clearError } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const apiBase = API_BASE;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');
    clearError();

    if (!name || !email || !password || !confirmPassword) {
      setValidationError(t('auth.errors.fillAll'));
      return;
    }

    if (!role) {
      setValidationError(t('auth.errors.roleRequired'));
      return;
    }

    if (password !== confirmPassword) {
      setValidationError(t('auth.errors.passwordMismatch'));
      return;
    }

    if (password.length < 8) {
      setValidationError(t('auth.errors.passwordLength'));
      return;
    }

    if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      setValidationError(t('auth.errors.passwordComplexity'));
      return;
    }

    const success = await register({ name, email, password, role });
    if (success) {
      navigate(WORKSPACE_PATH);
    }
  };

  const displayError = validationError || authError;

  return (
    <div className="app-background relative flex min-h-screen items-center justify-center p-4 py-8">
      <div className="fixed right-6 top-6 z-40 flex items-center gap-2">
        <LanguageSwitcher />
        <ThemeSwitcher />
      </div>

      <div className="w-full max-w-md animate-fadeIn">
        <div className="surface p-8 sm:p-10">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface-2)] text-lg font-bold text-[var(--color-text)]">
              F
            </div>
            <h1 className="text-[2rem] font-bold tracking-[-0.012em] text-[var(--color-text)]">
              Freelance<span className="text-[var(--color-primary)]">KG</span>
            </h1>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">{t('auth.registerSubtitle')}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {displayError && (
              <div className="rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--color-danger)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_12%,transparent)] px-4 py-3 text-sm text-[var(--color-danger)]">
                {displayError}
              </div>
            )}

            <div className="space-y-2">
              <span className="text-sm font-medium text-[var(--color-text)]">{t('auth.roleTitle')}</span>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRole('CLIENT')}
                  className={cn(
                    'flex flex-col items-center gap-1.5 rounded-[var(--radius-control)] border px-3 py-3 text-xs font-semibold transition-colors',
                    role === 'CLIENT'
                      ? 'border-[var(--color-primary)] bg-[color-mix(in_srgb,var(--color-primary)_12%,transparent)] text-[var(--color-primary)]'
                      : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]'
                  )}
                >
                  <Briefcase className="h-4 w-4" />
                  {t('auth.roleClient')}
                </button>

                <button
                  type="button"
                  onClick={() => setRole('FREELANCER')}
                  className={cn(
                    'flex flex-col items-center gap-1.5 rounded-[var(--radius-control)] border px-3 py-3 text-xs font-semibold transition-colors',
                    role === 'FREELANCER'
                      ? 'border-[var(--color-primary)] bg-[color-mix(in_srgb,var(--color-primary)_12%,transparent)] text-[var(--color-primary)]'
                      : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]'
                  )}
                >
                  <Users className="h-4 w-4" />
                  {t('auth.roleFreelancer')}
                </button>
              </div>
            </div>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-[var(--color-text)]">{t('auth.name')}</span>
              <span className="relative block">
                <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-soft)]" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('auth.placeholderName')}
                  className="h-10 w-full rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] pl-10 pr-3.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-soft)] outline-none transition-colors focus:border-[var(--color-ring)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-ring)_32%,transparent)]"
                />
              </span>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-[var(--color-text)]">{t('auth.email')}</span>
              <span className="relative block">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-soft)]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('auth.placeholderEmail')}
                  className="h-10 w-full rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] pl-10 pr-3.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-soft)] outline-none transition-colors focus:border-[var(--color-ring)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-ring)_32%,transparent)]"
                />
              </span>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-[var(--color-text)]">{t('auth.password')}</span>
              <span className="relative block">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-soft)]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('auth.placeholderNewPassword')}
                  className="h-10 w-full rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] pl-10 pr-10 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-soft)] outline-none transition-colors focus:border-[var(--color-ring)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-ring)_32%,transparent)]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-soft)] transition-colors hover:text-[var(--color-text)]"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </span>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-[var(--color-text)]">{t('auth.confirmPassword')}</span>
              <span className="relative block">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-soft)]" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t('auth.placeholderConfirmPassword')}
                  className="h-10 w-full rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] pl-10 pr-10 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-soft)] outline-none transition-colors focus:border-[var(--color-ring)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-ring)_32%,transparent)]"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-soft)] transition-colors hover:text-[var(--color-text)]"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </span>
            </label>

            <p className="text-xs leading-relaxed text-[var(--color-text-soft)]">
              {t('auth.termsPrefix')}{' '}
              <Link to="/terms" className="font-medium text-[var(--color-primary)] hover:underline">
                {t('auth.terms')}
              </Link>
              {' '}
              {t('auth.and')}
              {' '}
              <Link to="/terms" className="font-medium text-[var(--color-primary)] hover:underline">
                {t('auth.privacy')}
              </Link>
            </p>

            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[var(--color-primary)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{t('auth.registering')}</span>
                </>
              ) : (
                <>
                  <span>{t('auth.registerButton')}</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="my-6 flex items-center gap-4">
            <div className="h-px flex-1 bg-[var(--color-border)]" />
            <span className="text-xs text-[var(--color-text-soft)]">{t('auth.or')}</span>
            <div className="h-px flex-1 bg-[var(--color-border)]" />
          </div>

          <div className="grid grid-cols-1 gap-3">
            <button
              type="button"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm font-medium text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-2)]"
              onClick={() => {
                window.location.href = `${apiBase}/auth/google`;
              }}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {t('auth.loginWithGoogle')}
            </button>

            <button
              type="button"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm font-medium text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-2)]"
              onClick={() => {
                window.location.href = `${apiBase}/auth/github`;
              }}
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              {t('auth.loginWithGithub')}
            </button>
          </div>

          <p className="mt-6 text-center text-sm text-[var(--color-text-muted)]">
            {t('auth.hasAccount')}{' '}
            <Link to="/login" className="font-semibold text-[var(--color-primary)] hover:underline">
              {t('auth.toLogin')}
            </Link>
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-[var(--color-text-soft)]">{t('footer.copyright')}</p>
      </div>
    </div>
  );
}
