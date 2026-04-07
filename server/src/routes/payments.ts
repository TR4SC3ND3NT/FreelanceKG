/**
 * Payment Routes
 * GET /api/payments/config - Get payment configuration
 * POST /api/payments/escrow - Create escrow for order
 * GET /api/payments/balance - Get my balance
 * POST /api/payments/withdraw - Request withdrawal
 * GET /api/payments/transactions - My transactions
 */

import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { clientOnly, freelancerOnly, orderClientGuard } from '../middleware/roleGuard';
import { validate, createPaymentSchema } from '../lib/validation';
import { EscrowService, WithdrawalService, getPaymentConfig, getPaymentMethods } from '../lib/payment';
import { logger, auditLogFromRequest } from '../lib/logger';
import { getFreelancerPaymentDetails } from '../lib/userSettings';
import { getPaymentGateway } from '../lib/paymentGateway';
import { env } from '../config/env';
import { executeIdempotentHttp, getHeaderIdempotencyKey, IdempotencyConflictError } from '../lib/idempotency';

const router = Router();

// ============================================
// GET PAYMENT CONFIGURATION
// ============================================

router.get('/config', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: getPaymentConfig(),
  });
});

// ============================================
// GET PAYMENT METHODS
// ============================================

router.get('/methods', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: getPaymentMethods(),
  });
});

// ============================================
// CREATE ESCROW
// ============================================

router.post('/escrow', authMiddleware, clientOnly, validate(createPaymentSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const { orderId, amount, method } = req.body;
    
    // Verify order exists and belongs to user
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });
    
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Заказ не найден',
      });
    }
    
    if (order.clientId !== user.id) {
      return res.status(403).json({
        success: false,
        error: 'Вы не являетесь заказчиком',
      });
    }
    
    if (order.escrowStatus !== 'NONE') {
      return res.status(400).json({
        success: false,
        error: 'Эскроу уже создан для этого заказа',
      });
    }

    if (!['PENDING', 'ACTIVE'].includes(order.status)) {
      return res.status(400).json({
        success: false,
        error: 'Эскроу можно создать только для активного или ожидающего заказа',
      });
    }

    const requestedAmount = Math.round(Number(amount) * 100);
    const orderBudgetAmount = Math.round(Number(order.budget) * 100);
    if (requestedAmount !== orderBudgetAmount) {
      return res.status(400).json({
        success: false,
        error: `Сумма эскроу должна совпадать с бюджетом заказа (${order.budget} сом)`,
      });
    }
    
    const idempotencyHeader = req.headers['x-idempotency-key'];
    const idempotencyKey = Array.isArray(idempotencyHeader) ? idempotencyHeader[0] : idempotencyHeader;
    const result = await EscrowService.createEscrow(orderId, user.id, amount, method, {
      idempotencyKey,
    });
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.message,
      });
    }
    
    auditLogFromRequest(req, 'ESCROW_CREATED', {
      orderId,
      amount,
      method,
      transactionId: result.transactionId,
    });
    
    const statusCode = result.status === 'PENDING' ? 202 : 200;
    res.status(statusCode).json({
      success: true,
      data: result,
      message:
        result.status === 'PENDING'
          ? 'Платёж инициирован. Завершите оплату для активации эскроу.'
          : 'Средства заморожены в эскроу',
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// PAYMENT WEBHOOK (provider)
// ============================================

router.post('/webhook/:provider', async (req: Request, res: Response) => {
  try {
    const { provider } = req.params;
    if (provider !== env.PAYMENT_PROVIDER) {
      return res.status(400).json({
        success: false,
        error: `Webhook provider "${provider}" не активен`,
      });
    }

    const event = typeof req.body?.event === 'string' ? req.body.event : '';
    const providerPaymentId =
      typeof req.body?.providerPaymentId === 'string'
        ? req.body.providerPaymentId
        : typeof req.body?.transactionId === 'string'
          ? req.body.transactionId
          : '';

    if (!providerPaymentId) {
      return res.status(400).json({
        success: false,
        error: 'providerPaymentId обязателен',
      });
    }

    const gateway = getPaymentGateway();
    const isValid = gateway.verifyWebhook?.({
      headers: req.headers as Record<string, string | string[] | undefined>,
      rawBody: (req as Request & { rawBody?: string }).rawBody,
      payload: req.body,
    }) ?? false;

    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'Невалидная подпись webhook',
      });
    }

    if (event === 'payment.failed') {
      const reason = typeof req.body?.reason === 'string' ? req.body.reason : 'Платёж отклонён провайдером';
      const fail = await EscrowService.failEscrowIntent(providerPaymentId, reason, req.body as Record<string, unknown>);
      return res.json({
        success: true,
        data: fail,
      });
    }

    const confirm = await EscrowService.confirmEscrowIntent(
      providerPaymentId,
      req.body as Record<string, unknown>
    );

    if (!confirm.success) {
      return res.status(400).json({
        success: false,
        error: confirm.message,
      });
    }

    res.json({
      success: true,
      data: confirm,
      message: 'Webhook обработан, эскроу подтверждён',
    });
  } catch (error) {
    logger.error('Payment webhook error', { error });
    res.status(500).json({
      success: false,
      error: 'Ошибка обработки webhook',
    });
  }
});

// ============================================
// GET ESCROW INFO
// ============================================

router.get('/escrow/:orderId', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const { orderId } = req.params;
    
    // Verify access
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });
    
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Заказ не найден',
      });
    }
    
    const isParticipant = order.clientId === user.id || order.freelancerId === user.id;
    
    if (!isParticipant && user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Нет доступа',
      });
    }
    
    const escrowInfo = await EscrowService.getEscrowInfo(orderId);
    
    res.json({
      success: true,
      data: escrowInfo,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET MY BALANCE (Freelancer)
// ============================================

router.get('/balance', authMiddleware, freelancerOnly, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    
    const profile = await prisma.freelancerProfile.findUnique({
      where: { userId: user.id },
      select: {
        balance: true,
        pendingWithdrawal: true,
        totalEarnings: true,
      },
    });
    
    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'Профиль не найден',
      });
    }
    
    // Get pending orders earnings
    const pendingOrders = await prisma.order.aggregate({
      where: {
        freelancerId: user.id,
        status: { in: ['ACTIVE', 'SUBMITTED'] },
        escrowStatus: 'HOLDING',
      },
      _sum: { netAmount: true },
      _count: { id: true },
    });
    
    res.json({
      success: true,
      data: {
        available: profile.balance,
        pending: profile.pendingWithdrawal,
        totalEarnings: profile.totalEarnings,
        inEscrow: pendingOrders._sum.netAmount || 0,
        pendingOrdersCount: pendingOrders._count.id,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// REQUEST WITHDRAWAL
// ============================================

router.post('/withdraw', authMiddleware, freelancerOnly, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const { amount, method, details } = req.body as { amount: number; method: string; details?: string };
    
    if (!amount || amount < 1000) {
      return res.status(400).json({
        success: false,
        error: 'Минимальная сумма вывода: 1000 сом',
      });
    }
    
    if (!method) {
      return res.status(400).json({
        success: false,
        error: 'Укажите метод вывода',
      });
    }

    if (!['card', 'elsom', 'odengi', 'mbank'].includes(method)) {
      return res.status(400).json({
        success: false,
        error: 'Некорректный метод вывода',
      });
    }
    
    const savedPaymentDetails = await getFreelancerPaymentDetails(user.id);
    const normalizedDetails = typeof details === 'string' ? details.trim() : '';
    const resolvedDetails =
      normalizedDetails ||
      (savedPaymentDetails?.method === method ? savedPaymentDetails.value.trim() : '');

    if (!resolvedDetails) {
      return res.status(400).json({
        success: false,
        error: 'Укажите реквизиты для вывода',
      });
    }
    
    const idempotencyKey = getHeaderIdempotencyKey(req.headers as Record<string, string | string[] | undefined>);
    const idempotent = await executeIdempotentHttp({
      key: idempotencyKey,
      scope: 'withdrawal_request',
      actorId: user.id,
      payload: {
        amount,
        method,
        details: resolvedDetails,
      },
      ttlMinutes: 30,
      handler: async () => {
        const result = await WithdrawalService.requestWithdrawal(
          user.id,
          amount,
          method as 'card' | 'elsom' | 'odengi' | 'mbank',
          resolvedDetails
        );

        if (!result.success) {
          return {
            status: 400,
            body: {
              success: false,
              error: result.message,
            },
          };
        }

        auditLogFromRequest(req, 'WITHDRAWAL_REQUESTED', {
          amount,
          method,
          transactionId: result.transactionId,
        });

        return {
          status: 200,
          body: {
            success: true,
            data: result,
            message: 'Запрос на вывод создан',
          },
        };
      },
    });

    return res.status(idempotent.response.status).json(idempotent.response.body);
  } catch (error) {
    if (error instanceof IdempotencyConflictError) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message,
      });
    }
    next(error);
  }
});

// ============================================
// GET MY TRANSACTIONS
// ============================================

router.get('/transactions', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const { type, page = 1, limit = 20 } = req.query;
    
    const skip = (Number(page) - 1) * Number(limit);
    
    const where: any = { userId: user.id };
    
    if (type) {
      where.type = type;
    }
    
    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          order: {
            select: { id: true, title: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
      }),
      prisma.transaction.count({ where }),
    ]);
    
    res.json({
      success: true,
      data: transactions,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET MY WITHDRAWALS
// ============================================

router.get('/withdrawals', authMiddleware, freelancerOnly, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const { status, page = 1, limit = 10 } = req.query;
    
    const skip = (Number(page) - 1) * Number(limit);
    
    const where: any = { userId: user.id };
    
    if (status) {
      where.status = status;
    }
    
    const [withdrawals, total] = await Promise.all([
      prisma.withdrawal.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
      }),
      prisma.withdrawal.count({ where }),
    ]);
    
    res.json({
      success: true,
      data: withdrawals,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// CLIENT STATS
// ============================================

router.get('/stats/client', authMiddleware, clientOnly, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    
    const [
      activeOrders,
      completedOrders,
      totalSpent,
      inEscrow,
    ] = await Promise.all([
      prisma.order.count({
        where: { clientId: user.id, status: { in: ['ACTIVE', 'SUBMITTED'] } },
      }),
      prisma.order.count({
        where: { clientId: user.id, status: 'COMPLETED' },
      }),
      prisma.order.aggregate({
        where: { clientId: user.id, status: 'COMPLETED' },
        _sum: { budget: true },
      }),
      prisma.order.aggregate({
        where: { clientId: user.id, escrowStatus: 'HOLDING' },
        _sum: { escrowAmount: true },
      }),
    ]);
    
    res.json({
      success: true,
      data: {
        activeOrders,
        completedOrders,
        totalSpent: totalSpent._sum.budget || 0,
        inEscrow: inEscrow._sum.escrowAmount || 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// FREELANCER STATS
// ============================================

router.get('/stats/freelancer', authMiddleware, freelancerOnly, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    
    const profile = await prisma.freelancerProfile.findUnique({
      where: { userId: user.id },
    });
    
    const [
      activeOrders,
      completedOrders,
      pendingAmount,
    ] = await Promise.all([
      prisma.order.count({
        where: { freelancerId: user.id, status: { in: ['ACTIVE', 'SUBMITTED'] } },
      }),
      prisma.order.count({
        where: { freelancerId: user.id, status: 'COMPLETED' },
      }),
      prisma.order.aggregate({
        where: { freelancerId: user.id, escrowStatus: 'HOLDING' },
        _sum: { netAmount: true },
      }),
    ]);
    
    res.json({
      success: true,
      data: {
        activeOrders,
        completedOrders,
        totalEarnings: profile?.totalEarnings || 0,
        balance: profile?.balance || 0,
        pendingAmount: pendingAmount._sum.netAmount || 0,
        rating: profile?.rating || 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
