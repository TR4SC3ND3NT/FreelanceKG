import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  CheckCircle,
  CreditCard,
  DollarSign,
  FileText,
  Loader2,
  Lock,
  Shield,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { CATEGORIES } from '../data/mockData';
import api, { ApiError, PaymentMethod, PaymentMethodId } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { DashboardShell } from '../components/dashboard/DashboardShell';
import { getClientSidebarItems } from '../components/dashboard/dashboardNav';
import { PageHeader } from '../components/ui/PageHeader';
import { Badge } from '../components/ui/Badge';
import { StepSection } from '../components/ui/StepSection';
import { Button } from '../components/ui/Button';
import { useTranslation } from 'react-i18next';
import { formatDate, formatMoneyKGS } from '../utils/locale';
import { WORKSPACE_PATH } from '@/utils/routes';

type Step = 1 | 2 | 3;
type FieldErrorMap = Partial<Record<'title' | 'category' | 'description' | 'deadline' | 'budget', string>>;

function isValidationPayload(payload: unknown): payload is {
  details: Array<{ field?: string; message?: string }>;
} {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'details' in payload &&
    Array.isArray((payload as { details?: unknown }).details)
  );
}

function getTomorrowIsoDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().split('T')[0];
}

function createEscrowIdempotencyKey(orderId: string): string {
  const suffix =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `escrow:${orderId}:${suffix}`.slice(0, 128);
}

export function CreateOrderPage() {
  const { t, i18n } = useTranslation();
  const { isDark } = useTheme();
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingPaymentMethods, setIsLoadingPaymentMethods] = useState(true);
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);
  const [escrowTransactionId, setEscrowTransactionId] = useState<string | null>(null);
  const [escrowCheckoutUrl, setEscrowCheckoutUrl] = useState<string | null>(null);
  const [escrowRequiresAction, setEscrowRequiresAction] = useState(false);
  const [selectedFreelancerName, setSelectedFreelancerName] = useState<string | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);

  const [formData, setFormData] = useState({
    title: '',
    category: '',
    description: '',
    deadline: '',
    budget: '',
    paymentMethod: 'card' as PaymentMethodId,
    escrowAgreed: false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const selectedFreelancerId = useMemo(() => {
    const value = searchParams.get('freelancerId');
    if (!value) return '';

    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
      ? value
      : '';
  }, [searchParams]);

  const selectedPaymentMethod = useMemo(
    () => paymentMethods.find((method) => method.id === formData.paymentMethod),
    [formData.paymentMethod, paymentMethods]
  );

  const steps = [
    { number: 1, title: t('orders.create.stepDetails') },
    { number: 2, title: t('orders.create.stepEscrow') },
    { number: 3, title: t('orders.create.stepDone') },
  ];

  useEffect(() => {
    const loadPaymentMethods = async () => {
      try {
        setIsLoadingPaymentMethods(true);
        const methods = await api.getPaymentMethods();
        const enabledMethods = methods.filter((method) => method.enabled !== false);
        setPaymentMethods(enabledMethods);

        if (enabledMethods[0]) {
          setFormData((prev) => ({ ...prev, paymentMethod: enabledMethods[0].id }));
        }
      } catch {
        setPaymentMethods([
          { id: 'card', name: t('orders.create.paymentMethodNames.card'), fee: 2.5, enabled: true, currencies: ['KGS'] },
          { id: 'elsom', name: t('orders.create.paymentMethodNames.elsom'), fee: 1.5, enabled: true, currencies: ['KGS'] },
          { id: 'odengi', name: t('orders.create.paymentMethodNames.odengi'), fee: 1.5, enabled: true, currencies: ['KGS'] },
          { id: 'mbank', name: t('orders.create.paymentMethodNames.mbank'), fee: 1, enabled: true, currencies: ['KGS'] },
        ]);
      } finally {
        setIsLoadingPaymentMethods(false);
      }
    };

    void loadPaymentMethods();
  }, [t]);

  useEffect(() => {
    const loadSelectedFreelancer = async () => {
      if (!selectedFreelancerId) {
        setSelectedFreelancerName(null);
        return;
      }

      try {
        const freelancer = await api.getFreelancer(selectedFreelancerId);
        setSelectedFreelancerName(freelancer.name);
      } catch {
        setSelectedFreelancerName(null);
      }
    };

    void loadSelectedFreelancer();
  }, [selectedFreelancerId]);

  const validateStep1 = () => {
    const newErrors: Record<string, string> = {};
    const title = formData.title.trim();
    const description = formData.description.trim();
    const budget = Number(formData.budget);
    const deadline = new Date(formData.deadline);
    const now = new Date();

    if (!title) {
      newErrors.title = t('orders.create.validation.titleRequired');
    } else if (title.length < 5) {
      newErrors.title = t('orders.create.validation.titleMin');
    }

    if (!formData.category) {
      newErrors.category = t('orders.create.validation.categoryRequired');
    }

    if (!description) {
      newErrors.description = t('orders.create.validation.descriptionRequired');
    } else if (description.length < 20) {
      newErrors.description = t('orders.create.validation.descriptionMin');
    }

    if (!formData.deadline) {
      newErrors.deadline = t('orders.create.validation.deadlineRequired');
    } else if (Number.isNaN(deadline.getTime()) || deadline <= now) {
      newErrors.deadline = t('orders.create.validation.deadlineMin');
    }

    if (!formData.budget || Number.isNaN(budget)) {
      newErrors.budget = t('orders.create.validation.budgetRequired');
    } else if (budget < 500) {
      newErrors.budget = t('orders.create.validation.budgetMin');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    const budgetAmount = Number(formData.budget);
    if (Number.isNaN(budgetAmount) || budgetAmount < 500) {
      setErrors({ submit: t('orders.create.validation.budgetMin') });
      return;
    }

    let createdOrderIdForRollback: string | null = null;

    try {
      setIsSubmitting(true);
      setErrors({});
      setEscrowTransactionId(null);
      setEscrowCheckoutUrl(null);
      setEscrowRequiresAction(false);

      const createdOrder = await api.createOrder({
        title: formData.title.trim(),
        description: formData.description.trim(),
        category: formData.category,
        budget: budgetAmount,
        deadline: formData.deadline,
        freelancerId: selectedFreelancerId || undefined,
      });
      createdOrderIdForRollback = createdOrder.id;
      const idempotencyKey = createEscrowIdempotencyKey(createdOrder.id);

      const escrowResult = await api.createEscrow({
        orderId: createdOrder.id,
        amount: budgetAmount,
        method: formData.paymentMethod,
        idempotencyKey,
      });
      setEscrowTransactionId(escrowResult.transactionId || null);
      setEscrowCheckoutUrl(escrowResult.checkoutUrl || null);
      setEscrowRequiresAction(Boolean(escrowResult.requiresAction || escrowResult.status === 'PENDING'));

      setCreatedOrderId(createdOrder.id);
      setCurrentStep(3);
    } catch (error) {
      if (createdOrderIdForRollback) {
        try {
          await api.cancelOrder(createdOrderIdForRollback, t('orders.create.validation.escrowPaymentFailed'));
        } catch {
          // rollback guard
        }
      }

      if (error instanceof ApiError && isValidationPayload(error.payload)) {
        const fieldErrors: FieldErrorMap = {};

        for (const item of error.payload.details) {
          const field = item.field;
          const message = item.message;
          if (!field || !message) continue;
          if (field === 'title') fieldErrors.title = message;
          if (field === 'category') fieldErrors.category = message;
          if (field === 'description') fieldErrors.description = message;
          if (field === 'deadline') fieldErrors.deadline = message;
          if (field === 'budget') fieldErrors.budget = message;
        }

        const firstFieldError = Object.values(fieldErrors).find(Boolean);
        const hasStep1Errors = Object.keys(fieldErrors).length > 0;

        setErrors({
          ...fieldErrors,
          submit: firstFieldError || error.message,
        });

        if (hasStep1Errors) setCurrentStep(1);
      } else {
        const message = error instanceof Error ? error.message : t('orders.create.validation.createFailed');
        setErrors({ submit: message });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNext = () => {
    if (currentStep === 1) {
      if (validateStep1()) {
        setCurrentStep(2);
      }
      return;
    }

    if (currentStep === 2 && formData.escrowAgreed) {
      void handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as Step);
    }
  };

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role === 'FREELANCER') return <Navigate to="/dashboard/freelancer" replace />;

  const budgetValue = Number(formData.budget);
  const safeBudget = Number.isFinite(budgetValue) && budgetValue > 0 ? budgetValue : 0;
  const methodFeePercentRaw = selectedPaymentMethod?.fee ?? 0;
  const methodFeePercent = Math.max(0, Math.min(20, methodFeePercentRaw));
  const estimatedFee = safeBudget > 0 ? Math.round((safeBudget * methodFeePercent) / 100) : 0;
  const totalReserve = safeBudget + estimatedFee;
  const selectedCategory = CATEGORIES.find((item) => item.id === formData.category);
  const selectedCategoryLabel = selectedCategory ? t(`categories.${selectedCategory.id}`, { defaultValue: selectedCategory.name }) : '';
  const checklistProgress = [
    formData.title.trim().length >= 5,
    Boolean(formData.category),
    formData.description.trim().length >= 20,
    Boolean(formData.deadline),
    safeBudget >= 500,
    formData.escrowAgreed,
  ].filter(Boolean).length;
  const isEscrowPending = escrowRequiresAction;

  return (
    <DashboardShell
      isDark={isDark}
      sidebarTitle={user?.name || t('orders.create.clientFallback')}
      sidebarSubtitle={t('topbar.workspace')}
      sidebarItems={getClientSidebarItems()}
      onLogout={logout}
    >
      <PageHeader
        title={t('orders.create.title')}
        subtitle={t('orders.create.subtitle')}
        badges={
          <>
            <Badge variant="success">{t('common.safeDeal')}</Badge>
            <Badge variant="info">{t('common.escrowProtection')}</Badge>
          </>
        }
        actions={
          <Link
            to="/dashboard/client"
            className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-sm font-semibold text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-2)]"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('common.back')}
          </Link>
        }
      />

      <section className="surface p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
          {steps.map((step, index) => {
            const isActive = currentStep === step.number;
            const isDone = currentStep > step.number;

            return (
              <div key={step.number} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={
                      isDone
                        ? 'flex h-10 w-10 items-center justify-center rounded-[10px] border border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
                        : isActive
                          ? 'flex h-10 w-10 items-center justify-center rounded-[10px] border border-[var(--color-primary)] bg-[color-mix(in_srgb,var(--color-primary)_12%,transparent)] text-[var(--color-primary)]'
                          : 'flex h-10 w-10 items-center justify-center rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-soft)]'
                    }
                  >
                    {isDone ? <Check className="h-4 w-4" /> : step.number}
                  </div>
                  <span
                    className={
                      isActive || isDone
                        ? 'mt-2 hidden text-xs font-semibold text-[var(--color-text)] sm:block'
                        : 'mt-2 hidden text-xs text-[var(--color-text-soft)] sm:block'
                    }
                  >
                    {step.title}
                  </span>
                </div>

                {index < steps.length - 1 && (
                  <div className={isDone ? 'mx-2 h-px w-14 bg-[var(--color-primary)] sm:w-20' : 'mx-2 h-px w-14 bg-[var(--color-border)] sm:w-20'} />
                )}
              </div>
            );
          })}
        </div>
      </section>

      {currentStep === 3 ? (
        <section className="mx-auto w-full max-w-3xl">
          <div className="surface p-8 text-center sm:p-10">
            <div
              className={
                isEscrowPending
                  ? 'mx-auto mb-6 inline-flex h-16 w-16 items-center justify-center rounded-[14px] border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-warning)_12%,transparent)] text-[var(--color-warning)]'
                  : 'mx-auto mb-6 inline-flex h-16 w-16 items-center justify-center rounded-[14px] border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-success)_12%,transparent)] text-[var(--color-success)]'
              }
            >
              {isEscrowPending ? <Loader2 className="h-8 w-8 animate-spin" /> : <Check className="h-8 w-8" />}
            </div>

            <h2 className="text-3xl font-bold text-[var(--color-text)]">
              {isEscrowPending
                ? t('orders.create.paymentPendingTitle', { defaultValue: 'Заказ создан, ожидается оплата' })
                : t('orders.create.created')}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-[var(--color-text-muted)]">
              {isEscrowPending
                ? t('orders.create.paymentPendingDescription', {
                    defaultValue:
                      'Эскроу будет активирован после подтверждения платежа. Завершите оплату по ссылке ниже.',
                  })
                : selectedFreelancerId
                  ? t('orders.create.createdAssigned')
                  : t('orders.create.createdPublished')}
            </p>

            {escrowTransactionId && (
              <p className="mt-4 text-xs text-[var(--color-text-soft)]">
                {t('orders.create.escrowTransaction')}:{' '}
                <span className="font-mono text-[var(--color-text)]">{escrowTransactionId}</span>
              </p>
            )}

            <div className="mt-6 inline-block rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3">
              <p className="text-sm font-semibold text-[var(--color-text)]">{formData.title}</p>
              <p
                className={
                  isEscrowPending
                    ? 'mt-1 text-lg font-bold text-[var(--color-warning)]'
                    : 'mt-1 text-lg font-bold text-[var(--color-success)]'
                }
              >
                {isEscrowPending
                  ? t('orders.create.awaitingEscrow', {
                      defaultValue: 'К оплате: {{amount}}',
                      amount: formatMoneyKGS(totalReserve, i18n.language),
                    })
                  : t('orders.create.inEscrow', { amount: formatMoneyKGS(safeBudget, i18n.language) })}
              </p>
            </div>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              {isEscrowPending && escrowCheckoutUrl && (
                <a
                  href={escrowCheckoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 items-center rounded-[var(--radius-control)] bg-[var(--color-primary)] px-5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-hover)]"
                >
                  {t('orders.create.payNow', { defaultValue: 'Перейти к оплате' })}
                </a>
              )}
              <Button
                type="button"
                onClick={() => navigate(createdOrderId ? `/orders/${createdOrderId}` : WORKSPACE_PATH)}
                variant={isEscrowPending ? 'outline' : 'primary'}
              >
                {t('orders.create.goToOrder')}
              </Button>
              {!isEscrowPending && (
                <Link
                  to={WORKSPACE_PATH}
                  className="inline-flex h-10 items-center rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-5 text-sm font-semibold text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-2)]"
                >
                  {t('orders.create.toDashboard')}
                </Link>
              )}
            </div>
          </div>
        </section>
      ) : (
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <div className="space-y-6 xl:col-span-8">
            {currentStep === 1 && (
              <StepSection
                title={t('orders.create.detailsSection')}
                subtitle={t('orders.create.detailsSectionHint', {
                  defaultValue: 'Define scope, deadlines, and budget before escrow funding.',
                })}
              >
                <div className="space-y-5">
                  {selectedFreelancerId && (
                    <div className="rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3 text-sm text-[var(--color-text-muted)]">
                      {t('orders.create.selectedFreelancerHint')}
                      <span className="ml-1 font-semibold text-[var(--color-text)]">
                        {selectedFreelancerName || t('orders.create.selectedFreelancerFallback')}
                      </span>
                    </div>
                  )}

                  <Field label={t('orders.create.orderTitle')} icon={<FileText className="h-4 w-4" />} error={errors.title}>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder={t('orders.create.orderTitlePlaceholder')}
                      className={inputClassName(Boolean(errors.title))}
                    />
                  </Field>

                  <Field label={t('orders.create.category')} error={errors.category}>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className={inputClassName(Boolean(errors.category))}
                    >
                      <option value="">{t('orders.create.categoryPlaceholder')}</option>
                      {CATEGORIES.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.icon} {t(`categories.${cat.id}`, { defaultValue: cat.name })}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label={t('orders.create.description')} error={errors.description}>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder={t('orders.create.descriptionPlaceholder')}
                      rows={6}
                      className={`${inputClassName(Boolean(errors.description))} h-auto py-2.5`}
                    />
                  </Field>

                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <Field label={t('orders.create.deadline')} icon={<Calendar className="h-4 w-4" />} error={errors.deadline}>
                      <input
                        type="date"
                        value={formData.deadline}
                        onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                        min={getTomorrowIsoDate()}
                        className={inputClassName(Boolean(errors.deadline))}
                      />
                    </Field>

                    <Field label={t('orders.create.budget')} icon={<DollarSign className="h-4 w-4" />} error={errors.budget}>
                      <input
                        type="number"
                        value={formData.budget}
                        onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                        placeholder="50000"
                        min="500"
                        className={inputClassName(Boolean(errors.budget))}
                      />
                    </Field>
                  </div>
                </div>

                <div className="mt-8 flex justify-end">
                  <Button
                    type="button"
                    onClick={handleNext}
                    rightIcon={<ArrowRight className="h-4 w-4" />}
                  >
                    {t('orders.create.next')}
                  </Button>
                </div>
              </StepSection>
            )}

            {currentStep === 2 && (
              <div className="space-y-4">
                <StepSection
                  title={t('orders.create.escrowTitle')}
                  subtitle={t('orders.create.escrowSubtitle')}
                  icon={<Shield className="h-5 w-5" />}
                >

                  <p className="mb-5 text-sm leading-relaxed text-[var(--color-text-muted)]">
                    {t('orders.create.escrowDescription')}
                  </p>

                  <Field label={t('orders.create.paymentMethod')} icon={<CreditCard className="h-4 w-4" />}>
                    <select
                      value={formData.paymentMethod}
                      disabled={isLoadingPaymentMethods}
                      onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value as PaymentMethodId })}
                      className={inputClassName(false)}
                    >
                      {isLoadingPaymentMethods && <option>{t('orders.create.paymentMethodsLoading')}</option>}
                      {!isLoadingPaymentMethods && paymentMethods.length === 0 && <option>{t('orders.create.paymentMethodsUnavailable')}</option>}
                      {!isLoadingPaymentMethods &&
                        paymentMethods.map((method) => (
                          <option key={method.id} value={method.id}>
                            {method.name}{' '}
                            {method.fee > 0
                              ? t('orders.create.methodFeeWithCommission', { fee: method.fee })
                              : t('orders.create.methodFeeNoCommission')}
                          </option>
                        ))}
                    </select>
                  </Field>

                  {selectedPaymentMethod && (
                    <p className="mt-2 text-xs text-[var(--color-text-soft)]">
                      {t('orders.create.methodDetails', {
                        fee: selectedPaymentMethod.fee,
                        currencies: selectedPaymentMethod.currencies.join(', '),
                      })}
                    </p>
                  )}

                  <div className="my-6 grid grid-cols-1 gap-3 md:grid-cols-3">
                    <EscrowStep icon={<Lock className="h-5 w-5" />} title={t('orders.create.escrowFlow.frozenTitle')} subtitle={t('orders.create.escrowFlow.frozenSubtitle')} />
                    <EscrowStep
                      icon={<CheckCircle className="h-5 w-5" />}
                      title={t('orders.create.escrowFlow.confirmedTitle')}
                      subtitle={t('orders.create.escrowFlow.confirmedSubtitle')}
                    />
                    <EscrowStep
                      icon={<DollarSign className="h-5 w-5" />}
                      title={t('orders.create.escrowFlow.paidTitle')}
                      subtitle={t('orders.create.escrowFlow.paidSubtitle')}
                    />
                  </div>

                  <label className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3 text-sm text-[var(--color-text-muted)]">
                    <input
                      type="checkbox"
                      checked={formData.escrowAgreed}
                      onChange={(e) => setFormData({ ...formData, escrowAgreed: e.target.checked })}
                      className="mt-0.5 h-4 w-4 rounded border-[var(--color-border)]"
                    />
                    <span>
                      {t('orders.create.agreementPrefix')}{' '}
                      <strong className="text-[var(--color-text)]">{formatMoneyKGS(safeBudget, i18n.language)}</strong>{' '}
                      {t('orders.create.agreementSuffix')}
                    </span>
                  </label>

                  {errors.submit && <Alert type="danger" text={errors.submit} />}
                </StepSection>

                <div className="flex justify-between">
                  <Button
                    type="button"
                    onClick={handleBack}
                    variant="outline"
                    leftIcon={<ArrowLeft className="h-4 w-4" />}
                  >
                    {t('common.back')}
                  </Button>

                  <Button
                    type="button"
                    onClick={handleNext}
                    disabled={!formData.escrowAgreed || isSubmitting || isLoadingPaymentMethods || paymentMethods.length === 0}
                    isLoading={isSubmitting}
                    rightIcon={isSubmitting ? undefined : <Check className="h-4 w-4" />}
                  >
                    {isSubmitting ? t('orders.create.creating') : t('orders.create.confirmOrder')}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <aside className="space-y-6 xl:col-span-4 xl:sticky xl:top-24 xl:self-start">
            <section className="surface p-5 sm:p-6">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-text-soft)]">{t('orders.create.summaryTitle')}</h3>
              <div className="mt-3 space-y-2">
                <p className="text-lg font-semibold text-[var(--color-text)]">{formData.title || t('orders.create.summaryTitlePlaceholder')}</p>
                <p className="text-sm text-[var(--color-text-muted)]">{selectedCategoryLabel || t('orders.create.summaryCategoryPlaceholder')}</p>
              </div>
              <p className="mt-4 text-3xl font-bold text-[var(--color-text)]">{formatMoneyKGS(totalReserve, i18n.language)}</p>
              <p className="mt-1 text-xs text-[var(--color-text-soft)]">
                {t('orders.create.deadlineLabel')}:{' '}
                {formData.deadline ? formatDate(formData.deadline, i18n.language) : t('orders.create.deadlineMissing')}
              </p>
              <div className="mt-4 space-y-2 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
                <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                  <span>{t('orders.create.summaryBudget', { defaultValue: 'Budget' })}</span>
                  <span className="font-semibold text-[var(--color-text)]">{formatMoneyKGS(safeBudget, i18n.language)}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                  <span>{t('orders.create.summaryFee', { defaultValue: 'Payment fee' })} ({methodFeePercent}%)</span>
                  <span className="font-semibold text-[var(--color-text)]">{formatMoneyKGS(estimatedFee, i18n.language)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-2 text-xs text-[var(--color-text-muted)]">
                  <span>{t('orders.create.summaryEscrow', { defaultValue: 'Reserved in escrow' })}</span>
                  <span className="font-semibold text-[var(--color-text)]">{formatMoneyKGS(totalReserve, i18n.language)}</span>
                </div>
              </div>
            </section>

            <section className="surface p-5 sm:p-6">
              <h3 className="text-base font-semibold text-[var(--color-text)]">{t('orders.create.checklist')}</h3>
              <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                {t('orders.create.checklistProgress', { current: checklistProgress, total: 6 })}
              </p>

              <div className="mt-4 space-y-2">
                {[
                  [t('orders.create.checklistItems.titleCategory'), formData.title.trim().length >= 5 && Boolean(formData.category)],
                  [t('orders.create.checklistItems.description'), formData.description.trim().length >= 20],
                  [t('orders.create.checklistItems.deadline'), Boolean(formData.deadline)],
                  [t('orders.create.checklistItems.budget'), safeBudget >= 500],
                  [t('orders.create.checklistItems.paymentMethod'), Boolean(selectedPaymentMethod)],
                  [t('orders.create.checklistItems.escrowAgreement'), formData.escrowAgreed],
                ].map(([label, done]) => (
                  <div key={String(label)} className="flex items-center justify-between rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2">
                    <span className="text-xs text-[var(--color-text-muted)]">{label}</span>
                    <span
                      className={
                        done
                          ? 'inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--color-success)_18%,transparent)] px-2 text-[11px] font-semibold text-[var(--color-success)]'
                          : 'inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--color-warning)_18%,transparent)] px-2 text-[11px] font-semibold text-[var(--color-warning)]'
                      }
                    >
                      {done ? t('orders.create.checklistDone') : t('orders.create.checklistPending')}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="surface p-5 sm:p-6">
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-success)]">
                <Shield className="h-4 w-4" />
                {t('orders.create.escrowActiveTitle')}
              </p>
              <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                {t('orders.create.escrowActiveText')}
              </p>
            </section>
          </aside>
        </section>
      )}
    </DashboardShell>
  );
}

function Field({
  label,
  icon,
  error,
  children,
}: {
  label: string;
  icon?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-text)]">
        {icon}
        {label}
      </span>
      {children}
      {error && <p className="mt-1 text-xs text-[var(--color-danger)]">{error}</p>}
    </label>
  );
}

function EscrowStep({ icon, title, subtitle }: { icon: ReactNode; title: string; subtitle: string }) {
  return (
    <div className="rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 text-center">
      <div className="mx-auto mb-2 inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-primary)]">
        {icon}
      </div>
      <p className="text-sm font-semibold text-[var(--color-text)]">{title}</p>
      <p className="text-xs text-[var(--color-text-soft)]">{subtitle}</p>
    </div>
  );
}

function inputClassName(hasError: boolean) {
  return hasError
    ? 'h-10 w-full rounded-[var(--radius-control)] border border-[var(--color-danger)] bg-[var(--color-surface)] px-3.5 text-sm text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-danger)]'
    : 'h-10 w-full rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 text-sm text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-ring)]';
}

function Alert({ type, text }: { type: 'danger' | 'success'; text: string }) {
  if (type === 'danger') {
    return (
      <div className="mt-4 rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--color-danger)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_12%,transparent)] px-4 py-3 text-sm text-[var(--color-danger)]">
        {text}
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--color-success)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-success)_12%,transparent)] px-4 py-3 text-sm text-[var(--color-success)]">
      {text}
    </div>
  );
}
