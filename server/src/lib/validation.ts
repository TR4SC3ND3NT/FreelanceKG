import { z } from 'zod';

const isAbsoluteHttpUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const isUploadPathOrHttpUrl = (value: string): boolean => {
  return value.startsWith('/uploads/files/') || isAbsoluteHttpUrl(value);
};

// ============================================
// AUTH VALIDATION SCHEMAS
// ============================================

export const registerSchema = z.object({
  email: z
    .string()
    .email('Некорректный формат email')
    .min(5, 'Email слишком короткий')
    .max(100, 'Email слишком длинный')
    .transform((e) => e.toLowerCase().trim()),
  
  password: z
    .string()
    .min(8, 'Пароль минимум 8 символов')
    .max(100, 'Пароль слишком длинный')
    .regex(/[a-z]/, 'Пароль должен содержать строчную букву')
    .regex(/[A-Z]/, 'Пароль должен содержать заглавную букву')
    .regex(/[0-9]/, 'Пароль должен содержать цифру'),
  
  name: z
    .string()
    .min(2, 'Имя минимум 2 символа')
    .max(50, 'Имя слишком длинное')
    .regex(/^[a-zA-Zа-яА-ЯёЁ\s]+$/, 'Имя содержит недопустимые символы')
    .transform((n) => n.trim()),
  
  role: z.enum(['CLIENT', 'FREELANCER'], {
    errorMap: () => ({ message: 'Роль должна быть CLIENT или FREELANCER' }),
  }),
});

export const loginSchema = z.object({
  email: z
    .string()
    .email('Некорректный формат email')
    .transform((e) => e.toLowerCase().trim()),
  
  password: z
    .string()
    .min(1, 'Пароль обязателен'),
});

export const updateUserProfileSchema = z.object({
  name: z
    .string()
    .min(2, 'Имя минимум 2 символа')
    .max(50, 'Имя слишком длинное')
    .regex(/^[a-zA-Zа-яА-ЯёЁ\s]+$/, 'Имя содержит недопустимые символы')
    .transform((n) => n.trim())
    .optional(),
});

// ============================================
// FREELANCER PROFILE VALIDATION
// ============================================

export const updateProfileSchema = z.object({
  name: z
    .string()
    .min(2, 'Имя минимум 2 символа')
    .max(50, 'Имя слишком длинное')
    .regex(/^[a-zA-Zа-яА-ЯёЁ\s]+$/, 'Имя содержит недопустимые символы')
    .transform((n) => n.trim())
    .optional(),

  bio: z
    .string()
    .min(10, 'Описание минимум 10 символов')
    .max(2000, 'Описание слишком длинное')
    .optional(),
  
  skills: z
    .array(z.string().min(1).max(50))
    .min(1, 'Добавьте хотя бы один навык')
    .max(20, 'Максимум 20 навыков')
    .optional(),
  
  hourlyRate: z
    .number()
    .min(100, 'Минимальная ставка 100 сом')
    .max(100000, 'Максимальная ставка 100000 сом')
    .optional(),
  
  category: z
    .enum(['development', 'design', 'marketing', 'copywriting', 'video', 'translation'])
    .optional(),
  
  portfolio: z
    .array(z.object({
      id: z.string().optional(),
      title: z.string().min(1).max(100),
      description: z.string().max(500).optional(),
      imageUrl: z
        .string()
        .refine((value) => {
          if (value.startsWith('/uploads/files/')) return true;
          try {
            new URL(value);
            return true;
          } catch {
            return false;
          }
        }, 'Некорректный URL изображения')
        .optional(),
      link: z.string().url().optional(),
    }))
    .max(20, 'Максимум 20 работ в портфолио')
    .optional(),

  paymentDetails: z
    .object({
      method: z.enum(['card', 'wallet', 'elsom', 'odengi', 'mbank']),
      value: z.string().min(4).max(120),
    })
    .optional(),
});

// ============================================
// ORDER VALIDATION
// ============================================

export const createOrderSchema = z.object({
  title: z
    .string()
    .min(5, 'Название минимум 5 символов')
    .max(200, 'Название слишком длинное')
    .transform((t) => t.trim()),
  
  description: z
    .string()
    .min(20, 'Описание минимум 20 символов')
    .max(10000, 'Описание слишком длинное')
    .transform((d) => d.trim()),
  
  category: z.enum(['development', 'design', 'marketing', 'copywriting', 'video', 'translation'], {
    errorMap: () => ({ message: 'Выберите категорию' }),
  }),
  
  budget: z
    .number()
    .min(500, 'Минимальный бюджет 500 сом')
    .max(10000000, 'Максимальный бюджет 10 000 000 сом'),
  
  deadline: z
    .string()
    .refine((d) => {
      const date = new Date(d);
      const now = new Date();
      return date > now;
    }, 'Дедлайн должен быть в будущем'),
  
  freelancerId: z.string().uuid().optional(),
});

export const submitWorkSchema = z.object({
  message: z
    .string()
    .min(10, 'Сообщение минимум 10 символов')
    .max(5000, 'Сообщение слишком длинное')
    .optional(),
  
  files: z
    .array(z.string().refine(isUploadPathOrHttpUrl, 'Некорректный URL файла'))
    .max(10, 'Максимум 10 файлов')
    .optional(),
});

// ============================================
// MESSAGE VALIDATION
// ============================================

export const sendMessageSchema = z.object({
  orderId: z.string().uuid('Некорректный ID заказа'),

  content: z
    .string()
    .max(5000, 'Сообщение слишком длинное')
    .transform((c) => c.trim())
    .optional()
    .default(''),

  fileUrl: z
    .string()
    .refine(isUploadPathOrHttpUrl, 'Некорректный URL файла')
    .optional(),

  fileName: z
    .string()
    .min(1, 'Имя файла не может быть пустым')
    .max(255, 'Слишком длинное имя файла')
    .optional(),

  fileSize: z
    .number()
    .int('Размер файла должен быть целым числом')
    .positive('Размер файла должен быть больше нуля')
    .max(50 * 1024 * 1024, 'Файл слишком большой')
    .optional(),

  mimeType: z
    .string()
    .min(1, 'MIME-тип обязателен')
    .max(255, 'Слишком длинный MIME-тип')
    .optional(),

  type: z.enum(['text', 'image', 'file', 'system']).optional(),
}).superRefine((data, ctx) => {
  if (!data.content && !data.fileUrl) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['content'],
      message: 'Сообщение не может быть пустым без вложения',
    });
  }
});

// ============================================
// DISPUTE VALIDATION
// ============================================

export const createDisputeSchema = z.object({
  orderId: z.string().uuid('Некорректный ID заказа'),
  
  reason: z
    .string()
    .min(20, 'Опишите причину подробнее (минимум 20 символов)')
    .max(5000, 'Описание слишком длинное')
    .transform((r) => r.trim()),
  
  evidence: z
    .array(z.string().refine(isUploadPathOrHttpUrl, 'Некорректный URL файла'))
    .max(10, 'Максимум 10 файлов')
    .optional(),
});

// ============================================
// REVIEW VALIDATION
// ============================================

export const createReviewSchema = z.object({
  orderId: z.string().uuid('Некорректный ID заказа'),
  
  rating: z
    .number()
    .min(1, 'Минимальная оценка 1')
    .max(5, 'Максимальная оценка 5'),
  
  comment: z
    .string()
    .min(10, 'Отзыв минимум 10 символов')
    .max(2000, 'Отзыв слишком длинный')
    .transform((c) => c.trim()),
});

export const orderReviewBodySchema = z.object({
  rating: z
    .number()
    .min(1, 'Минимальная оценка 1')
    .max(5, 'Максимальная оценка 5'),
  comment: z
    .string()
    .min(10, 'Отзыв минимум 10 символов')
    .max(2000, 'Отзыв слишком длинный')
    .transform((c) => c.trim()),
});

export const authSettingsSchema = z.object({
  twoFactorEnabled: z.boolean().optional(),
  loginAlertsEnabled: z.boolean().optional(),
  notificationsEnabled: z.boolean().optional(),
  telegramNotificationsEnabled: z.boolean().optional(),
});

export const changeEmailSchema = z.object({
  newEmail: z.string().email('Некорректный формат email').transform((e) => e.toLowerCase().trim()),
  currentPassword: z.string().min(1, 'Текущий пароль обязателен'),
});

export const deleteAccountSchema = z.object({
  currentPassword: z.string().min(1, 'Пароль обязателен'),
});

// ============================================
// PAYMENT VALIDATION
// ============================================

export const createPaymentSchema = z.object({
  orderId: z.string().uuid('Некорректный ID заказа'),
  
  amount: z
    .number()
    .min(500, 'Минимальная сумма 500 сом')
    .max(10000000, 'Максимальная сумма 10 000 000 сом'),
  
  method: z.enum(['card', 'balance', 'elsom', 'odengi', 'mbank'], {
    errorMap: () => ({ message: 'Выберите метод оплаты' }),
  }),
});

// ============================================
// QUERY PARAMS VALIDATION
// ============================================

export const freelancerQuerySchema = z.object({
  category: z.enum(['development', 'design', 'marketing', 'copywriting', 'video', 'translation']).optional(),
  search: z.string().max(100).optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  skills: z.string().optional(), // comma-separated
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(12),
  sortBy: z.enum(['rating', 'price', 'orders', 'newest']).default('rating'),
});

export const orderQuerySchema = z.object({
  status: z.enum(['PENDING', 'ACTIVE', 'SUBMITTED', 'COMPLETED', 'DISPUTED', 'CANCELLED']).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(10),
});

// ============================================
// UTILITY TYPES
// ============================================

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateUserProfileInput = z.infer<typeof updateUserProfileSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type CreateDisputeInput = z.infer<typeof createDisputeSchema>;
export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type OrderReviewBodyInput = z.infer<typeof orderReviewBodySchema>;
export type AuthSettingsInput = z.infer<typeof authSettingsSchema>;
export type ChangeEmailInput = z.infer<typeof changeEmailSchema>;
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type FreelancerQueryInput = z.infer<typeof freelancerQuerySchema>;
export type OrderQueryInput = z.infer<typeof orderQuerySchema>;

// ============================================
// VALIDATION MIDDLEWARE FACTORY
// ============================================

import { Request, Response, NextFunction } from 'express';

export const validate = <T extends z.ZodSchema>(schema: T, source: 'body' | 'query' | 'params' = 'body') => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = source === 'body' ? req.body : source === 'query' ? req.query : req.params;
      const validated = await schema.parseAsync(data);
      
      if (source === 'body') {
        req.body = validated;
      } else if (source === 'query') {
        (req as any).validatedQuery = validated;
      } else {
        (req as any).validatedParams = validated;
      }
      
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Ошибка валидации',
          details: error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  };
};
