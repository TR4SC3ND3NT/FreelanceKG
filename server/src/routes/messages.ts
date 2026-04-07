/**
 * Message Routes
 * GET /api/messages/:orderId - Get messages for order
 * POST /api/messages - Send message
 * PUT /api/messages/:id/read - Mark as read
 */

import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { validate, sendMessageSchema } from '../lib/validation';
import { validateOwnedUploadForUser } from '../lib/uploadOwnership';
import path from 'path';
import { TelegramService } from '../lib/telegram';

const router = Router();
const UPLOADS_DIR = path.join(__dirname, '../../uploads');

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.zip': 'application/zip',
};

function inferMimeType(fileName?: string | null, fileUrl?: string | null): string | undefined {
  const source = (fileName || fileUrl || '').toLowerCase();
  if (!source) return undefined;
  const ext = path.extname(source);
  return MIME_BY_EXT[ext];
}

function resolveMessageType(fileUrl?: string | null, mimeType?: string): 'text' | 'image' | 'file' {
  if (!fileUrl) return 'text';
  if (mimeType?.startsWith('image/')) return 'image';
  return 'file';
}

function mapMessageForClient(
  message: {
    id: string;
    orderId: string;
    senderId: string;
    content: string;
    fileUrl: string | null;
    fileName: string | null;
    fileSize: number | null;
    createdAt: Date;
    sender: { id: string; name: string; avatar: string | null };
  },
  mimeTypeFromPayload?: string
) {
  const mimeType = mimeTypeFromPayload || inferMimeType(message.fileName, message.fileUrl);
  return {
    ...message,
    mimeType,
    type: resolveMessageType(message.fileUrl, mimeType),
  };
}

// ============================================
// GET MESSAGES FOR ORDER
// ============================================

router.get('/:orderId', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const { orderId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    
    // Verify access
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { clientId: true, freelancerId: true },
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
        error: 'Нет доступа к этому чату',
      });
    }
    
    const skip = (Number(page) - 1) * Number(limit);
    
    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where: { orderId },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
        skip,
        take: Number(limit),
      }),
      prisma.message.count({ where: { orderId } }),
    ]);
    
    // Mark messages as read
    await prisma.message.updateMany({
      where: {
        orderId,
        senderId: { not: user.id },
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
    
    res.json({
      success: true,
      data: messages.map((message) => mapMessageForClient(message)),
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
// SEND MESSAGE
// ============================================

router.post('/', authMiddleware, validate(sendMessageSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const { orderId, content, fileUrl, fileName, fileSize, mimeType } = req.body;

    const attachmentCheck = validateOwnedUploadForUser(fileUrl, user.id, UPLOADS_DIR);
    if (!attachmentCheck.ok) {
      return res.status(attachmentCheck.status).json({
        success: false,
        error: attachmentCheck.error,
      });
    }
    
    // Verify access
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { clientId: true, freelancerId: true, status: true },
    });
    
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Заказ не найден',
      });
    }
    
    const isParticipant = order.clientId === user.id || order.freelancerId === user.id;
    
    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        error: 'Вы не участник этого заказа',
      });
    }
    
    // Don't allow messages on completed/cancelled orders
    if (['COMPLETED', 'CANCELLED'].includes(order.status)) {
      return res.status(400).json({
        success: false,
        error: 'Нельзя отправлять сообщения в завершённый заказ',
      });
    }

    const normalizedContent = typeof content === 'string' ? content.trim() : '';
    const normalizedFileName =
      typeof fileName === 'string' && fileName.trim().length > 0
        ? fileName.trim()
        : attachmentCheck.normalizedUrl
          ? path.basename(attachmentCheck.normalizedUrl)
          : null;

    if (!normalizedContent && !attachmentCheck.normalizedUrl) {
      return res.status(400).json({
        success: false,
        error: 'Сообщение не может быть пустым без вложения',
      });
    }
    
    const message = await prisma.message.create({
      data: {
        orderId,
        senderId: user.id,
        content: normalizedContent || (normalizedFileName ? `[attachment] ${normalizedFileName}` : '[attachment]'),
        fileUrl: attachmentCheck.normalizedUrl,
        fileName: normalizedFileName,
        fileSize: typeof fileSize === 'number' ? fileSize : null,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    });

    const recipientId = order.clientId === user.id ? order.freelancerId : order.clientId;
    if (recipientId) {
      await TelegramService.notifyOrderEvent({
        recipientUserId: recipientId,
        title: 'Новое сообщение в заказе',
        lines: [`${user.name}: ${(normalizedContent || '[вложение]').substring(0, 120)}`],
        orderId,
      });
    }
    
    res.status(201).json({
      success: true,
      data: mapMessageForClient(message, typeof mimeType === 'string' ? mimeType : undefined),
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// MARK MESSAGE AS READ
// ============================================

router.put('/:id/read', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    
    const message = await prisma.message.findUnique({
      where: { id },
      include: {
        order: {
          select: { clientId: true, freelancerId: true },
        },
      },
    });
    
    if (!message) {
      return res.status(404).json({
        success: false,
        error: 'Сообщение не найдено',
      });
    }
    
    const isParticipant = message.order.clientId === user.id || message.order.freelancerId === user.id;
    
    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        error: 'Нет доступа',
      });
    }
    
    // Only mark as read if user is not the sender
    if (message.senderId !== user.id && !message.isRead) {
      await prisma.message.update({
        where: { id },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });
    }
    
    res.json({
      success: true,
      message: 'Сообщение отмечено как прочитанное',
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET UNREAD COUNT
// ============================================

router.get('/unread/count', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    
    // Get orders where user is participant
    const orders = await prisma.order.findMany({
      where: {
        OR: [
          { clientId: user.id },
          { freelancerId: user.id },
        ],
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
      },
      select: { id: true },
    });
    
    const orderIds = orders.map((o) => o.id);
    
    const unreadCount = await prisma.message.count({
      where: {
        orderId: { in: orderIds },
        senderId: { not: user.id },
        isRead: false,
      },
    });
    
    res.json({
      success: true,
      data: { unreadCount },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET CONVERSATIONS
// ============================================

router.get('/conversations/list', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    
    // Get all orders with messages
    const orders = await prisma.order.findMany({
      where: {
        OR: [
          { clientId: user.id },
          { freelancerId: user.id },
        ],
      },
      include: {
        client: {
          select: { id: true, name: true, avatar: true },
        },
        freelancer: {
          select: { id: true, name: true, avatar: true },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: {
              select: { id: true, name: true },
            },
          },
        },
        _count: {
          select: {
            messages: {
              where: {
                senderId: { not: user.id },
                isRead: false,
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
    
    const conversations = orders
      .filter((o) => o.messages.length > 0)
      .map((order) => {
        const otherUser = order.clientId === user.id ? order.freelancer : order.client;
        const lastMessage = order.messages[0];
        
        return {
          orderId: order.id,
          orderTitle: order.title,
          orderStatus: order.status,
          otherUser,
          lastMessage: lastMessage ? {
            content: lastMessage.content,
            createdAt: lastMessage.createdAt,
            isFromMe: lastMessage.senderId === user.id,
          } : null,
          unreadCount: (order._count as any).messages,
        };
      });
    
    res.json({
      success: true,
      data: conversations,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
