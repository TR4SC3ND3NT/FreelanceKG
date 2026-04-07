/**
 * Database Seed Script
 * Creates test users and data
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...\n');
  
  // Clear existing data
  console.log('Clearing existing data...');
  await prisma.notification.deleteMany();
  await prisma.withdrawal.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.dispute.deleteMany();
  await prisma.review.deleteMany();
  await prisma.message.deleteMany();
  await prisma.order.deleteMany();
  await prisma.freelancerProfile.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.category.deleteMany();
  
  // Hash password
  const password = await bcrypt.hash('password123', 10);
  
  // Create categories
  console.log('Creating categories...');
  const categories = await Promise.all([
    prisma.category.create({
      data: {
        slug: 'development',
        name: 'Разработка',
        nameKy: 'Программалоо',
        icon: '💻',
        description: 'Веб-разработка, мобильные приложения, скрипты',
      },
    }),
    prisma.category.create({
      data: {
        slug: 'design',
        name: 'Дизайн',
        nameKy: 'Дизайн',
        icon: '🎨',
        description: 'Графический дизайн, UI/UX, логотипы',
      },
    }),
    prisma.category.create({
      data: {
        slug: 'marketing',
        name: 'Маркетинг',
        nameKy: 'Маркетинг',
        icon: '📈',
        description: 'SMM, таргетинг, контент-маркетинг',
      },
    }),
    prisma.category.create({
      data: {
        slug: 'copywriting',
        name: 'Копирайтинг',
        nameKy: 'Копирайтинг',
        icon: '✍️',
        description: 'Тексты для сайтов, статьи, рерайт',
      },
    }),
    prisma.category.create({
      data: {
        slug: 'video',
        name: 'Видео',
        nameKy: 'Видео',
        icon: '🎬',
        description: 'Видеомонтаж, анимация, motion design',
      },
    }),
    prisma.category.create({
      data: {
        slug: 'translation',
        name: 'Переводы',
        nameKy: 'Котормолор',
        icon: '🌍',
        description: 'Переводы на все языки',
      },
    }),
  ]);
  
  // Create test client
  console.log('Creating test client...');
  const client = await prisma.user.create({
    data: {
      email: 'client@test.kg',
      password,
      name: 'Азамат Тестов',
      role: 'CLIENT',
      isEmailVerified: true,
      avatar: '/placeholders/avatar.svg',
    },
  });
  
  // Create test freelancers
  console.log('Creating test freelancers...');
  const freelancer1 = await prisma.user.create({
    data: {
      email: 'aibek@test.kg',
      password,
      name: 'Айбек Кодеров',
      role: 'FREELANCER',
      isEmailVerified: true,
      avatar: '/placeholders/avatar.svg',
      freelancerProfile: {
        create: {
          bio: 'Full-stack разработчик с 5-летним опытом. Специализируюсь на React, Node.js, PostgreSQL. Делаю качественно и в срок.',
          skills: ['React', 'Node.js', 'TypeScript', 'PostgreSQL', 'Docker', 'AWS'],
          hourlyRate: 1500,
          category: 'development',
          rating: 4.9,
          totalRatings: 47,
          completedOrders: 52,
          totalEarnings: 450000,
          isVerified: true,
          verifiedAt: new Date(),
          responseTime: 2,
          portfolio: JSON.stringify([
            {
              title: 'E-commerce платформа',
              imageUrl: '/placeholders/work.svg',
            },
            {
              title: 'CRM система',
              imageUrl: '/placeholders/work.svg',
            },
          ]),
        },
      },
    },
  });
  
  const freelancer2 = await prisma.user.create({
    data: {
      email: 'gulzat@test.kg',
      password,
      name: 'Гульзат Дизайнова',
      role: 'FREELANCER',
      isEmailVerified: true,
      avatar: '/placeholders/avatar.svg',
      freelancerProfile: {
        create: {
          bio: 'UI/UX дизайнер. Создаю красивые и удобные интерфейсы. Figma, Adobe XD, Photoshop.',
          skills: ['Figma', 'Adobe XD', 'Photoshop', 'Illustrator', 'UI/UX', 'Веб-дизайн'],
          hourlyRate: 1200,
          category: 'design',
          rating: 4.8,
          totalRatings: 35,
          completedOrders: 38,
          totalEarnings: 320000,
          isVerified: true,
          verifiedAt: new Date(),
          responseTime: 1,
        },
      },
    },
  });
  
  const freelancer3 = await prisma.user.create({
    data: {
      email: 'nurlan@test.kg',
      password,
      name: 'Нурлан Маркетолог',
      role: 'FREELANCER',
      isEmailVerified: true,
      avatar: '/placeholders/avatar.svg',
      freelancerProfile: {
        create: {
          bio: 'Digital маркетолог. Настройка таргетированной рекламы, SMM, контент-стратегия.',
          skills: ['Facebook Ads', 'Google Ads', 'Instagram', 'TikTok', 'SMM', 'Аналитика'],
          hourlyRate: 1000,
          category: 'marketing',
          rating: 4.7,
          totalRatings: 28,
          completedOrders: 31,
          totalEarnings: 250000,
          isVerified: false,
          responseTime: 3,
        },
      },
    },
  });
  
  // Create admin
  console.log('Creating admin...');
  const admin = await prisma.user.create({
    data: {
      email: 'admin@test.kg',
      password,
      name: 'Администратор',
      role: 'ADMIN',
      isEmailVerified: true,
      avatar: '/placeholders/avatar.svg',
    },
  });
  
  // Create test orders
  console.log('Creating test orders...');
  const order1 = await prisma.order.create({
    data: {
      clientId: client.id,
      freelancerId: freelancer1.id,
      title: 'Разработка лендинга для стартапа',
      description: 'Нужен современный лендинг на React для нашего стартапа. Дизайн готов в Figma.',
      category: 'development',
      budget: 25000,
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: 'ACTIVE',
      escrowAmount: 25000,
      escrowStatus: 'HOLDING',
      escrowHeldAt: new Date(),
      platformFee: 2500,
      netAmount: 22500,
    },
  });
  
  const order2 = await prisma.order.create({
    data: {
      clientId: client.id,
      title: 'Дизайн мобильного приложения',
      description: 'Требуется UI/UX дизайн для приложения доставки еды. 10-15 экранов.',
      category: 'design',
      budget: 40000,
      deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      status: 'PENDING',
    },
  });
  
  const order3 = await prisma.order.create({
    data: {
      clientId: client.id,
      freelancerId: freelancer2.id,
      title: 'Редизайн сайта компании',
      description: 'Нужен полный редизайн корпоративного сайта.',
      category: 'design',
      budget: 35000,
      deadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      status: 'COMPLETED',
      completedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      escrowAmount: 35000,
      escrowStatus: 'RELEASED',
      escrowHeldAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      escrowReleasedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      platformFee: 3500,
      netAmount: 31500,
    },
  });
  
  // Create messages
  console.log('Creating test messages...');
  await prisma.message.createMany({
    data: [
      {
        orderId: order1.id,
        senderId: client.id,
        content: 'Привет! Готов начать работу?',
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
      {
        orderId: order1.id,
        senderId: freelancer1.id,
        content: 'Да, конечно! Уже изучаю ТЗ.',
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 3600000),
      },
      {
        orderId: order1.id,
        senderId: freelancer1.id,
        content: 'Есть несколько вопросов по дизайну. Можем созвониться?',
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      },
      {
        orderId: order1.id,
        senderId: client.id,
        content: 'Да, давай сегодня в 15:00',
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 1800000),
      },
    ],
  });
  
  // Create review
  console.log('Creating test review...');
  await prisma.review.create({
    data: {
      orderId: order3.id,
      fromId: client.id,
      toId: freelancer2.id,
      rating: 5,
      comment: 'Отличная работа! Гульзат сделала именно то, что я хотел. Рекомендую!',
    },
  });
  
  // Create notifications
  console.log('Creating test notifications...');
  await prisma.notification.createMany({
    data: [
      {
        userId: client.id,
        type: 'ORDER_ACCEPTED',
        title: 'Заказ принят',
        message: 'Айбек Кодеров принял ваш заказ "Разработка лендинга"',
        link: `/orders/${order1.id}`,
      },
      {
        userId: freelancer1.id,
        type: 'PAYMENT_RECEIVED',
        title: 'Оплата получена',
        message: 'Вы получили 22,500 сом за заказ',
        isRead: true,
        readAt: new Date(),
      },
    ],
  });
  
  console.log('\n✅ Seeding completed!\n');
  console.log('📧 Test accounts:');
  console.log('   Client:     client@test.kg / password123');
  console.log('   Freelancer: aibek@test.kg / password123');
  console.log('   Freelancer: gulzat@test.kg / password123');
  console.log('   Freelancer: nurlan@test.kg / password123');
  console.log('   Admin:      admin@test.kg / password123');
  console.log('');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
