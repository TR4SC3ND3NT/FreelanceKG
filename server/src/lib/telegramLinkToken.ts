import crypto from 'crypto';
import { env } from '../config/env';
import { prisma } from './prisma';

const TOKEN_PREFIX = 'telegram_link_token:';

interface TelegramLinkPayload {
  userId: string;
  nonce: string;
  exp: number;
}

function getSigningSecret(): string {
  return env.TELEGRAM_LINK_SECRET || env.SESSION_SECRET;
}

function toBase64Url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function fromBase64Url(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function sign(encodedPayload: string): string {
  return crypto
    .createHmac('sha256', getSigningSecret())
    .update(encodedPayload)
    .digest('base64url');
}

function safeEquals(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export async function createTelegramLinkToken(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const expiresAt = new Date(Date.now() + env.TELEGRAM_LINK_TTL_SECONDS * 1000);
  const payload: TelegramLinkPayload = {
    userId,
    nonce: crypto.randomBytes(16).toString('hex'),
    exp: expiresAt.getTime(),
  };

  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = sign(encodedPayload);
  const token = `${encodedPayload}.${signature}`;

  await prisma.systemSetting.upsert({
    where: { key: `${TOKEN_PREFIX}${payload.nonce}` },
    update: {
      value: JSON.stringify({ userId: payload.userId, exp: payload.exp }),
      type: 'json',
      updatedBy: userId,
    },
    create: {
      key: `${TOKEN_PREFIX}${payload.nonce}`,
      value: JSON.stringify({ userId: payload.userId, exp: payload.exp }),
      type: 'json',
      updatedBy: userId,
    },
  });

  return { token, expiresAt };
}

export async function consumeTelegramLinkToken(token: string): Promise<{ userId?: string; error?: string }> {
  if (!token) {
    return { error: 'Пустой payload' };
  }

  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) {
    return { error: 'Неверный формат payload' };
  }

  const expectedSignature = sign(encodedPayload);
  if (!safeEquals(signature, expectedSignature)) {
    return { error: 'Подпись payload невалидна' };
  }

  let payload: TelegramLinkPayload;
  try {
    payload = JSON.parse(fromBase64Url(encodedPayload)) as TelegramLinkPayload;
  } catch {
    return { error: 'Payload поврежден' };
  }

  if (!payload.userId || !payload.nonce || !payload.exp) {
    return { error: 'Payload неполный' };
  }

  if (payload.exp < Date.now()) {
    await prisma.systemSetting.deleteMany({
      where: { key: `${TOKEN_PREFIX}${payload.nonce}` },
    });
    return { error: 'Срок действия payload истёк' };
  }

  const state = await prisma.systemSetting.findUnique({
    where: { key: `${TOKEN_PREFIX}${payload.nonce}` },
    select: { value: true },
  });

  if (!state) {
    return { error: 'Payload уже использован или не найден' };
  }

  try {
    const parsed = JSON.parse(state.value) as { userId?: string; exp?: number };
    if (parsed.userId !== payload.userId || parsed.exp !== payload.exp) {
      return { error: 'Payload не прошёл проверку целостности' };
    }
  } catch {
    return { error: 'Состояние payload повреждено' };
  }

  await prisma.systemSetting.deleteMany({
    where: { key: `${TOKEN_PREFIX}${payload.nonce}` },
  });

  return { userId: payload.userId };
}

export async function cleanupExpiredTelegramLinkTokens(): Promise<number> {
  const rows = await prisma.systemSetting.findMany({
    where: {
      key: {
        startsWith: TOKEN_PREFIX,
      },
    },
    select: {
      key: true,
      value: true,
    },
    take: 1000,
  });

  if (rows.length === 0) return 0;

  const now = Date.now();
  const expiredKeys: string[] = [];
  for (const row of rows) {
    try {
      const payload = JSON.parse(row.value) as { exp?: number };
      if (!payload.exp || payload.exp <= now) {
        expiredKeys.push(row.key);
      }
    } catch {
      expiredKeys.push(row.key);
    }
  }

  if (expiredKeys.length === 0) return 0;

  await prisma.systemSetting.deleteMany({
    where: {
      key: {
        in: expiredKeys,
      },
    },
  });

  return expiredKeys.length;
}
