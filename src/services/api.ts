// ============================================
// FreelanceKG API Service
// ============================================

import { API_BASE } from '@/config/runtime';

// Types
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'CLIENT' | 'FREELANCER' | 'ADMIN';
  permissions?: string[];
  avatar?: string;
  createdAt?: string;
  settings?: UserSettings;
  freelancerProfile?: FreelancerProfile;
}

export interface UserSettings {
  twoFactorEnabled: boolean;
  loginAlertsEnabled: boolean;
  notificationsEnabled: boolean;
  telegramNotificationsEnabled: boolean;
}

export interface TelegramLinkResponse {
  deepLink: string;
  expiresAt: string;
}

export interface TelegramStatusResponse {
  linked: boolean;
  chatIdMasked?: string | null;
  telegramNotificationsEnabled: boolean;
}

export interface FreelancerPaymentDetails {
  method: 'card' | 'wallet' | 'elsom' | 'odengi' | 'mbank';
  value: string;
}

export interface FreelancerProfile {
  bio?: string;
  skills: string[];
  hourlyRate?: number;
  category?: string;
  rating: number;
  completedOrders: number;
  isVerified?: boolean;
  isOnline?: boolean;
  portfolio?: unknown[];
  paymentDetails?: FreelancerPaymentDetails;
}

export interface UpdateFreelancerProfilePayload extends Partial<FreelancerProfile> {
  name?: string;
}

export interface Freelancer {
  id: string;
  name: string;
  avatar?: string;
  category?: string;
  bio?: string;
  skills: string[];
  hourlyRate?: number;
  rating: number;
  completedOrders: number;
  isOnline: boolean;
  isVerified: boolean;
  reviewCount?: number;
  reviews?: Review[];
  portfolio?: unknown[];
}

export interface Order {
  id: string;
  title: string;
  description: string;
  category?: string;
  budget: number;
  status: 'PENDING' | 'ACTIVE' | 'SUBMITTED' | 'COMPLETED' | 'DISPUTED' | 'CANCELLED';
  escrowAmount: number;
  deadline?: string;
  createdAt: string;
  client: {
    id: string;
    name: string;
    avatar?: string;
  };
  freelancer?: {
    id: string;
    name: string;
    avatar?: string;
    rating?: number;
  };
}

export interface Message {
  id: string;
  type?: 'text' | 'image' | 'file' | 'system';
  orderId: string;
  senderId: string;
  content: string;
  text?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  size?: number;
  status?: 'sending' | 'sent' | 'failed';
  createdAt: string;
  sender: {
    id: string;
    name: string;
    avatar?: string;
  };
}

export interface UploadResult {
  url: string;
  filename: string;
  fileName?: string;
  originalName?: string;
  size?: number;
  mimetype?: string;
  mimeType?: string;
}

export interface Review {
  id: string;
  rating: number;
  comment?: string;
  createdAt: string;
  author: {
    id: string;
    name: string;
    avatar?: string;
  };
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface AuthPermissionsResponse {
  role: User['role'];
  permissions: string[];
}

export type PaymentMethodId = 'card' | 'balance' | 'elsom' | 'odengi' | 'mbank';

export interface PaymentMethod {
  id: PaymentMethodId;
  name: string;
  fee: number;
  enabled: boolean;
  currencies: string[];
}

export interface PaymentConfig {
  platformFee: number;
  minAmount: number;
  maxAmount: number;
}

export interface EscrowPaymentResult {
  success: boolean;
  status: string;
  message: string;
  transactionId?: string;
  escrowId?: string;
  checkoutUrl?: string;
  requiresAction?: boolean;
}

export interface FreelancerBalanceStats {
  available: number;
  pending: number;
  totalEarnings: number;
  inEscrow: number;
  pendingOrdersCount: number;
}

export interface PaymentTransaction {
  id: string;
  type: string;
  amount: number;
  status: string;
  createdAt: string;
  order?: {
    id: string;
    title: string;
  };
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  link?: string | null;
  isRead: boolean;
  readAt?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface NotificationListResponse extends PaginatedResponse<NotificationItem> {
  unreadCount: number;
}

export interface ClientWorkspaceProfile {
  company: string;
  website: string;
  phone: string;
  industry: string;
  teamSize: string;
  billingEmail: string;
  taxId: string;
  address: string;
  city: string;
  country: string;
  about: string;
}

export interface FreelancerResumeProfile {
  headline: string;
  availability: string;
  experience: string;
  education: string;
  certifications: string[];
  languages: string[];
  location: string;
  workPreference: string;
  rateNote: string;
}

export type WorkspacePaymentMethodType = 'card' | 'wallet' | 'bank';

export interface SavedPaymentMethod {
  id: string;
  type: WorkspacePaymentMethodType;
  title: string;
  holderName: string;
  brand: string;
  provider: string;
  maskedValue: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault: boolean;
  status: 'ACTIVE' | 'EXPIRED';
  createdAt: string;
}

export interface CreateSavedPaymentMethodPayload {
  type: WorkspacePaymentMethodType;
  title?: string;
  holderName?: string;
  brand?: string;
  provider?: string;
  cardNumber?: string;
  accountNumber?: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault?: boolean;
}

export type WorkspaceDocumentType =
  | 'INVOICE'
  | 'AGREEMENT'
  | 'BRIEF'
  | 'REPORT'
  | 'ID'
  | 'PORTFOLIO'
  | 'STATEMENT';

export type WorkspaceDocumentStatus = 'DRAFT' | 'UNDER_REVIEW' | 'SIGNED' | 'ARCHIVED';

export interface WorkspaceDocument {
  id: string;
  title: string;
  type: WorkspaceDocumentType;
  status: WorkspaceDocumentStatus;
  createdAt: string;
  updatedAt: string;
  fileUrl?: string;
  fileName?: string;
  size?: number;
  notes?: string;
}

export interface WorkspaceTeamMember {
  id: string;
  name: string;
  email: string;
  title: string;
  role: 'OWNER' | 'ADMIN' | 'FINANCE' | 'LEGAL' | 'OPERATIONS' | 'VIEWER';
  status: 'ACTIVE' | 'INVITED' | 'SUSPENDED';
  location: string;
  avatarColor: string;
  mfaEnabled: boolean;
  permissions: string[];
  seatsScope: string[];
  lastActiveAt: string;
  inviteAcceptedAt?: string;
}

export interface WorkspaceSecuritySettings {
  sessionTimeoutMinutes: number;
  enforceMfa: boolean;
  requireDeviceApproval: boolean;
  anomalyAlerts: boolean;
  auditRetentionDays: number;
  ipAllowlist: string[];
  allowedCountries: string[];
  apiKeysCount: number;
  backupCodesGenerated: boolean;
  lastKeyRotationAt?: string;
  securityScore: number;
}

export interface WorkspaceVerificationCheck {
  id: string;
  title: string;
  status: 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REQUIRES_UPDATE';
  note?: string;
  updatedAt: string;
}

export interface WorkspaceVerificationProfile {
  status: 'NOT_STARTED' | 'UNDER_REVIEW' | 'VERIFIED' | 'ACTION_REQUIRED';
  level: 'BASIC' | 'BUSINESS' | 'ENTERPRISE';
  ownerName: string;
  legalEntityName: string;
  country: string;
  documentType: string;
  documentNumberMasked: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  submittedAt?: string;
  approvedAt?: string;
  nextStep: string;
  checks: WorkspaceVerificationCheck[];
}

export interface WorkspaceSubscriptionAddon {
  id: string;
  name: string;
  status: 'ACTIVE' | 'TRIAL' | 'PENDING';
  priceMonthly: number;
  usage: string;
}

export interface WorkspaceSubscriptionInvoice {
  id: string;
  title: string;
  amount: number;
  status: 'PAID' | 'PENDING';
  issuedAt: string;
  dueAt: string;
}

export interface WorkspaceSubscriptionPlan {
  planCode: 'growth' | 'scale' | 'enterprise';
  planName: string;
  billingCycle: 'MONTHLY' | 'ANNUAL';
  priceMonthly: number;
  seatsIncluded: number;
  seatsUsed: number;
  renewalDate: string;
  usage: {
    activeProjects: number;
    storedDocuments: number;
    monthlyVolume: number;
  };
  addons: WorkspaceSubscriptionAddon[];
  invoices: WorkspaceSubscriptionInvoice[];
}

export interface WorkspaceActivityEntry {
  id: string;
  action: string;
  description: string;
  createdAt: string;
  tone: 'default' | 'success' | 'warning' | 'danger' | 'info';
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface WorkspaceOverviewKpi {
  id: string;
  label: string;
  value: string | number;
  delta: number;
  tone: 'primary' | 'success' | 'warning' | 'danger' | 'info';
  helper?: string;
}

export interface WorkspaceOverviewChartPoint {
  label: string;
  value: number;
  secondaryValue?: number;
}

export interface WorkspaceOverviewTransaction {
  id: string;
  type: string;
  amount: number;
  status: string;
  createdAt: string;
  orderId?: string | null;
  orderTitle?: string | null;
}

export interface WorkspaceOverviewSupportCase {
  id: string;
  caseNumber?: number;
  title: string;
  priority: string;
  status: string;
  createdAt: string;
}

export interface WorkspaceOverviewDeadline {
  id: string;
  title: string;
  date: string;
  status: string;
  amount?: number;
  counterparty?: string;
}

export interface WorkspaceOverviewTimelineEntry {
  id: string;
  title: string;
  description: string;
  at: string;
  type: string;
  status: string;
  href?: string;
}

export interface WorkspaceOverviewSummary {
  role: 'CLIENT' | 'FREELANCER';
  kpis: WorkspaceOverviewKpi[];
  charts: {
    volume: WorkspaceOverviewChartPoint[];
    cashflow: WorkspaceOverviewChartPoint[];
  };
  recentTransactions: WorkspaceOverviewTransaction[];
  recentDocuments: WorkspaceDocument[];
  recentCases: WorkspaceOverviewSupportCase[];
  supportSummary: {
    open: number;
    urgent: number;
    waiting: number;
    resolved: number;
  };
  deadlines: WorkspaceOverviewDeadline[];
  timeline: WorkspaceOverviewTimelineEntry[];
  activityFeed: WorkspaceActivityEntry[];
  quickStats: {
    unreadNotifications: number;
    pendingApprovals: number;
    openCases: number;
    documentsInReview: number;
    savedMethods: number;
    teamMembers: number;
  };
}

export interface Proposal {
  id: string;
  orderId: string;
  freelancerId: string;
  amount: number;
  deliveryDays: number;
  message?: string | null;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN';
  respondedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SupportCase {
  id: string;
  caseNumber: number;
  createdById?: string | null;
  assignedToId?: string | null;
  orderId?: string | null;
  disputeId?: string | null;
  title: string;
  description: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'WAITING_CUSTOMER' | 'RESOLVED' | 'CLOSED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  resolution?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogItem {
  id: string;
  action: string;
  actorId?: string | null;
  actorRole?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
  details?: Record<string, unknown> | null;
  createdAt: string;
}

export interface LedgerEntryRow {
  id: string;
  batchId: string;
  userId?: string | null;
  orderId?: string | null;
  account: string;
  direction: 'DEBIT' | 'CREDIT';
  amount: number;
  currency: string;
  referenceType?: string | null;
  referenceId?: string | null;
  description?: string | null;
  createdAt: string;
}

export interface LedgerSummaryResponse {
  summary: Record<
    string,
    {
      debit: number;
      credit: number;
      net: number;
    }
  >;
  totals: {
    debit: number;
    credit: number;
    net: number;
  };
  filters: {
    userId?: string | null;
    orderId?: string | null;
  };
}

export interface AdminStatsResponse {
  stats: {
    users: {
      total: number;
      freelancers: number;
      clients: number;
    };
    orders: {
      total: number;
      active: number;
      completed: number;
      disputed: number;
    };
    finance: {
      revenue: number;
      escrowHolding: number;
      platformFee: number;
    };
    openDisputes: number;
  };
  recentOrders: Array<{
    id: string;
    title: string;
    status: string;
    budget: number;
    createdAt: string;
    client?: { name?: string };
    freelancer?: { name?: string } | null;
  }>;
  recentUsers: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    createdAt: string;
  }>;
}

export interface AdminUserRow {
  id: string;
  email: string;
  name: string;
  role: 'CLIENT' | 'FREELANCER' | 'ADMIN';
  avatar?: string;
  createdAt: string;
  lockedUntil?: string | null;
  isBanned?: boolean;
  _count?: {
    ordersAsClient?: number;
    ordersAsFreelancer?: number;
  };
}

export interface AdminDisputeRow {
  id: string;
  orderId: string;
  reason: string;
  status: string;
  createdAt: string;
  order: {
    id: string;
    title: string;
    client?: { id: string; name: string; email: string };
    freelancer?: { id: string; name: string; email: string } | null;
  };
  openedBy?: { id: string; name: string };
}

export interface AdminOrderRow {
  id: string;
  title: string;
  budget: number;
  escrowAmount?: number;
  status: 'PENDING' | 'ACTIVE' | 'SUBMITTED' | 'COMPLETED' | 'DISPUTED' | 'CANCELLED';
  createdAt: string;
  client?: { id: string; name: string; email: string };
  freelancer?: { id: string; name: string; email: string } | null;
}

export type FeatureFlagMap = Record<string, boolean>;

export interface PlatformFlagsResponse {
  flags: FeatureFlagMap;
  defaults: FeatureFlagMap;
  availableKeys: string[];
}

export interface PlatformFlagUpdateResponse {
  key: string;
  enabled: boolean;
}

export interface Conversation {
  orderId: string;
  orderTitle: string;
  orderStatus: Order['status'];
  otherUser?: {
    id: string;
    name: string;
    avatar?: string;
  } | null;
  lastMessage?: {
    content: string;
    createdAt: string;
    isFromMe: boolean;
  } | null;
  unreadCount: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

interface ApiEnvelope<T> {
  success?: boolean;
  data?: T;
  error?: string;
  message?: string;
  pagination?: PaginatedResponse<unknown>['pagination'];
}

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

// Token management
const TOKEN_KEY = 'freelancekg_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getApiErrorMessage(payload: unknown, status: number): string {
  if (isObject(payload) && typeof payload.error === 'string' && payload.error.trim().length > 0) {
    if (payload.error === 'Ошибка валидации' && Array.isArray(payload.details)) {
      const firstDetail = payload.details.find((item) => isObject(item) && typeof item.message === 'string');
      if (isObject(firstDetail) && typeof firstDetail.message === 'string' && firstDetail.message.trim().length > 0) {
        return firstDetail.message;
      }
    }
    return payload.error;
  }

  return `HTTP error! status: ${status}`;
}

function inferMimeType(fileName?: string, fileUrl?: string): string | undefined {
  const source = (fileName || fileUrl || '').toLowerCase();
  if (!source) return undefined;
  if (source.endsWith('.png')) return 'image/png';
  if (source.endsWith('.jpg') || source.endsWith('.jpeg')) return 'image/jpeg';
  if (source.endsWith('.webp')) return 'image/webp';
  if (source.endsWith('.gif')) return 'image/gif';
  if (source.endsWith('.pdf')) return 'application/pdf';
  if (source.endsWith('.doc')) return 'application/msword';
  if (source.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (source.endsWith('.zip')) return 'application/zip';
  return undefined;
}

// API Client
class ApiClient {
  private idempotencyKeys = new Map<string, string>();

  private randomIdSegment(): string {
    if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
      return globalThis.crypto.randomUUID().replace(/-/g, '');
    }
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  }

  private getOrCreateIdempotencyKey(scope: string): string {
    const existing = this.idempotencyKeys.get(scope);
    if (existing) return existing;

    const key = `${scope}-${this.randomIdSegment()}`.slice(0, 120);
    this.idempotencyKeys.set(scope, key);
    return key;
  }

  private clearIdempotencyKey(scope: string): void {
    this.idempotencyKeys.delete(scope);
  }

  private shortHash(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i += 1) {
      hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
    }
    return hash.toString(16);
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE}${endpoint}`;
    const token = getToken();

    const headers: HeadersInit = {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    };

    // Don't set JSON content-type for FormData
    if (!(options.body instanceof FormData) && !('Content-Type' in (headers as Record<string, string>))) {
      (headers as Record<string, string>)['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });

    const contentType = response.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    const payload = isJson ? await response.json() : null;

    if (!response.ok) {
      const message = getApiErrorMessage(payload, response.status);
      throw new ApiError(message, response.status, payload);
    }

    return (payload ?? ({} as T)) as T;
  }

  private unwrapData<T>(response: unknown): T {
    if (isObject(response) && 'data' in response) {
      return (response as ApiEnvelope<T>).data as T;
    }
    return response as T;
  }

  private unwrapPagination<T>(response: unknown): PaginatedResponse<T> {
    const data = this.unwrapData<T[]>(response) || [];
    const pagination = isObject(response) && 'pagination' in response
      ? (response as ApiEnvelope<T[]>).pagination
      : undefined;

    return {
      data,
      pagination: pagination || {
        page: 1,
        limit: data.length,
        total: data.length,
        pages: 1,
      },
    };
  }

  private mapReview(raw: any): Review {
    return {
      id: raw.id,
      rating: raw.rating,
      comment: raw.comment,
      createdAt: raw.createdAt,
      author: raw.author || raw.from || {
        id: '',
        name: 'Unknown',
      },
    };
  }

  private mapMessage(raw: any): Message {
    const mimeType = raw.mimeType || inferMimeType(raw.fileName, raw.fileUrl);
    const type =
      raw.type ||
      (raw.fileUrl ? (mimeType?.startsWith('image/') ? 'image' : 'file') : 'text');

    return {
      id: raw.id,
      orderId: raw.orderId,
      senderId: raw.senderId,
      content: raw.content || '',
      text: raw.content || '',
      fileUrl: raw.fileUrl || undefined,
      fileName: raw.fileName || undefined,
      fileSize: raw.fileSize ?? undefined,
      mimeType,
      size: raw.fileSize ?? undefined,
      type,
      createdAt: raw.createdAt,
      sender: raw.sender || {
        id: '',
        name: 'Unknown',
      },
    };
  }

  private mapFreelancer(raw: any): Freelancer {
    const profile = raw.freelancerProfile || {};
    const reviews = Array.isArray(raw.reviewsReceived)
      ? raw.reviewsReceived.map((r: any) => this.mapReview(r))
      : [];

    return {
      id: raw.id,
      name: raw.name,
      avatar: raw.avatar || undefined,
      category: profile.category,
      bio: profile.bio,
      skills: profile.skills || [],
      hourlyRate: profile.hourlyRate,
      rating: profile.rating || 0,
      completedOrders: profile.completedOrders || 0,
      isOnline: Boolean(profile.isAvailable),
      isVerified: Boolean(profile.isVerified),
      reviewCount: profile.totalRatings || reviews.length || 0,
      reviews,
      portfolio: Array.isArray(profile.portfolio) ? profile.portfolio : [],
    };
  }

  // ============================================
  // Auth
  // ============================================

  async register(payload: {
    email: string;
    password: string;
    name: string;
    role: 'CLIENT' | 'FREELANCER';
  }): Promise<AuthResponse> {
    const response = await this.request<ApiEnvelope<AuthResponse>>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const auth = this.unwrapData<AuthResponse>(response);
    if (auth?.token) setToken(auth.token);
    return auth;
  }

  async login(payload: { email: string; password: string }): Promise<AuthResponse> {
    const response = await this.request<ApiEnvelope<AuthResponse>>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const auth = this.unwrapData<AuthResponse>(response);
    if (auth?.token) setToken(auth.token);
    return auth;
  }

  async logout(): Promise<void> {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } finally {
      removeToken();
    }
  }

  async getMe(): Promise<User> {
    const response = await this.request<ApiEnvelope<User>>('/auth/me');
    return this.unwrapData<User>(response);
  }

  async getAuthPermissions(): Promise<AuthPermissionsResponse> {
    const response = await this.request<ApiEnvelope<AuthPermissionsResponse>>('/auth/permissions');
    return this.unwrapData<AuthPermissionsResponse>(response);
  }

  async updateMyProfile(data: { name?: string }): Promise<User> {
    const response = await this.request<ApiEnvelope<User>>('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return this.unwrapData<User>(response);
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const response = await this.request<ApiEnvelope<unknown>>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });

    return {
      message: (response as ApiEnvelope<unknown>).message || 'Письмо отправлено',
    };
  }

  async changePassword(data: { currentPassword: string; newPassword: string }): Promise<{ message: string }> {
    const response = await this.request<ApiEnvelope<unknown>>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    return {
      message: (response as ApiEnvelope<unknown>).message || 'Пароль обновлён',
    };
  }

  async getAuthSettings(): Promise<UserSettings> {
    const response = await this.request<ApiEnvelope<UserSettings>>('/auth/settings');
    return this.unwrapData<UserSettings>(response);
  }

  async updateAuthSettings(data: Partial<UserSettings>): Promise<UserSettings> {
    const response = await this.request<ApiEnvelope<UserSettings>>('/auth/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return this.unwrapData<UserSettings>(response);
  }

  async getTelegramDeepLink(): Promise<TelegramLinkResponse> {
    const response = await this.request<ApiEnvelope<TelegramLinkResponse>>('/auth/telegram/link');
    return this.unwrapData<TelegramLinkResponse>(response);
  }

  async getTelegramStatus(): Promise<TelegramStatusResponse> {
    const response = await this.request<ApiEnvelope<TelegramStatusResponse>>('/auth/telegram/status');
    return this.unwrapData<TelegramStatusResponse>(response);
  }

  async unlinkTelegramChat(): Promise<TelegramStatusResponse> {
    const response = await this.request<ApiEnvelope<TelegramStatusResponse>>('/auth/telegram/link', {
      method: 'DELETE',
    });
    return this.unwrapData<TelegramStatusResponse>(response);
  }

  async changeEmail(data: { newEmail: string; currentPassword: string }): Promise<{ message: string }> {
    const response = await this.request<ApiEnvelope<unknown>>('/auth/change-email', {
      method: 'PUT',
      body: JSON.stringify(data),
    });

    return {
      message: (response as ApiEnvelope<unknown>).message || 'Email обновлён',
    };
  }

  async deleteAccount(data: { currentPassword: string }): Promise<{ message: string }> {
    const response = await this.request<ApiEnvelope<unknown>>('/auth/account', {
      method: 'DELETE',
      body: JSON.stringify(data),
    });

    return {
      message: (response as ApiEnvelope<unknown>).message || 'Аккаунт удалён',
    };
  }

  // ============================================
  // Freelancers
  // ============================================

  async getFreelancers(params?: {
    category?: string;
    search?: string;
    minRating?: number;
    maxPrice?: number;
    skills?: string[];
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<Freelancer>> {
    const searchParams = new URLSearchParams();

    if (params?.category) searchParams.set('category', params.category);
    if (params?.search) searchParams.set('search', params.search);
    if (params?.minRating) searchParams.set('minRating', params.minRating.toString());
    if (params?.maxPrice) searchParams.set('maxPrice', params.maxPrice.toString());
    if (params?.skills?.length) searchParams.set('skills', params.skills.join(','));
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());

    const query = searchParams.toString();
    const response = await this.request<ApiEnvelope<any[]>>(`/freelancers${query ? `?${query}` : ''}`);
    const paginated = this.unwrapPagination<any>(response);

    return {
      ...paginated,
      data: paginated.data.map((f) => this.mapFreelancer(f)),
    };
  }

  async getFreelancer(id: string): Promise<Freelancer> {
    const response = await this.request<ApiEnvelope<any>>(`/freelancers/${id}`);
    const raw = this.unwrapData<any>(response);
    return this.mapFreelancer(raw);
  }

  async updateFreelancerProfile(data: UpdateFreelancerProfilePayload): Promise<FreelancerProfile> {
    const response = await this.request<ApiEnvelope<FreelancerProfile>>('/freelancers/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return this.unwrapData<FreelancerProfile>(response);
  }

  // ============================================
  // Orders
  // ============================================

  async getOrders(params?: {
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<Order>> {
    const searchParams = new URLSearchParams();

    if (params?.status) searchParams.set('status', params.status);
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());

    const query = searchParams.toString();
    const response = await this.request<ApiEnvelope<Order[]>>(`/orders${query ? `?${query}` : ''}`);
    return this.unwrapPagination<Order>(response);
  }

  async getAvailableOrders(params?: {
    category?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<Order>> {
    const searchParams = new URLSearchParams();

    if (params?.category) searchParams.set('category', params.category);
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());

    const query = searchParams.toString();
    const response = await this.request<ApiEnvelope<Order[]>>(`/orders/available${query ? `?${query}` : ''}`);
    return this.unwrapPagination<Order>(response);
  }

  async getOrder(id: string): Promise<Order & { messages: Message[] }> {
    const orderResponse = await this.request<ApiEnvelope<Order>>(`/orders/${id}`);
    const order = this.unwrapData<Order>(orderResponse);

    try {
      const messages = await this.getMessages(id, { limit: 100 });
      return { ...order, messages: messages.data };
    } catch {
      return { ...order, messages: [] };
    }
  }

  async createOrder(data: {
    title: string;
    description: string;
    category?: string;
    budget: number;
    deadline?: string;
    freelancerId?: string;
  }): Promise<Order> {
    const response = await this.request<ApiEnvelope<Order>>('/orders', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return this.unwrapData<Order>(response);
  }

  async acceptOrder(id: string): Promise<Order> {
    const response = await this.request<ApiEnvelope<Order>>(`/orders/${id}/accept`, { method: 'POST' });
    return this.unwrapData<Order>(response);
  }

  async submitOrder(id: string, submissionNote?: string): Promise<Order> {
    const response = await this.request<ApiEnvelope<Order>>(`/orders/${id}/submit`, {
      method: 'POST',
      body: JSON.stringify({ submissionNote }),
    });
    return this.unwrapData<Order>(response);
  }

  async approveOrder(id: string, data?: { rating?: number; comment?: string }): Promise<Order> {
    const response = await this.request<ApiEnvelope<Order>>(`/orders/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    });
    return this.unwrapData<Order>(response);
  }

  async submitOrderReview(id: string, data: { rating: number; comment: string }): Promise<Order> {
    const response = await this.request<ApiEnvelope<Order>>(`/orders/${id}/review`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return this.unwrapData<Order>(response);
  }

  async cancelOrder(id: string, reason?: string): Promise<Order> {
    const response = await this.request<ApiEnvelope<Order>>(`/orders/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
    return this.unwrapData<Order>(response);
  }

  async getOrderProposals(orderId: string): Promise<Proposal[]> {
    const response = await this.request<ApiEnvelope<Proposal[]>>(`/orders/${orderId}/proposals`);
    return this.unwrapData<Proposal[]>(response) || [];
  }

  async submitOrderProposal(
    orderId: string,
    data: { amount: number; deliveryDays: number; message?: string }
  ): Promise<Proposal> {
    const response = await this.request<ApiEnvelope<Proposal>>(`/orders/${orderId}/proposals`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return this.unwrapData<Proposal>(response);
  }

  async acceptOrderProposal(orderId: string, proposalId: string): Promise<Proposal> {
    const response = await this.request<ApiEnvelope<Proposal>>(`/orders/${orderId}/proposals/${proposalId}/accept`, {
      method: 'POST',
    });
    return this.unwrapData<Proposal>(response);
  }

  async rejectOrderProposal(orderId: string, proposalId: string): Promise<Proposal> {
    const response = await this.request<ApiEnvelope<Proposal>>(`/orders/${orderId}/proposals/${proposalId}/reject`, {
      method: 'POST',
    });
    return this.unwrapData<Proposal>(response);
  }

  // ============================================
  // Messages
  // ============================================

  async getMessages(orderId: string, params?: {
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<Message>> {
    const searchParams = new URLSearchParams();

    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());

    const query = searchParams.toString();
    const response = await this.request<ApiEnvelope<any[]>>(`/messages/${orderId}${query ? `?${query}` : ''}`);
    const paginated = this.unwrapPagination<any>(response);
    return {
      ...paginated,
      data: paginated.data.map((message) => this.mapMessage(message)),
    };
  }

  async sendMessage(data: {
    orderId: string;
    content?: string;
    fileUrl?: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    type?: 'text' | 'image' | 'file' | 'system';
  }): Promise<Message> {
    const response = await this.request<ApiEnvelope<any>>('/messages', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return this.mapMessage(this.unwrapData<any>(response));
  }

  async getConversations(): Promise<Conversation[]> {
    const response = await this.request<ApiEnvelope<Conversation[]>>('/messages/conversations/list');
    return this.unwrapData<Conversation[]>(response) || [];
  }

  async getUnreadMessagesCount(): Promise<number> {
    const response = await this.request<ApiEnvelope<{ unreadCount: number }>>('/messages/unread/count');
    return this.unwrapData<{ unreadCount: number }>(response)?.unreadCount || 0;
  }

  // ============================================
  // Notifications
  // ============================================

  async getNotifications(params?: {
    page?: number;
    limit?: number;
    unreadOnly?: boolean;
  }): Promise<NotificationListResponse> {
    const searchParams = new URLSearchParams();

    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.unreadOnly) searchParams.set('unreadOnly', 'true');

    const query = searchParams.toString();
    const response = await this.request<
      ApiEnvelope<NotificationItem[]> & { unreadCount?: number }
    >(`/notifications${query ? `?${query}` : ''}`);
    const paginated = this.unwrapPagination<NotificationItem>(response);
    const unreadCount =
      isObject(response) && typeof response.unreadCount === 'number'
        ? response.unreadCount
        : paginated.data.filter((item) => !item.isRead).length;

    return {
      ...paginated,
      unreadCount,
    };
  }

  async getUnreadNotificationsCount(): Promise<number> {
    const response = await this.request<ApiEnvelope<{ count: number }>>('/notifications/unread-count');
    return this.unwrapData<{ count: number }>(response)?.count || 0;
  }

  async markNotificationRead(id: string): Promise<void> {
    await this.request(`/notifications/${id}/read`, {
      method: 'PUT',
    });
  }

  async markAllNotificationsRead(): Promise<void> {
    await this.request('/notifications/read-all', {
      method: 'PUT',
    });
  }

  async deleteNotification(id: string): Promise<void> {
    await this.request(`/notifications/${id}`, {
      method: 'DELETE',
    });
  }

  async deleteReadNotifications(): Promise<{ message: string }> {
    const response = await this.request<ApiEnvelope<unknown>>('/notifications', {
      method: 'DELETE',
    });

    return {
      message: (response as ApiEnvelope<unknown>).message || 'Прочитанные уведомления удалены',
    };
  }

  // ============================================
  // Workspace
  // ============================================

  async getClientWorkspaceProfile(): Promise<ClientWorkspaceProfile> {
    const response = await this.request<ApiEnvelope<ClientWorkspaceProfile>>('/workspace/client-profile');
    return this.unwrapData<ClientWorkspaceProfile>(response);
  }

  async updateClientWorkspaceProfile(data: ClientWorkspaceProfile): Promise<ClientWorkspaceProfile> {
    const response = await this.request<ApiEnvelope<ClientWorkspaceProfile>>('/workspace/client-profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return this.unwrapData<ClientWorkspaceProfile>(response);
  }

  async getFreelancerResumeProfile(): Promise<FreelancerResumeProfile> {
    const response = await this.request<ApiEnvelope<FreelancerResumeProfile>>('/workspace/resume');
    return this.unwrapData<FreelancerResumeProfile>(response);
  }

  async updateFreelancerResumeProfile(data: FreelancerResumeProfile): Promise<FreelancerResumeProfile> {
    const response = await this.request<ApiEnvelope<FreelancerResumeProfile>>('/workspace/resume', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return this.unwrapData<FreelancerResumeProfile>(response);
  }

  async getSavedPaymentMethods(): Promise<SavedPaymentMethod[]> {
    const response = await this.request<ApiEnvelope<SavedPaymentMethod[]>>('/workspace/payment-methods');
    return this.unwrapData<SavedPaymentMethod[]>(response) || [];
  }

  async createSavedPaymentMethod(data: CreateSavedPaymentMethodPayload): Promise<SavedPaymentMethod> {
    const response = await this.request<ApiEnvelope<SavedPaymentMethod>>('/workspace/payment-methods', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return this.unwrapData<SavedPaymentMethod>(response);
  }

  async setDefaultSavedPaymentMethod(id: string): Promise<SavedPaymentMethod> {
    const response = await this.request<ApiEnvelope<SavedPaymentMethod>>(`/workspace/payment-methods/${id}/default`, {
      method: 'PATCH',
    });
    return this.unwrapData<SavedPaymentMethod>(response);
  }

  async deleteSavedPaymentMethod(id: string): Promise<void> {
    await this.request(`/workspace/payment-methods/${id}`, {
      method: 'DELETE',
    });
  }

  async getWorkspaceDocuments(): Promise<WorkspaceDocument[]> {
    const response = await this.request<ApiEnvelope<WorkspaceDocument[]>>('/workspace/documents');
    return this.unwrapData<WorkspaceDocument[]>(response) || [];
  }

  async createWorkspaceDocument(data: {
    title: string;
    type: WorkspaceDocumentType;
    status: WorkspaceDocumentStatus;
    fileUrl?: string;
    fileName?: string;
    size?: number;
    notes?: string;
  }): Promise<WorkspaceDocument> {
    const response = await this.request<ApiEnvelope<WorkspaceDocument>>('/workspace/documents', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return this.unwrapData<WorkspaceDocument>(response);
  }

  async updateWorkspaceDocument(
    id: string,
    data: Partial<Pick<WorkspaceDocument, 'title' | 'status' | 'notes'>>
  ): Promise<WorkspaceDocument> {
    const response = await this.request<ApiEnvelope<WorkspaceDocument>>(`/workspace/documents/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return this.unwrapData<WorkspaceDocument>(response);
  }

  async deleteWorkspaceDocument(id: string): Promise<void> {
    await this.request(`/workspace/documents/${id}`, {
      method: 'DELETE',
    });
  }

  async getWorkspaceTeamMembers(): Promise<WorkspaceTeamMember[]> {
    const response = await this.request<ApiEnvelope<WorkspaceTeamMember[]>>('/workspace/team-members');
    return this.unwrapData<WorkspaceTeamMember[]>(response) || [];
  }

  async createWorkspaceTeamMember(
    data: Pick<
      WorkspaceTeamMember,
      'name' | 'email' | 'title' | 'role' | 'status' | 'location' | 'permissions' | 'seatsScope'
    > &
      Partial<Pick<WorkspaceTeamMember, 'avatarColor' | 'mfaEnabled' | 'lastActiveAt' | 'inviteAcceptedAt'>>
  ): Promise<WorkspaceTeamMember> {
    const response = await this.request<ApiEnvelope<WorkspaceTeamMember>>('/workspace/team-members', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return this.unwrapData<WorkspaceTeamMember>(response);
  }

  async updateWorkspaceTeamMember(
    id: string,
    data: Partial<
      Pick<
        WorkspaceTeamMember,
        | 'name'
        | 'email'
        | 'role'
        | 'title'
        | 'status'
        | 'location'
        | 'avatarColor'
        | 'mfaEnabled'
        | 'permissions'
        | 'seatsScope'
        | 'lastActiveAt'
        | 'inviteAcceptedAt'
      >
    >
  ): Promise<WorkspaceTeamMember> {
    const response = await this.request<ApiEnvelope<WorkspaceTeamMember>>(`/workspace/team-members/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return this.unwrapData<WorkspaceTeamMember>(response);
  }

  async deleteWorkspaceTeamMember(id: string): Promise<void> {
    await this.request(`/workspace/team-members/${id}`, {
      method: 'DELETE',
    });
  }

  async getWorkspaceSecurity(): Promise<WorkspaceSecuritySettings> {
    const response = await this.request<ApiEnvelope<WorkspaceSecuritySettings>>('/workspace/security');
    return this.unwrapData<WorkspaceSecuritySettings>(response);
  }

  async updateWorkspaceSecurity(data: WorkspaceSecuritySettings): Promise<WorkspaceSecuritySettings> {
    const response = await this.request<ApiEnvelope<WorkspaceSecuritySettings>>('/workspace/security', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return this.unwrapData<WorkspaceSecuritySettings>(response);
  }

  async getWorkspaceVerification(): Promise<WorkspaceVerificationProfile> {
    const response = await this.request<ApiEnvelope<WorkspaceVerificationProfile>>('/workspace/verification');
    return this.unwrapData<WorkspaceVerificationProfile>(response);
  }

  async updateWorkspaceVerification(data: WorkspaceVerificationProfile): Promise<WorkspaceVerificationProfile> {
    const response = await this.request<ApiEnvelope<WorkspaceVerificationProfile>>('/workspace/verification', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return this.unwrapData<WorkspaceVerificationProfile>(response);
  }

  async getWorkspaceSubscription(): Promise<WorkspaceSubscriptionPlan> {
    const response = await this.request<ApiEnvelope<WorkspaceSubscriptionPlan>>('/workspace/subscription');
    return this.unwrapData<WorkspaceSubscriptionPlan>(response);
  }

  async updateWorkspaceSubscription(data: WorkspaceSubscriptionPlan): Promise<WorkspaceSubscriptionPlan> {
    const response = await this.request<ApiEnvelope<WorkspaceSubscriptionPlan>>('/workspace/subscription', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return this.unwrapData<WorkspaceSubscriptionPlan>(response);
  }

  async getWorkspaceActivityLog(params?: { limit?: number }): Promise<WorkspaceActivityEntry[]> {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    const query = searchParams.toString();
    const response = await this.request<ApiEnvelope<WorkspaceActivityEntry[]>>(`/workspace/activity-log${query ? `?${query}` : ''}`);
    return this.unwrapData<WorkspaceActivityEntry[]>(response) || [];
  }

  async getWorkspaceOverview(): Promise<WorkspaceOverviewSummary> {
    const response = await this.request<ApiEnvelope<WorkspaceOverviewSummary>>('/workspace/overview');
    return this.unwrapData<WorkspaceOverviewSummary>(response);
  }

  // ============================================
  // Disputes
  // ============================================

  async createDispute(data: {
    orderId: string;
    reason: string;
    evidence?: string[];
  }): Promise<any> {
    const response = await this.request<ApiEnvelope<any>>('/disputes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return this.unwrapData(response);
  }

  async getDispute(id: string): Promise<any> {
    const response = await this.request<ApiEnvelope<any>>(`/disputes/${id}`);
    return this.unwrapData(response);
  }

  // ============================================
  // Uploads
  // ============================================

  async uploadFile(file: File): Promise<UploadResult> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await this.request<ApiEnvelope<UploadResult>>('/uploads', {
      method: 'POST',
      body: formData,
    });

    return this.unwrapData<UploadResult>(response);
  }

  async uploadMultipleFiles(files: File[]): Promise<UploadResult[]> {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));

    const response = await this.request<ApiEnvelope<UploadResult[]>>('/uploads/multiple', {
      method: 'POST',
      body: formData,
    });

    return this.unwrapData<UploadResult[]>(response);
  }

  async uploadFileWithProgress(file: File, onProgress?: (progress: number) => void): Promise<UploadResult> {
    const token = getToken();

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE}/uploads`);
      xhr.withCredentials = true;

      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable || !onProgress) return;
        const progress = Math.round((event.loaded / event.total) * 100);
        onProgress(progress);
      };

      xhr.onerror = () => {
        reject(new ApiError('Network error during file upload', 0, null));
      };

      xhr.onload = () => {
        let payload: unknown = null;
        if (xhr.responseText) {
          try {
            payload = JSON.parse(xhr.responseText);
          } catch {
            payload = null;
          }
        }

        if (xhr.status < 200 || xhr.status >= 300) {
          reject(new ApiError(getApiErrorMessage(payload, xhr.status), xhr.status, payload));
          return;
        }

        if (isObject(payload) && 'data' in payload) {
          resolve((payload as ApiEnvelope<UploadResult>).data as UploadResult);
          return;
        }

        resolve(payload as UploadResult);
      };

      const formData = new FormData();
      formData.append('file', file);
      xhr.send(formData);
    });
  }

  async uploadAvatar(file: File): Promise<{ url: string }> {
    const formData = new FormData();
    formData.append('avatar', file);

    const response = await this.request<ApiEnvelope<{ url: string }>>('/uploads/avatar', {
      method: 'POST',
      body: formData,
    });

    return this.unwrapData<{ url: string }>(response);
  }

  // ============================================
  // Payments
  // ============================================

  async getPaymentConfig(): Promise<PaymentConfig> {
    const response = await this.request<ApiEnvelope<PaymentConfig>>('/payments/config');
    return this.unwrapData<PaymentConfig>(response);
  }

  async getPaymentMethods(): Promise<PaymentMethod[]> {
    const response = await this.request<ApiEnvelope<PaymentMethod[]>>('/payments/methods');
    return this.unwrapData<PaymentMethod[]>(response) || [];
  }

  async createEscrow(data: {
    orderId: string;
    amount: number;
    method: PaymentMethodId;
    idempotencyKey?: string;
  }): Promise<EscrowPaymentResult> {
    const headers: Record<string, string> = {};
    if (data.idempotencyKey) {
      headers['x-idempotency-key'] = data.idempotencyKey;
    }

    const response = await this.request<ApiEnvelope<EscrowPaymentResult>>('/payments/escrow', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        orderId: data.orderId,
        amount: data.amount,
        method: data.method,
      }),
    });
    return this.unwrapData<EscrowPaymentResult>(response);
  }

  async getEscrowInfo(orderId: string): Promise<any> {
    const response = await this.request<ApiEnvelope<any>>(`/payments/escrow/${orderId}`);
    return this.unwrapData<any>(response);
  }

  async getFreelancerBalance(): Promise<FreelancerBalanceStats> {
    const response = await this.request<ApiEnvelope<FreelancerBalanceStats>>('/payments/balance');
    return this.unwrapData<FreelancerBalanceStats>(response);
  }

  async requestWithdrawal(data: {
    amount: number;
    method: PaymentMethodId;
    details: string;
    idempotencyKey?: string;
  }): Promise<EscrowPaymentResult> {
    const scope =
      data.idempotencyKey
        ? ''
        : `withdraw-${data.method}-${data.amount}-${this.shortHash(data.details || '')}`;
    const idempotencyKey = data.idempotencyKey || this.getOrCreateIdempotencyKey(scope);
    const headers: Record<string, string> = {};
    headers['x-idempotency-key'] = idempotencyKey;

    try {
      const response = await this.request<ApiEnvelope<EscrowPaymentResult>>('/payments/withdraw', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          amount: data.amount,
          method: data.method,
          details: data.details,
        }),
      });
      if (!data.idempotencyKey && scope) {
        this.clearIdempotencyKey(scope);
      }
      return this.unwrapData<EscrowPaymentResult>(response);
    } catch (error) {
      // Keep generated key for retry on same action.
      throw error;
    }
  }

  async getTransactions(params?: {
    type?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<PaymentTransaction>> {
    const searchParams = new URLSearchParams();
    if (params?.type) searchParams.set('type', params.type);
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());

    const query = searchParams.toString();
    const response = await this.request<ApiEnvelope<PaymentTransaction[]>>(
      `/payments/transactions${query ? `?${query}` : ''}`
    );
    return this.unwrapPagination<PaymentTransaction>(response);
  }

  async getClientPaymentStats(): Promise<{
    activeOrders: number;
    completedOrders: number;
    totalSpent: number;
    inEscrow: number;
  }> {
    const response = await this.request<ApiEnvelope<any>>('/payments/stats/client');
    return this.unwrapData(response);
  }

  async getFreelancerPaymentStats(): Promise<{
    activeOrders: number;
    completedOrders: number;
    totalEarnings: number;
    balance: number;
    pendingAmount: number;
    rating: number;
  }> {
    const response = await this.request<ApiEnvelope<any>>('/payments/stats/freelancer');
    return this.unwrapData(response);
  }

  // ============================================
  // Admin
  // ============================================

  async getAdminStats(): Promise<AdminStatsResponse> {
    return this.request<AdminStatsResponse>('/admin/stats');
  }

  async getAdminUsers(params?: {
    role?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ users: AdminUserRow[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
    const searchParams = new URLSearchParams();
    if (params?.role) searchParams.set('role', params.role);
    if (params?.search) searchParams.set('search', params.search);
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    const query = searchParams.toString();
    return this.request(`/admin/users${query ? `?${query}` : ''}`);
  }

  async updateAdminUser(
    id: string,
    data: { name?: string; role?: 'CLIENT' | 'FREELANCER' | 'ADMIN'; isBanned?: boolean }
  ): Promise<{ user: AdminUserRow }> {
    return this.request(`/admin/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getAdminDisputes(params?: {
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{ disputes: AdminDisputeRow[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    const query = searchParams.toString();
    return this.request(`/admin/disputes${query ? `?${query}` : ''}`);
  }

  async getAdminOrders(params?: {
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{ orders: AdminOrderRow[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    const query = searchParams.toString();
    return this.request(`/admin/orders${query ? `?${query}` : ''}`);
  }

  async resolveDisputeToClient(disputeId: string, resolution?: string): Promise<any> {
    const scope = `admin-refund-${disputeId}`;
    const idempotencyKey = this.getOrCreateIdempotencyKey(scope);
    return this.request(`/admin/disputes/${disputeId}/refund-client`, {
      method: 'POST',
      headers: {
        'x-idempotency-key': idempotencyKey,
      },
      body: JSON.stringify({ resolution }),
    }).then((result) => {
      this.clearIdempotencyKey(scope);
      return result;
    });
  }

  async resolveDisputeToFreelancer(disputeId: string, resolution?: string): Promise<any> {
    const scope = `admin-release-${disputeId}`;
    const idempotencyKey = this.getOrCreateIdempotencyKey(scope);
    return this.request(`/admin/disputes/${disputeId}/release-freelancer`, {
      method: 'POST',
      headers: {
        'x-idempotency-key': idempotencyKey,
      },
      body: JSON.stringify({ resolution }),
    }).then((result) => {
      this.clearIdempotencyKey(scope);
      return result;
    });
  }

  async getPlatformFlags(): Promise<PlatformFlagsResponse> {
    const response = await this.request<ApiEnvelope<PlatformFlagsResponse>>('/platform/flags');
    return this.unwrapData<PlatformFlagsResponse>(response);
  }

  async updatePlatformFlag(key: string, enabled: boolean): Promise<PlatformFlagUpdateResponse> {
    const response = await this.request<ApiEnvelope<PlatformFlagUpdateResponse>>(`/platform/flags/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: JSON.stringify({ enabled }),
    });
    return this.unwrapData<PlatformFlagUpdateResponse>(response);
  }

  async getMySupportCases(params?: { page?: number; limit?: number }): Promise<PaginatedResponse<SupportCase>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    const query = searchParams.toString();
    const response = await this.request<ApiEnvelope<SupportCase[]>>(`/cases/my${query ? `?${query}` : ''}`);
    return this.unwrapPagination<SupportCase>(response);
  }

  async getSupportCases(params?: {
    status?: SupportCase['status'];
    priority?: SupportCase['priority'];
    assignedToId?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<SupportCase>> {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.priority) searchParams.set('priority', params.priority);
    if (params?.assignedToId) searchParams.set('assignedToId', params.assignedToId);
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    const query = searchParams.toString();
    const response = await this.request<ApiEnvelope<SupportCase[]>>(`/cases${query ? `?${query}` : ''}`);
    return this.unwrapPagination<SupportCase>(response);
  }

  async createSupportCase(data: {
    title: string;
    description: string;
    orderId?: string;
    disputeId?: string;
    priority?: SupportCase['priority'];
  }): Promise<SupportCase> {
    const response = await this.request<ApiEnvelope<SupportCase>>('/cases', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return this.unwrapData<SupportCase>(response);
  }

  async assignSupportCase(caseId: string, assignedToId?: string | null): Promise<SupportCase> {
    const response = await this.request<ApiEnvelope<SupportCase>>(`/cases/${caseId}/assign`, {
      method: 'PATCH',
      body: JSON.stringify({ assignedToId: assignedToId || null }),
    });
    return this.unwrapData<SupportCase>(response);
  }

  async updateSupportCaseStatus(
    caseId: string,
    data: { status: SupportCase['status']; resolution?: string }
  ): Promise<SupportCase> {
    const response = await this.request<ApiEnvelope<SupportCase>>(`/cases/${caseId}/status`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return this.unwrapData<SupportCase>(response);
  }

  async getAdminAuditLogs(params?: {
    action?: string;
    actorId?: string;
    entityType?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<AuditLogItem>> {
    const searchParams = new URLSearchParams();
    if (params?.action) searchParams.set('action', params.action);
    if (params?.actorId) searchParams.set('actorId', params.actorId);
    if (params?.entityType) searchParams.set('entityType', params.entityType);
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    const query = searchParams.toString();
    const response = await this.request<ApiEnvelope<AuditLogItem[]>>(`/admin/audit-logs${query ? `?${query}` : ''}`);
    return this.unwrapPagination<AuditLogItem>(response);
  }

  async getAdminLedgerEntries(params?: {
    account?: string;
    userId?: string;
    orderId?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<LedgerEntryRow>> {
    const searchParams = new URLSearchParams();
    if (params?.account) searchParams.set('account', params.account);
    if (params?.userId) searchParams.set('userId', params.userId);
    if (params?.orderId) searchParams.set('orderId', params.orderId);
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    const query = searchParams.toString();
    const response = await this.request<ApiEnvelope<LedgerEntryRow[]>>(`/admin/ledger${query ? `?${query}` : ''}`);
    return this.unwrapPagination<LedgerEntryRow>(response);
  }

  async getAdminLedgerSummary(params?: {
    userId?: string;
    orderId?: string;
  }): Promise<LedgerSummaryResponse> {
    const searchParams = new URLSearchParams();
    if (params?.userId) searchParams.set('userId', params.userId);
    if (params?.orderId) searchParams.set('orderId', params.orderId);
    const query = searchParams.toString();
    const response = await this.request<ApiEnvelope<LedgerSummaryResponse>>(
      `/admin/ledger-summary${query ? `?${query}` : ''}`
    );
    return this.unwrapData<LedgerSummaryResponse>(response);
  }

  // ============================================
  // Health
  // ============================================

  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return this.request('/health');
  }
}

export const api = new ApiClient();
export default api;
