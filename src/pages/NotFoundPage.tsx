import { Compass } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PublicNavbar } from '../components/PublicNavbar';
import { WORKSPACE_PATH } from '@/utils/routes';

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen app-background">
      <PublicNavbar />

      <main className="relative mx-auto flex min-h-screen max-w-4xl items-center justify-center px-4 pt-20">
        <section className="surface w-full p-8 text-center sm:p-10">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-primary)]">
            <Compass className="h-7 w-7" />
          </div>

          <p className="mt-5 text-sm font-semibold uppercase tracking-wide text-[var(--color-text-soft)]">{t('notFound.code', { defaultValue: 'Error 404' })}</p>
          <h1 className="mt-2 text-3xl font-bold text-[var(--color-text)] sm:text-4xl">{t('notFound.title', { defaultValue: 'Page not found' })}</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-[var(--color-text-muted)] sm:text-base">
            {t('notFound.subtitle', { defaultValue: 'Link may be outdated or page moved. Go back to dashboard or homepage.' })}
          </p>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link
              to={WORKSPACE_PATH}
              className="inline-flex h-10 items-center rounded-[var(--radius-control)] bg-[var(--color-primary)] px-5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-hover)]"
            >
              {t('notFound.dashboard', { defaultValue: 'Dashboard' })}
            </Link>
            <Link
              to="/"
              className="inline-flex h-10 items-center rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-5 text-sm font-semibold text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
            >
              {t('notFound.home', { defaultValue: 'Home' })}
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
