/**
 * Authentication Routes
 * POST /api/auth/register
 * POST /api/auth/login
 * POST /api/auth/logout
 * GET /api/auth/me
 * PUT /api/auth/profile
 * POST /api/auth/refresh
 * POST /api/auth/forgot-password
 * POST /api/auth/reset-password
 * GET /api/auth/google
 * GET /api/auth/google/callback
 * GET /api/auth/github
 * GET /api/auth/github/callback
 */

import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { hashPassword, comparePassword } from '../lib/password';
import { generateToken } from '../lib/jwt';
import {
  validate,
  registerSchema,
  loginSchema,
  updateUserProfileSchema,
  authSettingsSchema,
  changeEmailSchema,
  deleteAccountSchema,
} from '../lib/validation';
import { authMiddleware } from '../middleware/auth';
import { logger, auditLog, securityLog } from '../lib/logger';
import { EmailService } from '../lib/email';
import passport, { isOAuthProviderAvailable, oauthCapabilities, loginWithDevOAuth } from '../lib/oauth';
import { env } from '../config/env';
import crypto from 'crypto';
import {
  getUserSettings,
  saveUserSettings,
  getFreelancerPaymentDetails,
  getTelegramChatIdByUserId,
  unlinkTelegramChat,
} from '../lib/userSettings';
import { createTelegramLinkToken } from '../lib/telegramLinkToken';
import { ensurePermissions } from '../lib/permissions';

const router = Router();
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCK_WINDOW_MS = 15 * 60 * 1000;

function maskTelegramChatId(chatId: string | null): string | null {
  if (!chatId) return null;
  if (chatId.length <= 6) return chatId;
  return `${chatId.slice(0, 3)}***${chatId.slice(-3)}`;
}

// ============================================
// REGISTER
// ============================================

router.post('/register', validate(registerSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, name, role } = req.body;
    
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });
    
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'Пользователь с таким email уже существует',
      });
    }
    
    // Hash password
    const hashedPassword = await hashPassword(password);
    
    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        createdAt: true,
      },
    });
    
    // Create freelancer profile if role is FREELANCER
    if (role === 'FREELANCER') {
      await prisma.freelancerProfile.create({
        data: {
          userId: user.id,
        },
      });
    }
    
    // Generate token
    const token = generateToken({ userId: user.id, role: user.role });
    
    // Create session
    await prisma.session.create({
      data: {
        userId: user.id,
        token,
        userAgent: req.get('user-agent'),
        ip: req.ip,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });
    
    // Send welcome email (async, don't wait)
    EmailService.sendWelcome(email, name).catch((err) => {
      logger.error('Failed to send welcome email', { error: err, userId: user.id });
    });
    
    auditLog('USER_REGISTERED', user.id, { email, role });
    
    res.status(201).json({
      success: true,
      data: { user, token },
      message: 'Регистрация успешна',
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// LOGIN
// ============================================

router.post('/login', validate(loginSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    
    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        freelancerProfile: {
          select: {
            id: true,
            rating: true,
            completedOrders: true,
            isVerified: true,
          },
        },
      },
    });
    
    if (!user) {
      securityLog('LOGIN_FAILED_USER_NOT_FOUND', { email, ip: req.ip });
      return res.status(401).json({
        success: false,
        error: 'Неверный email или пароль',
      });
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      securityLog('LOGIN_BLOCKED', { email, ip: req.ip, lockedUntil: user.lockedUntil });
      const minutesLeft = Math.max(1, Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000));
      return res.status(403).json({
        success: false,
        error: `Аккаунт временно заблокирован. Повторите через ${minutesLeft} мин.`,
      });
    }
    
    // OAuth users can't login with password
    if (user.oauthProvider && !user.password) {
      return res.status(400).json({
        success: false,
        error: `Используйте вход через ${user.oauthProvider}`,
      });
    }
    
    // Verify password
    const isValidPassword = await comparePassword(password, user.password);
    
    if (!isValidPassword) {
      const failedAttempts = user.failedLoginAttempts + 1;
      const shouldLock = failedAttempts >= MAX_LOGIN_ATTEMPTS;
      const lockedUntil = shouldLock ? new Date(Date.now() + LOGIN_LOCK_WINDOW_MS) : null;

      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: failedAttempts,
          lockedUntil,
        },
      });
      
      securityLog('LOGIN_FAILED_WRONG_PASSWORD', {
        email,
        ip: req.ip,
        failedAttempts,
        lockedUntil,
      });
      
      return res.status(shouldLock ? 403 : 401).json({
        success: false,
        error: shouldLock
          ? 'Слишком много неудачных попыток. Аккаунт временно заблокирован.'
          : 'Неверный email или пароль',
      });
    }
    
    // Reset failed attempts on successful login
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        lastLoginIp: req.ip,
      },
    });
    
    // Generate token
    const token = generateToken({ userId: user.id, role: user.role });
    
    // Create session
    await prisma.session.create({
      data: {
        userId: user.id,
        token,
        userAgent: req.get('user-agent'),
        ip: req.ip,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    
    // Remove sensitive data
    const { password: _, failedLoginAttempts, lockedUntil, ...safeUser } = user;
    
    auditLog('USER_LOGIN', user.id, { email, ip: req.ip });
    
    res.json({
      success: true,
      data: {
        user: safeUser,
        token,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// LOGOUT
// ============================================

router.post('/logout', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const user = req.user!;
    
    if (token) {
      // Invalidate session
      await prisma.session.deleteMany({
        where: { token },
      });
    }
    
    auditLog('USER_LOGOUT', user.id, {});
    
    res.json({
      success: true,
      message: 'Вы вышли из системы',
    });
  } catch (error) {
    next(error);
  }
});

router.get('/sessions', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const currentToken = req.headers.authorization?.split(' ')[1] || '';

    const sessions = await prisma.session.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        userAgent: true,
        ip: true,
        createdAt: true,
        expiresAt: true,
        token: true,
      },
      take: 50,
    });

    res.json({
      success: true,
      data: sessions.map((session) => ({
        id: session.id,
        userAgent: session.userAgent,
        ip: session.ip,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        isCurrent: session.token === currentToken,
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/sessions/:id', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const currentToken = req.headers.authorization?.split(' ')[1] || '';

    const session = await prisma.session.findFirst({
      where: { id, userId: user.id },
      select: { id: true, token: true },
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Сессия не найдена',
      });
    }

    if (session.token === currentToken) {
      return res.status(400).json({
        success: false,
        error: 'Нельзя удалить текущую сессию этим методом. Используйте logout',
      });
    }

    await prisma.session.delete({
      where: { id: session.id },
    });

    auditLog('SESSION_REVOKED', user.id, {
      sessionId: id,
    });

    res.json({
      success: true,
      message: 'Сессия отозвана',
    });
  } catch (error) {
    next(error);
  }
});

router.post('/sessions/revoke-all', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const currentToken = req.headers.authorization?.split(' ')[1] || '';
    const where = currentToken
      ? {
          userId: user.id,
          token: { not: currentToken },
        }
      : {
          userId: user.id,
        };

    const result = await prisma.session.deleteMany({ where });

    auditLog('SESSIONS_REVOKE_ALL', user.id, {
      revokedCount: result.count,
    });

    res.json({
      success: true,
      data: {
        revokedCount: result.count,
      },
      message: 'Все остальные сессии отозваны',
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET CURRENT USER
// ============================================

router.get('/me', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        role: true,
        isEmailVerified: true,
        createdAt: true,
        freelancerProfile: {
          select: {
            id: true,
            bio: true,
            skills: true,
            hourlyRate: true,
            category: true,
            portfolio: true,
            rating: true,
            completedOrders: true,
            totalEarnings: true,
            balance: true,
            isVerified: true,
          },
        },
      },
    });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Пользователь не найден',
      });
    }

    const settings = await getUserSettings(userId);
    const paymentDetails = user.role === 'FREELANCER' ? await getFreelancerPaymentDetails(userId) : null;
    
    res.json({
      success: true,
      data: {
        ...user,
        settings,
        freelancerProfile: user.freelancerProfile
          ? {
              ...user.freelancerProfile,
              paymentDetails: paymentDetails || undefined,
            }
          : user.freelancerProfile,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// AUTH SETTINGS
// ============================================

router.get('/settings', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const settings = await getUserSettings(userId);
    res.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    next(error);
  }
});

router.put('/settings', authMiddleware, validate(authSettingsSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const {
      twoFactorEnabled,
      loginAlertsEnabled,
      notificationsEnabled,
      telegramNotificationsEnabled,
    } = req.body as {
      twoFactorEnabled?: boolean;
      loginAlertsEnabled?: boolean;
      notificationsEnabled?: boolean;
      telegramNotificationsEnabled?: boolean;
    };

    const patch: Record<string, boolean> = {};
    if (typeof twoFactorEnabled === 'boolean') patch.twoFactorEnabled = twoFactorEnabled;
    if (typeof loginAlertsEnabled === 'boolean') patch.loginAlertsEnabled = loginAlertsEnabled;
    if (typeof notificationsEnabled === 'boolean') patch.notificationsEnabled = notificationsEnabled;
    if (typeof telegramNotificationsEnabled === 'boolean') patch.telegramNotificationsEnabled = telegramNotificationsEnabled;

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Нет данных для обновления',
      });
    }

    const settings = await saveUserSettings(userId, patch);

    auditLog('AUTH_SETTINGS_UPDATED', userId, patch);

    res.json({
      success: true,
      data: settings,
      message: 'Настройки аккаунта обновлены',
    });
  } catch (error) {
    next(error);
  }
});

router.get('/telegram/link', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id as string;
    const { token, expiresAt } = await createTelegramLinkToken(userId);

    res.json({
      success: true,
      data: {
        deepLink: `https://t.me/FreelancerKG_bot?start=${encodeURIComponent(`link_${token}`)}`,
        expiresAt: expiresAt.toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/telegram/status', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id as string;
    const [chatId, settings] = await Promise.all([
      getTelegramChatIdByUserId(userId),
      getUserSettings(userId),
    ]);

    res.json({
      success: true,
      data: {
        linked: Boolean(chatId),
        chatIdMasked: maskTelegramChatId(chatId),
        telegramNotificationsEnabled: settings.telegramNotificationsEnabled,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/permissions', authMiddleware, async (req: Request, res: Response) => {
  const user = req.user!;
  const permissions = ensurePermissions(user.role, user.permissions);

  res.json({
    success: true,
    data: {
      role: user.role,
      permissions,
    },
  });
});

router.delete('/telegram/link', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id as string;
    await unlinkTelegramChat(userId);
    const settings = await saveUserSettings(userId, { telegramNotificationsEnabled: false });

    auditLog('TELEGRAM_UNLINKED', userId, {});

    res.json({
      success: true,
      data: {
        linked: false,
        chatIdMasked: null,
        telegramNotificationsEnabled: settings.telegramNotificationsEnabled,
      },
      message: 'Telegram-чат отвязан',
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// UPDATE CURRENT USER PROFILE
// ============================================

router.put('/profile', authMiddleware, validate(updateUserProfileSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { name } = req.body as { name?: string };

    if (name === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Нет данных для обновления',
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { name },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        role: true,
        isEmailVerified: true,
        createdAt: true,
        freelancerProfile: {
          select: {
            id: true,
            bio: true,
            skills: true,
            hourlyRate: true,
            category: true,
            rating: true,
            completedOrders: true,
            totalEarnings: true,
            balance: true,
            isVerified: true,
          },
        },
      },
    });

    auditLog('PROFILE_UPDATED', userId, { fields: ['name'] });

    res.json({
      success: true,
      data: updatedUser,
      message: 'Профиль обновлён',
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// FORGOT PASSWORD
// ============================================

router.post('/forgot-password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email обязателен',
      });
    }
    
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    
    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({
        success: true,
        message: 'Если email зарегистрирован, вы получите письмо с инструкциями',
      });
    }
    
    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetTokenHash,
        passwordResetExpires: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });
    
    // Send email
    await EmailService.sendPasswordReset(email, resetToken);
    
    auditLog('PASSWORD_RESET_REQUESTED', user.id, { email });
    
    res.json({
      success: true,
      message: 'Если email зарегистрирован, вы получите письмо с инструкциями',
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// RESET PASSWORD
// ============================================

router.post('/reset-password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, password } = req.body;
    
    if (!token || !password) {
      return res.status(400).json({
        success: false,
        error: 'Token и пароль обязательны',
      });
    }
    
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Пароль должен быть минимум 8 символов',
      });
    }
    
    const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');
    
    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: resetTokenHash,
        passwordResetExpires: { gt: new Date() },
      },
    });
    
    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Недействительный или истёкший токен',
      });
    }
    
    const hashedPassword = await hashPassword(password);
    
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
    
    // Invalidate all sessions
    await prisma.session.deleteMany({
      where: { userId: user.id },
    });
    
    auditLog('PASSWORD_RESET_COMPLETED', user.id, {});
    
    res.json({
      success: true,
      message: 'Пароль успешно изменён. Войдите с новым паролем.',
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// CHANGE PASSWORD (for logged in users)
// ============================================

router.post('/change-password', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Текущий и новый пароль обязательны',
      });
    }
    
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Новый пароль должен быть минимум 8 символов',
      });
    }
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Пользователь не найден',
      });
    }
    
    const isValid = await comparePassword(currentPassword, user.password);
    
    if (!isValid) {
      return res.status(400).json({
        success: false,
        error: 'Неверный текущий пароль',
      });
    }
    
    const hashedPassword = await hashPassword(newPassword);
    
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    await prisma.session.deleteMany({
      where: { userId },
    });
    
    auditLog('PASSWORD_CHANGED', userId, {});
    
    res.json({
      success: true,
      message: 'Пароль успешно изменён',
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// CHANGE EMAIL
// ============================================

router.put('/change-email', authMiddleware, validate(changeEmailSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { newEmail, currentPassword } = req.body as { newEmail: string; currentPassword: string };

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, password: true },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Пользователь не найден',
      });
    }

    const isValidPassword = await comparePassword(currentPassword, user.password);
    if (!isValidPassword) {
      return res.status(400).json({
        success: false,
        error: 'Неверный текущий пароль',
      });
    }

    if (user.email === newEmail) {
      return res.status(400).json({
        success: false,
        error: 'Новый email совпадает с текущим',
      });
    }

    const existing = await prisma.user.findUnique({
      where: { email: newEmail },
      select: { id: true },
    });

    if (existing && existing.id !== userId) {
      return res.status(400).json({
        success: false,
        error: 'Пользователь с таким email уже существует',
      });
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        email: newEmail,
        isEmailVerified: false,
      },
    });

    auditLog('EMAIL_CHANGED', userId, {
      previousEmail: user.email,
      newEmail,
    });

    res.json({
      success: true,
      message: 'Email успешно обновлён',
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// DELETE ACCOUNT
// ============================================

router.delete('/account', authMiddleware, validate(deleteAccountSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { currentPassword } = req.body as { currentPassword: string };

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, password: true, email: true, role: true },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Пользователь не найден',
      });
    }

    const isValidPassword = await comparePassword(currentPassword, user.password);
    if (!isValidPassword) {
      return res.status(400).json({
        success: false,
        error: 'Неверный пароль',
      });
    }

    await unlinkTelegramChat(userId).catch(() => undefined);

    await prisma.systemSetting.deleteMany({
      where: {
        OR: [
          { key: `user_settings:${userId}` },
          { key: `freelancer_payment_details:${userId}` },
          { key: `telegram_chat:${userId}` },
        ],
      },
    });

    await prisma.user.delete({
      where: { id: userId },
    });

    auditLog('ACCOUNT_DELETED', userId, {
      email: user.email,
      role: user.role,
    });

    res.json({
      success: true,
      message: 'Аккаунт удалён',
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GOOGLE OAUTH
// ============================================

const frontendUrl = env.FRONTEND_URL;

const oauthUnavailableResponse = (res: Response, provider: 'google' | 'github') => {
  res.status(503).json({
    success: false,
    error: `${provider} OAuth unavailable`,
    details: oauthCapabilities.enabled
      ? `Configure ${provider.toUpperCase()}_CLIENT_ID and ${provider.toUpperCase()}_CLIENT_SECRET`
      : 'OAuth is disabled by ENABLE_OAUTH=false',
  });
};

router.get('/google', async (req: Request, res: Response, next: NextFunction) => {
  if (isOAuthProviderAvailable('google')) {
    return passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
  }

  if (oauthCapabilities.devMockEnabled) {
    try {
      const { token } = await loginWithDevOAuth('google');
      return res.redirect(`${frontendUrl}/oauth/callback#token=${token}&provider=google&mock=1`);
    } catch (error) {
      return next(error);
    }
  }

  return oauthUnavailableResponse(res, 'google');
});

router.get('/google/callback', (req: Request, res: Response, next: NextFunction) => {
  if (!isOAuthProviderAvailable('google')) {
    return res.redirect(`${frontendUrl}/login?error=oauth_not_configured`);
  }

  return passport.authenticate('google', { failureRedirect: '/login?error=oauth_failed' })(req, res, next);
}, (req: Request, res: Response) => {
  const user = req.user as any;
  
  if (user && user.token) {
    res.redirect(`${frontendUrl}/oauth/callback#token=${user.token}`);
  } else {
    res.redirect(`${frontendUrl}/login?error=oauth_failed`);
  }
});

// ============================================
// GITHUB OAUTH
// ============================================

router.get('/github', async (req: Request, res: Response, next: NextFunction) => {
  if (isOAuthProviderAvailable('github')) {
    return passport.authenticate('github', { scope: ['user:email'] })(req, res, next);
  }

  if (oauthCapabilities.devMockEnabled) {
    try {
      const { token } = await loginWithDevOAuth('github');
      return res.redirect(`${frontendUrl}/oauth/callback#token=${token}&provider=github&mock=1`);
    } catch (error) {
      return next(error);
    }
  }

  return oauthUnavailableResponse(res, 'github');
});

router.get('/github/callback', (req: Request, res: Response, next: NextFunction) => {
  if (!isOAuthProviderAvailable('github')) {
    return res.redirect(`${frontendUrl}/login?error=oauth_not_configured`);
  }

  return passport.authenticate('github', { failureRedirect: '/login?error=oauth_failed' })(req, res, next);
}, (req: Request, res: Response) => {
  const user = req.user as any;
  
  if (user && user.token) {
    res.redirect(`${frontendUrl}/oauth/callback#token=${user.token}`);
  } else {
    res.redirect(`${frontendUrl}/login?error=oauth_failed`);
  }
});

export default router;
