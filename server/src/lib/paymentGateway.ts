import { env } from '../config/env';
import crypto from 'crypto';

export type GatewayMethod = 'card' | 'balance' | 'elsom' | 'odengi' | 'mbank';

export interface GatewayIntentInput {
  amount: number;
  method: GatewayMethod;
  userId: string;
  orderId: string;
  idempotencyKey: string;
}

export type GatewayIntentStatus = 'SUCCEEDED' | 'PENDING' | 'FAILED';

export interface GatewayIntentResult {
  status: GatewayIntentStatus;
  providerPaymentId: string;
  message: string;
  provider: string;
  checkoutUrl?: string;
}

interface PaymentGateway {
  createEscrowIntent(input: GatewayIntentInput): Promise<GatewayIntentResult>;
  verifyWebhook?(params: {
    headers: Record<string, string | string[] | undefined>;
    rawBody?: string;
    payload: unknown;
  }): boolean;
}

function createTransactionId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 11).toUpperCase()}`;
}

class MockPaymentGateway implements PaymentGateway {
  async createEscrowIntent(_input: GatewayIntentInput): Promise<GatewayIntentResult> {
    const providerPaymentId = createTransactionId('TXN');
    await new Promise((resolve) => setTimeout(resolve, 200));
    return {
      status: 'SUCCEEDED',
      providerPaymentId,
      message: 'Платёж успешно обработан (mock)',
      provider: 'mock',
    };
  }
}

class DisabledPaymentGateway implements PaymentGateway {
  async createEscrowIntent(_input: GatewayIntentInput): Promise<GatewayIntentResult> {
    const providerPaymentId = createTransactionId('TXN');
    return {
      status: 'FAILED',
      providerPaymentId,
      message: 'Платёжный шлюз не настроен. Обратитесь в поддержку.',
      provider: 'disabled',
    };
  }
}

class PayboxPaymentGateway implements PaymentGateway {
  async createEscrowIntent(input: GatewayIntentInput): Promise<GatewayIntentResult> {
    const providerPaymentId = createTransactionId('PBOX');
    const base = env.PAYBOX_API_BASE || 'https://paybox.example.com';
    const checkoutUrl = `${base.replace(/\/+$/, '')}/checkout/${providerPaymentId}`;

    return {
      status: 'PENDING',
      providerPaymentId,
      checkoutUrl,
      message: 'Перенаправьте пользователя на страницу оплаты PayBox.',
      provider: 'paybox',
    };
  }

  verifyWebhook(params: {
    headers: Record<string, string | string[] | undefined>;
    rawBody?: string;
    payload: unknown;
  }): boolean {
    const incoming = params.headers['x-paybox-signature'];
    const value = Array.isArray(incoming) ? incoming[0] : incoming;
    if (!value || !env.PAYBOX_SECRET_KEY) return false;

    const normalizedSignature = value.startsWith('sha256=') ? value.slice(7) : value;
    const rawPayload =
      params.rawBody ??
      (typeof params.payload === 'string' ? params.payload : JSON.stringify(params.payload ?? {}));
    const expectedSignature = crypto
      .createHmac('sha256', env.PAYBOX_SECRET_KEY)
      .update(rawPayload)
      .digest('hex');

    if (normalizedSignature.length !== expectedSignature.length) {
      return false;
    }

    return crypto.timingSafeEqual(
      Buffer.from(normalizedSignature, 'utf8'),
      Buffer.from(expectedSignature, 'utf8')
    );
  }
}

let cachedGateway: PaymentGateway | null = null;

export function getPaymentGateway(): PaymentGateway {
  if (cachedGateway) return cachedGateway;

  if (env.NODE_ENV === 'production' && env.PAYMENT_PROVIDER === 'mock') {
    cachedGateway = new DisabledPaymentGateway();
    return cachedGateway;
  }

  if (env.PAYMENT_PROVIDER === 'paybox') {
    if (!env.PAYBOX_MERCHANT_ID || !env.PAYBOX_SECRET_KEY) {
      cachedGateway = new DisabledPaymentGateway();
      return cachedGateway;
    }
    cachedGateway = new PayboxPaymentGateway();
    return cachedGateway;
  }

  if (env.PAYMENT_PROVIDER === 'mock') {
    cachedGateway = new MockPaymentGateway();
    return cachedGateway;
  }

  cachedGateway = new DisabledPaymentGateway();
  return cachedGateway;
}
