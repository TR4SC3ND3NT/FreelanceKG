import { Router, Request, Response } from 'express';
import { authMiddleware, adminMiddleware } from '../middleware/auth';
import { logger, auditLogFromRequest } from '../lib/logger';
import { EscrowService } from '../lib/payment';
import { prisma } from '../lib/prisma';
import { permissionGuard } from '../middleware/roleGuard';
import { executeIdempotentHttp, getHeaderIdempotencyKey, IdempotencyConflictError } from '../lib/idempotency';
import { FEATURE_FLAGS, getFeatureFlag } from '../lib/featureFlags';

const router = Router();

// All routes require admin
router.use(authMiddleware);
router.use(adminMiddleware);

// GET /api/admin/stats - Dashboard statistics
router.get('/stats', permissionGuard('orders.read', 'finance.read'), async (req: Request, res: Response) => {
  try {
    const [
      totalUsers,
      totalFreelancers,
      totalClients,
      totalOrders,
      activeOrders,
      completedOrders,
      disputedOrders,
      totalRevenue,
      openDisputes,
      escrowHolding,
      platformFeeSum,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: 'FREELANCER' } }),
      prisma.user.count({ where: { role: 'CLIENT' } }),
      prisma.order.count(),
      prisma.order.count({ where: { status: { in: ['ACTIVE', 'SUBMITTED'] } } }),
      prisma.order.count({ where: { status: 'COMPLETED' } }),
      prisma.order.count({ where: { status: 'DISPUTED' } }),
      prisma.order.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { budget: true }
      }),
      prisma.dispute.count({ where: { status: 'OPEN' } }),
      prisma.order.aggregate({
        where: { escrowStatus: 'HOLDING' },
        _sum: { escrowAmount: true },
      }),
      prisma.order.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { platformFee: true },
      }),
    ]);

    // Recent activity
    const recentOrders = await prisma.order.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        client: { select: { name: true } },
        freelancer: { select: { name: true } }
      }
    });

    const recentUsers = await prisma.user.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, email: true, role: true, createdAt: true }
    });

    res.json({
      stats: {
        users: {
          total: totalUsers,
          freelancers: totalFreelancers,
          clients: totalClients
        },
        orders: {
          total: totalOrders,
          active: activeOrders,
          completed: completedOrders,
          disputed: disputedOrders
        },
        finance: {
          revenue: totalRevenue._sum.budget || 0,
          escrowHolding: escrowHolding._sum.escrowAmount || 0,
          platformFee: platformFeeSum._sum.platformFee || 0,
        },
        openDisputes,
      },
      recentOrders,
      recentUsers
    });
  } catch (error) {
    logger.error('Admin stats error', error);
    res.status(500).json({ success: false, error: 'Ошибка получения статистики' });
  }
});

// GET /api/admin/users - List all users
router.get('/users', permissionGuard('users.read'), async (req: Request, res: Response) => {
  try {
    const { role, search, page = '1', limit = '20' } = req.query;
    
    const pageNum = parseInt(page as string);
    const limitNum = Math.min(parseInt(limit as string), 100);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (role) where.role = role;
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          avatar: true,
          lockedUntil: true,
          createdAt: true,
          _count: {
            select: {
              ordersAsClient: true,
              ordersAsFreelancer: true
            }
          }
        },
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.user.count({ where })
    ]);

    const mappedUsers = users.map((user) => ({
      ...user,
      isBanned: Boolean(user.lockedUntil && user.lockedUntil > new Date()),
    }));

    res.json({
      users: mappedUsers,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) }
    });
  } catch (error) {
    logger.error('Admin get users error', error);
    res.status(500).json({ success: false, error: 'Ошибка получения пользователей' });
  }
});

// PUT /api/admin/users/:id - Update user
router.put('/users/:id', permissionGuard('users.manage'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, role, isBanned } = req.body;
    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        role: true,
      },
    });

    if (!targetUser) {
      return res.status(404).json({ success: false, error: 'Пользователь не найден' });
    }

    if (targetUser.role === 'ADMIN') {
      return res.status(403).json({ success: false, error: 'Нельзя изменять администратора через эту панель' });
    }

    if (role === 'ADMIN') {
      return res.status(403).json({ success: false, error: 'Назначение роли ADMIN через эту панель запрещено' });
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(role && { role }),
        ...(typeof isBanned === 'boolean'
          ? {
              lockedUntil: isBanned ? new Date('2999-01-01T00:00:00.000Z') : null,
              failedLoginAttempts: isBanned ? 999 : 0,
            }
          : {}),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        lockedUntil: true,
      }
    });

    logger.info(`Admin updated user ${id}`);
    auditLogFromRequest(req, 'ADMIN_USER_UPDATED', {
      entityType: 'user',
      entityId: id,
      targetRole: role || null,
      isBanned: typeof isBanned === 'boolean' ? isBanned : null,
    });
    res.json({
      user: {
        ...user,
        isBanned: Boolean(user.lockedUntil && user.lockedUntil > new Date()),
      },
    });
  } catch (error) {
    logger.error('Admin update user error', error);
    res.status(500).json({ success: false, error: 'Ошибка обновления пользователя' });
  }
});

// DELETE /api/admin/users/:id - Delete user
router.delete('/users/:id', permissionGuard('users.manage', 'users.ban'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Don't allow deleting admins
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ success: false, error: 'Пользователь не найден' });
    }

    if (user?.role === 'ADMIN') {
      return res.status(403).json({ success: false, error: 'Нельзя удалить администратора' });
    }

    await prisma.user.delete({ where: { id } });

    logger.info(`Admin deleted user ${id}`);
    auditLogFromRequest(req, 'ADMIN_USER_DELETED', {
      entityType: 'user',
      entityId: id,
    });
    res.json({ message: 'Пользователь удалён' });
  } catch (error) {
    logger.error('Admin delete user error', error);
    res.status(500).json({ success: false, error: 'Ошибка удаления пользователя' });
  }
});

// GET /api/admin/orders - List all orders
router.get('/orders', permissionGuard('orders.read'), async (req: Request, res: Response) => {
  try {
    const { status, page = '1', limit = '20' } = req.query;
    
    const pageNum = parseInt(page as string);
    const limitNum = Math.min(parseInt(limit as string), 100);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (status) where.status = status;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          client: { select: { id: true, name: true, email: true } },
          freelancer: { select: { id: true, name: true, email: true } }
        },
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.order.count({ where })
    ]);

    res.json({
      orders,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) }
    });
  } catch (error) {
    logger.error('Admin get orders error', error);
    res.status(500).json({ success: false, error: 'Ошибка получения заказов' });
  }
});

// GET /api/admin/disputes - List all disputes
router.get('/disputes', permissionGuard('disputes.read'), async (req: Request, res: Response) => {
  try {
    const { status = 'OPEN', page = '1', limit = '20' } = req.query;
    
    const pageNum = parseInt(page as string);
    const limitNum = Math.min(parseInt(limit as string), 100);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (status !== 'all') where.status = status;

    const [disputes, total] = await Promise.all([
      prisma.dispute.findMany({
        where,
        include: {
          order: {
            include: {
              client: { select: { id: true, name: true, email: true } },
              freelancer: { select: { id: true, name: true, email: true } }
            }
          },
          openedBy: { select: { id: true, name: true } }
        },
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.dispute.count({ where })
    ]);

    res.json({
      disputes,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) }
    });
  } catch (error) {
    logger.error('Admin get disputes error', error);
    res.status(500).json({ success: false, error: 'Ошибка получения споров' });
  }
});

// POST /api/admin/disputes/:id/refund-client
router.post('/disputes/:id/refund-client', permissionGuard('disputes.resolve', 'finance.withdraw.approve'), async (req: Request, res: Response) => {
  try {
    const admin = req.user!;
    const { id } = req.params;
    const { resolution } = req.body as { resolution?: string };

    const dispute = await prisma.dispute.findUnique({
      where: { id },
      include: { order: true },
    });

    if (!dispute) {
      return res.status(404).json({ success: false, error: 'Спор не найден' });
    }

    if (dispute.status === 'RESOLVED' || dispute.status === 'CLOSED') {
      return res.status(400).json({ success: false, error: 'Спор уже закрыт' });
    }

    const idempotencyKey = getHeaderIdempotencyKey(req.headers as Record<string, string | string[] | undefined>);
    const idempotent = await executeIdempotentHttp({
      key: idempotencyKey,
      scope: `admin_dispute_refund:${id}`,
      actorId: admin?.id,
      payload: req.body,
      ttlMinutes: 60,
      handler: async () => {
        const refund = await EscrowService.refundEscrow(
          dispute.orderId,
          admin?.id || 'admin',
          resolution?.trim() || 'Решение админа: возврат клиенту'
        );

        if (!refund.success) {
          return {
            status: 400,
            body: { success: false, error: refund.message },
          };
        }

        const updated = await prisma.$transaction(async (tx) => {
          const savedDispute = await tx.dispute.update({
            where: { id },
            data: {
              status: 'RESOLVED',
              resolution: resolution?.trim() || 'Возврат клиенту',
              resolvedAt: new Date(),
              resolvedById: admin?.id,
              refundAmount: dispute.order.escrowAmount,
            },
          });

          await tx.disputeEvent.create({
            data: {
              disputeId: id,
              actorId: admin?.id,
              eventType: 'DISPUTE_RESOLVED_ADMIN_REFUND',
              message: resolution?.trim() || 'Возврат клиенту',
            },
          });

          return savedDispute;
        });

        auditLogFromRequest(req, 'ADMIN_DISPUTE_RESOLVED_REFUND', {
          disputeId: id,
          orderId: dispute.orderId,
        });

        return {
          status: 200,
          body: {
            success: true,
            data: updated,
            message: 'Спор решён: средства возвращены клиенту',
          },
        };
      },
    });

    return res.status(idempotent.response.status).json(idempotent.response.body);
  } catch (error) {
    if (error instanceof IdempotencyConflictError) {
      return res.status(error.statusCode).json({ success: false, error: error.message });
    }
    logger.error('Admin refund dispute error', error);
    res.status(500).json({ success: false, error: 'Ошибка решения спора' });
  }
});

// POST /api/admin/disputes/:id/release-freelancer
router.post('/disputes/:id/release-freelancer', permissionGuard('disputes.resolve', 'finance.withdraw.approve'), async (req: Request, res: Response) => {
  try {
    const admin = req.user!;
    const { id } = req.params;
    const { resolution } = req.body as { resolution?: string };

    const dispute = await prisma.dispute.findUnique({
      where: { id },
      include: { order: true },
    });

    if (!dispute) {
      return res.status(404).json({ success: false, error: 'Спор не найден' });
    }

    if (dispute.status === 'RESOLVED' || dispute.status === 'CLOSED') {
      return res.status(400).json({ success: false, error: 'Спор уже закрыт' });
    }

    const idempotencyKey = getHeaderIdempotencyKey(req.headers as Record<string, string | string[] | undefined>);
    const idempotent = await executeIdempotentHttp({
      key: idempotencyKey,
      scope: `admin_dispute_release:${id}`,
      actorId: admin?.id,
      payload: req.body,
      ttlMinutes: 60,
      handler: async () => {
        const release = await EscrowService.releaseEscrow(
          dispute.orderId,
          dispute.order.clientId,
          { allowDisputed: true, auditActorId: admin?.id }
        );

        if (!release.success) {
          return {
            status: 400,
            body: { success: false, error: release.message },
          };
        }

        const updated = await prisma.$transaction(async (tx) => {
          const savedDispute = await tx.dispute.update({
            where: { id },
            data: {
              status: 'RESOLVED',
              resolution: resolution?.trim() || 'Выплата фрилансеру',
              resolvedAt: new Date(),
              resolvedById: admin?.id,
              refundAmount: 0,
            },
          });

          await tx.disputeEvent.create({
            data: {
              disputeId: id,
              actorId: admin?.id,
              eventType: 'DISPUTE_RESOLVED_ADMIN_RELEASE',
              message: resolution?.trim() || 'Выплата фрилансеру',
            },
          });

          return savedDispute;
        });

        auditLogFromRequest(req, 'ADMIN_DISPUTE_RESOLVED_RELEASE', {
          disputeId: id,
          orderId: dispute.orderId,
        });

        return {
          status: 200,
          body: {
            success: true,
            data: updated,
            message: 'Спор решён: средства выданы фрилансеру',
          },
        };
      },
    });

    return res.status(idempotent.response.status).json(idempotent.response.body);
  } catch (error) {
    if (error instanceof IdempotencyConflictError) {
      return res.status(error.statusCode).json({ success: false, error: error.message });
    }
    logger.error('Admin release dispute error', error);
    res.status(500).json({ success: false, error: 'Ошибка решения спора' });
  }
});

router.get('/audit-logs', permissionGuard('audit.read'), async (req: Request, res: Response) => {
  try {
    if (!(await getFeatureFlag(FEATURE_FLAGS.AUDIT_PANEL_ENABLED))) {
      return res.status(503).json({
        success: false,
        error: `Feature "${FEATURE_FLAGS.AUDIT_PANEL_ENABLED}" disabled`,
      });
    }

    const { action, actorId, entityType, page = '1', limit = '50' } = req.query;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(200, Math.max(1, Number(limit)));
    const skip = (pageNum - 1) * limitNum;
    const where: Record<string, unknown> = {};

    if (typeof action === 'string' && action.trim()) where.action = action.trim();
    if (typeof actorId === 'string' && actorId.trim()) where.actorId = actorId.trim();
    if (typeof entityType === 'string' && entityType.trim()) where.entityType = entityType.trim();

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip,
        take: limitNum,
      }),
      prisma.auditLog.count({ where }),
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
    logger.error('Admin audit logs error', error);
    res.status(500).json({ success: false, error: 'Ошибка загрузки аудита' });
  }
});

router.get('/ledger', permissionGuard('ledger.read'), async (req: Request, res: Response) => {
  try {
    if (!(await getFeatureFlag(FEATURE_FLAGS.LEDGER_ENABLED))) {
      return res.status(503).json({
        success: false,
        error: `Feature "${FEATURE_FLAGS.LEDGER_ENABLED}" disabled`,
      });
    }

    const { account, userId, orderId, page = '1', limit = '50' } = req.query;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(200, Math.max(1, Number(limit)));
    const skip = (pageNum - 1) * limitNum;
    const where: Record<string, unknown> = {};

    if (typeof account === 'string' && account.trim()) where.account = account.trim();
    if (typeof userId === 'string' && userId.trim()) where.userId = userId.trim();
    if (typeof orderId === 'string' && orderId.trim()) where.orderId = orderId.trim();

    const [items, total] = await Promise.all([
      prisma.ledgerEntry.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip,
        take: limitNum,
      }),
      prisma.ledgerEntry.count({ where }),
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
    logger.error('Admin ledger error', error);
    res.status(500).json({ success: false, error: 'Ошибка загрузки ledger' });
  }
});

router.get('/ledger-summary', permissionGuard('ledger.read'), async (req: Request, res: Response) => {
  try {
    if (!(await getFeatureFlag(FEATURE_FLAGS.LEDGER_ENABLED))) {
      return res.status(503).json({
        success: false,
        error: `Feature "${FEATURE_FLAGS.LEDGER_ENABLED}" disabled`,
      });
    }

    const { userId, orderId } = req.query;
    const where: Record<string, unknown> = {};
    if (typeof userId === 'string' && userId.trim()) where.userId = userId.trim();
    if (typeof orderId === 'string' && orderId.trim()) where.orderId = orderId.trim();

    const grouped = await prisma.ledgerEntry.groupBy({
      by: ['account', 'direction'],
      where,
      _sum: {
        amount: true,
      },
    });

    const summary: Record<string, { debit: number; credit: number; net: number }> = {};
    for (const row of grouped) {
      const account = row.account;
      if (!summary[account]) {
        summary[account] = { debit: 0, credit: 0, net: 0 };
      }

      const amount = Number(row._sum.amount || 0);
      if (row.direction === 'DEBIT') {
        summary[account].debit += amount;
      } else {
        summary[account].credit += amount;
      }
      summary[account].net = summary[account].credit - summary[account].debit;
    }

    const totals = Object.values(summary).reduce(
      (acc, item) => {
        acc.debit += item.debit;
        acc.credit += item.credit;
        acc.net += item.net;
        return acc;
      },
      { debit: 0, credit: 0, net: 0 }
    );

    res.json({
      success: true,
      data: {
        summary,
        totals,
        filters: {
          userId: typeof userId === 'string' ? userId : null,
          orderId: typeof orderId === 'string' ? orderId : null,
        },
      },
    });
  } catch (error) {
    logger.error('Admin ledger summary error', error);
    res.status(500).json({ success: false, error: 'Ошибка расчета ledger summary' });
  }
});

// POST /api/admin/seed - Seed demo data
router.post('/seed', async (req: Request, res: Response) => {
  try {
    // This would run the seed script
    logger.info('Admin requested data seeding');
    res.json({ message: 'Запустите npm run db:seed для заполнения базы' });
  } catch (error) {
    logger.error('Seed error', error);
    res.status(500).json({ success: false, error: 'Ошибка заполнения базы' });
  }
});

export default router;
