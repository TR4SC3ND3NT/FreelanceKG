/**
 * FreelanceKG Payment System
 * 
 * Mock-система эскроу платежей для Кыргызстана.
 * Готова к замене на реальные платёжные шлюзы:
 * - Элсом (Elsom)
 * - О!Деньги (O!Dengi)
 * - MBank
 * - VISA/Mastercard через банки КР
 * - PayBox.money
 * - Payler
 */

import { prisma } from './prisma';
import { logger, paymentLog, auditLog } from './logger';
import { getPaymentGateway } from './paymentGateway';
import { Prisma } from '@prisma/client';
import { createLedgerBatchId, postLedgerBatch } from './ledger';

// ============================================
// ТИПЫ
// ============================================

export type PaymentMethod = 'card' | 'balance' | 'elsom' | 'odengi' | 'mbank';
export type PaymentStatus = 'PENDING' | 'PROCESSING' | 'HELD' | 'RELEASED' | 'REFUNDED' | 'FAILED';
export type EscrowStatus = 'NONE' | 'HOLDING' | 'RELEASED' | 'DISPUTED' | 'REFUNDED';

export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  status: PaymentStatus;
  message: string;
  escrowId?: string;
  checkoutUrl?: string;
  requiresAction?: boolean;
}

export interface EscrowInfo {
  orderId: string;
  amount: number;
  status: EscrowStatus;
  heldAt?: Date;
  releasedAt?: Date;
  refundedAt?: Date;
}

// ============================================
// КОНФИГУРАЦИЯ ПЛАТЁЖНЫХ СИСТЕМ
// ============================================

const PAYMENT_CONFIG = {
  // Комиссия платформы (%)
  platformFee: 10,
  
  // Минимальная сумма
  minAmount: 500,
  
  // Максимальная сумма
  maxAmount: 10000000,
  
  // Методы оплаты доступные в КР
  methods: {
    card: {
      name: 'Банковская карта',
      fee: 2.5,
      enabled: true,
      currencies: ['KGS', 'USD', 'RUB'],
    },
    elsom: {
      name: 'Элсом',
      fee: 1.5,
      enabled: true,
      currencies: ['KGS'],
    },
    odengi: {
      name: 'О!Деньги',
      fee: 1.5,
      enabled: true,
      currencies: ['KGS'],
    },
    mbank: {
      name: 'MBank',
      fee: 1.0,
      enabled: true,
      currencies: ['KGS'],
    },
    balance: {
      name: 'Баланс аккаунта',
      fee: 0,
      enabled: true,
      currencies: ['KGS'],
    },
  },
};

// ============================================
// MOCK PAYMENT GATEWAY
// ============================================

class PaymentDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentDomainError';
  }
}

function createTransactionId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 11).toUpperCase()}`;
}

function normalizeMetadata(
  metadata?: Record<string, unknown>
): Prisma.InputJsonValue | undefined {
  if (!metadata) {
    return undefined;
  }

  try {
    return JSON.parse(JSON.stringify(metadata)) as Prisma.InputJsonValue;
  } catch {
    return undefined;
  }
}

/**
 * Платёж обрабатывается через выбранный gateway-provider.
 * В production mock блокируется конфигурацией env.
 */
async function processPayment(
  params: {
    amount: number;
    method: PaymentMethod;
    userId: string;
    orderId: string;
    idempotencyKey: string;
  }
): Promise<{
  status: 'SUCCEEDED' | 'PENDING' | 'FAILED';
  transactionId: string;
  message: string;
  provider: string;
  checkoutUrl?: string;
}> {
  const gateway = getPaymentGateway();
  const gatewayResult = await gateway.createEscrowIntent({
    amount: params.amount,
    method: params.method,
    userId: params.userId,
    orderId: params.orderId,
    idempotencyKey: params.idempotencyKey,
  });

  const eventName =
    gatewayResult.status === 'SUCCEEDED'
      ? 'PAYMENT_PROCESSED'
      : gatewayResult.status === 'PENDING'
        ? 'PAYMENT_PENDING'
        : 'PAYMENT_FAILED';

  paymentLog(eventName, {
    transactionId: gatewayResult.providerPaymentId,
    amount: params.amount,
    method: params.method,
    userId: params.userId,
    status: gatewayResult.status,
    provider: gatewayResult.provider,
    reason: gatewayResult.status === 'FAILED' ? gatewayResult.message : undefined,
    orderId: params.orderId,
    idempotencyKey: params.idempotencyKey,
  });

  return {
    status: gatewayResult.status,
    transactionId: gatewayResult.providerPaymentId,
    message: gatewayResult.message,
    provider: gatewayResult.provider,
    checkoutUrl: gatewayResult.checkoutUrl,
  };
}

// ============================================
// ESCROW SYSTEM
// ============================================

/**
 * Класс для управления эскроу платежами
 */
export class EscrowService {
  /**
   * Создать эскроу для заказа
   * Замораживает средства клиента
   */
  static async createEscrow(
    orderId: string,
    clientId: string,
    amount: number,
    method: PaymentMethod,
    options?: { idempotencyKey?: string }
  ): Promise<PaymentResult> {
    try {
      // Валидация суммы
      if (amount < PAYMENT_CONFIG.minAmount) {
        return {
          success: false,
          status: 'FAILED',
          message: `Минимальная сумма: ${PAYMENT_CONFIG.minAmount} сом`,
        };
      }
      
      if (amount > PAYMENT_CONFIG.maxAmount) {
        return {
          success: false,
          status: 'FAILED',
          message: `Максимальная сумма: ${PAYMENT_CONFIG.maxAmount} сом`,
        };
      }

      const idempotencyKeyRaw = options?.idempotencyKey?.trim();
      const idempotencyKey =
        idempotencyKeyRaw && idempotencyKeyRaw.length >= 10
          ? idempotencyKeyRaw.slice(0, 128)
          : createTransactionId('IDEMP');

      const existingIntent = await prisma.paymentIntent.findUnique({
        where: { idempotencyKey },
      });

      if (existingIntent) {
        if (existingIntent.clientId !== clientId || existingIntent.orderId !== orderId) {
          return {
            success: false,
            status: 'FAILED',
            message: 'Idempotency key уже использован в другом платеже',
          };
        }

        if (existingIntent.status === 'SUCCEEDED') {
          return {
            success: true,
            status: 'HELD',
            message: 'Платёж уже подтверждён ранее',
            transactionId: existingIntent.providerPaymentId || undefined,
            escrowId: orderId,
          };
        }

        if (existingIntent.status === 'INITIATED') {
          return {
            success: true,
            status: 'PENDING',
            message: 'Платёж уже инициирован, завершите оплату.',
            transactionId: existingIntent.providerPaymentId || undefined,
            checkoutUrl: existingIntent.checkoutUrl || undefined,
            requiresAction: true,
            escrowId: orderId,
          };
        }

        return {
          success: false,
          status: 'FAILED',
          message: existingIntent.errorMessage || 'Платёж по этому ключу уже отклонён',
          transactionId: existingIntent.providerPaymentId || undefined,
        };
      }

      const existingPendingIntent = await prisma.paymentIntent.findFirst({
        where: {
          orderId,
          clientId,
          status: 'INITIATED',
        },
        orderBy: { createdAt: 'desc' },
        select: {
          providerPaymentId: true,
          checkoutUrl: true,
        },
      });

      if (existingPendingIntent) {
        return {
          success: true,
          status: 'PENDING',
          message: 'Платёж уже инициирован, завершите оплату.',
          transactionId: existingPendingIntent.providerPaymentId || undefined,
          checkoutUrl: existingPendingIntent.checkoutUrl || undefined,
          requiresAction: true,
          escrowId: orderId,
        };
      }

      const existingOrder = await prisma.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          clientId: true,
          budget: true,
          status: true,
          escrowStatus: true,
        },
      });

      if (!existingOrder) {
        return {
          success: false,
          status: 'FAILED',
          message: 'Заказ не найден',
        };
      }

      if (existingOrder.clientId !== clientId) {
        return {
          success: false,
          status: 'FAILED',
          message: 'Вы не являетесь заказчиком',
        };
      }

      if (!['PENDING', 'ACTIVE'].includes(existingOrder.status)) {
        return {
          success: false,
          status: 'FAILED',
          message: 'Эскроу можно создать только для активного или ожидающего заказа',
        };
      }

      const requestedAmount = Math.round(Number(amount) * 100);
      const budgetAmount = Math.round(Number(existingOrder.budget) * 100);
      if (requestedAmount !== budgetAmount) {
        return {
          success: false,
          status: 'FAILED',
          message: `Сумма эскроу должна совпадать с бюджетом заказа (${existingOrder.budget} сом)`,
        };
      }

      // Инициируем оплату через внешний провайдер.
      const paymentResult = await processPayment({
        amount,
        method,
        userId: clientId,
        orderId,
        idempotencyKey,
      });

      if (paymentResult.status === 'FAILED') {
        await prisma.paymentIntent.create({
          data: {
            orderId,
            clientId,
            amount,
            method,
            provider: paymentResult.provider,
            status: 'FAILED',
            idempotencyKey,
            providerPaymentId: paymentResult.transactionId,
            errorMessage: paymentResult.message,
          },
        });

        return {
          success: false,
          status: 'FAILED',
          message: paymentResult.message,
          transactionId: paymentResult.transactionId,
        };
      }
      
      // Рассчитываем комиссию
      const methodFee = PAYMENT_CONFIG.methods[method].fee;
      const platformFee = PAYMENT_CONFIG.platformFee;
      const totalFee = (amount * (methodFee + platformFee)) / 100;
      const netAmount = amount - totalFee;

      if (paymentResult.status === 'PENDING') {
        await prisma.paymentIntent.create({
          data: {
            orderId,
            clientId,
            amount,
            method,
            provider: paymentResult.provider,
            status: 'INITIATED',
            idempotencyKey,
            providerPaymentId: paymentResult.transactionId,
            checkoutUrl: paymentResult.checkoutUrl,
          },
        });

        return {
          success: true,
          status: 'PENDING',
          message: paymentResult.message,
          transactionId: paymentResult.transactionId,
          checkoutUrl: paymentResult.checkoutUrl,
          requiresAction: true,
          escrowId: orderId,
        };
      }

      await prisma.$transaction(async (tx) => {
        await tx.paymentIntent.create({
          data: {
            orderId,
            clientId,
            amount,
            method,
            provider: paymentResult.provider,
            status: 'SUCCEEDED',
            idempotencyKey,
            providerPaymentId: paymentResult.transactionId,
            confirmedAt: new Date(),
          },
        });

        const guardedUpdate = await tx.order.updateMany({
          where: {
            id: orderId,
            clientId,
            escrowStatus: 'NONE',
            status: { in: ['PENDING', 'ACTIVE'] },
          },
          data: {
            escrowAmount: amount,
            escrowStatus: 'HOLDING',
            escrowHeldAt: new Date(),
            escrowTransactionId: paymentResult.transactionId,
            platformFee: totalFee,
            netAmount,
          },
        });

        if (guardedUpdate.count === 0) {
          throw new PaymentDomainError('Состояние заказа изменилось. Обновите страницу и повторите попытку.');
        }

        await tx.transaction.create({
          data: {
            orderId,
            userId: clientId,
            type: 'ESCROW_HOLD',
            amount,
            fee: totalFee,
            netAmount,
            method,
            status: 'COMPLETED',
            transactionId: paymentResult.transactionId,
            completedAt: new Date(),
          },
        });

        await postLedgerBatch(tx, {
          batchId: createLedgerBatchId('ESCROW_HOLD'),
          entries: [
            {
              account: 'ESCROW',
              direction: 'DEBIT',
              amount,
              userId: clientId,
              orderId,
              referenceType: 'order',
              referenceId: orderId,
              description: 'Escrow funds held',
            },
            {
              account: 'REFUND_RESERVE',
              direction: 'CREDIT',
              amount,
              userId: clientId,
              orderId,
              referenceType: 'order',
              referenceId: orderId,
              description: 'Client liability reserved',
            },
          ],
        });
      });
      
      auditLog('ESCROW_CREATED', clientId, {
        orderId,
        amount,
        fee: totalFee,
        transactionId: paymentResult.transactionId,
      });
      
      return {
        success: true,
        status: 'HELD',
        message: 'Средства успешно заморожены в эскроу',
        transactionId: paymentResult.transactionId,
        escrowId: orderId,
      };
    } catch (error) {
      if (error instanceof PaymentDomainError) {
        return {
          success: false,
          status: 'FAILED',
          message: error.message,
        };
      }
      logger.error('Escrow creation error', { orderId, error });
      return {
        success: false,
        status: 'FAILED',
        message: 'Ошибка при создании эскроу',
      };
    }
  }

  static async confirmEscrowIntent(
    providerPaymentId: string,
    metadata?: Record<string, unknown>
  ): Promise<PaymentResult> {
    try {
      const intent = await prisma.paymentIntent.findUnique({
        where: { providerPaymentId },
        select: {
          id: true,
          orderId: true,
          clientId: true,
          amount: true,
          method: true,
          status: true,
        },
      });

      if (!intent) {
        return {
          success: false,
          status: 'FAILED',
          message: 'Платёж не найден',
        };
      }

      if (intent.status === 'SUCCEEDED') {
        return {
          success: true,
          status: 'HELD',
          message: 'Платёж уже подтверждён',
          transactionId: providerPaymentId,
          escrowId: intent.orderId,
        };
      }

      if (intent.status !== 'INITIATED') {
        return {
          success: false,
          status: 'FAILED',
          message: 'Платёж не в состоянии подтверждения',
          transactionId: providerPaymentId,
        };
      }

      const amount = Number(intent.amount);
      const method = intent.method as PaymentMethod;
      const methodFee = PAYMENT_CONFIG.methods[method]?.fee ?? 0;
      const platformFee = PAYMENT_CONFIG.platformFee;
      const totalFee = (amount * (methodFee + platformFee)) / 100;
      const netAmount = amount - totalFee;

      await prisma.$transaction(async (tx) => {
        const updatedIntent = await tx.paymentIntent.updateMany({
          where: {
            id: intent.id,
            status: 'INITIATED',
          },
          data: {
            status: 'SUCCEEDED',
            confirmedAt: new Date(),
            metadata: normalizeMetadata(metadata),
            errorMessage: null,
          },
        });

        if (updatedIntent.count === 0) {
          throw new PaymentDomainError('Платёж уже обработан');
        }

        const guardedUpdate = await tx.order.updateMany({
          where: {
            id: intent.orderId,
            clientId: intent.clientId,
            escrowStatus: 'NONE',
            status: { in: ['PENDING', 'ACTIVE'] },
          },
          data: {
            escrowAmount: amount,
            escrowStatus: 'HOLDING',
            escrowHeldAt: new Date(),
            escrowTransactionId: providerPaymentId,
            platformFee: totalFee,
            netAmount,
          },
        });

        if (guardedUpdate.count === 0) {
          throw new PaymentDomainError('Состояние заказа изменилось. Эскроу не может быть подтверждён.');
        }

        await tx.transaction.create({
          data: {
            orderId: intent.orderId,
            userId: intent.clientId,
            type: 'ESCROW_HOLD',
            amount,
            fee: totalFee,
            netAmount,
            method,
            status: 'COMPLETED',
            transactionId: providerPaymentId,
            completedAt: new Date(),
          },
        });

        await postLedgerBatch(tx, {
          batchId: createLedgerBatchId('ESCROW_HOLD'),
          entries: [
            {
              account: 'ESCROW',
              direction: 'DEBIT',
              amount,
              userId: intent.clientId,
              orderId: intent.orderId,
              referenceType: 'payment_intent',
              referenceId: intent.id,
              description: 'Escrow funds held (webhook confirm)',
            },
            {
              account: 'REFUND_RESERVE',
              direction: 'CREDIT',
              amount,
              userId: intent.clientId,
              orderId: intent.orderId,
              referenceType: 'payment_intent',
              referenceId: intent.id,
              description: 'Client liability reserved',
            },
          ],
        });
      });

      return {
        success: true,
        status: 'HELD',
        message: 'Платёж подтверждён, эскроу активирован',
        transactionId: providerPaymentId,
        escrowId: intent.orderId,
      };
    } catch (error) {
      if (error instanceof PaymentDomainError) {
        return {
          success: false,
          status: 'FAILED',
          message: error.message,
          transactionId: providerPaymentId,
        };
      }

      logger.error('Escrow confirm intent error', { providerPaymentId, error });
      return {
        success: false,
        status: 'FAILED',
        message: 'Ошибка при подтверждении платежа',
        transactionId: providerPaymentId,
      };
    }
  }

  static async failEscrowIntent(
    providerPaymentId: string,
    reason: string,
    metadata?: Record<string, unknown>
  ): Promise<PaymentResult> {
    try {
      const intent = await prisma.paymentIntent.findUnique({
        where: { providerPaymentId },
        select: {
          id: true,
          orderId: true,
          status: true,
        },
      });

      if (!intent) {
        return {
          success: false,
          status: 'FAILED',
          message: 'Платёж не найден',
        };
      }

      if (intent.status === 'FAILED') {
        return {
          success: false,
          status: 'FAILED',
          message: reason || 'Платёж уже помечен как отклонённый',
          transactionId: providerPaymentId,
        };
      }

      if (intent.status === 'SUCCEEDED') {
        return {
          success: false,
          status: 'FAILED',
          message: 'Нельзя отклонить уже подтверждённый платёж',
          transactionId: providerPaymentId,
        };
      }

      await prisma.paymentIntent.update({
        where: { id: intent.id },
        data: {
          status: 'FAILED',
          errorMessage: reason,
          metadata: normalizeMetadata(metadata),
        },
      });

      return {
        success: false,
        status: 'FAILED',
        message: reason || 'Платёж отклонён',
        transactionId: providerPaymentId,
        escrowId: intent.orderId,
      };
    } catch (error) {
      logger.error('Escrow fail intent error', { providerPaymentId, error });
      return {
        success: false,
        status: 'FAILED',
        message: 'Ошибка при отклонении платежа',
        transactionId: providerPaymentId,
      };
    }
  }
  
  /**
   * Освободить эскроу - перевести деньги фрилансеру
   * Вызывается когда клиент подтверждает выполнение работы
   */
  static async releaseEscrow(
    orderId: string,
    clientId: string,
    options?: { allowDisputed?: boolean; auditActorId?: string }
  ): Promise<PaymentResult> {
    try {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          title: true,
          clientId: true,
          freelancerId: true,
          status: true,
          escrowStatus: true,
          netAmount: true,
          escrowAmount: true,
        },
      });

      if (!order) {
        return {
          success: false,
          status: 'FAILED',
          message: 'Заказ не найден',
        };
      }
      
      if (order.clientId !== clientId) {
        return {
          success: false,
          status: 'FAILED',
          message: 'Вы не являетесь заказчиком',
        };
      }
      
      const canReleaseFromDispute = options?.allowDisputed === true && order.escrowStatus === 'DISPUTED';
      if (order.escrowStatus !== 'HOLDING' && !canReleaseFromDispute) {
        return {
          success: false,
          status: 'FAILED',
          message: 'Эскроу не активен',
        };
      }
      
      const canReleaseWhenDisputed = options?.allowDisputed === true && order.status === 'DISPUTED';
      if (order.status !== 'SUBMITTED' && !canReleaseWhenDisputed) {
        return {
          success: false,
          status: 'FAILED',
          message: 'Работа ещё не сдана',
        };
      }

      const transactionId = createTransactionId('TXN_REL');
      const payoutAmount = order.netAmount || order.escrowAmount;
      const grossAmount = new Prisma.Decimal(order.escrowAmount);
      const payoutDecimal = new Prisma.Decimal(payoutAmount);
      const feeDecimalRaw = grossAmount.minus(payoutDecimal);
      const feeDecimal = feeDecimalRaw.lessThan(0) ? new Prisma.Decimal(0) : feeDecimalRaw;
      const now = new Date();

      await prisma.$transaction(async (tx) => {
        const guardedRelease = await tx.order.updateMany({
          where: {
            id: orderId,
            clientId,
            escrowStatus: canReleaseFromDispute ? { in: ['HOLDING', 'DISPUTED'] } : 'HOLDING',
            status: canReleaseWhenDisputed ? { in: ['SUBMITTED', 'DISPUTED'] } : 'SUBMITTED',
          },
          data: {
            escrowStatus: 'RELEASED',
            escrowReleasedAt: now,
            status: 'COMPLETED',
            completedAt: now,
          },
        });

        if (guardedRelease.count === 0) {
          throw new PaymentDomainError('Состояние заказа изменилось. Попробуйте обновить страницу.');
        }

        if (!order.freelancerId) {
          return;
        }

        await tx.transaction.create({
          data: {
            orderId,
            userId: order.freelancerId,
            type: 'ESCROW_RELEASE',
            amount: payoutAmount,
            fee: 0,
            netAmount: payoutAmount,
            method: 'balance',
            status: 'COMPLETED',
            transactionId,
            completedAt: now,
          },
        });

        const ledgerEntries: Parameters<typeof postLedgerBatch>[1]['entries'] = [
          {
            account: 'REFUND_RESERVE',
            direction: 'DEBIT',
            amount: grossAmount,
            orderId,
            userId: order.clientId,
            referenceType: 'order',
            referenceId: orderId,
            description: 'Release client liability',
          },
          {
            account: 'USER_BALANCE',
            direction: 'CREDIT',
            amount: payoutDecimal,
            orderId,
            userId: order.freelancerId,
            referenceType: 'order',
            referenceId: orderId,
            description: 'Freelancer payout credited',
          },
        ];
        if (feeDecimal.greaterThan(0)) {
          ledgerEntries.push({
            account: 'PLATFORM_REVENUE',
            direction: 'CREDIT',
            amount: feeDecimal,
            orderId,
            userId: order.clientId,
            referenceType: 'order',
            referenceId: orderId,
            description: 'Platform fee recognized',
          });
        }

        await postLedgerBatch(tx, {
          batchId: createLedgerBatchId('ESCROW_RELEASE'),
          entries: ledgerEntries,
        });

        const profileUpdate = await tx.freelancerProfile.updateMany({
          where: { userId: order.freelancerId },
          data: {
            balance: { increment: payoutAmount },
            completedOrders: { increment: 1 },
            totalEarnings: { increment: payoutAmount },
          },
        });

        if (profileUpdate.count === 0) {
          await tx.freelancerProfile.create({
            data: {
              userId: order.freelancerId,
              skills: [],
              balance: payoutAmount,
              completedOrders: 1,
              totalEarnings: payoutAmount,
            },
          });
        }
      });
      
      auditLog('ESCROW_RELEASED', options?.auditActorId || clientId, {
        orderId,
        amount: payoutAmount,
        freelancerId: order.freelancerId,
        transactionId,
      });
      
      paymentLog('ESCROW_RELEASED', {
        orderId,
        amount: payoutAmount,
        freelancerId: order.freelancerId,
        transactionId,
      });
      
      return {
        success: true,
        status: 'RELEASED',
        message: 'Средства переведены фрилансеру',
        transactionId,
      };
    } catch (error) {
      if (error instanceof PaymentDomainError) {
        return {
          success: false,
          status: 'FAILED',
          message: error.message,
        };
      }
      logger.error('Escrow release error', { orderId, error });
      return {
        success: false,
        status: 'FAILED',
        message: 'Ошибка при освобождении эскроу',
      };
    }
  }
  
  /**
   * Возврат эскроу клиенту
   * Вызывается при отмене заказа или решении спора в пользу клиента
   */
  static async refundEscrow(
    orderId: string,
    initiatorId: string,
    reason: string
  ): Promise<PaymentResult> {
    try {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
      });
      
      if (!order) {
        return {
          success: false,
          status: 'FAILED',
          message: 'Заказ не найден',
        };
      }
      
      if (order.escrowStatus !== 'HOLDING' && order.escrowStatus !== 'DISPUTED') {
        return {
          success: false,
          status: 'FAILED',
          message: 'Эскроу не активен',
        };
      }

      const transactionId = createTransactionId('TXN_REF');
      const now = new Date();

      await prisma.$transaction(async (tx) => {
        const guardedUpdate = await tx.order.updateMany({
          where: {
            id: orderId,
            escrowStatus: { in: ['HOLDING', 'DISPUTED'] },
          },
          data: {
            escrowStatus: 'REFUNDED',
            escrowRefundedAt: now,
            status: 'CANCELLED',
            cancelReason: reason,
            cancelledAt: now,
          },
        });

        if (guardedUpdate.count === 0) {
          throw new PaymentDomainError('Эскроу уже обработан или неактивен');
        }

        await tx.transaction.create({
          data: {
            orderId,
            userId: order.clientId,
            type: 'ESCROW_REFUND',
            amount: order.escrowAmount,
            fee: 0,
            netAmount: order.escrowAmount,
            method: 'balance',
            status: 'COMPLETED',
            transactionId,
            completedAt: now,
          },
        });

        await postLedgerBatch(tx, {
          batchId: createLedgerBatchId('ESCROW_REFUND'),
          entries: [
            {
              account: 'REFUND_RESERVE',
              direction: 'DEBIT',
              amount: order.escrowAmount,
              orderId,
              userId: order.clientId,
              referenceType: 'order',
              referenceId: orderId,
              description: 'Release liability back to client',
            },
            {
              account: 'ESCROW',
              direction: 'CREDIT',
              amount: order.escrowAmount,
              orderId,
              userId: order.clientId,
              referenceType: 'order',
              referenceId: orderId,
              description: 'Escrow funds refunded',
            },
          ],
        });
      });
      
      auditLog('ESCROW_REFUNDED', initiatorId, {
        orderId,
        amount: order.escrowAmount,
        clientId: order.clientId,
        reason,
        transactionId,
      });
      
      paymentLog('ESCROW_REFUNDED', {
        orderId,
        amount: order.escrowAmount,
        clientId: order.clientId,
        reason,
        transactionId,
      });
      
      return {
        success: true,
        status: 'REFUNDED',
        message: 'Средства возвращены заказчику',
        transactionId,
      };
    } catch (error) {
      if (error instanceof PaymentDomainError) {
        return {
          success: false,
          status: 'FAILED',
          message: error.message,
        };
      }
      logger.error('Escrow refund error', { orderId, error });
      return {
        success: false,
        status: 'FAILED',
        message: 'Ошибка при возврате эскроу',
      };
    }
  }
  
  /**
   * Заморозить эскроу из-за спора
   */
  static async disputeEscrow(orderId: string, disputeId: string): Promise<PaymentResult> {
    try {
      const updated = await prisma.order.updateMany({
        where: {
          id: orderId,
          escrowStatus: 'HOLDING',
        },
        data: {
          escrowStatus: 'DISPUTED',
        },
      });

      if (updated.count === 0) {
        return {
          success: false,
          status: 'FAILED',
          message: 'Эскроу не находится в статусе HOLDING',
        };
      }
      
      return {
        success: true,
        status: 'HELD',
        message: 'Эскроу заморожен до решения спора',
      };
    } catch (error) {
      logger.error('Escrow dispute error', { orderId, error });
      return {
        success: false,
        status: 'FAILED',
        message: 'Ошибка при заморозке эскроу',
      };
    }
  }
  
  /**
   * Получить информацию об эскроу
   */
  static async getEscrowInfo(orderId: string): Promise<EscrowInfo | null> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        escrowAmount: true,
        escrowStatus: true,
        escrowHeldAt: true,
        escrowReleasedAt: true,
        escrowRefundedAt: true,
      },
    });
    
    if (!order) return null;
    
    return {
      orderId: order.id,
      amount: Number(order.escrowAmount),
      status: order.escrowStatus as EscrowStatus,
      heldAt: order.escrowHeldAt || undefined,
      releasedAt: order.escrowReleasedAt || undefined,
      refundedAt: order.escrowRefundedAt || undefined,
    };
  }
}

// ============================================
// WITHDRAWAL SERVICE
// ============================================

export class WithdrawalService {
  /**
   * Запросить вывод средств
   */
  static async requestWithdrawal(
    userId: string,
    amount: number,
    method: PaymentMethod,
    details: unknown
  ): Promise<PaymentResult> {
    try {
      // Проверяем баланс
      const profile = await prisma.freelancerProfile.findUnique({
        where: { userId },
      });
      
      if (!profile) {
        return {
          success: false,
          status: 'FAILED',
          message: 'Профиль фрилансера не найден',
        };
      }
      
      if (Number(profile.balance) < amount) {
        return {
          success: false,
          status: 'FAILED',
          message: `Недостаточно средств. Баланс: ${Number(profile.balance)} сом`,
        };
      }
      
      if (amount < 1000) {
        return {
          success: false,
          status: 'FAILED',
          message: 'Минимальная сумма вывода: 1000 сом',
        };
      }

      const transactionId = createTransactionId('WDR');
      const fee = 0;
      const netAmount = amount - fee;
      const normalizedDetails =
        typeof details === 'string' ? details : JSON.stringify(details ?? {});

      await prisma.$transaction(async (tx) => {
        const balanceUpdate = await tx.freelancerProfile.updateMany({
          where: {
            userId,
            balance: { gte: amount },
          },
          data: {
            balance: { decrement: amount },
            pendingWithdrawal: { increment: amount },
          },
        });

        if (balanceUpdate.count === 0) {
          throw new PaymentDomainError('Недостаточно средств для вывода');
        }

        await tx.withdrawal.create({
          data: {
            userId,
            amount,
            fee,
            netAmount,
            method,
            status: 'PENDING',
            details: normalizedDetails,
            transactionId,
          },
        });

        await postLedgerBatch(tx, {
          batchId: createLedgerBatchId('WITHDRAW_REQUEST'),
          entries: [
            {
              account: 'USER_BALANCE',
              direction: 'DEBIT',
              amount,
              userId,
              referenceType: 'withdrawal_request',
              referenceId: transactionId,
              description: 'Funds moved to withdrawal hold',
            },
            {
              account: 'WITHDRAWAL_HOLD',
              direction: 'CREDIT',
              amount,
              userId,
              referenceType: 'withdrawal_request',
              referenceId: transactionId,
              description: 'Withdrawal hold created',
            },
          ],
        });
      });
      
      paymentLog('WITHDRAWAL_REQUESTED', {
        userId,
        amount,
        method,
        transactionId,
      });
      
      return {
        success: true,
        status: 'PENDING',
        message: 'Запрос на вывод создан. Обработка в течение 24 часов.',
        transactionId,
      };
    } catch (error) {
      if (error instanceof PaymentDomainError) {
        return {
          success: false,
          status: 'FAILED',
          message: error.message,
        };
      }
      logger.error('Withdrawal request error', { userId, error });
      return {
        success: false,
        status: 'FAILED',
        message: 'Ошибка при создании запроса на вывод',
      };
    }
  }
}

// ============================================
// PAYMENT INFO
// ============================================

export function getPaymentMethods() {
  return Object.entries(PAYMENT_CONFIG.methods)
    .filter(([_, config]) => config.enabled)
    .map(([id, config]) => ({
      id,
      name: config.name,
      fee: config.fee,
      enabled: config.enabled,
      currencies: config.currencies,
    }));
}

export function getPaymentConfig() {
  return {
    platformFee: PAYMENT_CONFIG.platformFee,
    minAmount: PAYMENT_CONFIG.minAmount,
    maxAmount: PAYMENT_CONFIG.maxAmount,
    methods: getPaymentMethods(),
  };
}
