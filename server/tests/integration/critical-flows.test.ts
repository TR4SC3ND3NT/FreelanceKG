import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';
import app from '../../src/index';

function extractTokenFromLocation(location?: string): string | null {
  if (!location) return null;
  const hash = location.split('#')[1];
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  return params.get('token');
}

describe('FreelanceKG critical integration flows', () => {
  let clientToken = '';
  let freelancerToken = '';

  beforeAll(async () => {
    const clientLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'client@test.kg', password: 'password123' });

    expect(clientLogin.status).toBe(200);
    clientToken = clientLogin.body?.data?.token;
    expect(clientToken).toBeTruthy();

    const freelancerLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'aibek@test.kg', password: 'password123' });

    expect(freelancerLogin.status).toBe(200);
    freelancerToken = freelancerLogin.body?.data?.token;
    expect(freelancerToken).toBeTruthy();
  });

  it('auth: register + login + me works', async () => {
    const uniqueEmail = `test_${Date.now()}@freelancekg.local`;
    const password = 'SecurePass123';

    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: uniqueEmail,
        password,
        name: 'Test User',
        role: 'CLIENT',
      });

    expect(registerRes.status).toBe(201);
    expect(registerRes.body?.success).toBe(true);
    expect(registerRes.body?.data?.token).toBeTruthy();

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: uniqueEmail, password });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body?.success).toBe(true);
    const token = loginRes.body?.data?.token;
    expect(token).toBeTruthy();

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body?.data?.email).toBe(uniqueEmail);
  });

  it('oauth dev fallback: /api/auth/google returns callback token when provider keys are absent', async () => {
    const oauthRes = await request(app).get('/api/auth/google').redirects(0);

    expect([302, 503]).toContain(oauthRes.status);

    if (oauthRes.status === 302) {
      const token = extractTokenFromLocation(oauthRes.headers.location);
      expect(token).toBeTruthy();

      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(meRes.status).toBe(200);
      expect(meRes.body?.data?.email).toContain('dev-google');
    }
  });

  it('order + escrow + dispute flow works', async () => {
    const deadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const createOrderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        title: `Dispute Flow ${Date.now()}`,
        description: 'Нужна качественная разработка с подробным ТЗ и четкой коммуникацией.',
        category: 'development',
        budget: 12000,
        deadline,
      });

    expect(createOrderRes.status).toBe(201);
    const orderId = createOrderRes.body?.data?.id;
    expect(orderId).toBeTruthy();

    const escrowRes = await request(app)
      .post('/api/payments/escrow')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        orderId,
        amount: 12000,
        method: 'card',
      });

    expect(escrowRes.status).toBe(200);
    expect(escrowRes.body?.success).toBe(true);

    const acceptRes = await request(app)
      .post(`/api/orders/${orderId}/accept`)
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({});

    expect(acceptRes.status).toBe(200);

    const submitRes = await request(app)
      .post(`/api/orders/${orderId}/submit`)
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ message: 'Работа выполнена, отправляю на проверку заказчику.' });

    expect(submitRes.status).toBe(200);

    const disputeRes = await request(app)
      .post('/api/disputes')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        orderId,
        reason: 'Результат не соответствует техническому заданию и требует полного пересмотра.',
        evidence: [],
      });

    expect(disputeRes.status).toBe(201);
    expect(disputeRes.body?.success).toBe(true);

    const orderRes = await request(app)
      .get(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${clientToken}`);

    expect(orderRes.status).toBe(200);
    expect(orderRes.body?.data?.status).toBe('DISPUTED');
  });

  it('order + escrow + approve completion flow works', async () => {
    const deadline = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString();

    const createOrderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        title: `Approve Flow ${Date.now()}`,
        description: 'Нужна реализация backend API по ТЗ и проверка интеграции.',
        category: 'development',
        budget: 15000,
        deadline,
      });

    expect(createOrderRes.status).toBe(201);
    const orderId = createOrderRes.body?.data?.id;

    const escrowRes = await request(app)
      .post('/api/payments/escrow')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ orderId, amount: 15000, method: 'card' });

    expect(escrowRes.status).toBe(200);

    const acceptRes = await request(app)
      .post(`/api/orders/${orderId}/accept`)
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({});

    expect(acceptRes.status).toBe(200);

    const submitRes = await request(app)
      .post(`/api/orders/${orderId}/submit`)
      .set('Authorization', `Bearer ${freelancerToken}`)
      .send({ message: 'Сделано. Прошу принять работу и закрыть заказ.' });

    expect(submitRes.status).toBe(200);

    const approveRes = await request(app)
      .post(`/api/orders/${orderId}/approve`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({});

    expect(approveRes.status).toBe(200);
    expect(approveRes.body?.success).toBe(true);

    const orderRes = await request(app)
      .get(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${clientToken}`);

    expect(orderRes.status).toBe(200);
    expect(orderRes.body?.data?.status).toBe('COMPLETED');
  });
});
