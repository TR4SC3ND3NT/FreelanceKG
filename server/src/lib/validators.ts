import { z } from 'zod';

// Auth validators
export const registerSchema = z.object({
  email: z.string().email('Неверный формат email'),
  password: z.string().min(6, 'Пароль должен быть минимум 6 символов'),
  name: z.string().min(2, 'Имя должно быть минимум 2 символа'),
  role: z.enum(['CLIENT', 'FREELANCER'], {
    errorMap: () => ({ message: 'Роль должна быть CLIENT или FREELANCER' })
  })
});

export const loginSchema = z.object({
  email: z.string().email('Неверный формат email'),
  password: z.string().min(1, 'Пароль обязателен')
});

// Order validators
export const createOrderSchema = z.object({
  title: z.string().min(5, 'Название должно быть минимум 5 символов').max(100),
  description: z.string().min(20, 'Описание должно быть минимум 20 символов').max(5000),
  category: z.string().min(1, 'Категория обязательна'),
  budget: z.number().min(100, 'Минимальный бюджет 100 сом').max(1000000),
  deadline: z.string().refine((date) => new Date(date) > new Date(), {
    message: 'Дедлайн должен быть в будущем'
  }),
  freelancerId: z.string().optional()
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(['PENDING', 'ACTIVE', 'SUBMITTED', 'COMPLETED', 'DISPUTED', 'CANCELLED'])
});

// Profile validators
export const updateProfileSchema = z.object({
  bio: z.string().max(1000).optional(),
  skills: z.array(z.string()).max(20).optional(),
  hourlyRate: z.number().min(0).max(100000).optional(),
  category: z.string().optional()
});

// Message validators
export const createMessageSchema = z.object({
  orderId: z.string().uuid('Неверный ID заказа'),
  content: z.string().min(1, 'Сообщение не может быть пустым').max(5000),
  fileUrl: z.string().url().optional()
});

// Dispute validators
export const createDisputeSchema = z.object({
  orderId: z.string().uuid('Неверный ID заказа'),
  reason: z.string().min(20, 'Опишите причину спора подробнее (минимум 20 символов)').max(2000)
});

export const resolveDisputeSchema = z.object({
  resolution: z.string().min(10, 'Укажите решение спора'),
  refundToClient: z.boolean(),
  refundAmount: z.number().min(0).optional()
});

// Review validators
export const createReviewSchema = z.object({
  orderId: z.string().uuid('Неверный ID заказа'),
  rating: z.number().min(1).max(5),
  comment: z.string().min(10, 'Отзыв должен быть минимум 10 символов').max(1000)
});

// Validation middleware factory
import { Request, Response, NextFunction } from 'express';

export const validate = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message
        }));
        return res.status(400).json({ error: 'Validation failed', details: errors });
      }
      next(error);
    }
  };
};

// Query validation
export const validateQuery = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.query = schema.parse(req.query);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message
        }));
        return res.status(400).json({ error: 'Invalid query parameters', details: errors });
      }
      next(error);
    }
  };
};
