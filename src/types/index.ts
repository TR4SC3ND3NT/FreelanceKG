// ============================================
// FreelanceKG Type Definitions
// ============================================

export type UserRole = 'CLIENT' | 'FREELANCER' | 'ADMIN';

export type OrderStatus = 
  | 'PENDING' 
  | 'ACTIVE' 
  | 'SUBMITTED' 
  | 'COMPLETED' 
  | 'DISPUTED' 
  | 'CANCELLED';

export type DisputeStatus = 'OPEN' | 'RESOLVED';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: UserRole;
  createdAt: string;
}

export interface FreelancerProfile {
  id: string;
  userId: string;
  bio?: string;
  skills: string[];
  hourlyRate?: number;
  category?: string;
  portfolio?: PortfolioItem[];
  rating: number;
  completedOrders: number;
}

export interface PortfolioItem {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  link?: string;
}

export interface Order {
  id: string;
  clientId: string;
  freelancerId?: string;
  title: string;
  description: string;
  budget: number;
  status: OrderStatus;
  escrowAmount: number;
  deadline?: string;
  createdAt: string;
  client?: User;
  freelancer?: User;
}

export interface Message {
  id: string;
  orderId: string;
  senderId: string;
  content: string;
  fileUrl?: string;
  createdAt: string;
  sender?: User;
}

export interface Review {
  id: string;
  orderId: string;
  fromId: string;
  toId: string;
  rating: number;
  comment?: string;
  createdAt: string;
  from?: User;
  to?: User;
}

export interface Dispute {
  id: string;
  orderId: string;
  openedById: string;
  reason: string;
  status: DisputeStatus;
  resolution?: string;
  createdAt: string;
  resolvedAt?: string;
}

// API Response types
export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  message?: string;
}

export interface AuthResponse {
  user: User;
  token?: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

export interface LoginPayload {
  email: string;
  password: string;
}

// Category options for freelancers
export const CATEGORIES = [
  'Веб-разработка',
  'Мобильная разработка',
  'UI/UX Дизайн',
  'Графический дизайн',
  'Копирайтинг',
  'SMM и Маркетинг',
  'SEO оптимизация',
  'Видеомонтаж',
  'Переводы',
  'Администрирование',
] as const;

// Skills suggestions
export const SKILL_SUGGESTIONS = [
  'JavaScript',
  'TypeScript',
  'React',
  'Next.js',
  'Vue.js',
  'Node.js',
  'Python',
  'PHP',
  'Laravel',
  'WordPress',
  'Figma',
  'Adobe Photoshop',
  'Adobe Illustrator',
  'After Effects',
  'Premiere Pro',
  'SEO',
  'Google Ads',
  'Facebook Ads',
  'Instagram',
  'TikTok',
] as const;
