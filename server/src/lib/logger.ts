import winston from 'winston';
import path from 'path';
import fs from 'fs';
import type { Request } from 'express';
import { prisma } from './prisma';

// Создаём папку для логов
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Форматы логов
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    if (Object.keys(meta).length) {
      log += ` ${JSON.stringify(meta)}`;
    }
    if (stack) {
      log += `\n${stack}`;
    }
    return log;
  })
);

const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ level, message, timestamp, ...meta }) => {
    let log = `${timestamp} ${level}: ${message}`;
    if (Object.keys(meta).length && !meta.stack) {
      log += ` ${JSON.stringify(meta)}`;
    }
    return log;
  })
);

// Создаём logger
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'freelancekg' },
  transports: [
    // Логи ошибок
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
    // Все логи
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 10485760,
      maxFiles: 10,
    }),
    // Логи доступа к API
    new winston.transports.File({
      filename: path.join(logsDir, 'access.log'),
      level: 'http',
      maxsize: 10485760,
      maxFiles: 5,
    }),
  ],
});

// Консольный вывод в dev режиме
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: consoleFormat,
      level: 'debug',
    })
  );
}

// HTTP logger middleware
export const httpLogger = (req: any, res: any, next: any) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const { method, originalUrl, ip } = req;
    const { statusCode } = res;
    const userId = req.user?.id || 'anonymous';
    
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'http';
    
    logger.log(level, `${method} ${originalUrl}`, {
      statusCode,
      duration: `${duration}ms`,
      ip,
      userId,
      userAgent: req.get('user-agent'),
      requestId: req.requestId,
    });
  });
  
  next();
};

// Логгер для аудита действий
interface AuditContext {
  actorRole?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

function buildAuditPayload(details: any): {
  entityType: string | null;
  entityId: string | null;
  safeDetails: unknown;
} {
  const entityId =
    (details &&
      (details.orderId ||
        details.disputeId ||
        details.caseId ||
        details.milestoneId ||
        details.changeRequestId ||
        details.entityId)) ||
    null;
  const entityType =
    (details && details.entityType) ||
    (details?.orderId
      ? 'order'
      : details?.disputeId
        ? 'dispute'
        : details?.caseId
          ? 'support_case'
          : details?.milestoneId
            ? 'milestone'
            : details?.changeRequestId
              ? 'change_request'
              : null);

  let safeDetails: unknown = undefined;
  try {
    const cloned = JSON.parse(JSON.stringify(details ?? {}));
    if (cloned && typeof cloned === 'object') {
      delete (cloned as Record<string, unknown>).__auditContext;
    }
    safeDetails = cloned;
  } catch {
    safeDetails = { note: 'details_unserializable' };
  }

  return { entityType, entityId, safeDetails };
}

export const auditLog = (action: string, userId: string, details: any, context?: AuditContext) => {
  logger.info(`AUDIT: ${action}`, {
    userId,
    action,
    ...details,
    actorRole: context?.actorRole,
    ip: context?.ip,
    userAgent: context?.userAgent,
    requestId: context?.requestId,
    timestamp: new Date().toISOString(),
  });
  const { entityType, entityId, safeDetails } = buildAuditPayload(details);

  void prisma.auditLog
    .create({
      data: {
        action,
        actorId: userId || null,
        actorRole: context?.actorRole || null,
        entityType,
        entityId,
        ip: context?.ip || null,
        userAgent: context?.userAgent || null,
        requestId: context?.requestId || null,
        details: safeDetails as any,
      },
    })
    .catch((error) => {
      logger.warn('Failed to persist audit log', { action, userId, error: error?.message });
    });
};

export const auditLogFromRequest = (req: Request, action: string, details: any) => {
  auditLog(action, req.user?.id || 'system', details, {
    actorRole: req.user?.role || null,
    ip: req.ip || null,
    userAgent: req.get('user-agent') || null,
    requestId: req.requestId || null,
  });
};

// Логгер для платежей
export const paymentLog = (action: string, details: any) => {
  logger.info(`PAYMENT: ${action}`, {
    action,
    ...details,
    timestamp: new Date().toISOString(),
  });
};

// Логгер для безопасности
export const securityLog = (event: string, details: any) => {
  logger.warn(`SECURITY: ${event}`, {
    event,
    ...details,
    timestamp: new Date().toISOString(),
  });
};

export default logger;
