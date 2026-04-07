/**
 * Email Service для FreelanceKG
 * 
 * Mock-сервис для отправки email.
 * Готов к замене на реальный SMTP или сервис:
 * - Nodemailer с SMTP
 * - SendGrid
 * - Mailgun
 * - Amazon SES
 */

import nodemailer from 'nodemailer';
import { logger } from './logger';
import { env, smtpConfigured } from '../config/env';

// ============================================
// CONFIGURATION
// ============================================

const EMAIL_CONFIG = {
  from: env.EMAIL_FROM,
  replyTo: env.EMAIL_REPLY_TO,
  
  // Шаблоны
  templates: {
    welcome: {
      subject: 'Добро пожаловать в FreelanceKG! 🎉',
    },
    orderCreated: {
      subject: 'Новый заказ создан',
    },
    orderAccepted: {
      subject: 'Ваш заказ принят фрилансером',
    },
    workSubmitted: {
      subject: 'Работа сдана на проверку',
    },
    orderCompleted: {
      subject: 'Заказ завершён! 🎉',
    },
    disputeOpened: {
      subject: '⚠️ Открыт спор по заказу',
    },
    paymentReceived: {
      subject: 'Оплата получена 💰',
    },
    newMessage: {
      subject: 'Новое сообщение по заказу',
    },
    passwordReset: {
      subject: 'Сброс пароля',
    },
    emailVerification: {
      subject: 'Подтвердите email',
    },
  },
};

// ============================================
// TRANSPORTER
// ============================================

let transporter: nodemailer.Transporter | null = null;

// В production используем реальный SMTP
if (smtpConfigured) {
  const transportOptions: any = {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
  };

  if (env.SMTP_USER && env.SMTP_PASS) {
    transportOptions.auth = {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    };
  }

  transporter = nodemailer.createTransport(transportOptions);
  
  logger.info('Email transporter configured with SMTP');
} else {
  // В development логируем в консоль
  logger.warn('SMTP not configured, emails will be logged only');
}

// ============================================
// EMAIL TEMPLATES
// ============================================

const generateHtml = (content: string, title: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      margin: 0;
      padding: 0;
      background-color: #f5f5f5;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .card {
      background: white;
      border-radius: 12px;
      padding: 30px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .logo {
      font-size: 24px;
      font-weight: bold;
      color: #3b82f6;
      margin-bottom: 20px;
    }
    .button {
      display: inline-block;
      padding: 12px 24px;
      background: linear-gradient(135deg, #3b82f6, #6366f1);
      color: white;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      margin: 10px 0;
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #eee;
      font-size: 12px;
      color: #666;
    }
    .highlight {
      background: #f0f9ff;
      padding: 15px;
      border-radius: 8px;
      margin: 15px 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo">FreelanceKG</div>
      ${content}
      <div class="footer">
        <p>С уважением,<br>Команда FreelanceKG</p>
        <p>© ${new Date().getFullYear()} FreelanceKG. Сделано с ❤️ в Кыргызстане</p>
      </div>
    </div>
  </div>
</body>
</html>
`;

// ============================================
// EMAIL FUNCTIONS
// ============================================

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  try {
    if (transporter) {
      await transporter.sendMail({
        from: EMAIL_CONFIG.from,
        replyTo: EMAIL_CONFIG.replyTo,
        ...options,
      });
      
      logger.info('Email sent', { to: options.to, subject: options.subject });
      return true;
    } else {
      // Mock: логируем email
      logger.info('📧 EMAIL (mock):', {
        to: options.to,
        subject: options.subject,
        preview: options.text?.substring(0, 100) || 'HTML email',
      });
      return true;
    }
  } catch (error) {
    logger.error('Failed to send email', { to: options.to, error });
    return false;
  }
}

// ============================================
// PUBLIC API
// ============================================

export const EmailService = {
  /**
   * Отправить приветственное письмо
   */
  async sendWelcome(to: string, name: string): Promise<boolean> {
    const html = generateHtml(`
      <h2>Добро пожаловать, ${name}! 👋</h2>
      <p>Мы рады видеть вас на FreelanceKG — ведущей фриланс-платформе Кыргызстана.</p>
      <div class="highlight">
        <strong>Что вы можете делать:</strong>
        <ul>
          <li>🔍 Найти лучших фрилансеров</li>
          <li>💼 Создать заказ с защитой эскроу</li>
          <li>💬 Общаться с исполнителями</li>
          <li>⭐ Оставлять отзывы</li>
        </ul>
      </div>
      <a href="${env.FRONTEND_URL}" class="button">
        Начать работу
      </a>
    `, EMAIL_CONFIG.templates.welcome.subject);
    
    return sendEmail({
      to,
      subject: EMAIL_CONFIG.templates.welcome.subject,
      html,
      text: `Добро пожаловать в FreelanceKG, ${name}!`,
    });
  },
  
  /**
   * Уведомление о новом заказе
   */
  async sendOrderCreated(
    to: string,
    orderTitle: string,
    orderBudget: number,
    orderId: string
  ): Promise<boolean> {
    const html = generateHtml(`
      <h2>Новый заказ создан! 📋</h2>
      <div class="highlight">
        <p><strong>Название:</strong> ${orderTitle}</p>
        <p><strong>Бюджет:</strong> ${orderBudget.toLocaleString()} сом</p>
      </div>
      <p>Ваш заказ опубликован и доступен фрилансерам.</p>
      <a href="${env.FRONTEND_URL}/orders/${orderId}" class="button">
        Посмотреть заказ
      </a>
    `, EMAIL_CONFIG.templates.orderCreated.subject);
    
    return sendEmail({
      to,
      subject: EMAIL_CONFIG.templates.orderCreated.subject,
      html,
      text: `Заказ "${orderTitle}" создан. Бюджет: ${orderBudget} сом`,
    });
  },
  
  /**
   * Уведомление фрилансеру о новом заказе в его категории
   */
  async sendNewOrderInCategory(
    to: string,
    name: string,
    orderTitle: string,
    orderBudget: number,
    orderId: string
  ): Promise<boolean> {
    const html = generateHtml(`
      <h2>Новый заказ для вас, ${name}! 🎯</h2>
      <p>Появился заказ в вашей категории:</p>
      <div class="highlight">
        <p><strong>Название:</strong> ${orderTitle}</p>
        <p><strong>Бюджет:</strong> ${orderBudget.toLocaleString()} сом</p>
      </div>
      <a href="${env.FRONTEND_URL}/orders/${orderId}" class="button">
        Откликнуться
      </a>
    `, 'Новый заказ в вашей категории');
    
    return sendEmail({
      to,
      subject: 'Новый заказ в вашей категории 🎯',
      html,
      text: `Новый заказ: "${orderTitle}" (${orderBudget} сом)`,
    });
  },
  
  /**
   * Уведомление о принятии заказа
   */
  async sendOrderAccepted(
    to: string,
    orderTitle: string,
    freelancerName: string,
    orderId: string
  ): Promise<boolean> {
    const html = generateHtml(`
      <h2>Заказ принят! 🎉</h2>
      <p>Фрилансер <strong>${freelancerName}</strong> принял ваш заказ:</p>
      <div class="highlight">
        <p><strong>${orderTitle}</strong></p>
      </div>
      <p>Теперь вы можете общаться с исполнителем через чат.</p>
      <a href="${env.FRONTEND_URL}/orders/${orderId}" class="button">
        Перейти к заказу
      </a>
    `, EMAIL_CONFIG.templates.orderAccepted.subject);
    
    return sendEmail({
      to,
      subject: EMAIL_CONFIG.templates.orderAccepted.subject,
      html,
      text: `Фрилансер ${freelancerName} принял ваш заказ "${orderTitle}"`,
    });
  },
  
  /**
   * Уведомление о сдаче работы
   */
  async sendWorkSubmitted(
    to: string,
    orderTitle: string,
    orderId: string
  ): Promise<boolean> {
    const html = generateHtml(`
      <h2>Работа сдана на проверку! ✅</h2>
      <p>Фрилансер завершил работу над заказом:</p>
      <div class="highlight">
        <p><strong>${orderTitle}</strong></p>
      </div>
      <p>Пожалуйста, проверьте работу и подтвердите выполнение.</p>
      <a href="${env.FRONTEND_URL}/orders/${orderId}" class="button">
        Проверить работу
      </a>
    `, EMAIL_CONFIG.templates.workSubmitted.subject);
    
    return sendEmail({
      to,
      subject: EMAIL_CONFIG.templates.workSubmitted.subject,
      html,
      text: `Работа по заказу "${orderTitle}" сдана на проверку`,
    });
  },
  
  /**
   * Уведомление о завершении заказа
   */
  async sendOrderCompleted(
    to: string,
    orderTitle: string,
    amount: number,
    orderId: string,
    isFreelancer: boolean
  ): Promise<boolean> {
    const html = generateHtml(`
      <h2>Заказ завершён! 🎉</h2>
      <div class="highlight">
        <p><strong>${orderTitle}</strong></p>
        <p><strong>Сумма:</strong> ${amount.toLocaleString()} сом</p>
      </div>
      ${isFreelancer 
        ? '<p>💰 Средства переведены на ваш баланс!</p>' 
        : '<p>Спасибо за использование FreelanceKG!</p>'
      }
      <p>Пожалуйста, оставьте отзыв о сотрудничестве:</p>
      <a href="${env.FRONTEND_URL}/orders/${orderId}/review" class="button">
        Оставить отзыв
      </a>
    `, EMAIL_CONFIG.templates.orderCompleted.subject);
    
    return sendEmail({
      to,
      subject: EMAIL_CONFIG.templates.orderCompleted.subject,
      html,
      text: `Заказ "${orderTitle}" завершён. ${isFreelancer ? 'Вы получили ' + amount + ' сом' : ''}`,
    });
  },
  
  /**
   * Уведомление о новом сообщении
   */
  async sendNewMessage(
    to: string,
    senderName: string,
    orderTitle: string,
    messagePreview: string,
    orderId: string
  ): Promise<boolean> {
    const html = generateHtml(`
      <h2>Новое сообщение 💬</h2>
      <p><strong>${senderName}</strong> написал вам по заказу "${orderTitle}":</p>
      <div class="highlight">
        <p>"${messagePreview.substring(0, 200)}${messagePreview.length > 200 ? '...' : ''}"</p>
      </div>
      <a href="${env.FRONTEND_URL}/orders/${orderId}" class="button">
        Ответить
      </a>
    `, EMAIL_CONFIG.templates.newMessage.subject);
    
    return sendEmail({
      to,
      subject: `${senderName} написал вам по заказу`,
      html,
      text: `${senderName}: ${messagePreview.substring(0, 100)}`,
    });
  },
  
  /**
   * Уведомление о споре
   */
  async sendDisputeOpened(
    to: string,
    orderTitle: string,
    reason: string,
    orderId: string
  ): Promise<boolean> {
    const html = generateHtml(`
      <h2>⚠️ Открыт спор</h2>
      <p>По заказу "${orderTitle}" открыт спор:</p>
      <div class="highlight" style="background: #fef2f2;">
        <p>${reason}</p>
      </div>
      <p>Наша команда рассмотрит спор в течение 48 часов.</p>
      <a href="${env.FRONTEND_URL}/orders/${orderId}" class="button">
        Подробнее
      </a>
    `, EMAIL_CONFIG.templates.disputeOpened.subject);
    
    return sendEmail({
      to,
      subject: EMAIL_CONFIG.templates.disputeOpened.subject,
      html,
      text: `Спор по заказу "${orderTitle}": ${reason}`,
    });
  },
  
  /**
   * Сброс пароля
   */
  async sendPasswordReset(to: string, resetToken: string): Promise<boolean> {
    const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    
    const html = generateHtml(`
      <h2>Сброс пароля 🔐</h2>
      <p>Вы запросили сброс пароля. Нажмите на кнопку ниже:</p>
      <a href="${resetUrl}" class="button">
        Сбросить пароль
      </a>
      <p style="font-size: 12px; color: #666; margin-top: 20px;">
        Ссылка действительна 1 час. Если вы не запрашивали сброс, проигнорируйте это письмо.
      </p>
    `, EMAIL_CONFIG.templates.passwordReset.subject);
    
    return sendEmail({
      to,
      subject: EMAIL_CONFIG.templates.passwordReset.subject,
      html,
      text: `Сбросить пароль: ${resetUrl}`,
    });
  },
  
  /**
   * Подтверждение email
   */
  async sendEmailVerification(to: string, verificationToken: string): Promise<boolean> {
    const verifyUrl = `${env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
    
    const html = generateHtml(`
      <h2>Подтвердите email ✉️</h2>
      <p>Для завершения регистрации подтвердите ваш email:</p>
      <a href="${verifyUrl}" class="button">
        Подтвердить email
      </a>
      <p style="font-size: 12px; color: #666; margin-top: 20px;">
        Ссылка действительна 24 часа.
      </p>
    `, EMAIL_CONFIG.templates.emailVerification.subject);
    
    return sendEmail({
      to,
      subject: EMAIL_CONFIG.templates.emailVerification.subject,
      html,
      text: `Подтвердите email: ${verifyUrl}`,
    });
  },
};

export default EmailService;
