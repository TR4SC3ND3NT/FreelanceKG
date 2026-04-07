import { Router, Request, Response, NextFunction } from 'express';
import { SupportCasePriority, SupportCaseStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { permissionGuard } from '../middleware/roleGuard';
import { auditLogFromRequest } from '../lib/logger';
import { FEATURE_FLAGS, getFeatureFlag } from '../lib/featureFlags';

const router = Router();

const allowedPriorities = new Set<SupportCasePriority>(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
const allowedStatuses = new Set<SupportCaseStatus>([
  'OPEN',
  'IN_PROGRESS',
  'WAITING_CUSTOMER',
  'RESOLVED',
  'CLOSED',
]);

async function requireCasesEnabled(res: Response): Promise<boolean> {
  const enabled = await getFeatureFlag(FEATURE_FLAGS.SUPPORT_CASES_ENABLED);
  if (enabled) return true;
  res.status(503).json({
    success: false,
    error: `Feature "${FEATURE_FLAGS.SUPPORT_CASES_ENABLED}" disabled`,
  });
  return false;
}

router.post('/', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!(await requireCasesEnabled(res))) return;
    const actor = req.user!;
    const {
      title,
      description,
      orderId,
      disputeId,
      priority,
      metadata,
    } = req.body as {
      title?: string;
      description?: string;
      orderId?: string;
      disputeId?: string;
      priority?: SupportCasePriority;
      metadata?: unknown;
    };

    if (!title?.trim() || !description?.trim()) {
      return res.status(400).json({
        success: false,
        error: 'title and description are required',
      });
    }

    const safePriority = priority && allowedPriorities.has(priority) ? priority : 'MEDIUM';
    const supportCase = await prisma.supportCase.create({
      data: {
        title: title.trim(),
        description: description.trim(),
        createdById: actor.id,
        orderId: orderId || null,
        disputeId: disputeId || null,
        priority: safePriority,
        metadata: metadata as any,
      },
    });

    auditLogFromRequest(req, 'SUPPORT_CASE_CREATED', {
      caseId: supportCase.id,
      entityType: 'support_case',
      orderId: orderId || null,
      disputeId: disputeId || null,
      priority: safePriority,
    });

    res.status(201).json({
      success: true,
      data: supportCase,
      message: 'Support case created',
    });
  } catch (error) {
    next(error);
  }
});

router.get('/my', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!(await requireCasesEnabled(res))) return;
    const actor = req.user!;
    const { page = '1', limit = '20' } = req.query;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const skip = (pageNum - 1) * limitNum;

    const where =
      actor.role === 'ADMIN'
        ? {
            OR: [{ createdById: actor.id }, { assignedToId: actor.id }],
          }
        : {
            createdById: actor.id,
          };

    const [items, total] = await Promise.all([
      prisma.supportCase.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip,
        take: limitNum,
      }),
      prisma.supportCase.count({ where }),
    ]);

    res.json({
      success: true,
      data: items,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/', authMiddleware, permissionGuard('cases.read'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!(await requireCasesEnabled(res))) return;
    const { status, priority, assignedToId, page = '1', limit = '20' } = req.query;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const skip = (pageNum - 1) * limitNum;
    const where: Record<string, unknown> = {};

    if (typeof status === 'string' && allowedStatuses.has(status as SupportCaseStatus)) {
      where.status = status;
    }
    if (typeof priority === 'string' && allowedPriorities.has(priority as SupportCasePriority)) {
      where.priority = priority;
    }
    if (typeof assignedToId === 'string' && assignedToId.trim().length > 0) {
      where.assignedToId = assignedToId.trim();
    }

    const [items, total] = await Promise.all([
      prisma.supportCase.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip,
        take: limitNum,
      }),
      prisma.supportCase.count({ where }),
    ]);

    res.json({
      success: true,
      data: items,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/assign', authMiddleware, permissionGuard('cases.manage'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!(await requireCasesEnabled(res))) return;
    const actor = req.user!;
    const { id } = req.params;
    const { assignedToId } = req.body as { assignedToId?: string | null };

    const supportCase = await prisma.supportCase.update({
      where: { id },
      data: {
        assignedToId: assignedToId || null,
        status: assignedToId ? 'IN_PROGRESS' : 'OPEN',
      },
    });

    auditLogFromRequest(req, 'SUPPORT_CASE_ASSIGNED', {
      caseId: supportCase.id,
      entityType: 'support_case',
      assignedToId: assignedToId || null,
    });

    res.json({
      success: true,
      data: supportCase,
      message: 'Case assignment updated',
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/status', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!(await requireCasesEnabled(res))) return;
    const actor = req.user!;
    const { id } = req.params;
    const { status, resolution } = req.body as {
      status?: SupportCaseStatus;
      resolution?: string;
    };

    if (!status || !allowedStatuses.has(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid support case status',
      });
    }

    const existing = await prisma.supportCase.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Support case not found',
      });
    }

    const canManage =
      actor.role === 'ADMIN' ||
      actor.permissions?.includes('cases.manage') ||
      existing.createdById === actor.id ||
      existing.assignedToId === actor.id;
    if (!canManage) {
      return res.status(403).json({
        success: false,
        error: 'No access to update this support case',
      });
    }

    const now = new Date();
    const updated = await prisma.supportCase.update({
      where: { id },
      data: {
        status,
        resolution: resolution?.trim() || existing.resolution,
        resolvedAt: status === 'RESOLVED' ? now : status === 'CLOSED' ? existing.resolvedAt || now : null,
        closedAt: status === 'CLOSED' ? now : null,
      },
    });

    auditLogFromRequest(req, 'SUPPORT_CASE_STATUS_UPDATED', {
      caseId: updated.id,
      entityType: 'support_case',
      status,
    });

    res.json({
      success: true,
      data: updated,
      message: 'Case status updated',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
