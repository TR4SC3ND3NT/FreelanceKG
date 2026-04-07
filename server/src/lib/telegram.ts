import { env, telegramConfigured } from '../config/env';
import { logger } from './logger';
import { prisma } from './prisma';
import {
  getTelegramChatIdByUserId,
  getUserIdByTelegramChatId,
  getUserSettings,
  linkTelegramChat,
  saveUserSettings,
} from './userSettings';
import { emitToRoom, emitToUser } from './socket';
import { consumeTelegramLinkToken } from './telegramLinkToken';

interface TelegramMessage {
  message_id: number;
  chat: {
    id: number;
  };
  text?: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

interface TelegramApiResponse<T> {
  ok: boolean;
  result: T;
}

const POLL_INTERVAL_MS = 5000;

class TelegramServiceClass {
  private pollOffset = 0;
  private isPolling = false;
  private pollTimer: NodeJS.Timeout | null = null;

  private get apiBase(): string | null {
    if (!telegramConfigured || !env.TELEGRAM_BOT_TOKEN) return null;
    return env.TELEGRAM_API_BASE || `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}`;
  }

  private async request<T>(method: string, body?: Record<string, unknown>): Promise<T | null> {
    const base = this.apiBase;
    if (!base) return null;

    const response = await fetch(`${base}/${method}`, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      logger.warn('Telegram API request failed', { method, status: response.status });
      return null;
    }

    const payload = (await response.json()) as TelegramApiResponse<T>;
    if (!payload.ok) return null;
    return payload.result;
  }

  async sendToChat(chatId: string, text: string): Promise<boolean> {
    const result = await this.request('sendMessage', {
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    });
    return Boolean(result);
  }

  async sendToUser(userId: string, text: string): Promise<boolean> {
    try {
      const settings = await getUserSettings(userId);
      if (!settings.telegramNotificationsEnabled) {
        return false;
      }

      const directChatId = await getTelegramChatIdByUserId(userId);
      const fallbackChatId =
        env.NODE_ENV !== 'production' ? env.TELEGRAM_DEFAULT_CHAT_ID || null : null;
      const targetChatId = directChatId || fallbackChatId;

      if (!targetChatId) {
        return false;
      }

      return this.sendToChat(targetChatId, text);
    } catch (error) {
      logger.warn('Telegram sendToUser failed', { userId, error });
      return false;
    }
  }

  async notifyOrderEvent(params: {
    recipientUserId?: string | null;
    title: string;
    lines: string[];
    orderId: string;
  }): Promise<void> {
    if (!params.recipientUserId) return;

    const text = [
      `*${params.title}*`,
      ...params.lines,
      '',
      `Открыть заказ: ${env.FRONTEND_URL}/orders/${params.orderId}`,
      `Ответ в чат: /reply ${params.orderId} <текст>`,
    ].join('\n');

    await this.sendToUser(params.recipientUserId, text);
  }

  private parseStartPayload(raw: string | undefined): string {
    if (!raw) return '';

    const candidates = [raw];
    try {
      const decoded = decodeURIComponent(raw);
      if (decoded !== raw) candidates.push(decoded);
    } catch {
      // Ignore decode errors and continue with raw payload.
    }

    for (const candidate of candidates) {
      const normalized = candidate
        .trim()
        .replace(/^start=/i, '')
        .replace(/^link_/i, '')
        .trim();

      if (normalized) {
        return normalized;
      }
    }

    return '';
  }

  private async handleLinkCommand(chatId: string, args: string[]): Promise<void> {
    const payload = this.parseStartPayload(args[0]);

    if (!payload) {
      const linkedUserId = await getUserIdByTelegramChatId(chatId);
      if (linkedUserId) {
        await this.sendToChat(chatId, 'Чат уже привязан. Для перепривязки нажмите кнопку в настройках FreelanceKG и снова отправьте /start.');
        return;
      }

      await this.sendToChat(chatId, 'Откройте бота по ссылке из настроек аккаунта FreelanceKG и повторите /start.');
      return;
    }

    let userId: string | null = null;
    const tokenResult = await consumeTelegramLinkToken(payload);
    if (tokenResult.userId) {
      userId = tokenResult.userId;
    } else if (env.NODE_ENV !== 'production') {
      // Legacy fallback for local development only.
      userId = payload;
    }

    if (!userId) {
      await this.sendToChat(chatId, 'Payload для привязки недействителен или истёк. Сгенерируйте новую ссылку в настройках аккаунта.');
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true },
    });

    if (!user) {
      await this.sendToChat(chatId, 'Пользователь не найден. Проверьте userId.');
      return;
    }

    await linkTelegramChat(user.id, chatId);
    await saveUserSettings(user.id, { telegramNotificationsEnabled: true });
    await this.sendToChat(chatId, `Чат привязан к аккаунту ${user.name}. Теперь уведомления будут приходить сюда.`);
  }

  private async handleReplyCommand(chatId: string, args: string[]): Promise<void> {
    const orderId = args[0];
    const content = args.slice(1).join(' ').trim();

    if (!orderId || !content) {
      await this.sendToChat(chatId, 'Формат: /reply <orderId> <сообщение>');
      return;
    }

    const senderId = await getUserIdByTelegramChatId(chatId);
    if (!senderId) {
      await this.sendToChat(chatId, 'Сначала привяжите аккаунт через кнопку "Привязать Telegram" в настройках FreelanceKG.');
      return;
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        clientId: true,
        freelancerId: true,
        status: true,
      },
    });

    if (!order) {
      await this.sendToChat(chatId, 'Заказ не найден.');
      return;
    }

    const isParticipant = order.clientId === senderId || order.freelancerId === senderId;
    if (!isParticipant) {
      await this.sendToChat(chatId, 'Вы не участник этого заказа.');
      return;
    }

    if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
      await this.sendToChat(chatId, 'Чат закрыт для завершённого/отменённого заказа.');
      return;
    }

    const message = await prisma.message.create({
      data: {
        orderId,
        senderId,
        content,
      },
      include: {
        sender: {
          select: { id: true, name: true, avatar: true },
        },
      },
    });

    emitToRoom(`order:${orderId}`, 'new-message', {
      ...message,
      type: 'text',
      mimeType: undefined,
    });

    const recipientId = order.clientId === senderId ? order.freelancerId : order.clientId;
    if (recipientId) {
      emitToUser(recipientId, 'notification', {
        type: 'MESSAGE_RECEIVED',
        title: 'Новое сообщение',
        message: `${message.sender.name}: ${content.substring(0, 80)}`,
        link: `/orders/${orderId}`,
      });

      await this.notifyOrderEvent({
        recipientUserId: recipientId,
        title: 'Новое сообщение',
        lines: [`${message.sender.name}: ${content.substring(0, 120)}`],
        orderId,
      });
    }

    await this.sendToChat(chatId, 'Сообщение отправлено.');
  }

  private async handleUpdate(update: TelegramUpdate): Promise<void> {
    const message = update.message;
    if (!message?.text) return;

    const chatId = String(message.chat.id);
    const text = message.text.trim();
    if (!text.startsWith('/')) return;

    const [command, ...args] = text.split(/\s+/);
    const commandName = command.toLowerCase().split('@')[0];

    if (commandName === '/start' || commandName === '/link') {
      await this.handleLinkCommand(chatId, args);
      return;
    }

    if (commandName === '/reply') {
      await this.handleReplyCommand(chatId, args);
      return;
    }

    await this.sendToChat(chatId, 'Доступные команды:\n/start\n/link\n/reply <orderId> <сообщение>');
  }

  private async pollOnce(): Promise<void> {
    const updates = await this.request<TelegramUpdate[]>('getUpdates', {
      timeout: 25,
      offset: this.pollOffset,
    });

    if (!updates?.length) return;

    for (const update of updates) {
      this.pollOffset = update.update_id + 1;
      await this.handleUpdate(update);
    }
  }

  startPolling(): void {
    if (!telegramConfigured || !env.TELEGRAM_POLLING_ENABLED) {
      logger.info('Telegram polling disabled');
      return;
    }

    if (this.isPolling) return;
    this.isPolling = true;
    logger.info('Telegram polling started');

    const loop = async () => {
      if (!this.isPolling) return;

      try {
        await this.pollOnce();
      } catch (error) {
        logger.warn('Telegram polling iteration failed', { error });
      } finally {
        if (this.isPolling) {
          this.pollTimer = setTimeout(loop, POLL_INTERVAL_MS);
        }
      }
    };

    void loop();
  }

  stopPolling(): void {
    this.isPolling = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }
}

export const TelegramService = new TelegramServiceClass();
