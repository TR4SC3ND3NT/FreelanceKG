import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Landmark, ShieldCheck, Wallet } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import api, {
  FreelancerBalanceStats,
  FreelancerPaymentDetails,
  PaymentMethod,
  PaymentMethodId,
  PaymentTransaction,
} from '@/services/api';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { getFreelancerSidebarItems } from '@/components/dashboard/dashboardNav';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { useTranslation } from 'react-i18next';
import { formatDate, formatMoneyKGS } from '@/utils/locale';

function maskPaymentValue(method: string, value: string): string {
  const normalized = value.trim();
  if (!normalized) return '';

  if (method === 'card') {
    const digits = normalized.replace(/\D/g, '');
    if (digits.length < 4) return normalized;
    return `**** **** **** ${digits.slice(-4)}`;
  }

  if (normalized.length <= 4) return normalized;
  return `${normalized.slice(0, 2)}***${normalized.slice(-2)}`;
}

export function FreelancerFinancePage() {
  const { t, i18n } = useTranslation();
  const { isDark } = useTheme();
  const { user, logout, refreshUser } = useAuth();

  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [stats, setStats] = useState<{
    activeOrders: number;
    completedOrders: number;
    totalEarnings: number;
    balance: number;
    pendingAmount: number;
    rating: number;
  } | null>(null);
  const [balance, setBalance] = useState<FreelancerBalanceStats | null>(null);

  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawMethod, setWithdrawMethod] = useState<PaymentMethodId>('mbank');
  const [withdrawDetails, setWithdrawDetails] = useState('');
  const [withdrawMessage, setWithdrawMessage] = useState<string | null>(null);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [savedRequisites, setSavedRequisites] = useState<FreelancerPaymentDetails | null>(null);
  const [requisiteMethod, setRequisiteMethod] = useState<FreelancerPaymentDetails['method']>('card');
  const [requisiteValue, setRequisiteValue] = useState('');
  const [requisiteError, setRequisiteError] = useState<string | null>(null);
  const [requisiteMessage, setRequisiteMessage] = useState<string | null>(null);
  const [isSavingRequisites, setIsSavingRequisites] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFinance = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [paymentMethods, transactionResult, statsResult, balanceResult] = await Promise.all([
        api.getPaymentMethods(),
        api.getTransactions({ limit: 20 }),
        api.getFreelancerPaymentStats(),
        api.getFreelancerBalance(),
      ]);

      setMethods(paymentMethods.filter((method) => method.enabled));
      setTransactions(transactionResult.data);
      setStats(statsResult);
      setBalance(balanceResult);

      if (paymentMethods.length > 0) {
        setWithdrawMethod(paymentMethods[0].id);
        const defaultMethod = paymentMethods[0].id;
        if (['card', 'elsom', 'odengi', 'mbank'].includes(defaultMethod)) {
          setRequisiteMethod(defaultMethod as FreelancerPaymentDetails['method']);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('finance.freelancer.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadFinance();
  }, [loadFinance]);

  useEffect(() => {
    const payout = user?.freelancerProfile?.paymentDetails;
    if (!payout) return;

    setSavedRequisites(payout);
    setRequisiteMethod(payout.method);
    setRequisiteValue(payout.value);
    if (!withdrawDetails) {
      if (['card', 'elsom', 'odengi', 'mbank', 'balance'].includes(payout.method)) {
        setWithdrawMethod(payout.method as PaymentMethodId);
      }
      setWithdrawDetails(payout.value);
    }
  }, [user?.freelancerProfile?.paymentDetails, withdrawDetails]);

  const handleWithdraw = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setWithdrawError(null);
    setWithdrawMessage(null);

    const amount = Number(withdrawAmount);
    if (Number.isNaN(amount) || amount < 1000) {
      setWithdrawError(t('finance.freelancer.withdrawMin'));
      return;
    }

    const resolvedDetails =
      withdrawDetails.trim() ||
      (savedRequisites && savedRequisites.method === withdrawMethod ? savedRequisites.value.trim() : '');

    if (!resolvedDetails) {
      setWithdrawError(t('finance.freelancer.withdrawDetailsRequired'));
      return;
    }

    try {
      setIsWithdrawing(true);
      const result = await api.requestWithdrawal({ amount, method: withdrawMethod, details: resolvedDetails });
      setWithdrawMessage(result.message);
      setWithdrawAmount('');
      setWithdrawDetails(savedRequisites && savedRequisites.method === withdrawMethod ? savedRequisites.value : '');
      await loadFinance();
    } catch (err) {
      setWithdrawError(err instanceof Error ? err.message : t('finance.freelancer.withdrawCreateFailed'));
    } finally {
      setIsWithdrawing(false);
    }
  };

  const handleSaveRequisites = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRequisiteError(null);
    setRequisiteMessage(null);

    if (!requisiteValue.trim()) {
      setRequisiteError(t('finance.freelancer.withdrawDetailsRequired'));
      return;
    }

    try {
      setIsSavingRequisites(true);
      await api.updateFreelancerProfile({
        paymentDetails: {
          method: requisiteMethod,
          value: requisiteValue.trim(),
        },
      });
      await refreshUser().catch(() => null);
      setSavedRequisites({
        method: requisiteMethod,
        value: requisiteValue.trim(),
      });
      if (['card', 'elsom', 'odengi', 'mbank', 'balance'].includes(requisiteMethod)) {
        setWithdrawMethod(requisiteMethod as PaymentMethodId);
      }
      setWithdrawDetails(requisiteValue.trim());
      setRequisiteMessage(t('finance.freelancer.requisitesSaved', { defaultValue: 'Payment details saved' }));
    } catch (err) {
      setRequisiteError(err instanceof Error ? err.message : t('finance.freelancer.requisitesSaveFailed', { defaultValue: 'Failed to save payment details' }));
    } finally {
      setIsSavingRequisites(false);
    }
  };

  const columns = useMemo<Array<DataTableColumn<PaymentTransaction>>>(
    () => [
      {
        key: 'date',
        header: t('common.date'),
        render: (tx) => <span>{formatDate(tx.createdAt, i18n.language)}</span>,
      },
      {
        key: 'type',
        header: t('common.type'),
        render: (tx) => <span className="font-medium text-[var(--color-text)]">{tx.type}</span>,
      },
      {
        key: 'amount',
        header: t('common.amount'),
        render: (tx) => <span>{formatMoneyKGS(tx.amount, i18n.language)}</span>,
      },
      {
        key: 'status',
        header: t('common.status'),
        render: (tx) => <Badge variant={tx.status === 'COMPLETED' ? 'success' : 'warning'}>{tx.status}</Badge>,
      },
      {
        key: 'order',
        header: t('common.orders'),
        render: (tx) => <span className="text-xs text-[var(--color-text-soft)]">{tx.order?.title || '-'}</span>,
      },
    ],
    [i18n.language, t]
  );

  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'FREELANCER') return <Navigate to="/dashboard/client/finance" replace />;

  return (
    <DashboardShell
      isDark={isDark}
      sidebarTitle={user.name || t('dashboard.freelancer.title')}
      sidebarSubtitle={t('topbar.workspace')}
      sidebarItems={getFreelancerSidebarItems()}
      onLogout={logout}
    >
      <PageHeader
        title={t('finance.freelancer.title')}
        subtitle={t('finance.freelancer.subtitle')}
        badges={
          <>
            <Badge variant="success">{t('finance.freelancer.badgePayout')}</Badge>
            <Badge variant="info">{t('finance.freelancer.badgeCenter')}</Badge>
          </>
        }
      />

      {error ? (
        <div className="rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--color-danger)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_12%,transparent)] px-4 py-3 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Wallet} label={t('common.available')} value={formatMoneyKGS(balance?.available || 0, i18n.language)} tone="success" />
        <StatCard icon={Landmark} label={t('common.pending')} value={formatMoneyKGS(stats?.pendingAmount || 0, i18n.language)} tone="warning" />
        <StatCard icon={ShieldCheck} label={t('common.inEscrow')} value={formatMoneyKGS(balance?.inEscrow || 0, i18n.language)} tone="primary" />
        <StatCard icon={Wallet} label={t('common.earned')} value={formatMoneyKGS(stats?.totalEarnings || 0, i18n.language)} tone="info" />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-8">
          <section className="surface p-5 sm:p-6">
            <h2 className="mb-4 section-title">{t('finance.freelancer.history')}</h2>
            {isLoading ? (
              <div className="surface-muted p-4 text-sm text-[var(--color-text-muted)]">{t('finance.freelancer.loadingTransactions')}</div>
            ) : (
              <DataTable
                columns={columns}
                data={transactions}
                rowKey={(row) => row.id}
                emptyTitle={t('finance.freelancer.emptyTitle')}
                emptyDescription={t('finance.freelancer.emptyDescription')}
              />
            )}
          </section>

          <section className="surface p-5 sm:p-6">
            <h2 className="mb-2 section-title">
              {t('finance.freelancer.myRequisites', { defaultValue: 'Мои реквизиты' })}
            </h2>
            <p className="mb-4 text-sm text-[var(--color-text-muted)]">
              {t('finance.freelancer.myRequisitesHint', { defaultValue: 'Saved details are used by default when you request withdrawal.' })}
            </p>

            <form onSubmit={handleSaveRequisites} className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <select
                value={requisiteMethod}
                onChange={(event) => setRequisiteMethod(event.target.value as FreelancerPaymentDetails['method'])}
                className={inputClassName()}
              >
                {(methods.length > 0 ? methods : [{ id: 'mbank', name: 'MBank' } as PaymentMethod]).map((method) => (
                  <option key={method.id} value={method.id}>
                    {method.name}
                  </option>
                ))}
              </select>

              <input
                value={requisiteValue}
                onChange={(event) => setRequisiteValue(event.target.value)}
                placeholder={t('finance.freelancer.withdrawDetails')}
                className={inputClassName()}
              />

              <button
                type="submit"
                disabled={isSavingRequisites}
                className="inline-flex h-10 items-center justify-center rounded-[var(--radius-control)] bg-[var(--color-primary)] px-4 text-sm font-semibold text-white disabled:opacity-60"
              >
                {isSavingRequisites ? t('common.loading') : t('common.save')}
              </button>
            </form>

            {savedRequisites ? (
              <p className="mt-3 text-xs text-[var(--color-text-soft)]">
                {t('finance.freelancer.savedAs', { defaultValue: 'Saved' })}:{' '}
                <span className="font-semibold text-[var(--color-text)]">
                  {savedRequisites.method} - {maskPaymentValue(savedRequisites.method, savedRequisites.value)}
                </span>
              </p>
            ) : null}

            {requisiteError ? (
              <p className="mt-3 rounded-[10px] border border-[color-mix(in_srgb,var(--color-danger)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_12%,transparent)] px-3 py-2 text-xs text-[var(--color-danger)]">
                {requisiteError}
              </p>
            ) : null}

            {requisiteMessage ? (
              <p className="mt-3 rounded-[10px] border border-[color-mix(in_srgb,var(--color-success)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-success)_12%,transparent)] px-3 py-2 text-xs text-[var(--color-success)]">
                {requisiteMessage}
              </p>
            ) : null}
          </section>
        </div>

        <aside className="space-y-6 xl:col-span-4">
          <section className="surface p-5 sm:p-6">
            <h2 className="mb-3 section-title">{t('finance.freelancer.withdrawTitle')}</h2>

            <form onSubmit={handleWithdraw} className="space-y-3">
              <input
                type="number"
                min={1000}
                value={withdrawAmount}
                onChange={(event) => setWithdrawAmount(event.target.value)}
                placeholder={t('finance.freelancer.withdrawAmount')}
                className={inputClassName()}
              />

              <select
                value={withdrawMethod}
                onChange={(event) => {
                  const nextMethod = event.target.value as PaymentMethodId;
                  setWithdrawMethod(nextMethod);
                  if (savedRequisites && savedRequisites.method === nextMethod) {
                    setWithdrawDetails(savedRequisites.value);
                  }
                }}
                className={inputClassName()}
              >
                {(methods.length > 0 ? methods : [{ id: 'mbank', name: 'MBank', fee: 1 } as PaymentMethod]).map((method) => (
                  <option key={method.id} value={method.id}>
                    {method.name}
                  </option>
                ))}
              </select>

              <input
                value={withdrawDetails}
                onChange={(event) => setWithdrawDetails(event.target.value)}
                placeholder={t('finance.freelancer.withdrawDetails')}
                className={inputClassName()}
              />

              <button
                type="submit"
                disabled={isWithdrawing}
                className="inline-flex h-10 w-full items-center justify-center rounded-[var(--radius-control)] bg-[var(--color-success)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[color-mix(in_srgb,var(--color-success)_85%,black_15%)] disabled:opacity-60"
              >
                {isWithdrawing ? t('finance.freelancer.withdrawing') : t('finance.freelancer.requestWithdraw')}
              </button>
            </form>

            {withdrawError ? (
              <p className="mt-3 rounded-[10px] border border-[color-mix(in_srgb,var(--color-danger)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_12%,transparent)] px-3 py-2 text-xs text-[var(--color-danger)]">
                {withdrawError}
              </p>
            ) : null}

            {withdrawMessage ? (
              <p className="mt-3 rounded-[10px] border border-[color-mix(in_srgb,var(--color-success)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-success)_12%,transparent)] px-3 py-2 text-xs text-[var(--color-success)]">
                {withdrawMessage}
              </p>
            ) : null}
          </section>

          <section className="surface p-5 sm:p-6">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-text-soft)]">{t('finance.freelancer.modelTitle')}</h3>
            <div className="mt-3 space-y-2">
              <div className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-xs text-[var(--color-text-muted)]">
                {t('finance.freelancer.modelStep1')}
              </div>
              <div className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-xs text-[var(--color-text-muted)]">
                {t('finance.freelancer.modelStep2')}
              </div>
              <div className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-xs text-[var(--color-text-muted)]">
                {t('finance.freelancer.modelStep3')}
              </div>
            </div>
          </section>
        </aside>
      </section>
    </DashboardShell>
  );
}

function inputClassName() {
  return 'h-10 w-full rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 text-sm text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-ring)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-ring)_32%,transparent)]';
}
