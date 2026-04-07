import { Router, Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { orderClientGuard, orderParticipantGuard } from '../middleware/roleGuard';
import { auditLog } from '../lib/logger';
import { FEATURE_FLAGS, FeatureFlagKey, getFeatureFlag } from '../lib/featureFlags';

const router = Router();

async function requireFlagOr503(flag: FeatureFlagKey, res: Response): Promise<boolean> {
  const enabled = await getFeatureFlag(flag);
  if (enabled) return true;

  res.status(503).json({
    success: false,
    error: `Feature "${flag}" disabled`,
  });
  return false;
}

function parseDecimal(value: unknown): Prisma.Decimal | null {
  if (typeof value === 'number') return new Prisma.Decimal(value);
  if (typeof value === 'string' && value.trim().length > 0) return new Prisma.Decimal(value);
  return null;
}

// ============================================
// MILESTONES
// ============================================

router.get('/orders/:orderId/milestones', authMiddleware, orderParticipantGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!(await requireFlagOr503(FEATURE_FLAGS.MILESTONES_ENABLED, res))) return;

    const { orderId } = req.params;
    const milestones = await prisma.milestone.findMany({
      where: { orderId },
      orderBy: [{ createdAt: 'asc' }],
    });

    res.json({
      success: true,
      data: milestones,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/orders/:orderId/milestones', authMiddleware, orderClientGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!(await requireFlagOr503(FEATURE_FLAGS.MILESTONES_ENABLED, res))) return;

    const user = req.user!;
    const { orderId } = req.params;
    const { title, description, amount, dueDate } = req.body as {
      title?: string;
      description?: string;
      amount?: string | number;
      dueDate?: string;
    };

    const parsedAmount = parseDecimal(amount);
    const parsedDate = dueDate ? new Date(dueDate) : null;
    if (!title?.trim() || !parsedAmount || !parsedDate || Number.isNaN(parsedDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'title, amount, dueDate are required',
      });
    }

    const milestone = await prisma.milestone.create({
      data: {
        orderId,
        title: title.trim(),
        description: description?.trim() || null,
        amount: parsedAmount,
        dueDate: parsedDate,
        createdById: user.id,
        status: 'ACTIVE',
      },
    });

    auditLog('MILESTONE_CREATED', user.id, {
      orderId,
      milestoneId: milestone.id,
      amount: parsedAmount.toString(),
    });

    res.status(201).json({
      success: true,
      data: milestone,
      message: 'Milestone created',
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/milestones/:milestoneId', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!(await requireFlagOr503(FEATURE_FLAGS.MILESTONES_ENABLED, res))) return;

    const user = req.user!;
    const { milestoneId } = req.params;
    const { status, note } = req.body as {
      status?: 'ACTIVE' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
      note?: string;
    };

    if (!status) {
      return res.status(400).json({ success: false, error: 'status is required' });
    }

    const milestone = await prisma.milestone.findUnique({
      where: { id: milestoneId },
      include: {
        order: {
          select: {
            id: true,
            clientId: true,
            freelancerId: true,
          },
        },
      },
    });

    if (!milestone) {
      return res.status(404).json({ success: false, error: 'Milestone not found' });
    }

    const isAdmin = user.role === 'ADMIN';
    const isClient = milestone.order.clientId === user.id;
    const isFreelancer = milestone.order.freelancerId === user.id;

    if (!isAdmin && !isClient && !isFreelancer) {
      return res.status(403).json({ success: false, error: 'Not order participant' });
    }

    if (!isAdmin) {
      if (isFreelancer && !['SUBMITTED'].includes(status)) {
        return res.status(403).json({ success: false, error: 'Freelancer can only submit milestone' });
      }
      if (isClient && !['ACTIVE', 'APPROVED', 'REJECTED', 'CANCELLED'].includes(status)) {
        return res.status(403).json({ success: false, error: 'Client cannot set this status' });
      }
    }

    const updateData: Prisma.MilestoneUpdateInput = {
      status,
      note: note?.trim() || null,
    };
    if (status === 'SUBMITTED') updateData.submittedAt = new Date();
    if (status === 'APPROVED') {
      updateData.approvedAt = new Date();
      updateData.completedAt = new Date();
    }
    if (status === 'REJECTED') updateData.rejectedAt = new Date();

    const updated = await prisma.milestone.update({
      where: { id: milestoneId },
      data: updateData,
    });

    auditLog('MILESTONE_STATUS_UPDATED', user.id, {
      orderId: milestone.order.id,
      milestoneId,
      status,
    });

    res.json({
      success: true,
      data: updated,
      message: 'Milestone updated',
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// CHANGE REQUESTS
// ============================================

router.get('/orders/:orderId/change-requests', authMiddleware, orderParticipantGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!(await requireFlagOr503(FEATURE_FLAGS.CHANGE_REQUESTS_ENABLED, res))) return;

    const { orderId } = req.params;
    const changeRequests = await prisma.changeRequest.findMany({
      where: { orderId },
      orderBy: [{ createdAt: 'desc' }],
    });

    res.json({
      success: true,
      data: changeRequests,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/orders/:orderId/change-requests', authMiddleware, orderParticipantGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!(await requireFlagOr503(FEATURE_FLAGS.CHANGE_REQUESTS_ENABLED, res))) return;

    const user = req.user!;
    const { orderId } = req.params;
    const { reason, requestedBudget, requestedDeadline } = req.body as {
      reason?: string;
      requestedBudget?: string | number;
      requestedDeadline?: string;
    };

    const parsedBudget = requestedBudget === undefined ? null : parseDecimal(requestedBudget);
    const parsedDate = requestedDeadline ? new Date(requestedDeadline) : null;

    if (!reason?.trim()) {
      return res.status(400).json({ success: false, error: 'reason is required' });
    }
    if (requestedBudget !== undefined && !parsedBudget) {
      return res.status(400).json({ success: false, error: 'requestedBudget invalid' });
    }
    if (requestedDeadline && (!parsedDate || Number.isNaN(parsedDate.getTime()))) {
      return res.status(400).json({ success: false, error: 'requestedDeadline invalid' });
    }

    const changeRequest = await prisma.changeRequest.create({
      data: {
        orderId,
        requestedById: user.id,
        reason: reason.trim(),
        requestedBudget: parsedBudget,
        requestedDeadline: parsedDate,
        status: 'OPEN',
      },
    });

    auditLog('CHANGE_REQUEST_CREATED', user.id, {
      orderId,
      changeRequestId: changeRequest.id,
    });

    res.status(201).json({
      success: true,
      data: changeRequest,
      message: 'Change request created',
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/change-requests/:changeRequestId/respond', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!(await requireFlagOr503(FEATURE_FLAGS.CHANGE_REQUESTS_ENABLED, res))) return;

    const user = req.user!;
    const { changeRequestId } = req.params;
    const { status, responseNote } = req.body as {
      status?: 'ACCEPTED' | 'REJECTED' | 'CANCELLED';
      responseNote?: string;
    };

    if (!status || !['ACCEPTED', 'REJECTED', 'CANCELLED'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'status must be ACCEPTED | REJECTED | CANCELLED',
      });
    }

    const changeRequest = await prisma.changeRequest.findUnique({
      where: { id: changeRequestId },
      include: {
        order: {
          select: {
            id: true,
            clientId: true,
            freelancerId: true,
          },
        },
      },
    });

    if (!changeRequest) {
      return res.status(404).json({ success: false, error: 'Change request not found' });
    }

    const isAdmin = user.role === 'ADMIN';
    const isParticipant =
      changeRequest.order.clientId === user.id || changeRequest.order.freelancerId === user.id;
    if (!isAdmin && !isParticipant) {
      return res.status(403).json({ success: false, error: 'Not order participant' });
    }

    if (!isAdmin && changeRequest.requestedById === user.id) {
      return res.status(403).json({ success: false, error: 'Requester cannot approve own change request' });
    }

    if (changeRequest.status !== 'OPEN') {
      return res.status(400).json({ success: false, error: 'Change request already resolved' });
    }

    const updated = await prisma.changeRequest.update({
      where: { id: changeRequestId },
      data: {
        status,
        responseNote: responseNote?.trim() || null,
        resolvedById: user.id,
        resolvedAt: new Date(),
      },
    });

    if (status === 'ACCEPTED') {
      const orderPatch: Prisma.OrderUpdateInput = {};
      if (changeRequest.requestedBudget) {
        orderPatch.budget = changeRequest.requestedBudget;
      }
      if (changeRequest.requestedDeadline) {
        orderPatch.deadline = changeRequest.requestedDeadline;
      }

      if (Object.keys(orderPatch).length > 0) {
        await prisma.order.update({
          where: { id: changeRequest.order.id },
          data: orderPatch,
        });
      }
    }

    auditLog('CHANGE_REQUEST_RESPONDED', user.id, {
      orderId: changeRequest.order.id,
      changeRequestId,
      status,
    });

    res.json({
      success: true,
      data: updated,
      message: 'Change request updated',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
