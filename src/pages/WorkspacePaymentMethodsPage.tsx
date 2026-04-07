import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { CreditCard, Landmark, ShieldCheck, Trash2, WalletCards } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import api, { CreateSavedPaymentMethodPayload, PaymentMethod, SavedPaymentMethod, WorkspacePaymentMethodType } from '@/services/api';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { getClientSidebarItems, getFreelancerSidebarItems } from '@/components/dashboard/dashboardNav';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { MetricTrendCard } from '@/components/dashboard/WorkspaceInsights';
import { useTranslation } from 'react-i18next';
import { WORKSPACE_PATH } from '@/utils/routes';

interface MethodFormState {
  type: WorkspacePaymentMethodType;
  title: string;
  holderName: string;
  brand: string;
  provider: string;
  cardNumber: string;
  accountNumber: string;
  expiryMonth: string;
  expiryYear: string;
  isDefault: boolean;
}

const DEFAULT_FORM: MethodFormState = {
  type: 'card',
  title: '',
  holderName: '',
  brand: '',
  provider: '',
  cardNumber: '',
  accountNumber: '',
  expiryMonth: '',
  expiryYear: '',
  isDefault: true,
};

function methodTypeIcon(type: WorkspacePaymentMethodType) {
  if (type === 'wallet') return <WalletCards className="h-4 w-4" />;
  if (type === 'bank') return <Landmark className="h-4 w-4" />;
  return <CreditCard className="h-4 w-4" />;
}

export function WorkspacePaymentMethodsPage() {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const { user, logout } = useAuth();
  const [savedMethods, setSavedMethods] = useState<SavedPaymentMethod[]>([]);
  const [platformMethods, setPlatformMethods] = useState<PaymentMethod[]>([]);
  const [form, setForm] = useState<MethodFormState>(DEFAULT_FORM);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [busyMethodId, setBusyMethodId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isClient = user?.role === 'CLIENT';
  const isFreelancer = user?.role === 'FREELANCER';

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [saved, available] = await Promise.all([
        api.getSavedPaymentMethods(),
        api.getPaymentMethods(),
      ]);

      setSavedMethods(saved);
      setPlatformMethods(available.filter((item) => item.enabled));
      setForm((prev) => ({
        ...prev,
        isDefault: saved.length === 0,
      }));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('billing.loadFailed', { defaultValue: 'Failed to load payment methods' })
      );
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const roleTitle = isClient
    ? t('billing.client.title', { defaultValue: 'Cards and wallets' })
    : t('billing.freelancer.title', { defaultValue: 'Payout methods' });

  const roleSubtitle = isClient
    ? t('billing.client.subtitle', { defaultValue: 'Store cards and wallets for faster checkout during escrow payments.' })
    : t('billing.freelancer.subtitle', { defaultValue: 'Save payout methods for withdrawals and completed orders.' });

  const sidebarItems = useMemo(() => {
    if (!user) return [];
    return isFreelancer ? getFreelancerSidebarItems() : getClientSidebarItems();
  }, [isFreelancer, user]);

  const submitLabel =
    form.type === 'card'
      ? t('billing.addCard', { defaultValue: 'Add card' })
      : form.type === 'wallet'
        ? t('billing.addWallet', { defaultValue: 'Add wallet' })
        : t('billing.addBank', { defaultValue: 'Add bank account' });

  const availableProviders = platformMethods.map((item) => item.name);
  const defaultMethod = savedMethods.find((item) => item.isDefault);
  const cardsCount = savedMethods.filter((item) => item.type === 'card').length;
  const payoutRailsCount = savedMethods.filter((item) => item.type !== 'card').length;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const payload: CreateSavedPaymentMethodPayload = {
        type: form.type,
        title: form.title.trim() || undefined,
        holderName: form.holderName.trim() || undefined,
        brand: form.brand.trim() || undefined,
        provider: form.provider.trim() || undefined,
        cardNumber: form.cardNumber.trim() || undefined,
        accountNumber: form.accountNumber.trim() || undefined,
        expiryMonth: form.expiryMonth ? Number(form.expiryMonth) : undefined,
        expiryYear: form.expiryYear ? Number(form.expiryYear) : undefined,
        isDefault: form.isDefault,
      };

      const created = await api.createSavedPaymentMethod(payload);
      setSavedMethods((prev) => {
        const next = form.isDefault ? prev.map((item) => ({ ...item, isDefault: false })) : prev;
        return [created, ...next];
      });
      setForm({
        ...DEFAULT_FORM,
        type: form.type,
        isDefault: false,
      });
      setSuccess(
        form.type === 'card'
          ? t('billing.cardSaved', { defaultValue: 'Card saved' })
          : t('billing.methodSaved', { defaultValue: 'Payment method saved' })
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('billing.saveFailed', { defaultValue: 'Failed to save payment method' })
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (methodId: string) => {
    setBusyMethodId(methodId);
    setError(null);
    try {
      await api.deleteSavedPaymentMethod(methodId);
      setSavedMethods((prev) => prev.filter((item) => item.id !== methodId));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('billing.deleteFailed', { defaultValue: 'Failed to remove payment method' })
      );
    } finally {
      setBusyMethodId(null);
    }
  };

  const handleSetDefault = async (methodId: string) => {
    setBusyMethodId(methodId);
    setError(null);
    try {
      const updated = await api.setDefaultSavedPaymentMethod(methodId);
      setSavedMethods((prev) =>
        prev.map((item) => ({
          ...item,
          isDefault: item.id === updated.id,
        }))
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('billing.defaultFailed', { defaultValue: 'Failed to set default method' })
      );
    } finally {
      setBusyMethodId(null);
    }
  };

  if (!user) return <Navigate to="/login" replace />;
  if (!isClient && !isFreelancer) return <Navigate to={WORKSPACE_PATH} replace />;

  return (
    <DashboardShell
      isDark={isDark}
      sidebarTitle={user.name || t('topbar.user')}
      sidebarSubtitle={t('topbar.workspace')}
      sidebarItems={sidebarItems}
      onLogout={logout}
    >
      <PageHeader
        title={roleTitle}
        subtitle={roleSubtitle}
        badges={
          <>
            <Badge variant="info">
              {t('billing.savedCount', { defaultValue: 'Saved' })}: {savedMethods.length}
            </Badge>
            <Badge variant="success">
              {t('billing.providers', { defaultValue: 'Providers' })}: {platformMethods.length}
            </Badge>
          </>
        }
      />

      {error ? (
        <div className="mb-6 rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--color-danger)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_12%,transparent)] px-4 py-3 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="mb-6 rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--color-success)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-success)_12%,transparent)] px-4 py-3 text-sm text-[var(--color-success)]">
          {success}
        </div>
      ) : null}

      <section className="surface-glow mb-6 p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-soft)]">
              {t('billing.heroKicker', { defaultValue: 'Settlement and funding layer' })}
            </p>
            <h2 className="mt-2 font-[var(--font-family-display)] text-[clamp(1.55rem,2.7vw,2.1rem)] font-semibold leading-[1.05] tracking-[-0.04em] text-[var(--color-text)]">
              {t('billing.heroTitle', { defaultValue: 'Turn payment methods into a polished billing surface with visible operational readiness.' })}
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-[var(--color-text-muted)]">
              {t('billing.heroText', { defaultValue: 'Cards, wallets and bank rails now read like a real funding and payout setup instead of a simple form.' })}
            </p>
          </div>

          <div className="grid w-full max-w-md grid-cols-2 gap-3">
            <div className="rounded-[18px] border border-[color-mix(in_srgb,var(--color-primary)_24%,transparent)] bg-[color-mix(in_srgb,var(--color-primary)_10%,transparent)] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-soft)]">{t('billing.default', { defaultValue: 'Default rail' })}</p>
              <p className="mt-2 text-lg font-semibold text-[var(--color-text)]">{defaultMethod?.provider || defaultMethod?.type || 'Pending'}</p>
            </div>
            <div className="rounded-[18px] border border-[color-mix(in_srgb,var(--color-success)_24%,transparent)] bg-[color-mix(in_srgb,var(--color-success)_10%,transparent)] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-soft)]">{t('billing.providers', { defaultValue: 'Providers' })}</p>
              <p className="mt-2 text-lg font-semibold text-[var(--color-text)]">{platformMethods.length}</p>
            </div>
            <div className="rounded-[18px] border border-[color-mix(in_srgb,var(--color-info)_24%,transparent)] bg-[color-mix(in_srgb,var(--color-info)_10%,transparent)] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-soft)]">{t('billing.addCard', { defaultValue: 'Cards' })}</p>
              <p className="mt-2 text-lg font-semibold text-[var(--color-text)]">{cardsCount}</p>
            </div>
            <div className="rounded-[18px] border border-[color-mix(in_srgb,var(--color-warning)_24%,transparent)] bg-[color-mix(in_srgb,var(--color-warning)_10%,transparent)] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-soft)]">{t('billing.addBank', { defaultValue: 'Wallets and banks' })}</p>
              <p className="mt-2 text-lg font-semibold text-[var(--color-text)]">{payoutRailsCount}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricTrendCard
          label={t('billing.savedCount', { defaultValue: 'Saved methods' })}
          value={String(savedMethods.length)}
          icon={WalletCards}
          trend={[0, 1, 2, 2, 3, savedMethods.length]}
        />
        <MetricTrendCard
          label={t('billing.default', { defaultValue: 'Default rail' })}
          value={defaultMethod?.type || t('billing.none', { defaultValue: 'None' })}
          icon={ShieldCheck}
          tone="success"
          trend={[1, 1, 1, 2, 2, defaultMethod ? 3 : 1]}
        />
        <MetricTrendCard
          label={t('billing.providers', { defaultValue: 'Providers' })}
          value={String(platformMethods.length)}
          icon={CreditCard}
          tone="info"
          trend={[1, 2, 2, 3, 3, platformMethods.length]}
        />
        <MetricTrendCard
          label={t('billing.addBank', { defaultValue: 'Payout rails' })}
          value={`${cardsCount}/${payoutRailsCount}`}
          icon={Landmark}
          tone="warning"
          trend={[1, 1, 2, 2, payoutRailsCount, cardsCount + payoutRailsCount]}
        />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-8">
          <section className="surface p-5 sm:p-6">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {availableProviders.length > 0 ? availableProviders.map((provider) => (
                <Badge key={provider} variant="default">{provider}</Badge>
              )) : <Badge variant="default">{t('billing.localProviders', { defaultValue: 'Local providers ready' })}</Badge>}
            </div>

            {isLoading ? (
              <div className="grid gap-3 md:grid-cols-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="surface-muted p-4">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="mt-3 h-4 w-40" />
                    <Skeleton className="mt-2 h-4 w-24" />
                  </div>
                ))}
              </div>
            ) : savedMethods.length === 0 ? (
              <EmptyState
                title={t('billing.emptyTitle', { defaultValue: 'No saved payment methods yet' })}
                description={t('billing.emptyDescription', { defaultValue: 'Add a card, wallet or bank account so the demo looks like a real production workspace.' })}
                icon={<WalletCards className="h-5 w-5" />}
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {savedMethods.map((item) => (
                  <article key={item.id} className="surface-muted p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="inline-flex h-10 w-10 items-center justify-center rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-primary)]">
                        {methodTypeIcon(item.type)}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {item.isDefault ? <Badge variant="success">{t('billing.default', { defaultValue: 'Default' })}</Badge> : null}
                        <Badge variant="default">{item.status}</Badge>
                      </div>
                    </div>

                    <div className="mt-4 space-y-1">
                      <p className="font-semibold text-[var(--color-text)]">{item.title}</p>
                      <p className="text-sm text-[var(--color-text-muted)]">{item.maskedValue}</p>
                      <p className="text-xs text-[var(--color-text-soft)]">
                        {[item.provider, item.holderName].filter(Boolean).join(' • ')}
                      </p>
                      {item.expiryMonth && item.expiryYear ? (
                        <p className="text-xs text-[var(--color-text-soft)]">
                          {t('billing.expires', { defaultValue: 'Expires' })}: {String(item.expiryMonth).padStart(2, '0')}/{item.expiryYear}
                        </p>
                      ) : null}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={item.isDefault || busyMethodId === item.id}
                        onClick={() => void handleSetDefault(item.id)}
                        leftIcon={<ShieldCheck className="h-4 w-4" />}
                      >
                        {t('billing.makeDefault', { defaultValue: 'Make default' })}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={busyMethodId === item.id}
                        onClick={() => void handleDelete(item.id)}
                        leftIcon={<Trash2 className="h-4 w-4" />}
                      >
                        {t('common.delete', { defaultValue: 'Delete' })}
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="surface p-5 sm:p-6">
            <h2 className="mb-3 text-lg font-semibold text-[var(--color-text)]">
              {t('billing.quickAccess', { defaultValue: 'Workspace shortcuts' })}
            </h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <Link to={isClient ? '/dashboard/client/finance' : '/dashboard/freelancer/finance'} className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3 text-sm font-medium text-[var(--color-text)]">
                {t('sidebar.items.finance', { defaultValue: 'Finance' })}
              </Link>
              <Link to={isClient ? '/dashboard/client/documents' : '/dashboard/freelancer/documents'} className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3 text-sm font-medium text-[var(--color-text)]">
                {t('sidebar.items.documents', { defaultValue: 'Documents' })}
              </Link>
              <Link to={isClient ? '/dashboard/client/support' : '/dashboard/freelancer/support'} className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3 text-sm font-medium text-[var(--color-text)]">
                {t('billing.support', { defaultValue: 'Support' })}
              </Link>
            </div>
          </section>
        </div>

        <aside className="space-y-6 xl:col-span-4">
          <section className="surface p-5 sm:p-6">
            <h2 className="mb-4 text-lg font-semibold text-[var(--color-text)]">
              {submitLabel}
            </h2>

            <div className="mb-4 flex gap-2">
              {([
                ['card', t('billing.type.card', { defaultValue: 'Card' })],
                ['wallet', t('billing.type.wallet', { defaultValue: 'Wallet' })],
                ['bank', t('billing.type.bank', { defaultValue: 'Bank' })],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, type: value }))}
                  className={
                    form.type === value
                      ? 'inline-flex h-10 items-center rounded-[10px] border border-[color-mix(in_srgb,var(--color-primary)_44%,transparent)] bg-[color-mix(in_srgb,var(--color-primary)_10%,transparent)] px-3 text-sm font-semibold text-[var(--color-primary)]'
                      : 'inline-flex h-10 items-center rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm font-medium text-[var(--color-text-muted)]'
                  }
                >
                  {label}
                </button>
              ))}
            </div>

            <form className="space-y-3" onSubmit={handleSubmit}>
              <Input
                label={t('billing.titleField', { defaultValue: 'Internal label' })}
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder={t('billing.titlePlaceholder', { defaultValue: 'Main corporate card' })}
              />
              <Input
                label={t('billing.holder', { defaultValue: 'Holder name' })}
                value={form.holderName}
                onChange={(event) => setForm((prev) => ({ ...prev, holderName: event.target.value }))}
                placeholder={t('billing.holderPlaceholder', { defaultValue: 'Aibek Osmonov' })}
              />

              {form.type === 'card' ? (
                <>
                  <Input
                    label={t('billing.cardNumber', { defaultValue: 'Card number' })}
                    value={form.cardNumber}
                    onChange={(event) => setForm((prev) => ({ ...prev, cardNumber: event.target.value }))}
                    placeholder="4400 1234 5678 9010"
                  />
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Input
                      label={t('billing.brand', { defaultValue: 'Brand' })}
                      value={form.brand}
                      onChange={(event) => setForm((prev) => ({ ...prev, brand: event.target.value }))}
                      placeholder="Visa"
                    />
                    <Input
                      label="MM"
                      value={form.expiryMonth}
                      onChange={(event) => setForm((prev) => ({ ...prev, expiryMonth: event.target.value }))}
                      placeholder="09"
                    />
                    <Input
                      label="YYYY"
                      value={form.expiryYear}
                      onChange={(event) => setForm((prev) => ({ ...prev, expiryYear: event.target.value }))}
                      placeholder="2028"
                    />
                  </div>
                </>
              ) : (
                <>
                  <Input
                    label={t('billing.providerField', { defaultValue: 'Provider' })}
                    value={form.provider}
                    onChange={(event) => setForm((prev) => ({ ...prev, provider: event.target.value }))}
                    placeholder={form.type === 'wallet' ? 'MBank / O!Money / Elsom' : 'DemirBank / Optima / KICB'}
                  />
                  <Input
                    label={t('billing.accountNumber', { defaultValue: 'Account / wallet number' })}
                    value={form.accountNumber}
                    onChange={(event) => setForm((prev) => ({ ...prev, accountNumber: event.target.value }))}
                    placeholder={form.type === 'wallet' ? '+996 700 00 00 00' : '1250 9876 5432 1000'}
                  />
                </>
              )}

              <label className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={(event) => setForm((prev) => ({ ...prev, isDefault: event.target.checked }))}
                />
                {t('billing.setDefault', { defaultValue: 'Set as default' })}
              </label>

              <Button type="submit" isLoading={isSaving} className="w-full">
                {submitLabel}
              </Button>
            </form>
          </section>

          <section className="surface p-5 sm:p-6">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.08em] text-[var(--color-text-soft)]">
              {t('billing.trustBlock', { defaultValue: 'Checkout profile' })}
            </h3>
            <div className="space-y-2 text-sm text-[var(--color-text-muted)]">
              <p>{t('billing.trustLine1', { defaultValue: 'Saved methods are masked and shown only as demo-ready payment profiles.' })}</p>
              <p>{t('billing.trustLine2', { defaultValue: 'Use this page during the local presentation to show cards, wallets and bank payouts.' })}</p>
              <div className="flex flex-wrap gap-2 pt-2">
                <Badge variant="success">Visa</Badge>
                <Badge variant="default">Mastercard</Badge>
                <Badge variant="default">MBank</Badge>
                <Badge variant="default">O!Money</Badge>
                <Badge variant="default">Elsom</Badge>
              </div>
            </div>
          </section>
        </aside>
      </section>
    </DashboardShell>
  );
}
