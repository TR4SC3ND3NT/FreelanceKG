import { Request, Response, NextFunction } from 'express';
import { securityLog } from '../lib/logger';
import { Permission, ensurePermissions, hasPermissionList } from '../lib/permissions';

type Role = 'CLIENT' | 'FREELANCER' | 'ADMIN';

/**
 * Middleware для проверки ролей пользователя
 * @param allowedRoles - Массив разрешённых ролей
 */
export const roleGuard = (...allowedRoles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user!;
    
    if (!user) {
      securityLog('UNAUTHORIZED_ACCESS', {
        path: req.path,
        method: req.method,
        ip: req.ip,
      });
      
      return res.status(401).json({
        success: false,
        error: 'Требуется авторизация',
      });
    }
    
    if (!allowedRoles.includes(user.role)) {
      securityLog('FORBIDDEN_ACCESS', {
        path: req.path,
        method: req.method,
        userId: user.id,
        userRole: user.role,
        requiredRoles: allowedRoles,
        ip: req.ip,
      });
      
      return res.status(403).json({
        success: false,
        error: 'Недостаточно прав для выполнения действия',
        required: allowedRoles,
        current: user.role,
      });
    }
    
    next();
  };
};

/**
 * Middleware: только CLIENT
 */
export const clientOnly = roleGuard('CLIENT');

/**
 * Middleware: только FREELANCER
 */
export const freelancerOnly = roleGuard('FREELANCER');

/**
 * Middleware: только ADMIN
 */
export const adminOnly = roleGuard('ADMIN');

/**
 * Middleware: CLIENT или ADMIN
 */
export const clientOrAdmin = roleGuard('CLIENT', 'ADMIN');

/**
 * Middleware: FREELANCER или ADMIN
 */
export const freelancerOrAdmin = roleGuard('FREELANCER', 'ADMIN');

/**
 * Middleware: любой авторизованный пользователь
 */
export const authenticated = roleGuard('CLIENT', 'FREELANCER', 'ADMIN');

/**
 * Проверка permission (RBAC поверх ролей)
 */
export const permissionGuard = (...requiredPermissions: Permission[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user!;

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Требуется авторизация',
      });
    }

    const permissions = ensurePermissions(user.role, user.permissions);
    const missing = requiredPermissions.filter((permission) => !hasPermissionList(permissions, permission));

    if (missing.length > 0) {
      securityLog('PERMISSION_DENIED', {
        path: req.path,
        method: req.method,
        userId: user.id,
        userRole: user.role,
        requiredPermissions,
        missingPermissions: missing,
        ip: req.ip,
      });

      return res.status(403).json({
        success: false,
        error: 'Недостаточно permissions для выполнения действия',
        required: requiredPermissions,
        missing,
      });
    }

    next();
  };
};

/**
 * Проверка владельца ресурса
 * @param getResourceOwnerId - Функция для получения ID владельца ресурса
 */
export const ownerGuard = (getResourceOwnerId: (req: Request) => Promise<string | null>) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user!;
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Требуется авторизация',
      });
    }
    
    // Админ может всё
    if (user.role === 'ADMIN') {
      return next();
    }
    
    try {
      const ownerId = await getResourceOwnerId(req);
      
      if (!ownerId) {
        return res.status(404).json({
          success: false,
          error: 'Ресурс не найден',
        });
      }
      
      if (ownerId !== user.id) {
        securityLog('OWNER_GUARD_FAILED', {
          path: req.path,
          method: req.method,
          userId: user.id,
          resourceOwnerId: ownerId,
          ip: req.ip,
        });
        
        return res.status(403).json({
          success: false,
          error: 'Нет доступа к этому ресурсу',
        });
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Проверка участника заказа (клиент или фрилансер заказа)
 */
export const orderParticipantGuard = async (req: Request, res: Response, next: NextFunction) => {
  const user = req.user!;
  const orderId = req.params.id || req.params.orderId || req.body.orderId;
  
  if (!user) {
    return res.status(401).json({
      success: false,
      error: 'Требуется авторизация',
    });
  }
  
  if (user.role === 'ADMIN') {
    return next();
  }
  
  try {
    const { prisma } = await import('../lib/prisma');
    
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
    
    if (!isParticipant) {
      securityLog('ORDER_ACCESS_DENIED', {
        path: req.path,
        orderId,
        userId: user.id,
        ip: req.ip,
      });
      
      return res.status(403).json({
        success: false,
        error: 'Вы не являетесь участником этого заказа',
      });
    }
    
    // Добавляем информацию о заказе в request для дальнейшего использования
    (req as any).order = order;
    (req as any).isClient = order.clientId === user.id;
    (req as any).isFreelancer = order.freelancerId === user.id;
    
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Проверка что пользователь - клиент заказа
 */
export const orderClientGuard = async (req: Request, res: Response, next: NextFunction) => {
  const user = req.user!;
  const orderId = req.params.id || req.params.orderId || req.body.orderId;
  
  if (!user) {
    return res.status(401).json({
      success: false,
      error: 'Требуется авторизация',
    });
  }
  
  if (user.role === 'ADMIN') {
    return next();
  }
  
  try {
    const { prisma } = await import('../lib/prisma');
    
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { clientId: true },
    });
    
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Заказ не найден',
      });
    }
    
    if (order.clientId !== user.id) {
      return res.status(403).json({
        success: false,
        error: 'Только заказчик может выполнить это действие',
      });
    }
    
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Проверка что пользователь - фрилансер заказа
 */
export const orderFreelancerGuard = async (req: Request, res: Response, next: NextFunction) => {
  const user = req.user!;
  const orderId = req.params.id || req.params.orderId || req.body.orderId;
  
  if (!user) {
    return res.status(401).json({
      success: false,
      error: 'Требуется авторизация',
    });
  }
  
  if (user.role === 'ADMIN') {
    return next();
  }
  
  try {
    const { prisma } = await import('../lib/prisma');
    
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { freelancerId: true },
    });
    
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Заказ не найден',
      });
    }
    
    if (order.freelancerId !== user.id) {
      return res.status(403).json({
        success: false,
        error: 'Только исполнитель может выполнить это действие',
      });
    }
    
    next();
  } catch (error) {
    next(error);
  }
};
