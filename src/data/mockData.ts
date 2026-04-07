// ============================================
// FreelanceKG Mock Data (offline-safe)
// ============================================

const AVATAR = '/placeholders/avatar.svg';
const WORK_IMAGE = '/placeholders/work.svg';

export interface Freelancer {
  id: string;
  name: string;
  avatar: string;
  category: string;
  bio: string;
  skills: string[];
  hourlyRate: number;
  rating: number;
  reviewCount: number;
  completedOrders: number;
  isOnline: boolean;
  isVerified: boolean;
  portfolio: PortfolioItem[];
  reviews: FreelancerReview[];
}

export interface PortfolioItem {
  id: string;
  title: string;
  image: string;
  description: string;
}

export interface FreelancerReview {
  id: string;
  authorName: string;
  authorAvatar: string;
  rating: number;
  comment: string;
  date: string;
}

export const CATEGORIES = [
  { id: 'development', name: 'Разработка', icon: '💻', count: 234 },
  { id: 'design', name: 'Дизайн', icon: '🎨', count: 187 },
  { id: 'marketing', name: 'Маркетинг', icon: '📈', count: 156 },
  { id: 'copywriting', name: 'Копирайтинг', icon: '✍️', count: 143 },
  { id: 'video', name: 'Видео', icon: '🎬', count: 98 },
  { id: 'translation', name: 'Переводы', icon: '🌍', count: 112 },
];

export const freelancers: Freelancer[] = [
  {
    id: '1',
    name: 'Айбек Токтогулов',
    avatar: AVATAR,
    category: 'Разработка',
    bio: 'Full-stack разработчик. React, Node.js, TypeScript.',
    skills: ['React', 'Node.js', 'TypeScript', 'PostgreSQL'],
    hourlyRate: 1500,
    rating: 4.9,
    reviewCount: 47,
    completedOrders: 52,
    isOnline: true,
    isVerified: true,
    portfolio: [
      { id: '1', title: 'E-commerce платформа', image: WORK_IMAGE, description: 'Интернет-магазин' },
      { id: '2', title: 'CRM система', image: WORK_IMAGE, description: 'Система управления клиентами' },
    ],
    reviews: [
      { id: '1', authorName: 'Нурай М.', authorAvatar: AVATAR, rating: 5, comment: 'Отличная работа', date: '2025-01-15' },
    ],
  },
  {
    id: '2',
    name: 'Нурай Асанова',
    avatar: AVATAR,
    category: 'Дизайн',
    bio: 'UI/UX дизайнер. Figma, Illustrator.',
    skills: ['Figma', 'UI/UX', 'Illustrator'],
    hourlyRate: 1200,
    rating: 4.8,
    reviewCount: 38,
    completedOrders: 41,
    isOnline: true,
    isVerified: true,
    portfolio: [
      { id: '1', title: 'Брендинг стартапа', image: WORK_IMAGE, description: 'Брендинг пакет' },
    ],
    reviews: [
      { id: '1', authorName: 'Азамат К.', authorAvatar: AVATAR, rating: 5, comment: 'Сильный дизайн', date: '2025-01-12' },
    ],
  },
];

export const stats = {
  freelancers: 1200,
  orders: 850,
  satisfaction: 98,
};

export interface MockOrder {
  id: string;
  title: string;
  description: string;
  category: string;
  budget: number;
  status: 'PENDING' | 'ACTIVE' | 'SUBMITTED' | 'COMPLETED' | 'DISPUTED' | 'CANCELLED';
  escrowAmount: number;
  deadline: string;
  createdAt: string;
  client: {
    id: string;
    name: string;
    avatar: string;
  };
  freelancer?: {
    id: string;
    name: string;
    avatar: string;
    rating: number;
  };
  timeline: {
    date: string;
    event: string;
    icon: string;
  }[];
}

export interface MockMessage {
  id: string;
  senderId: string;
  content: string;
  fileUrl?: string;
  createdAt: string;
}

export const mockOrders: MockOrder[] = [
  {
    id: '1',
    title: 'Разработка мобильного приложения',
    description: 'Нужно разработать приложение для доставки еды.',
    category: 'Разработка',
    budget: 150000,
    status: 'ACTIVE',
    escrowAmount: 150000,
    deadline: '2025-02-15',
    createdAt: '2025-01-10',
    client: { id: 'client1', name: 'Эркин Бакиров', avatar: AVATAR },
    freelancer: { id: '1', name: 'Айбек Токтогулов', avatar: AVATAR, rating: 4.9 },
    timeline: [
      { date: '2025-01-10', event: 'Заказ создан', icon: '📝' },
      { date: '2025-01-11', event: 'Оплата внесена в эскроу', icon: '💰' },
      { date: '2025-01-12', event: 'Фрилансер принял заказ', icon: '✅' },
    ],
  },
];

export const mockMessages: Record<string, MockMessage[]> = {
  '1': [
    { id: 'm1', senderId: 'client1', content: 'Здравствуйте! Готов обсудить детали проекта.', createdAt: '2025-01-12T10:00:00' },
    { id: 'm2', senderId: '1', content: 'Добрый день! Я посмотрел ТЗ.', createdAt: '2025-01-12T10:05:00' },
  ],
};

export const currentUser = {
  id: 'client1',
  name: 'Эркин Бакиров',
  email: 'erkin@mail.kg',
  role: 'CLIENT' as const,
  avatar: AVATAR,
};

export const currentFreelancer = {
  id: '1',
  name: 'Айбек Токтогулов',
  email: 'aibek@mail.kg',
  role: 'FREELANCER' as const,
  avatar: AVATAR,
};

export type NotificationType = 'ORDER' | 'PAYMENT' | 'MESSAGE' | 'SECURITY' | 'SYSTEM';

export interface DashboardNotification {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  createdAt: string;
  isRead: boolean;
}

export interface NotificationPreference {
  id: string;
  label: string;
  email: boolean;
  push: boolean;
  inApp: boolean;
}

export interface ResumeBlock {
  headline: string;
  location: string;
  availability: string;
  experience: string;
  education: string;
  languages: string[];
  certifications: string[];
}

export interface DocumentRecord {
  id: string;
  title: string;
  type: 'INVOICE' | 'ACT' | 'AGREEMENT';
  status: 'DRAFT' | 'SIGNED' | 'ARCHIVED';
  createdAt: string;
}

export const mockNotifications: DashboardNotification[] = [
  {
    id: 'n1',
    type: 'ORDER',
    title: 'Новый отклик на заказ',
    description: 'Исполнитель оставил предложение по заказу "Разработка мобильного приложения".',
    createdAt: '2026-02-21T11:30:00',
    isRead: false,
  },
  {
    id: 'n2',
    type: 'PAYMENT',
    title: 'Эскроу-платеж подтвержден',
    description: 'Средства по заказу #1 успешно зарезервированы в эскроу.',
    createdAt: '2026-02-21T09:10:00',
    isRead: true,
  },
  {
    id: 'n3',
    type: 'SECURITY',
    title: 'Новый вход в аккаунт',
    description: 'Вход выполнен с нового устройства в Бишкеке.',
    createdAt: '2026-02-20T16:42:00',
    isRead: true,
  },
  {
    id: 'n4',
    type: 'MESSAGE',
    title: 'Новое сообщение в заказе',
    description: 'В чате заказа #1 получено новое сообщение.',
    createdAt: '2026-02-20T14:25:00',
    isRead: false,
  },
];

export const mockNotificationPreferences: NotificationPreference[] = [
  { id: 'orders', label: 'Обновления по заказам', email: true, push: true, inApp: true },
  { id: 'payments', label: 'Платежи и эскроу', email: true, push: true, inApp: true },
  { id: 'messages', label: 'Сообщения и чаты', email: false, push: true, inApp: true },
  { id: 'security', label: 'Безопасность аккаунта', email: true, push: true, inApp: true },
];

export const mockResumeBlock: ResumeBlock = {
  headline: 'Full-stack разработчик для финтех и marketplace проектов',
  location: 'Бишкек, Кыргызстан',
  availability: 'Готов к проектам 30-40 часов в неделю',
  experience: '5+ лет коммерческой разработки, 40+ выполненных проектов, опыт в escrow workflow.',
  education: 'КГТУ им. Раззакова, Информационные технологии',
  languages: ['Русский', 'Кыргызский', 'English (B2)'],
  certifications: ['Meta Front-End Certificate', 'Google UX Foundations'],
};

export const mockDocuments: DocumentRecord[] = [
  { id: 'd1', title: 'Акт выполненных работ #001', type: 'ACT', status: 'SIGNED', createdAt: '2026-02-10' },
  { id: 'd2', title: 'Инвойс на оплату #INV-12', type: 'INVOICE', status: 'DRAFT', createdAt: '2026-02-18' },
  { id: 'd3', title: 'Шаблон договора оказания услуг', type: 'AGREEMENT', status: 'ARCHIVED', createdAt: '2026-01-25' },
];
