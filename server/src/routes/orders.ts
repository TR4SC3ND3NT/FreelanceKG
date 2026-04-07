/**
 * Order Routes
 * GET /api/orders - My orders
 * GET /api/orders/available - Available orders for freelancers
 * GET /api/orders/:id - Order details
 * POST /api/orders - Create order
 * POST /api/orders/:id/accept - Accept order (freelancer)
 * POST /api/orders/:id/submit - Submit work (freelancer)
 * POST /api/orders/:id/approve - Approve work (client)
 * POST /api/orders/:id/reject - Reject work (client)
 * POST /api/orders/:id/cancel - Cancel order
 */

import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { clientOnly, freelancerOnly, orderParticipantGuard, orderClientGuard, orderFreelancerGuard } from '../middleware/roleGuard';
import { validate, createOrderSchema, orderQuerySchema, submitWorkSchema, orderReviewBodySchema } from '../lib/validation';
import { EscrowService } from '../lib/payment';
import { EmailService } from '../lib/email';
import { logger, auditLog, auditLogFromRequest } from '../lib/logger';
import { TelegramService } from '../lib/telegram';
import { FEATURE_FLAGS, getFeatureFlag } from '../lib/featureFlags';
import { createNotification } from '../lib/notifications';

const router = Router();

async function recalculateFreelancerRating(freelancerId: string): Promise<void> {
  const aggregate = await prisma.review.aggregate({
    where: { toId: freelancerId },
    _avg: { rating: true },
    _count: { id: true },
  });

  await prisma.freelancerProfile.update({
    where: { userId: freelancerId },
    data: {
      rating: aggregate._avg.rating || 0,
      totalRatings: aggregate._count.id || 0,
    },
  });
}

async function createReviewForOrder(params: {
  orderId: string;
  fromId: string;
  toId: string;
  rating: number;
  comment: string;
}) {
  const existingReview = await prisma.review.findUnique({
    where: { orderId: params.orderId },
    select: { id: true },
  });

  if (existingReview) {
    return null;
  }

  const review = await prisma.review.create({
    data: {
      orderId: params.orderId,
      fromId: params.fromId,
      toId: params.toId,
      rating: params.rating,
      comment: params.comment,
    },
  });

  await recalculateFreelancerRating(params.toId);
  return review;
}

async function requireFeature(flag: (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS], res: Response): Promise<boolean> {
  const enabled = await getFeatureFlag(flag);
  if (enabled) return true;
  res.status(503).json({
    success: false,
    error: `Feature "${flag}" disabled`,
  });
  return false;
}

// ============================================
// GET MY ORDERS
// ============================================

router.get('/', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const { status, page = 1, limit = 10 } = req.query;
    
    const skip = (Number(page) - 1) * Number(limit);
    
    const where: any = {};
    
    if (user.role === 'CLIENT') {
      where.clientId = user.id;
    } else if (user.role === 'FREELANCER') {
      where.freelancerId = user.id;
    }
    
    if (status) {
      where.status = status;
    }
    
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          client: {
            select: { id: true, name: true, avatar: true },
          },
          freelancer: {
            select: { id: true, name: true, avatar: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
      }),
      prisma.order.count({ where }),
    ]);
    
    res.json({
      success: true,
      data: orders,
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
// GET AVAILABLE ORDERS (for freelancers)
// ============================================

router.get('/available', authMiddleware, freelancerOnly, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const { category, page = 1, limit = 10 } = req.query;
    
    const skip = (Number(page) - 1) * Number(limit);
    
    const where: any = {
      status: 'PENDING',
      freelancerId: null,
    };
    
    if (category) {
      where.category = category;
    }
    
    // Get freelancer's category to prioritize matching orders
    const profile = await prisma.freelancerProfile.findUnique({
      where: { userId: user.id },
      select: { category: true },
    });
    
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          client: {
            select: { id: true, name: true, avatar: true },
          },
        },
        orderBy: [
          // Prioritize matching category
          ...(profile?.category ? [{ category: profile.category === where.category ? 'asc' as const : 'desc' as const }] : []),
          { createdAt: 'desc' as const },
        ],
        skip,
        take: Number(limit),
      }),
      prisma.order.count({ where }),
    ]);
    
    res.json({
      success: true,
      data: orders,
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
// GET ORDER BY ID
// ============================================

router.get('/:id', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            avatar: true,
            createdAt: true,
          },
        },
        freelancer: {
          select: {
            id: true,
            name: true,
            avatar: true,
            freelancerProfile: {
              select: {
                rating: true,
                completedOrders: true,
                isVerified: true,
              },
            },
          },
        },
        review: true,
        dispute: {
          select: {
            id: true,
            status: true,
            reason: true,
            createdAt: true,
          },
        },
      },
    });
    
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Заказ не найден',
      });
    }
    
    // Check access
    const isParticipant = order.clientId === user.id || order.freelancerId === user.id;
    const isAdmin = user.role === 'ADMIN';
    
    // Non-participants can only see PENDING orders (to take them)
    if (!isParticipant && !isAdmin && order.status !== 'PENDING') {
      return res.status(403).json({
        success: false,
        error: 'Нет доступа к этому заказу',
      });
    }
    
    // Get escrow info
    const escrowInfo = await EscrowService.getEscrowInfo(id);
    
    res.json({
      success: true,
      data: {
        ...order,
        escrow: escrowInfo,
        isClient: order.clientId === user.id,
        isFreelancer: order.freelancerId === user.id,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// PROPOSALS (BIDS)
// ============================================

router.get('/:id/proposals', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!(await requireFeature(FEATURE_FLAGS.PROPOSALS_ENABLED, res))) return;
    const actor = req.user!;
    const { id } = req.params;

    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        clientId: true,
        freelancerId: true,
      },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Заказ не найден',
      });
    }

    const canSeeAll =
      actor.role === 'ADMIN' || actor.id === order.clientId || actor.id === order.freelancerId;

    const proposals = await prisma.proposal.findMany({
      where: {
        orderId: id,
        ...(canSeeAll ? {} : { freelancerId: actor.id }),
      },
      include: {
        freelancer: {
          select: {
            id: true,
            name: true,
            avatar: true,
            freelancerProfile: {
              select: {
                rating: true,
                completedOrders: true,
                isVerified: true,
              },
            },
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    res.json({
      success: true,
      data: proposals,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/proposals', authMiddleware, freelancerOnly, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!(await requireFeature(FEATURE_FLAGS.PROPOSALS_ENABLED, res))) return;
    const actor = req.user!;
    const { id } = req.params;
    const { amount, deliveryDays, message, metadata } = req.body as {
      amount?: number | string;
      deliveryDays?: number;
      message?: string;
      metadata?: unknown;
    };

    const parsedAmount = Number(amount);
    const parsedDeliveryDays = Number(deliveryDays);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Некорректная сумма предложения' });
    }
    if (!Number.isInteger(parsedDeliveryDays) || parsedDeliveryDays < 1 || parsedDeliveryDays > 365) {
      return res.status(400).json({ success: false, error: 'deliveryDays должен быть от 1 до 365' });
    }

    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        clientId: true,
        status: true,
        freelancerId: true,
      },
    });

    if (!order) {
      return res.status(404).json({ success: false, error: 'Заказ не найден' });
    }
    if (order.clientId === actor.id) {
      return res.status(403).json({ success: false, error: 'Нельзя откликаться на свой заказ' });
    }
    if (order.status !== 'PENDING' || order.freelancerId) {
      return res.status(400).json({ success: false, error: 'Отклики доступны только для открытых заказов' });
    }

    const existing = await prisma.proposal.findUnique({
      where: {
        orderId_freelancerId: {
          orderId: id,
          freelancerId: actor.id,
        },
      },
      select: { id: true, status: true },
    });

    if (existing && existing.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        error: 'Этот отклик уже обработан и не может быть изменён',
      });
    }

    const proposal = existing
      ? await prisma.proposal.update({
          where: { id: existing.id },
          data: {
            amount: parsedAmount,
            deliveryDays: parsedDeliveryDays,
            message: message?.trim() || null,
            metadata: metadata as any,
          },
        })
      : await prisma.proposal.create({
          data: {
            orderId: id,
            freelancerId: actor.id,
            amount: parsedAmount,
            deliveryDays: parsedDeliveryDays,
            message: message?.trim() || null,
            metadata: metadata as any,
          },
        });

    auditLogFromRequest(req, 'PROPOSAL_UPSERTED', {
      orderId: id,
      proposalId: proposal.id,
      amount: parsedAmount,
      deliveryDays: parsedDeliveryDays,
      entityType: 'proposal',
      entityId: proposal.id,
    });

    res.status(existing ? 200 : 201).json({
      success: true,
      data: proposal,
      message: existing ? 'Отклик обновлён' : 'Отклик отправлен',
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/proposals/:proposalId/accept', authMiddleware, orderClientGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!(await requireFeature(FEATURE_FLAGS.PROPOSALS_ENABLED, res))) return;
    const actor = req.user!;
    const { id, proposalId } = req.params;
    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const proposal = await tx.proposal.findUnique({
        where: { id: proposalId },
        select: {
          id: true,
          orderId: true,
          freelancerId: true,
          amount: true,
          deliveryDays: true,
          status: true,
        },
      });

      if (!proposal || proposal.orderId !== id) {
        throw new Error('Отклик не найден');
      }
      if (proposal.status !== 'PENDING') {
        throw new Error('Отклик уже обработан');
      }

      const acceptedOrder = await tx.order.updateMany({
        where: {
          id,
          clientId: actor.id,
          status: 'PENDING',
          freelancerId: null,
        },
        data: {
          freelancerId: proposal.freelancerId,
          status: 'ACTIVE',
          budget: proposal.amount,
          deadline: new Date(now.getTime() + proposal.deliveryDays * 24 * 60 * 60 * 1000),
        },
      });

      if (acceptedOrder.count === 0) {
        throw new Error('Заказ уже не доступен для принятия отклика');
      }

      const acceptedProposal = await tx.proposal.update({
        where: { id: proposalId },
        data: {
          status: 'ACCEPTED',
          respondedAt: now,
        },
      });

      await tx.proposal.updateMany({
        where: {
          orderId: id,
          id: { not: proposalId },
          status: 'PENDING',
        },
        data: {
          status: 'REJECTED',
          respondedAt: now,
        },
      });

      return acceptedProposal;
    });

    auditLogFromRequest(req, 'PROPOSAL_ACCEPTED', {
      orderId: id,
      proposalId,
      entityType: 'proposal',
      entityId: proposalId,
    });

    res.json({
      success: true,
      data: result,
      message: 'Отклик принят, исполнитель назначен',
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('не найден')) {
      return res.status(404).json({ success: false, error: error.message });
    }
    if (error instanceof Error) {
      return res.status(400).json({ success: false, error: error.message });
    }
    next(error);
  }
});

router.post('/:id/proposals/:proposalId/reject', authMiddleware, orderClientGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!(await requireFeature(FEATURE_FLAGS.PROPOSALS_ENABLED, res))) return;
    const actor = req.user!;
    const { id, proposalId } = req.params;

    const order = await prisma.order.findUnique({
      where: { id },
      select: { id: true, clientId: true },
    });
    if (!order || order.clientId !== actor.id) {
      return res.status(403).json({ success: false, error: 'Недостаточно прав' });
    }

    const proposal = await prisma.proposal.findFirst({
      where: {
        id: proposalId,
        orderId: id,
      },
    });
    if (!proposal) {
      return res.status(404).json({ success: false, error: 'Отклик не найден' });
    }
    if (proposal.status !== 'PENDING') {
      return res.status(400).json({ success: false, error: 'Отклик уже обработан' });
    }

    const updated = await prisma.proposal.update({
      where: { id: proposalId },
      data: {
        status: 'REJECTED',
        respondedAt: new Date(),
      },
    });

    auditLogFromRequest(req, 'PROPOSAL_REJECTED', {
      orderId: id,
      proposalId,
      entityType: 'proposal',
      entityId: proposalId,
    });

    res.json({
      success: true,
      data: updated,
      message: 'Отклик отклонён',
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// CREATE ORDER
// ============================================

router.post('/', authMiddleware, clientOnly, validate(createOrderSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const { title, description, category, budget, deadline, freelancerId } = req.body;
    
    const order = await prisma.order.create({
      data: {
        clientId: user.id,
        freelancerId: freelancerId || null,
        title,
        description,
        category,
        budget,
        deadline: new Date(deadline),
        status: freelancerId ? 'ACTIVE' : 'PENDING',
      },
      include: {
        client: {
          select: { id: true, name: true, avatar: true },
        },
      },
    });
    const orderLink = `/orders/${order.id}`;
    
    // Send email to client
    EmailService.sendOrderCreated(user.email, title, budget, order.id).catch((err) => {
      logger.error('Failed to send order created email', { error: err });
    });

    await createNotification({
      userId: user.id,
      type: 'ORDER_CREATED',
      title: 'Заказ создан',
      message: freelancerId
        ? `Заказ "${title}" создан и сразу назначен исполнителю.`
        : `Заказ "${title}" опубликован и ожидает откликов.`,
      link: orderLink,
      metadata: {
        orderId: order.id,
        budget,
        category,
      },
    });
    
    // If assigned to freelancer, notify them
    if (freelancerId) {
      const freelancer = await prisma.user.findUnique({
        where: { id: freelancerId },
        select: { email: true, name: true },
      });
      
      if (freelancer) {
        EmailService.sendNewOrderInCategory(
          freelancer.email,
          freelancer.name,
          title,
          budget,
          order.id
        ).catch((err) => {
          logger.error('Failed to send order notification', { error: err });
        });
      }

      await TelegramService.notifyOrderEvent({
        recipientUserId: freelancerId,
        title: 'Новый заказ',
        lines: [
          `Название: ${title}`,
          `Бюджет: ${Math.round(budget)} сом`,
        ],
        orderId: order.id,
      });

      await createNotification({
        userId: freelancerId,
        type: 'ORDER_CREATED',
        title: 'Новый заказ назначен',
        message: `Вам назначен заказ "${title}" с бюджетом ${Math.round(budget)} сом.`,
        link: orderLink,
        metadata: {
          orderId: order.id,
          budget,
          clientId: user.id,
        },
      });
    }
    
    auditLog('ORDER_CREATED', user.id, {
      orderId: order.id,
      title,
      budget,
      category,
    });
    
    res.status(201).json({
      success: true,
      data: order,
      message: 'Заказ создан',
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// ACCEPT ORDER (Freelancer)
// ============================================

router.post('/:id/accept', authMiddleware, freelancerOnly, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        client: {
          select: { email: true, name: true },
        },
      },
    });
    
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Заказ не найден',
      });
    }
    
    const accepted = await prisma.order.updateMany({
      where: {
        id,
        status: 'PENDING',
        freelancerId: null,
      },
      data: {
        freelancerId: user.id,
        status: 'ACTIVE',
      },
    });

    if (accepted.count === 0) {
      return res.status(409).json({
        success: false,
        error: 'Заказ уже взят другим фрилансером',
      });
    }

    const updatedOrder = await prisma.order.findUnique({
      where: { id },
      include: {
        freelancer: {
          select: { id: true, name: true, avatar: true },
        },
      },
    });
    
    // Notify client
    EmailService.sendOrderAccepted(
      order.client.email,
      order.title,
      user.name,
      order.id
    ).catch((err) => {
      logger.error('Failed to send order accepted email', { error: err });
    });

    await TelegramService.notifyOrderEvent({
      recipientUserId: order.clientId,
      title: 'Заказ принят фрилансером',
      lines: [
        `Заказ: ${order.title}`,
        `Фрилансер: ${user.name}`,
      ],
      orderId: order.id,
    });

    await createNotification({
      userId: order.clientId,
      type: 'ORDER_ACCEPTED',
      title: 'Заказ принят',
      message: `Фрилансер ${user.name} взял заказ "${order.title}" в работу.`,
      link: `/orders/${order.id}`,
      metadata: {
        orderId: order.id,
        freelancerId: user.id,
      },
    });
    
    auditLog('ORDER_ACCEPTED', user.id, {
      orderId: order.id,
      clientId: order.clientId,
    });
    
    res.json({
      success: true,
      data: updatedOrder,
      message: 'Вы взяли заказ',
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// SUBMIT WORK (Freelancer)
// ============================================

router.post('/:id/submit', authMiddleware, orderFreelancerGuard, validate(submitWorkSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const { message, files } = req.body;
    
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        client: {
          select: { email: true, name: true },
        },
      },
    });
    
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Заказ не найден',
      });
    }
    
    if (order.status !== 'ACTIVE') {
      return res.status(400).json({
        success: false,
        error: 'Заказ должен быть активным для сдачи работы',
      });
    }
    
    const updatedOrder = await prisma.order.update({
      where: { id },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
        submissionNote: message,
        submissionFiles: files || [],
      },
    });
    
    // Notify client
    EmailService.sendWorkSubmitted(
      order.client.email,
      order.title,
      order.id
    ).catch((err) => {
      logger.error('Failed to send work submitted email', { error: err });
    });

    await TelegramService.notifyOrderEvent({
      recipientUserId: order.clientId,
      title: 'Работа сдана на проверку',
      lines: [`Заказ: ${order.title}`],
      orderId: order.id,
    });

    await createNotification({
      userId: order.clientId,
      type: 'ORDER_SUBMITTED',
      title: 'Работа отправлена',
      message: `Фрилансер ${user.name} отправил результат по заказу "${order.title}" на проверку.`,
      link: `/orders/${order.id}`,
      metadata: {
        orderId: order.id,
        freelancerId: user.id,
      },
    });
    
    auditLog('WORK_SUBMITTED', user.id, {
      orderId: order.id,
    });
    
    res.json({
      success: true,
      data: updatedOrder,
      message: 'Работа отправлена на проверку',
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// APPROVE WORK (Client)
// ============================================

router.post('/:id/approve', authMiddleware, orderClientGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const { rating, comment } = req.body as { rating?: number; comment?: string };

    const hasReviewPayload = rating !== undefined || comment !== undefined;
    if (hasReviewPayload) {
      if (typeof rating !== 'number' || rating < 1 || rating > 5) {
        return res.status(400).json({
          success: false,
          error: 'Рейтинг должен быть от 1 до 5',
        });
      }

      if (typeof comment !== 'string' || comment.trim().length < 10) {
        return res.status(400).json({
          success: false,
          error: 'Комментарий к отзыву минимум 10 символов',
        });
      }
    }
    
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        freelancer: {
          select: { id: true, email: true, name: true },
        },
      },
    });
    
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Заказ не найден',
      });
    }
    
    if (order.status !== 'SUBMITTED') {
      return res.status(400).json({
        success: false,
        error: 'Работа ещё не сдана',
      });
    }
    
    // Release escrow
    if (order.escrowStatus === 'HOLDING') {
      const result = await EscrowService.releaseEscrow(id, user.id);
      
      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.message,
        });
      }
    } else {
      // No escrow, just complete
      await prisma.order.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });
    }
    
    const updatedOrder = await prisma.order.findUnique({
      where: { id },
    });
    
    // Notify freelancer
    if (order.freelancer) {
      EmailService.sendOrderCompleted(
        order.freelancer.email,
        order.title,
        Number(order.netAmount || order.budget),
        order.id,
        true
      ).catch((err) => {
        logger.error('Failed to send completion email', { error: err });
      });

      await TelegramService.notifyOrderEvent({
        recipientUserId: order.freelancer.id,
        title: 'Заказ завершён',
        lines: [
          `Заказ: ${order.title}`,
          `Выплата: ${Math.round(Number(order.netAmount || order.budget))} сом`,
        ],
        orderId: order.id,
      });

      await createNotification({
        userId: order.freelancer.id,
        type: 'ORDER_COMPLETED',
        title: hasReviewPayload ? 'Заказ завершён и отзыв добавлен' : 'Заказ завершён',
        message: hasReviewPayload
          ? `Заказ "${order.title}" принят. Выплата ${Math.round(Number(order.netAmount || order.budget))} сом и отзыв ${rating}/5 уже доступны.`
          : `Заказ "${order.title}" принят. Выплата ${Math.round(Number(order.netAmount || order.budget))} сом уже доступна.`,
        link: `/orders/${order.id}`,
        metadata: hasReviewPayload
          ? {
              orderId: order.id,
              amount: Number(order.netAmount || order.budget),
              rating,
            }
          : {
              orderId: order.id,
              amount: Number(order.netAmount || order.budget),
            },
      });
    }

    let reviewId: string | undefined;
    if (order.freelancerId && typeof rating === 'number' && typeof comment === 'string') {
      const createdReview = await createReviewForOrder({
        orderId: id,
        fromId: user.id,
        toId: order.freelancerId,
        rating,
        comment: comment.trim(),
      });
      reviewId = createdReview?.id;
    }
    
    auditLog('ORDER_COMPLETED', user.id, {
      orderId: order.id,
      freelancerId: order.freelancerId,
      amount: Number(order.netAmount || order.budget),
      reviewId,
    });
    
    res.json({
      success: true,
      data: updatedOrder,
      message: 'Работа принята! Средства переведены фрилансеру.',
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// APPROVE + REVIEW WORK (Client)
// ============================================

router.post('/:id/review', authMiddleware, orderClientGuard, validate(orderReviewBodySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const { rating, comment } = req.body as { rating: number; comment: string };

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        freelancer: {
          select: { id: true, email: true, name: true },
        },
      },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Заказ не найден',
      });
    }

    if (!order.freelancerId) {
      return res.status(400).json({
        success: false,
        error: 'У заказа нет назначенного фрилансера',
      });
    }

    if (order.status !== 'SUBMITTED') {
      return res.status(400).json({
        success: false,
        error: 'Работа ещё не сдана',
      });
    }

    // Release escrow
    if (order.escrowStatus === 'HOLDING') {
      const result = await EscrowService.releaseEscrow(id, user.id);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.message,
        });
      }
    } else {
      // No escrow, just complete
      await prisma.order.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });
    }

    const createdReview = await createReviewForOrder({
      orderId: id,
      fromId: user.id,
      toId: order.freelancerId,
      rating,
      comment: comment.trim(),
    });

    const updatedOrder = await prisma.order.findUnique({
      where: { id },
      include: {
        review: true,
      },
    });

    // Notify freelancer
    if (order.freelancer) {
      EmailService.sendOrderCompleted(
        order.freelancer.email,
        order.title,
        Number(order.netAmount || order.budget),
        order.id,
        true
      ).catch((err) => {
        logger.error('Failed to send completion email', { error: err });
      });

      await TelegramService.notifyOrderEvent({
        recipientUserId: order.freelancer.id,
        title: 'Заказ завершён и отзыв добавлен',
        lines: [
          `Заказ: ${order.title}`,
          `Оценка: ${rating}/5`,
          `Выплата: ${Math.round(Number(order.netAmount || order.budget))} сом`,
        ],
        orderId: order.id,
      });

      await createNotification({
        userId: order.freelancer.id,
        type: 'ORDER_COMPLETED',
        title: 'Заказ завершён и отзыв добавлен',
        message: `Заказ "${order.title}" принят. Выплата ${Math.round(Number(order.netAmount || order.budget))} сом доступна, рейтинг ${rating}/5 опубликован.`,
        link: `/orders/${order.id}`,
        metadata: createdReview?.id
          ? {
              orderId: order.id,
              amount: Number(order.netAmount || order.budget),
              rating,
              reviewId: createdReview.id,
            }
          : {
              orderId: order.id,
              amount: Number(order.netAmount || order.budget),
              rating,
            },
      });
    }

    auditLog('ORDER_COMPLETED_WITH_REVIEW', user.id, {
      orderId: order.id,
      freelancerId: order.freelancerId,
      rating,
      reviewId: createdReview?.id,
    });

    res.json({
      success: true,
      data: updatedOrder,
      message: createdReview
        ? 'Работа принята, отзыв опубликован.'
        : 'Работа принята. Отзыв по этому заказу уже существует.',
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// REJECT WORK (Client)
// ============================================

router.post('/:id/reject', authMiddleware, orderClientGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const { reason } = req.body;
    
    if (!reason || reason.length < 10) {
      return res.status(400).json({
        success: false,
        error: 'Укажите причину отклонения (минимум 10 символов)',
      });
    }
    
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        freelancer: {
          select: { id: true, name: true },
        },
      },
    });
    
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Заказ не найден',
      });
    }
    
    if (order.status !== 'SUBMITTED') {
      return res.status(400).json({
        success: false,
        error: 'Работа ещё не сдана',
      });
    }
    
    // Return to ACTIVE status
    const updatedOrder = await prisma.order.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        submittedAt: null,
      },
    });
    
    // Create message with rejection reason
    await prisma.message.create({
      data: {
        orderId: id,
        senderId: user.id,
        content: `❌ Работа отклонена. Причина: ${reason}`,
      },
    });

    if (order.freelancerId) {
      await createNotification({
        userId: order.freelancerId,
        type: 'SYSTEM',
        title: 'Нужна доработка',
        message: `Заказчик вернул заказ "${order.title}" на доработку и оставил комментарий.`,
        link: `/orders/${order.id}`,
        metadata: {
          orderId: order.id,
          reason,
        },
      });
    }
    
    auditLog('WORK_REJECTED', user.id, {
      orderId: order.id,
      reason,
    });
    
    res.json({
      success: true,
      data: updatedOrder,
      message: 'Работа отклонена. Фрилансер может доработать и сдать снова.',
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// CANCEL ORDER
// ============================================

router.post('/:id/cancel', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const { reason } = req.body;
    
    const order = await prisma.order.findUnique({
      where: { id },
    });
    
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Заказ не найден',
      });
    }
    
    // Only client can cancel, and only if PENDING or ACTIVE (before submission)
    if (order.clientId !== user.id) {
      return res.status(403).json({
        success: false,
        error: 'Только заказчик может отменить заказ',
      });
    }
    
    if (!['PENDING', 'ACTIVE'].includes(order.status)) {
      return res.status(400).json({
        success: false,
        error: 'Заказ в этом статусе нельзя отменить',
      });
    }
    
    // If there's escrow, refund it
    if (order.escrowStatus === 'HOLDING') {
      const result = await EscrowService.refundEscrow(id, user.id, reason || 'Отмена заказа');
      
      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.message,
        });
      }
    } else {
      await prisma.order.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelReason: reason,
        },
      });
    }
    
    const updatedOrder = await prisma.order.findUnique({
      where: { id },
    });

    if (order.freelancerId) {
      await createNotification({
        userId: order.freelancerId,
        type: 'ORDER_CANCELLED',
        title: 'Заказ отменён',
        message: `Заказ "${order.title}" был отменён заказчиком.`,
        link: `/orders/${order.id}`,
        metadata: {
          orderId: order.id,
          reason: reason || null,
        },
      });
    }
    
    auditLog('ORDER_CANCELLED', user.id, {
      orderId: order.id,
      reason,
    });
    
    res.json({
      success: true,
      data: updatedOrder,
      message: 'Заказ отменён',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
