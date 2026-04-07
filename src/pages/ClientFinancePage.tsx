import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { CreditCard, ShieldCheck, Wallet } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import api, { PaymentMethod, PaymentTransaction, SavedPaymentMethod } from '@/services/api';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { getClientSidebarItems } from '@/components/dashboard/dashboardNav';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { useTranslation } from 'react-i18next';
import { formatDate, formatMoneyKGS } from '@/utils/locale';

export function ClientFinancePage() {
  const { t, i18n } = useTranslation();
  const { isDark } = useTheme();
  const { user, logout } = useAuth();

  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [savedMethods, setSavedMethods] = useState<SavedPaymentMethod[]>([]);
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [stats, setStats] = useState<{ activeOrders: number; completedOrders: number; totalSpent: number; inEscrow: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [topUpAmount, setTopUpAmount] = useState('5000');
  const [topUpMethod, setTopUpMethod] = useState<PaymentMethod['id']>('card');
  const [topUpMessage, setTopUpMessage] = useState<string | null>(null);

  const loadFinance = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [paymentMethods, savedWorkspaceMethods, transactionResult, clientStats] = await Promise.all([
        api.getPaymentMethods(),
        api.getSavedPaymentMethods(),
        api.getTransactions({ limit: 20 }),
        api.getClientPaymentStats(),
      ]);

      setMethods(paymentMethods.filter((method) => method.enabled));
      setSavedMethods(savedWorkspaceMethods);
      setTransactions(transactionResult.data);
      setStats(clientStats);
      if (paymentMethods[0]) {
        setTopUpMethod(paymentMethods[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('finance.client.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadFinance();
  }, [loadFinance]);

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

  const handleTopUp = () => {
    const amount = Number(topUpAmount);
    if (Number.isNaN(amount) || amount < 500) {
      setTopUpMessage(t('finance.client.topUpMin'));
      return;
    }

    const selectedMethod = methods.find((method) => method.id === topUpMethod);

    // TODO: replace with API endpoint for wallet top-up
    setTopUpMessage(
      t('finance.client.topUpRequested', {
        amount: formatMoneyKGS(amount, i18n.language),
        method: selectedMethod?.name || topUpMethod,
      })
    );
  };

  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'CLIENT') return <Navigate to="/dashboard/freelancer/finance" replace />;

  return (
    <DashboardShell
      isDark={isDark}
      sidebarTitle={user.name || t('orders.create.clientFallback')}
      sidebarSubtitle={t('topbar.workspace')}
      sidebarItems={getClientSidebarItems()}
      onLogout={logout}
    >
      <PageHeader
        title={t('finance.client.title')}
        subtitle={t('finance.client.subtitle')}
        badges={
          <>
            <Badge variant="success">{t('finance.client.badgeEscrow')}</Badge>
            <Badge variant="info">{t('finance.client.badgeFinance')}</Badge>
          </>
        }
      />

      {error ? (
        <div className="rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--color-danger)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_12%,transparent)] px-4 py-3 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Wallet} label={t('common.spent')} value={formatMoneyKGS(stats?.totalSpent || 0, i18n.language)} tone="warning" />
        <StatCard icon={ShieldCheck} label={t('common.inEscrow')} value={formatMoneyKGS(stats?.inEscrow || 0, i18n.language)} tone="primary" />
        <StatCard icon={CreditCard} label={t('finance.client.activeDeals')} value={`${stats?.activeOrders || 0}`} tone="info" />
        <StatCard icon={CreditCard} label={t('finance.client.closedDeals')} value={`${stats?.completedOrders || 0}`} tone="success" />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-8">
          <section className="surface p-5 sm:p-6">
            <h2 className="mb-4 section-title">{t('finance.client.history')}</h2>
            {isLoading ? (
              <div className="surface-muted p-4 text-sm text-[var(--color-text-muted)]">{t('finance.client.loadingTransactions')}</div>
            ) : (
              <DataTable
                columns={columns}
                data={transactions}
                rowKey={(row) => row.id}
                emptyTitle={t('finance.client.emptyTitle')}
                emptyDescription={t('finance.client.emptyDescription')}
              />
            )}
          </section>

          <section className="surface p-5 sm:p-6">
            <h2 className="mb-4 section-title">{t('finance.client.escrowLifecycle')}</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4 text-sm text-[var(--color-text-muted)]">
                {t('finance.client.lifecycleStep1')}
              </div>
              <div className="rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4 text-sm text-[var(--color-text-muted)]">
                {t('finance.client.lifecycleStep2')}
              </div>
              <div className="rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4 text-sm text-[var(--color-text-muted)]">
                {t('finance.client.lifecycleStep3')}
              </div>
            </div>
          </section>
        </div>

        <aside className="space-y-6 xl:col-span-4">
          <section className="surface p-5 sm:p-6">
            <h2 className="mb-3 section-title">{t('finance.client.topUpTitle')}</h2>
            <div className="space-y-3">
              <input
                type="number"
                min={500}
                value={topUpAmount}
                onChange={(event) => setTopUpAmount(event.target.value)}
                placeholder={t('finance.client.topUpAmount')}
                className={inputClassName()}
              />

              <select
                value={topUpMethod}
                onChange={(event) => setTopUpMethod(event.target.value as PaymentMethod['id'])}
                className={inputClassName()}
              >
                {(methods.length > 0 ? methods : [{ id: 'card', name: t('finance.client.cardFallback') } as PaymentMethod]).map((method) => (
                  <option key={method.id} value={method.id}>
                    {method.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleTopUp}
                className="inline-flex h-10 w-full items-center justify-center rounded-[var(--radius-control)] bg-[var(--color-primary)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-hover)]"
              >
                {t('finance.client.topUpAction')}
              </button>

              {topUpMessage ? (
                <p className="rounded-[10px] border border-[color-mix(in_srgb,var(--color-info)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-info)_12%,transparent)] px-3 py-2 text-xs text-[var(--color-info)]">
                  {topUpMessage}
                </p>
              ) : null}
            </div>
          </section>

          <section className="surface p-5 sm:p-6">
            <h2 className="mb-3 section-title">{t('finance.client.savedMethodsTitle', { defaultValue: 'Saved cards and wallets' })}</h2>
            <div className="space-y-3">
              <p className="text-sm text-[var(--color-text-muted)]">
                {t('finance.client.savedMethodsHint', {
                  defaultValue: 'This block is connected to the real workspace billing page, so you can prepare demo cards and wallets before the presentation.',
                })}
              </p>

              {savedMethods.length > 0 ? (
                <div className="space-y-2">
                  {savedMethods.slice(0, 3).map((method) => (
                    <div
                      key={method.id}
                      className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-[var(--color-text)]">{method.title}</p>
                          <p className="text-xs text-[var(--color-text-soft)]">{method.maskedValue}</p>
                        </div>
                        {method.isDefault ? <Badge variant="success">{t('finance.client.defaultMethod', { defaultValue: 'Default' })}</Badge> : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-[10px] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-3 text-sm text-[var(--color-text-muted)]">
                  {t('finance.client.savedMethodsEmpty', { defaultValue: 'No saved billing methods yet. Add cards and wallets from the billing page.' })}
                </div>
              )}

              <Link
                to="/dashboard/client/billing"
                className="inline-flex h-10 items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-sm font-semibold text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-2)]"
              >
                {t('finance.client.manageMethods', { defaultValue: 'Open billing center' })}
              </Link>
            </div>
          </section>

          <section className="surface p-5 sm:p-6">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-text-soft)]">{t('dashboard.client.quickActions')}</h3>
            <div className="mt-3 space-y-2">
              <Link
                to="/orders/new"
                className="block rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm font-medium text-[var(--color-text)]"
              >
                {t('dashboard.client.newOrder')}
              </Link>
              <Link
                to="/dashboard/client/orders"
                className="block rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm font-medium text-[var(--color-text)]"
              >
                {t('dashboard.client.allOrders')}
              </Link>
              <Link
                to="/dashboard/client/billing"
                className="block rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm font-medium text-[var(--color-text)]"
              >
                {t('finance.client.openBilling', { defaultValue: 'Cards and wallets' })}
              </Link>
              <Link
                to="/dashboard/client/support"
                className="block rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm font-medium text-[var(--color-text)]"
              >
                {t('finance.client.openSupport', { defaultValue: 'Support center' })}
              </Link>
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
