import { Loader2 } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/components/ui/Skeleton';
import { getRoleHomePath } from '@/utils/routes';

export function DashboardPage() {
  const { t } = useTranslation();
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="app-background flex min-h-screen items-center justify-center px-4">
        <div className="surface-elevated w-full max-w-md p-5">
          <div className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-text-muted)]">
            <Loader2 className="h-4 w-4 animate-spin text-[var(--color-primary)]" />
            {t('common.loading')}
          </div>
          <Skeleton className="h-3.5 w-3/5" />
          <Skeleton className="mt-2 h-3.5 w-4/5" />
          <Skeleton className="mt-4 h-10 w-full rounded-[var(--radius-control)]" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={getRoleHomePath(user.role)} replace />;
}
