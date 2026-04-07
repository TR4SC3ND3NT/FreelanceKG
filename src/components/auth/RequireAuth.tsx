import { Navigate, Outlet } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';

export function RequireAuth() {
  const { t } = useTranslation();
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className="app-background flex min-h-screen items-center justify-center px-4">
        <div className="surface inline-flex items-center gap-3 px-4 py-3">
          <Loader2 className="h-4 w-4 animate-spin text-[var(--color-primary)]" />
          <span className="text-sm">{t('auth.sessionCheck', { defaultValue: 'Checking session...' })}</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
