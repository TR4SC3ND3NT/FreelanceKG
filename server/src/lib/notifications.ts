import { NotificationType, Prisma } from '@prisma/client';
import { logger } from './logger';
import { prisma } from './prisma';
import { emitToUser } from './socket';

interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  metadata?: Prisma.InputJsonValue;
}

export async function createNotification({
  userId,
  type,
  title,
  message,
  link,
  metadata,
}: CreateNotificationInput) {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        link,
        metadata,
      },
    });

    emitToUser(userId, 'notification', notification);
    return notification;
  } catch (error) {
    logger.error('Failed to create notification', {
      error,
      userId,
      type,
      title,
      link,
    });
    return null;
  }
}
