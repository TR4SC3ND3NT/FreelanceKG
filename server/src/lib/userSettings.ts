import { prisma } from './prisma';

const USER_SETTINGS_PREFIX = 'user_settings:';
const FREELANCER_PAYMENT_PREFIX = 'freelancer_payment_details:';
const TELEGRAM_CHAT_PREFIX = 'telegram_chat:';
const TELEGRAM_USER_PREFIX = 'telegram_user:';

export interface UserSettings {
  twoFactorEnabled: boolean;
  loginAlertsEnabled: boolean;
  notificationsEnabled: boolean;
  telegramNotificationsEnabled: boolean;
}

export interface FreelancerPaymentDetails {
  method: string;
  value: string;
}

const DEFAULT_USER_SETTINGS: UserSettings = {
  twoFactorEnabled: false,
  loginAlertsEnabled: true,
  notificationsEnabled: true,
  telegramNotificationsEnabled: true,
};

function parseJson<T>(value: string | null | undefined): T | null {
  if (!value) return null;

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function userSettingsKey(userId: string): string {
  return `${USER_SETTINGS_PREFIX}${userId}`;
}

function freelancerPaymentKey(userId: string): string {
  return `${FREELANCER_PAYMENT_PREFIX}${userId}`;
}

function telegramChatKey(userId: string): string {
  return `${TELEGRAM_CHAT_PREFIX}${userId}`;
}

function telegramUserKey(chatId: string): string {
  return `${TELEGRAM_USER_PREFIX}${chatId}`;
}

export async function getUserSettings(userId: string): Promise<UserSettings> {
  const item = await prisma.systemSetting.findUnique({
    where: { key: userSettingsKey(userId) },
    select: { value: true },
  });

  const parsed = parseJson<Partial<UserSettings>>(item?.value);
  return {
    ...DEFAULT_USER_SETTINGS,
    ...(parsed || {}),
  };
}

export async function saveUserSettings(userId: string, patch: Partial<UserSettings>): Promise<UserSettings> {
  const current = await getUserSettings(userId);
  const nextValue: UserSettings = { ...current, ...patch };

  await prisma.systemSetting.upsert({
    where: { key: userSettingsKey(userId) },
    update: { value: JSON.stringify(nextValue), updatedBy: userId },
    create: {
      key: userSettingsKey(userId),
      value: JSON.stringify(nextValue),
      type: 'json',
      updatedBy: userId,
    },
  });

  return nextValue;
}

export async function getFreelancerPaymentDetails(userId: string): Promise<FreelancerPaymentDetails | null> {
  const item = await prisma.systemSetting.findUnique({
    where: { key: freelancerPaymentKey(userId) },
    select: { value: true },
  });

  const parsed = parseJson<FreelancerPaymentDetails>(item?.value);
  if (!parsed) return null;
  if (typeof parsed.method !== 'string' || typeof parsed.value !== 'string') return null;
  return parsed;
}

export async function saveFreelancerPaymentDetails(userId: string, details: FreelancerPaymentDetails): Promise<void> {
  await prisma.systemSetting.upsert({
    where: { key: freelancerPaymentKey(userId) },
    update: { value: JSON.stringify(details), updatedBy: userId },
    create: {
      key: freelancerPaymentKey(userId),
      value: JSON.stringify(details),
      type: 'json',
      updatedBy: userId,
    },
  });
}

export async function clearFreelancerPaymentDetails(userId: string): Promise<void> {
  await prisma.systemSetting.deleteMany({
    where: { key: freelancerPaymentKey(userId) },
  });
}

export async function linkTelegramChat(userId: string, chatId: string): Promise<void> {
  await prisma.$transaction([
    prisma.systemSetting.upsert({
      where: { key: telegramChatKey(userId) },
      update: { value: chatId, type: 'string', updatedBy: userId },
      create: {
        key: telegramChatKey(userId),
        value: chatId,
        type: 'string',
        updatedBy: userId,
      },
    }),
    prisma.systemSetting.upsert({
      where: { key: telegramUserKey(chatId) },
      update: { value: userId, type: 'string', updatedBy: userId },
      create: {
        key: telegramUserKey(chatId),
        value: userId,
        type: 'string',
        updatedBy: userId,
      },
    }),
  ]);
}

export async function unlinkTelegramChat(userId: string): Promise<void> {
  const existing = await prisma.systemSetting.findUnique({
    where: { key: telegramChatKey(userId) },
    select: { value: true },
  });

  await prisma.systemSetting.deleteMany({
    where: {
      key: {
        in: [
          telegramChatKey(userId),
          ...(existing?.value ? [telegramUserKey(existing.value)] : []),
        ],
      },
    },
  });
}

export async function getTelegramChatIdByUserId(userId: string): Promise<string | null> {
  const item = await prisma.systemSetting.findUnique({
    where: { key: telegramChatKey(userId) },
    select: { value: true },
  });
  return item?.value || null;
}

export async function getUserIdByTelegramChatId(chatId: string): Promise<string | null> {
  const item = await prisma.systemSetting.findUnique({
    where: { key: telegramUserKey(chatId) },
    select: { value: true },
  });
  return item?.value || null;
}
