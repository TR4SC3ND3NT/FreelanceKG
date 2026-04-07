/**
 * Dispute Routes
 * GET /api/disputes - My disputes
 * GET /api/disputes/:id - Dispute details
 * POST /api/disputes - Open dispute
 * POST /api/disputes/:id/respond - Respond to dispute
 */

import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { orderParticipantGuard, adminOnly } from '../middleware/roleGuard';
import { validate, createDisputeSchema } from '../lib/validation';
import { EscrowService } from '../lib/payment';
import { EmailService } from '../lib/email';
import { logger, auditLogFromRequest } from '../lib/logger';
import { TelegramService } from '../lib/telegram';
import { executeIdempotentHttp, getHeaderIdempotencyKey, IdempotencyConflictError } from '../lib/idempotency';

const router = Router();

// ============================================
// GET MY DISPUTES
// ============================================

router.get('/', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const { status, page = 1, limit = 10 } = req.query;
    
    const skip = (Number(page) - 1) * Number(limit);
    
    // Get disputes where user is involved
    const where: any = {
      OR: [
        { openedById: user.id },
        { order: { clientId: user.id } },
        { order: { freelancerId: user.id } },
      ],
    };
    
    if (status) {
      where.status = status;
    }
    
    const [disputes, total] = await Promise.all([
      prisma.dispute.findMany({
        where,
        include: {
          order: {
            select: {
              id: true,
              title: true,
              budget: true,
              escrowAmount: true,
              client: {
                select: { id: true, name: true, avatar: true },
              },
              freelancer: {
                select: { id: true, name: true, avatar: true },
              },
            },
          },
          openedBy: {
            select: { id: true, name: true, avatar: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
      }),
      prisma.dispute.count({ where }),
    ]);
    
    res.json({
      success: true,
      data: disputes,
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
// GET DISPUTE BY ID
// ============================================

router.get('/:id', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    
    const dispute = await prisma.dispute.findUnique({
      where: { id },
      include: {
        order: {
          select: {
            id: true,
            title: true,
            description: true,
            budget: true,
            escrowAmount: true,
            status: true,
            client: {
              select: { id: true, name: true, avatar: true, email: true },
            },
            freelancer: {
              select: { id: true, name: true, avatar: true, email: true },
            },
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 20,
              include: {
                sender: {
                  select: { id: true, name: true },
                },
              },
            },
          },
        },
        openedBy: {
          select: { id: true, name: true, avatar: true },
        },
        events: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    
    if (!dispute) {
      return res.status(404).json({
        success: false,
        error: 'Спор не найден',
      });
    }
    
    // Check access
    const isInvolved = 
      dispute.openedById === user.id ||
      dispute.order.client.id === user.id ||
      dispute.order.freelancer?.id === user.id ||
      user.role === 'ADMIN';
    
    if (!isInvolved) {
      return res.status(403).json({
        success: false,
        error: 'Нет доступа к этому спору',
      });
    }
    
    res.json({
      success: true,
      data: dispute,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// OPEN DISPUTE
// ============================================

router.post('/', authMiddleware, validate(createDisputeSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const { orderId, reason, evidence } = req.body;
    
    // Check order exists
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        client: {
          select: { id: true, email: true, name: true },
        },
        freelancer: {
          select: { id: true, email: true, name: true },
        },
        dispute: true,
      },
    });
    
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Заказ не найден',
      });
    }
    
    // Check user is participant
    const isParticipant = order.clientId === user.id || order.freelancerId === user.id;
    
    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        error: 'Вы не участник этого заказа',
      });
    }
    
    // Check if dispute already exists
    if (order.dispute) {
      return res.status(400).json({
        success: false,
        error: 'Спор по этому заказу уже открыт',
      });
    }
    
    // Can only dispute SUBMITTED orders
    if (order.status !== 'SUBMITTED') {
      return res.status(400).json({
        success: false,
        error: 'Спор можно открыть только для сданных заказов',
      });
    }
    
    // Create dispute + timeline event + update order status atomically
    const dispute = await prisma.$transaction(async (tx) => {
      const created = await tx.dispute.create({
        data: {
          orderId,
          openedById: user.id,
          reason,
          evidence: evidence || [],
          status: 'OPEN',
        },
        include: {
          order: {
            select: { id: true, title: true },
          },
          openedBy: {
            select: { id: true, name: true },
          },
        },
      });

      await tx.order.update({
        where: { id: orderId },
        data: { status: 'DISPUTED' },
      });

      await tx.disputeEvent.create({
        data: {
          disputeId: created.id,
          actorId: user.id,
          eventType: 'DISPUTE_OPENED',
          message: reason,
          payload: {
            evidenceCount: Array.isArray(evidence) ? evidence.length : 0,
          },
        },
      });

      return created;
    });
    
    // Freeze escrow
    if (order.escrowStatus === 'HOLDING') {
      await EscrowService.disputeEscrow(orderId, dispute.id);
    }
    
    // Notify other party
    const otherParty = order.clientId === user.id ? order.freelancer : order.client;
    if (otherParty) {
      EmailService.sendDisputeOpened(
        otherParty.email,
        order.title,
        reason,
        orderId
      ).catch((err) => {
        logger.error('Failed to send dispute email', { error: err });
      });

      await TelegramService.notifyOrderEvent({
        recipientUserId: otherParty.id,
        title: 'Открыт спор по заказу',
        lines: [
          `Заказ: ${order.title}`,
          `Причина: ${reason.substring(0, 120)}`,
        ],
        orderId,
      });
    }
    
    auditLogFromRequest(req, 'DISPUTE_OPENED', {
      disputeId: dispute.id,
      orderId,
      reason: reason.substring(0, 100),
    });
    
    res.status(201).json({
      success: true,
      data: dispute,
      message: 'Спор открыт. Мы рассмотрим его в течение 48 часов.',
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// RESPOND TO DISPUTE (other party)
// ============================================

router.post('/:id/respond', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const { response, evidence } = req.body;
    
    if (!response || response.length < 10) {
      return res.status(400).json({
        success: false,
        error: 'Ответ должен быть минимум 10 символов',
      });
    }
    
    const dispute = await prisma.dispute.findUnique({
      where: { id },
      include: {
        order: {
          select: { clientId: true, freelancerId: true },
        },
      },
    });
    
    if (!dispute) {
      return res.status(404).json({
        success: false,
        error: 'Спор не найден',
      });
    }
    
    // Check user is the other party (not the one who opened)
    const isOtherParty = 
      (dispute.order.clientId === user.id || dispute.order.freelancerId === user.id) &&
      dispute.openedById !== user.id;
    
    if (!isOtherParty && user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Только другая сторона может ответить на спор',
      });
    }
    
    if (dispute.status !== 'OPEN') {
      return res.status(400).json({
        success: false,
        error: 'Спор уже на рассмотрении или закрыт',
      });
    }
    
    // Update dispute with response
    const updatedDispute = await prisma.dispute.update({
      where: { id },
      data: {
        status: 'IN_REVIEW',
        // Store response as a message or in metadata
        // For simplicity, appending to reason
      },
    });
    
    await prisma.$transaction(async (tx) => {
      // Create message in order chat
      await tx.message.create({
        data: {
          orderId: dispute.orderId,
          senderId: user.id,
          content: `📝 Ответ на спор: ${response}`,
        },
      });

      await tx.disputeEvent.create({
        data: {
          disputeId: id,
          actorId: user.id,
          eventType: 'DISPUTE_RESPONSE',
          message: response,
          payload: {
            evidenceCount: Array.isArray(evidence) ? evidence.length : 0,
          },
        },
      });
    });
    
    auditLogFromRequest(req, 'DISPUTE_RESPONSE', {
      disputeId: id,
      response: response.substring(0, 100),
    });
    
    res.json({
      success: true,
      data: updatedDispute,
      message: 'Ответ на спор отправлен',
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/evidence', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actor = req.user!;
    const { id } = req.params;
    const { files } = req.body as { files?: string[] };
    const incomingFiles = Array.isArray(files)
      ? files.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : [];

    if (incomingFiles.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'files must be a non-empty array',
      });
    }

    const dispute = await prisma.dispute.findUnique({
      where: { id },
      include: {
        order: {
          select: { clientId: true, freelancerId: true },
        },
      },
    });
    if (!dispute) {
      return res.status(404).json({ success: false, error: 'Спор не найден' });
    }

    const canUpload =
      actor.role === 'ADMIN' ||
      actor.id === dispute.openedById ||
      actor.id === dispute.order.clientId ||
      actor.id === dispute.order.freelancerId;
    if (!canUpload) {
      return res.status(403).json({
        success: false,
        error: 'Недостаточно прав для добавления доказательств',
      });
    }

    const mergedEvidence = [...new Set([...(dispute.evidence || []), ...incomingFiles])];

    const updated = await prisma.$transaction(async (tx) => {
      const nextDispute = await tx.dispute.update({
        where: { id },
        data: { evidence: mergedEvidence },
      });

      await tx.disputeEvent.create({
        data: {
          disputeId: id,
          actorId: actor.id,
          eventType: 'EVIDENCE_ADDED',
          message: `Added ${incomingFiles.length} file(s)`,
          payload: { files: incomingFiles },
        },
      });

      return nextDispute;
    });

    auditLogFromRequest(req, 'DISPUTE_EVIDENCE_ADDED', {
      disputeId: id,
      files: incomingFiles.length,
    });

    res.json({
      success: true,
      data: updated,
      message: 'Доказательства добавлены',
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// RESOLVE DISPUTE (Admin only)
// ============================================

router.post('/:id/resolve', authMiddleware, adminOnly, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const { resolution, refundToClient, refundAmount } = req.body;
    
    if (!resolution) {
      return res.status(400).json({
        success: false,
        error: 'Укажите решение',
      });
    }
    
    const dispute = await prisma.dispute.findUnique({
      where: { id },
      include: {
        order: true,
      },
    });
    
    if (!dispute) {
      return res.status(404).json({
        success: false,
        error: 'Спор не найден',
      });
    }
    
    if (dispute.status === 'RESOLVED' || dispute.status === 'CLOSED') {
      return res.status(400).json({
        success: false,
        error: 'Спор уже решён',
      });
    }
    
    const idempotencyKey = getHeaderIdempotencyKey(req.headers as Record<string, string | string[] | undefined>);
    const idempotent = await executeIdempotentHttp({
      key: idempotencyKey,
      scope: `dispute_resolve:${id}`,
      actorId: user.id,
      payload: req.body,
      ttlMinutes: 60,
      handler: async () => {
        // Handle escrow based on decision
        if (refundToClient && dispute.order.escrowStatus === 'DISPUTED') {
          const refundResult = await EscrowService.refundEscrow(
            dispute.orderId,
            user.id,
            `Спор решён в пользу заказчика: ${resolution}`
          );

          if (!refundResult.success) {
            return {
              status: 400,
              body: {
                success: false,
                error: refundResult.message,
              },
            };
          }
        } else if (!refundToClient && dispute.order.escrowStatus === 'DISPUTED') {
          const releaseResult = await EscrowService.releaseEscrow(
            dispute.orderId,
            dispute.order.clientId,
            { allowDisputed: true, auditActorId: user.id }
          );

          if (!releaseResult.success) {
            return {
              status: 400,
              body: {
                success: false,
                error: releaseResult.message,
              },
            };
          }
        }

        // Update dispute
        const updatedDispute = await prisma.dispute.update({
          where: { id },
          data: {
            status: 'RESOLVED',
            resolution,
            resolvedAt: new Date(),
            resolvedById: user.id,
            refundAmount: refundToClient ? (refundAmount || dispute.order.escrowAmount) : 0,
          },
        });

        await prisma.disputeEvent.create({
          data: {
            disputeId: id,
            actorId: user.id,
            eventType: 'DISPUTE_RESOLVED',
            message: resolution,
            payload: {
              refundToClient: Boolean(refundToClient),
              refundAmount: refundToClient ? (refundAmount || dispute.order.escrowAmount) : 0,
            },
          },
        });

        await Promise.all([
          TelegramService.notifyOrderEvent({
            recipientUserId: dispute.order.clientId,
            title: 'Спор решён',
            lines: [
              `Заказ: ${dispute.order.title}`,
              refundToClient ? 'Решение: возврат клиенту' : 'Решение: выплата фрилансеру',
            ],
            orderId: dispute.orderId,
          }),
          dispute.order.freelancerId
            ? TelegramService.notifyOrderEvent({
                recipientUserId: dispute.order.freelancerId,
                title: 'Спор решён',
                lines: [
                  `Заказ: ${dispute.order.title}`,
                  refundToClient ? 'Решение: возврат клиенту' : 'Решение: выплата фрилансеру',
                ],
                orderId: dispute.orderId,
              })
            : Promise.resolve(),
        ]);

        auditLogFromRequest(req, 'DISPUTE_RESOLVED', {
          disputeId: id,
          orderId: dispute.orderId,
          refundToClient,
          refundAmount,
        });

        return {
          status: 200,
          body: {
            success: true,
            data: updatedDispute,
            message: 'Спор решён',
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

export default router;
