import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Logo } from '../Logo';

interface AuthLayoutProps {
  children: ReactNode;
  subtitle?: string;
}

export function AuthLayout({ children, subtitle }: AuthLayoutProps) {
  const { t } = useTranslation();
  return (
    <div className="app-background flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md animate-fadeIn">
        <div className="surface-elevated p-8 sm:p-10">
          <div className="mb-8 text-center">
            <Logo size="md" className="justify-center" />
            {subtitle && <p className="mt-3 text-sm text-[var(--color-text-muted)]">{subtitle}</p>}
          </div>
          {children}
        </div>

        <p className="mt-6 text-center text-sm text-[var(--color-text-soft)]">{t('footer.copyright')}</p>
      </div>
    </div>
  );
}
