import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const booleanFromEnv = z.preprocess((value) => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();

    if (['true', '1', 'yes', 'on'].includes(normalized)) {
      return true;
    }

    if (['false', '0', 'no', 'off', ''].includes(normalized)) {
      return false;
    }
  }

  return value;
}, z.boolean());

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().optional(),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 chars'),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 chars'),
  JWT_EXPIRES_IN: z.string().default('7d'),

  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  CORS_ORIGIN: z.string().optional(),

  EMAIL_FROM: z.string().email().default('noreply@freelancekg.com'),
  EMAIL_REPLY_TO: z.string().email().default('support@freelancekg.com'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: booleanFromEnv.default(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),

  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_DEFAULT_CHAT_ID: z.string().optional(),
  TELEGRAM_POLLING_ENABLED: booleanFromEnv.default(true),
  TELEGRAM_API_BASE: z.string().url().optional(),
  TELEGRAM_LINK_SECRET: z.string().optional(),
  TELEGRAM_LINK_TTL_SECONDS: z.coerce.number().int().positive().default(900),

  STORAGE_PROVIDER: z.enum(['local', 's3']).default('local'),
  S3_PUBLIC_BASE_URL: z.string().url().optional(),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),

  PAYMENT_PROVIDER: z.enum(['mock', 'paybox', 'disabled']).default('mock'),
  PAYBOX_MERCHANT_ID: z.string().optional(),
  PAYBOX_SECRET_KEY: z.string().optional(),
  PAYBOX_API_BASE: z.string().url().optional(),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(600),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),
  MESSAGE_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  UPLOAD_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),

  ENABLE_OAUTH: booleanFromEnv.default(true),
  DEV_OAUTH_MOCK: booleanFromEnv.default(true),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GITHUB_CALLBACK_URL: z.string().optional(),
});

type Env = z.infer<typeof EnvSchema>;

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
  throw new Error(`Invalid environment: ${issues}`);
}

const rawEnv = parsed.data;

const hasGoogleOAuth = Boolean(rawEnv.GOOGLE_CLIENT_ID && rawEnv.GOOGLE_CLIENT_SECRET);
const hasGithubOAuth = Boolean(rawEnv.GITHUB_CLIENT_ID && rawEnv.GITHUB_CLIENT_SECRET);
const hasAnyOAuthProvider = hasGoogleOAuth || hasGithubOAuth;
const hasSmtpConfig = Boolean(rawEnv.SMTP_HOST);

if (rawEnv.NODE_ENV === 'production') {
  if (rawEnv.ENABLE_OAUTH && !hasAnyOAuthProvider) {
    throw new Error('ENABLE_OAUTH=true but no OAuth provider credentials configured');
  }

  if (rawEnv.PAYMENT_PROVIDER === 'mock') {
    throw new Error('Production requires PAYMENT_PROVIDER != mock');
  }

  if (
    rawEnv.PAYMENT_PROVIDER === 'paybox' &&
    (!rawEnv.PAYBOX_MERCHANT_ID || !rawEnv.PAYBOX_SECRET_KEY)
  ) {
    throw new Error('PAYMENT_PROVIDER=paybox requires PAYBOX_MERCHANT_ID and PAYBOX_SECRET_KEY');
  }
}

if (rawEnv.NODE_ENV === 'production' && !hasSmtpConfig) {
  console.warn('SMTP_HOST not configured. Emails will be logged only until an email provider is configured.');
}

if (rawEnv.TELEGRAM_LINK_SECRET && rawEnv.TELEGRAM_LINK_SECRET.length < 16) {
  throw new Error('TELEGRAM_LINK_SECRET must be at least 16 chars when provided');
}

if (rawEnv.STORAGE_PROVIDER === 's3' && !rawEnv.S3_PUBLIC_BASE_URL) {
  throw new Error('STORAGE_PROVIDER=s3 requires S3_PUBLIC_BASE_URL');
}

if (
  rawEnv.STORAGE_PROVIDER === 's3' &&
  (!rawEnv.S3_BUCKET || !rawEnv.S3_REGION || !rawEnv.S3_ACCESS_KEY_ID || !rawEnv.S3_SECRET_ACCESS_KEY)
) {
  throw new Error(
    'STORAGE_PROVIDER=s3 requires S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY'
  );
}

if (rawEnv.NODE_ENV === 'production' && rawEnv.STORAGE_PROVIDER === 'local') {
  console.warn('STORAGE_PROVIDER=local in production. Uploaded files will be lost on redeploy or instance replacement.');
}

export const env: Env = rawEnv;
export const oauthProviders = {
  google: hasGoogleOAuth,
  github: hasGithubOAuth,
};
export const smtpConfigured = hasSmtpConfig;
export const telegramConfigured = Boolean(rawEnv.TELEGRAM_BOT_TOKEN);
