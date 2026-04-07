/**
 * FreelanceKG Backend Server
 * Production-ready Express + Socket.io server
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import session from 'express-session';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import path from 'path';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

// Import local modules
import { prisma } from './lib/prisma';
import { logger, httpLogger } from './lib/logger';
import passport from './lib/oauth';
import { env } from './config/env';
import { validateOwnedUploadForUser } from './lib/uploadOwnership';
import { setSocketServer } from './lib/socket';
import { TelegramService } from './lib/telegram';
import { cleanupExpiredTelegramLinkTokens } from './lib/telegramLinkToken';

// Import routes
import authRoutes from './routes/auth';
import freelancerRoutes from './routes/freelancers';
import orderRoutes from './routes/orders';
import messageRoutes from './routes/messages';
import disputeRoutes from './routes/disputes';
import uploadRoutes from './routes/uploads';
import paymentRoutes from './routes/payments';
import notificationRoutes from './routes/notifications';
import adminRoutes from './routes/admin';
import platformRoutes from './routes/platform';
import workflowRoutes from './routes/workflow';
import caseRoutes from './routes/cases';
import workspaceRoutes from './routes/workspace';

// ============================================
// APP CONFIGURATION
// ============================================

const app = express();
const httpServer = createServer(app);
const PORT = env.PORT;
const FRONTEND_URL = env.FRONTEND_URL || env.CORS_ORIGIN || 'http://localhost:5173';
const UPLOADS_DIR = path.join(__dirname, '../uploads');
const corsOrigins = [
  ...new Set([
    ...FRONTEND_URL.split(',').map((origin) => origin.trim()).filter(Boolean),
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ]),
];

const SOCKET_MIME_BY_EXT: Record<string, string> = {
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

app.set('json replacer', (_key: string, value: unknown) => {
  if (value instanceof Prisma.Decimal) {
    return value.toNumber();
  }
  return value;
});

const apiRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    const url = req.originalUrl;
    return (
      url.startsWith('/api/auth') ||
      url.startsWith('/api/messages') ||
      url.startsWith('/api/uploads')
    );
  },
  message: {
    success: false,
    error: 'Слишком много запросов. Попробуйте позже.',
  },
});

const authRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Слишком много попыток входа. Попробуйте позже.',
  },
});

const messageRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.MESSAGE_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Слишком много сообщений. Подождите немного.',
  },
});

const uploadRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.UPLOAD_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Слишком много загрузок. Попробуйте позже.',
  },
});

function inferSocketMimeType(fileName?: string | null, fileUrl?: string | null): string | undefined {
  const source = (fileName || fileUrl || '').toLowerCase();
  if (!source) return undefined;
  const ext = path.extname(source);
  return SOCKET_MIME_BY_EXT[ext];
}

function resolveSocketMessageType(fileUrl?: string | null, mimeType?: string): 'text' | 'image' | 'file' {
  if (!fileUrl) return 'text';
  if (mimeType?.startsWith('image/')) return 'image';
  return 'file';
}

// ============================================
// SECURITY MIDDLEWARE
// ============================================

app.set('trust proxy', 1);

// Helmet for security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false, // Disable for API
}));

// CORS configuration
app.use(cors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-Idempotency-Key',
    'X-Paybox-Signature',
  ],
}));

app.use('/api', apiRateLimiter);
app.use('/api/auth', authRateLimiter);
app.use('/api/messages', messageRateLimiter);
app.use('/api/uploads', uploadRateLimiter);

// ============================================
// BODY PARSING & LOGGING
// ============================================

app.use(express.json({
  limit: '10mb',
  verify: (req, _res, buf) => {
    (req as Request & { rawBody?: string }).rawBody = buf.toString('utf8');
  },
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use((req: Request, res: Response, next: NextFunction) => {
  const incoming = req.headers['x-request-id'];
  const requestId = Array.isArray(incoming)
    ? incoming[0]
    : typeof incoming === 'string' && incoming.trim().length > 0
      ? incoming.trim()
      : randomUUID();
  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);
  next();
});

// HTTP request logging
app.use(httpLogger);

// Session for OAuth
app.use(session({
  secret: env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// ============================================
// STATIC FILES
// ============================================

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ============================================
// HEALTH CHECK
// ============================================

const healthHandler = async (req: Request, res: Response) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    
    res.json({ status: 'ok' });
  } catch (error) {
    res.status(503).json({ status: 'error' });
  }
};

app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

// API info
app.get('/api', (req: Request, res: Response) => {
  res.json({
    name: 'FreelanceKG API',
    version: '1.0.0',
    description: 'Freelance platform API for Kyrgyzstan',
    documentation: '/api/docs',
    endpoints: {
      auth: '/api/auth',
      freelancers: '/api/freelancers',
      orders: '/api/orders',
      messages: '/api/messages',
      disputes: '/api/disputes',
      payments: '/api/payments',
      uploads: '/api/uploads',
      notifications: '/api/notifications',
      platform: '/api/platform',
      workflow: '/api/workflow',
      cases: '/api/cases',
      workspace: '/api/workspace',
    },
  });
});

// ============================================
// API ROUTES
// ============================================

app.use('/api/auth', authRoutes);
app.use('/api/freelancers', freelancerRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/disputes', disputeRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/platform', platformRoutes);
app.use('/api/workflow', workflowRoutes);
app.use('/api/cases', caseRoutes);
app.use('/api/workspace', workspaceRoutes);

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path,
  });
});

function normalizeServerError(err: any): { status: number; publicMessage: string; hideStack?: boolean } {
  if (err instanceof Prisma.PrismaClientValidationError) {
    return {
      status: 400,
      publicMessage: 'Некорректные параметры запроса',
      hideStack: true,
    };
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return {
        status: 409,
        publicMessage: 'Запись с такими данными уже существует',
        hideStack: true,
      };
    }

    if (err.code === 'P2025') {
      return {
        status: 404,
        publicMessage: 'Запись не найдена',
        hideStack: true,
      };
    }

    return {
      status: 400,
      publicMessage: 'Ошибка обработки данных',
      hideStack: true,
    };
  }

  if (err instanceof Prisma.PrismaClientInitializationError) {
    return {
      status: 503,
      publicMessage: 'Сервис временно недоступен',
      hideStack: true,
    };
  }

  if (err instanceof Prisma.PrismaClientRustPanicError) {
    return {
      status: 500,
      publicMessage: 'Внутренняя ошибка базы данных',
      hideStack: true,
    };
  }

  return {
    status: err?.status || 500,
    publicMessage: err?.message || 'Internal server error',
  };
}

// Global error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  const normalized = normalizeServerError(err);

  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    userId: req.user?.id,
    requestId: req.requestId,
  });
  
  // Don't leak error details in production
  const isDev = process.env.NODE_ENV !== 'production';
  const shouldShowStack = isDev && !normalized.hideStack;
  const safeMessage = shouldShowStack ? normalized.publicMessage : normalized.publicMessage || 'Internal server error';

  res.status(normalized.status).json({
    success: false,
    error: isDev && !normalized.hideStack ? err.message : safeMessage,
    requestId: req.requestId,
    ...(shouldShowStack && { stack: err.stack }),
  });
});

// ============================================
// SOCKET.IO CONFIGURATION
// ============================================

const io = new SocketServer(httpServer, {
  cors: {
    origin: corsOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});
setSocketServer(io);

// Socket.io authentication middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return next(new Error('Authentication required'));
    }
    
    const { verifyToken } = await import('./lib/jwt');
    const decoded = verifyToken(token);
    
    if (!decoded) {
      return next(new Error('Invalid token'));
    }

    const session = await prisma.session.findFirst({
      where: {
        token,
        userId: decoded.userId,
        expiresAt: {
          gt: new Date(),
        },
      },
      select: { id: true },
    });

    if (!session) {
      return next(new Error('Session expired'));
    }
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, name: true, role: true },
    });
    
    if (!user) {
      return next(new Error('User not found'));
    }
    
    (socket as any).user = user;
    next();
  } catch (error) {
    next(new Error('Authentication failed'));
  }
});

// Socket.io connection handling
io.on('connection', (socket) => {
  const user = (socket as any).user;
  logger.info('Socket connected', { userId: user.id, socketId: socket.id });
  
  // Join user's personal room
  socket.join(`user:${user.id}`);
  
  // Join order room
  socket.on('join-order', async (orderId: string) => {
    try {
      // Verify user is participant
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { clientId: true, freelancerId: true, status: true },
      });
      
      if (!order) {
        socket.emit('error', { message: 'Order not found' });
        return;
      }
      
      const isParticipant = order.clientId === user.id || order.freelancerId === user.id;
      
      if (!isParticipant && user.role !== 'ADMIN') {
        socket.emit('error', { message: 'Access denied' });
        return;
      }
      
      socket.join(`order:${orderId}`);
      logger.debug('User joined order room', { userId: user.id, orderId });
      
      // Notify others
      socket.to(`order:${orderId}`).emit('user-joined', {
        userId: user.id,
        name: user.name,
      });
    } catch (error) {
      socket.emit('error', { message: 'Failed to join order' });
    }
  });
  
  // Leave order room
  socket.on('leave-order', (orderId: string) => {
    socket.leave(`order:${orderId}`);
    socket.to(`order:${orderId}`).emit('user-left', {
      userId: user.id,
      name: user.name,
    });
  });
  
  // Send message
  socket.on('send-message', async (data: {
    orderId: string;
    content?: string;
    fileUrl?: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
  }) => {
    try {
      const { orderId, content, fileUrl, fileName, fileSize, mimeType } = data;

      const attachmentCheck = validateOwnedUploadForUser(fileUrl, user.id, UPLOADS_DIR);
      if (!attachmentCheck.ok) {
        socket.emit('error', { message: attachmentCheck.error });
        return;
      }
      
      // Verify access
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { clientId: true, freelancerId: true, status: true },
      });
      
      if (!order) {
        socket.emit('error', { message: 'Order not found' });
        return;
      }
      
      const isParticipant = order.clientId === user.id || order.freelancerId === user.id;
      
      if (!isParticipant) {
        socket.emit('error', { message: 'Access denied' });
        return;
      }

      if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
        socket.emit('error', { message: 'Нельзя отправлять сообщения в завершённый заказ' });
        return;
      }

      const normalizedContent = typeof content === 'string' ? content.trim() : '';
      const normalizedFileName =
        typeof fileName === 'string' && fileName.trim().length > 0
          ? fileName.trim()
          : attachmentCheck.normalizedUrl
            ? path.basename(attachmentCheck.normalizedUrl)
            : null;

      if (!normalizedContent && !attachmentCheck.normalizedUrl) {
        socket.emit('error', { message: 'Сообщение не может быть пустым без вложения' });
        return;
      }
      
      // Save message to database
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
            select: { id: true, name: true, avatar: true },
          },
        },
      });

      const resolvedMimeType = typeof mimeType === 'string' ? mimeType : inferSocketMimeType(message.fileName, message.fileUrl);
      const messagePayload = {
        ...message,
        mimeType: resolvedMimeType,
        type: resolveSocketMessageType(message.fileUrl, resolvedMimeType),
      };
      
      // Broadcast to order room
      io.to(`order:${orderId}`).emit('new-message', messagePayload);
      
      // Send notification to other participant
      const recipientId = order.clientId === user.id ? order.freelancerId : order.clientId;
      if (recipientId) {
        const previewText = normalizedContent || (normalizedFileName ? `File: ${normalizedFileName}` : 'Attachment');
        io.to(`user:${recipientId}`).emit('notification', {
          type: 'MESSAGE_RECEIVED',
          title: 'Новое сообщение',
          message: `${user.name}: ${previewText.substring(0, 50)}...`,
          link: `/orders/${orderId}`,
        });

        await TelegramService.notifyOrderEvent({
          recipientUserId: recipientId,
          title: 'Новое сообщение в заказе',
          lines: [`${user.name}: ${previewText.substring(0, 120)}`],
          orderId,
        });
      }
      
      logger.debug('Message sent', { orderId, senderId: user.id });
    } catch (error) {
      logger.error('Failed to send message', { error, userId: user.id });
      socket.emit('error', { message: 'Failed to send message' });
    }
  });
  
  // Typing indicators
  socket.on('typing', (orderId: string) => {
    socket.to(`order:${orderId}`).emit('user-typing', {
      userId: user.id,
      name: user.name,
    });
  });
  
  socket.on('stop-typing', (orderId: string) => {
    socket.to(`order:${orderId}`).emit('user-stop-typing', {
      userId: user.id,
    });
  });
  
  // Disconnect
  socket.on('disconnect', () => {
    logger.info('Socket disconnected', { userId: user.id, socketId: socket.id });
  });
});

// Export io for use in other modules
export { io };

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

const shutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  TelegramService.stopPolling();
  if (telegramLinkCleanupTimer) {
    clearInterval(telegramLinkCleanupTimer);
    telegramLinkCleanupTimer = null;
  }
  
  // Close HTTP server
  httpServer.close(async () => {
    logger.info('HTTP server closed');
    
    // Close database connection
    await prisma.$disconnect();
    logger.info('Database disconnected');
    
    process.exit(0);
  });
  
  // Force close after 30 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise });
});

// ============================================
// START SERVER
// ============================================

let started = false;
let telegramLinkCleanupTimer: NodeJS.Timeout | null = null;

export const startServer = () => {
  if (started) return httpServer;

  httpServer.listen(PORT, () => {
    logger.info(`🚀 FreelanceKG Server running on port ${PORT}`);
    logger.info(`📍 Health check: http://localhost:${PORT}/health`);
    logger.info(`📍 API info: http://localhost:${PORT}/api`);
    logger.info(`🔌 Socket.io ready`);
    
    if (process.env.NODE_ENV !== 'production') {
      logger.info(`🌐 Frontend: ${FRONTEND_URL}`);
    }

    TelegramService.startPolling();

    void cleanupExpiredTelegramLinkTokens()
      .then((removed) => {
        if (removed > 0) {
          logger.info('Cleaned expired Telegram link tokens', { removed });
        }
      })
      .catch((error) => {
        logger.warn('Failed to cleanup expired Telegram link tokens', { error });
      });

    if (!telegramLinkCleanupTimer) {
      telegramLinkCleanupTimer = setInterval(() => {
        void cleanupExpiredTelegramLinkTokens()
          .then((removed) => {
            if (removed > 0) {
              logger.info('Cleaned expired Telegram link tokens', { removed });
            }
          })
          .catch((error) => {
            logger.warn('Failed to cleanup expired Telegram link tokens', { error });
          });
      }, 60 * 60 * 1000);

      telegramLinkCleanupTimer.unref();
    }
  });

  started = true;
  return httpServer;
};

if (require.main === module) {
  startServer();
}

export default app;
