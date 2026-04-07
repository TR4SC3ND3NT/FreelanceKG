import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../lib/jwt';
import { logger } from '../lib/logger';
import { prisma } from '../lib/prisma';
import { getPermissionsForRole } from '../lib/permissions';

/**
 * Authentication middleware - requires valid JWT token
 */
export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ success: false, error: 'Требуется авторизация' });
    }

    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    
    if (!token) {
      return res.status(401).json({ success: false, error: 'Токен не предоставлен' });
    }

    const decoded = verifyToken(token);
    
    if (!decoded) {
      return res.status(401).json({ success: false, error: 'Недействительный токен' });
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
      return res.status(401).json({ success: false, error: 'Сессия истекла. Войдите снова' });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        role: true,
        name: true,
        email: true,
        avatar: true,
        lockedUntil: true,
      },
    });

    if (!user) {
      return res.status(401).json({ success: false, error: 'Пользователь не найден' });
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return res.status(403).json({ success: false, error: 'Аккаунт заблокирован' });
    }

    req.user = {
      id: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      permissions: getPermissionsForRole(user.role),
    };
    next();
  } catch (error) {
    logger.error('Auth middleware error', error);
    return res.status(401).json({ success: false, error: 'Ошибка авторизации' });
  }
};

/**
 * Optional authentication - sets user if token present, continues otherwise
 */
export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader) {
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
      const decoded = verifyToken(token);
      
      if (decoded) {
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

        if (session) {
          const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: {
              id: true,
              role: true,
              name: true,
              email: true,
              avatar: true,
              lockedUntil: true,
            },
          });

          if (user) {
            if (user.lockedUntil && user.lockedUntil > new Date()) {
              return next();
            }
            req.user = {
              id: user.id,
              role: user.role,
              name: user.name,
              email: user.email,
              avatar: user.avatar,
              permissions: getPermissionsForRole(user.role),
            };
          }
        }
      }
    }
    
    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};

/**
 * Admin only middleware - requires ADMIN role
 */
export const adminMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Требуется авторизация' });
  }

  if (req.user!.role !== 'ADMIN') {
    return res.status(403).json({ success: false, error: 'Доступ запрещён. Требуются права администратора.' });
  }

  next();
};

/**
 * Freelancer only middleware
 */
export const freelancerMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Требуется авторизация' });
  }

  if (req.user!.role !== 'FREELANCER') {
    return res.status(403).json({ success: false, error: 'Доступно только для фрилансеров' });
  }

  next();
};

/**
 * Client only middleware
 */
export const clientMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Требуется авторизация' });
  }

  if (req.user!.role !== 'CLIENT') {
    return res.status(403).json({ success: false, error: 'Доступно только для заказчиков' });
  }

  next();
};
