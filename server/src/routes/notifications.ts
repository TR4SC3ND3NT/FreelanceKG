/**
 * Notification Routes
 * GET /api/notifications - My notifications
 * PUT /api/notifications/:id/read - Mark as read
 * PUT /api/notifications/read-all - Mark all as read
 * DELETE /api/notifications/:id - Delete notification
 */

import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// ============================================
// GET MY NOTIFICATIONS
// ============================================

router.get('/', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const { page = 1, limit = 20, unreadOnly } = req.query;
    
    const skip = (Number(page) - 1) * Number(limit);
    
    const where: any = { userId: user.id };
    
    if (unreadOnly === 'true') {
      where.isRead = false;
    }
    
    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({
        where: { userId: user.id, isRead: false },
      }),
    ]);
    
    res.json({
      success: true,
      data: notifications,
      unreadCount,
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
// GET UNREAD COUNT
// ============================================

router.get('/unread-count', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    
    const count = await prisma.notification.count({
      where: { userId: user.id, isRead: false },
    });
    
    res.json({
      success: true,
      data: { count },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// MARK AS READ
// ============================================

router.put('/:id/read', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    
    const notification = await prisma.notification.findFirst({
      where: { id, userId: user.id },
    });
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        error: 'Уведомление не найдено',
      });
    }
    
    await prisma.notification.update({
      where: { id },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
    
    res.json({
      success: true,
      message: 'Уведомление отмечено как прочитанное',
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// MARK ALL AS READ
// ============================================

router.put('/read-all', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    
    await prisma.notification.updateMany({
      where: { userId: user.id, isRead: false },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
    
    res.json({
      success: true,
      message: 'Все уведомления отмечены как прочитанные',
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// DELETE NOTIFICATION
// ============================================

router.delete('/:id', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    
    const notification = await prisma.notification.findFirst({
      where: { id, userId: user.id },
    });
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        error: 'Уведомление не найдено',
      });
    }
    
    await prisma.notification.delete({
      where: { id },
    });
    
    res.json({
      success: true,
      message: 'Уведомление удалено',
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// DELETE ALL READ NOTIFICATIONS
// ============================================

router.delete('/', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    
    const result = await prisma.notification.deleteMany({
      where: { userId: user.id, isRead: true },
    });
    
    res.json({
      success: true,
      message: `Удалено ${result.count} уведомлений`,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
