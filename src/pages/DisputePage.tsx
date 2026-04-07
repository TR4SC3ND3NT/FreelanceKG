import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { AlertTriangle, FileText, Loader2, Shield, Upload, X } from 'lucide-react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api, { Order } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { formatDate, formatMoneyKGS } from '@/utils/locale';
import { DashboardShell } from '../components/dashboard/DashboardShell';
import { getClientSidebarItems, getFreelancerSidebarItems } from '../components/dashboard/dashboardNav';
import { PageHeader } from '../components/ui/PageHeader';
import { Badge } from '../components/ui/Badge';
import { WORKSPACE_PATH } from '@/utils/routes';

export function DisputePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { isDark } = useTheme();
  const { user, logout } = useAuth();

  const [order, setOrder] = useState<Order | null>(null);
  const [isLoadingOrder, setIsLoadingOrder] = useState(true);

  const [reason, setReason] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadOrder = async () => {
      if (!id) return;

      try {
        setIsLoadingOrder(true);
        const data = await api.getOrder(id);
        setOrder(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : t('dispute.loadFailed', { defaultValue: 'Failed to load order' }));
      } finally {
        setIsLoadingOrder(false);
      }
    };

    void loadOrder();
  }, [id]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setFiles((prev) => [...prev, ...Array.from(event.target.files || [])]);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!reason.trim()) {
      setError(t('dispute.reasonRequired', { defaultValue: 'Please describe dispute reason' }));
      return;
    }

    if (!id) {
      setError(t('dispute.orderIdMissing', { defaultValue: 'Order ID not found' }));
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      let evidence: string[] | undefined;
      if (files.length > 0) {
        const uploaded = await api.uploadMultipleFiles(files);
        evidence = uploaded.map((file) => file.url);
      }

      await api.createDispute({
        orderId: id,
        reason: reason.trim(),
        evidence,
      });

      setIsSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('dispute.openFailed', { defaultValue: 'Failed to open dispute' }));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) return <Navigate to="/login" replace />;

  const isFreelancer = user.role === 'FREELANCER';
  const sidebarItems = isFreelancer ? getFreelancerSidebarItems() : getClientSidebarItems();

  const disputeStatusLabel = useMemo(() => {
    if (isSubmitted) return t('dispute.statusInReview', { defaultValue: 'In review' });
    return t('dispute.statusDraft', { defaultValue: 'Draft' });
  }, [isSubmitted, t]);
  const disputeStatusVariant: 'warning' | 'info' = isSubmitted ? 'warning' : 'info';

  return (
    <DashboardShell
      isDark={isDark}
      sidebarTitle={user.name || 'Workspace'}
      sidebarSubtitle={isFreelancer ? 'Freelancer workspace' : 'Client workspace'}
      sidebarItems={sidebarItems}
      onLogout={logout}
    >
      <PageHeader
        title={order ? `${t('dispute.title')} #${order.id}` : t('dispute.title')}
        subtitle={t('dispute.subtitle')}
        badges={
          <>
            <Badge variant={disputeStatusVariant}>{disputeStatusLabel}</Badge>
            <Badge variant="warning">Dispute Case</Badge>
            <Badge variant="info">{t('common.escrowProtection')}</Badge>
          </>
        }
        actions={
          <Link
            to={id ? `/orders/${id}` : WORKSPACE_PATH}
            className="inline-flex h-10 items-center rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-sm font-semibold text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-2)]"
          >
            {t('dispute.backToOrder', { defaultValue: 'Back to order' })}
          </Link>
        }
      />

      {isLoadingOrder ? (
        <section className="surface p-6 text-sm text-[var(--color-text-muted)]">{t('common.loading')}</section>
      ) : null}

      {!isLoadingOrder && !order ? (
        <section className="surface p-8 text-center">
          <h2 className="text-2xl font-bold text-[var(--color-text)]">{t('orders.details.notFound', { defaultValue: 'Order not found' })}</h2>
          <Link to={WORKSPACE_PATH} className="mt-3 inline-block text-sm font-semibold text-[var(--color-primary)] hover:underline">
            {t('orders.details.backToDashboard', { defaultValue: 'Back to dashboard' })}
          </Link>
        </section>
      ) : null}

      {!isLoadingOrder && order && isSubmitted ? (
        <section className="surface mx-auto w-full max-w-3xl p-8 text-center">
          <div className="mx-auto mb-5 inline-flex h-16 w-16 items-center justify-center rounded-[14px] border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-warning)_12%,transparent)] text-[var(--color-warning)]">
            <AlertTriangle className="h-8 w-8" />
          </div>

          <h2 className="text-3xl font-bold text-[var(--color-text)]">{t('dispute.opened')}</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-[var(--color-text-muted)]">
            {t('dispute.openedHint', { defaultValue: 'Case is created and sent for moderation review.' })}
          </p>

          <div className="mt-5 rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--color-warning)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-warning)_12%,transparent)] px-4 py-3 text-left">
            <p className="text-sm font-semibold text-[var(--color-warning)]">{t('common.status')}: {disputeStatusLabel}</p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">{t('dispute.reviewTime')}</p>
          </div>

          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => navigate(`/orders/${id}`)}
              className="inline-flex h-10 items-center rounded-[var(--radius-control)] bg-[var(--color-primary)] px-5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-hover)]"
            >
              {t('dispute.backToOrder', { defaultValue: 'Back to order' })}
            </button>
            <Link
              to={WORKSPACE_PATH}
              className="inline-flex h-10 items-center rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-5 text-sm font-semibold text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-2)]"
            >
              {t('orders.details.backToDashboard', { defaultValue: 'Back to dashboard' })}
            </Link>
          </div>
        </section>
      ) : null}

      {!isLoadingOrder && order && !isSubmitted ? (
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <div className="space-y-6 xl:col-span-8">
            <section className="surface p-6">
              <div className="mb-5">
                <h2 className="section-title">{t('dispute.caseFile', { defaultValue: 'Case file' })}</h2>
                <p className="section-subtitle mt-1">
                  {t('dispute.caseFileHint', { defaultValue: 'Describe the issue clearly and attach all relevant evidence.' })}
                </p>
              </div>

              <div className="mb-5 rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--color-danger)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_12%,transparent)] p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 text-[var(--color-danger)]" />
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-danger)]">{t('dispute.warningTitle')}</p>
                    <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-muted)]">
                      {t('dispute.warningText')}
                    </p>
                  </div>
                </div>
              </div>

              {error && (
                <div className="mb-4 rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--color-danger)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_12%,transparent)] px-4 py-3 text-sm text-[var(--color-danger)]">
                  {error}
                </div>
              )}

              <label className="mb-5 block space-y-2">
                <span className="text-sm font-medium text-[var(--color-text)]">{t('dispute.reason')} *</span>
                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder={t('dispute.reasonPlaceholder')}
                  rows={7}
                  className="w-full resize-none rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5 text-sm text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-ring)]"
                />
              </label>

              <div className="mb-6">
                <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">{t('dispute.evidence')}</label>
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-[var(--radius-control)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-2)] p-7 text-center transition-colors hover:bg-[var(--color-surface)]">
                  <Upload className="mb-2 h-8 w-8 text-[var(--color-text-soft)]" />
                  <span className="text-sm font-medium text-[var(--color-text-muted)]">{t('dispute.uploadClick')}</span>
                  <span className="mt-1 text-xs text-[var(--color-text-soft)]">{t('dispute.fileRules', { defaultValue: 'PNG, JPG, PDF up to 10MB' })}</span>
                  <input type="file" multiple accept="image/*,.pdf" onChange={handleFileChange} className="hidden" />
                </label>

                {files.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {files.map((file, index) => (
                      <div key={`${file.name}-${index}`} className="flex items-center justify-between rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-[var(--color-text-soft)]" />
                          <span className="text-xs text-[var(--color-text-muted)]">{file.name}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-[8px] text-[var(--color-text-soft)] transition-colors hover:bg-[var(--color-surface)]"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  to={`/orders/${id}`}
                  className="inline-flex h-10 flex-1 items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-sm font-semibold text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-2)]"
                >
                  {t('common.cancel')}
                </Link>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[var(--color-danger)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[color-mix(in_srgb,var(--color-danger)_85%,black_15%)] disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t('dispute.submitting')}
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-4 w-4" />
                      {t('dispute.submit')}
                    </>
                  )}
                </button>
              </div>
            </section>
          </div>

          <aside className="space-y-6 xl:col-span-4 xl:sticky xl:top-24 xl:self-start">
            <section className="surface p-5 sm:p-6">
              <h3 className="section-title">{t('dispute.caseSummary', { defaultValue: 'Case summary' })}</h3>
              <p className="section-subtitle mt-1">
                {t('dispute.caseSummaryHint', { defaultValue: 'Order details used during moderation review.' })}
              </p>

              <div className="mt-4 space-y-2">
                <div className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-[var(--color-text-soft)]">Order ID</p>
                  <p className="mt-1 text-xs font-semibold text-[var(--color-text)]">{order.id}</p>
                </div>
                <div className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-[var(--color-text-soft)]">{t('common.status')}</p>
                  <div className="mt-1">
                    <Badge variant={disputeStatusVariant}>{disputeStatusLabel}</Badge>
                  </div>
                </div>
              </div>

              <p className="mt-4 text-sm font-semibold text-[var(--color-text)]">{order.title}</p>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                {t('orders.details.budget')}: {formatMoneyKGS(order.budget, i18n.language)}
              </p>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                {t('orders.details.escrow')}: {formatMoneyKGS(order.escrowAmount, i18n.language)}
              </p>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                {t('common.createdAt', { defaultValue: 'Created' })}: {formatDate(order.createdAt, i18n.language)}
              </p>
            </section>

            <section className="surface p-5 sm:p-6">
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-primary)]">
                <Shield className="h-4 w-4" />
                Dispute timeline
              </p>
              <div className="mt-4 space-y-2">
                <div className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-xs text-[var(--color-text-muted)]">
                  {t('dispute.timeline.step1', { defaultValue: '1. Case created and accepted' })}
                </div>
                <div className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-xs text-[var(--color-text-muted)]">
                  {t('dispute.timeline.step2', { defaultValue: '2. Evidence review of both parties' })}
                </div>
                <div className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-xs text-[var(--color-text-muted)]">
                  {t('dispute.timeline.step3', { defaultValue: '3. Decision and escrow transfer' })}
                </div>
              </div>
            </section>

            <section className="surface p-5 sm:p-6">
              <p className="text-sm text-[var(--color-text-muted)]">
                {t('dispute.finalHint', { defaultValue: 'After dispute opening, payout actions are blocked until final moderation decision.' })}
              </p>
            </section>
          </aside>
        </section>
      ) : null}
    </DashboardShell>
  );
}
