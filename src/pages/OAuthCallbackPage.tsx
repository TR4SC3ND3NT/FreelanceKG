import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { setToken } from '../services/api';
import { PublicLayout } from '../components/layout/PublicLayout';
import { WORKSPACE_PATH } from '@/utils/routes';

export function OAuthCallbackPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const hashToken = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('token');
    const token = hashToken || searchParams.get('token');

    if (token) {
      setToken(token);
      window.location.replace(WORKSPACE_PATH);
      return;
    }

    navigate('/login', { replace: true });
  }, [navigate, searchParams]);

  return (
    <PublicLayout showFooter={false} containerClassName="max-w-3xl">
      <section className="mx-auto flex min-h-[60vh] items-center justify-center">
        <div className="surface inline-flex items-center gap-3 px-4 py-3 text-sm font-medium text-[var(--color-text-muted)]">
          <Loader2 className="h-4 w-4 animate-spin text-[var(--color-primary)]" />
          {t('oauth.finishing')}
        </div>
      </section>
    </PublicLayout>
  );
}
