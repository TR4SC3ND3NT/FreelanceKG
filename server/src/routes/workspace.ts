import { randomUUID } from 'crypto';
import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import {
  ClientWorkspaceProfile,
  FreelancerResumeProfile,
  WorkspaceActivityEntry,
  WorkspaceDocumentRecord,
  WorkspaceDocumentStatus,
  WorkspaceDocumentType,
  WorkspaceOverviewSummary,
  WorkspacePaymentMethod,
  WorkspacePaymentMethodType,
  WorkspaceSecuritySettings,
  WorkspaceSubscriptionPlan,
  WorkspaceTeamMember,
  WorkspaceTeamMemberRole,
  WorkspaceTeamMemberStatus,
  WorkspaceVerificationCheck,
  WorkspaceVerificationCheckStatus,
  WorkspaceVerificationLevel,
  WorkspaceVerificationProfile,
  WorkspaceVerificationStatus,
  getClientWorkspaceProfile,
  getFreelancerResumeProfile,
  getWorkspaceDocuments,
  getWorkspacePaymentMethods,
  getWorkspaceSecuritySettings,
  getWorkspaceSubscriptionPlan,
  getWorkspaceTeamMembers,
  getWorkspaceVerificationProfile,
  saveClientWorkspaceProfile,
  saveFreelancerResumeProfile,
  saveWorkspaceDocuments,
  saveWorkspacePaymentMethods,
  saveWorkspaceSecuritySettings,
  saveWorkspaceSubscriptionPlan,
  saveWorkspaceTeamMembers,
  saveWorkspaceVerificationProfile,
} from '../lib/workspaceData';
import { auditLogFromRequest } from '../lib/logger';

const router = Router();

const DOCUMENT_TYPES = new Set<WorkspaceDocumentType>([
  'INVOICE',
  'AGREEMENT',
  'BRIEF',
  'REPORT',
  'ID',
  'PORTFOLIO',
  'STATEMENT',
]);

const DOCUMENT_STATUSES = new Set<WorkspaceDocumentStatus>([
  'DRAFT',
  'UNDER_REVIEW',
  'SIGNED',
  'ARCHIVED',
]);

const PAYMENT_METHOD_TYPES = new Set<WorkspacePaymentMethodType>(['card', 'wallet', 'bank']);
const TEAM_MEMBER_ROLES = new Set<WorkspaceTeamMemberRole>([
  'OWNER',
  'ADMIN',
  'FINANCE',
  'LEGAL',
  'OPERATIONS',
  'VIEWER',
]);
const TEAM_MEMBER_STATUSES = new Set<WorkspaceTeamMemberStatus>(['ACTIVE', 'INVITED', 'SUSPENDED']);
const VERIFICATION_STATUSES = new Set<WorkspaceVerificationStatus>([
  'NOT_STARTED',
  'UNDER_REVIEW',
  'VERIFIED',
  'ACTION_REQUIRED',
]);
const VERIFICATION_LEVELS = new Set<WorkspaceVerificationLevel>(['BASIC', 'BUSINESS', 'ENTERPRISE']);
const VERIFICATION_CHECK_STATUSES = new Set<WorkspaceVerificationCheckStatus>([
  'PENDING',
  'UNDER_REVIEW',
  'APPROVED',
  'REQUIRES_UPDATE',
]);
const SUBSCRIPTION_PLAN_CODES = new Set<WorkspaceSubscriptionPlan['planCode']>([
  'growth',
  'scale',
  'enterprise',
]);
const BILLING_CYCLES = new Set<WorkspaceSubscriptionPlan['billingCycle']>(['MONTHLY', 'ANNUAL']);
const AVATAR_COLORS = ['#0f766e', '#1d4ed8', '#9333ea', '#c2410c', '#be123c', '#0f766e'];

function sanitizeString(value: unknown, maxLength = 240): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function sanitizeMultiline(value: unknown, maxLength = 4000): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function sanitizeStringArray(value: unknown, maxItems = 20, maxLength = 80): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => sanitizeString(item, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function sanitizeNumber(value: unknown, min: number, max: number, fallback: number): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, Math.round(numeric)));
}

function sanitizeBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  return fallback;
}

function sanitizeIsoDate(value: unknown, fallback?: string): string | undefined {
  if (typeof value !== 'string') return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed.toISOString();
}

function sanitizeRole(value: unknown, fallback: WorkspaceTeamMemberRole): WorkspaceTeamMemberRole {
  const normalized = sanitizeString(value, 24) as WorkspaceTeamMemberRole;
  return TEAM_MEMBER_ROLES.has(normalized) ? normalized : fallback;
}

function sanitizeTeamStatus(value: unknown, fallback: WorkspaceTeamMemberStatus): WorkspaceTeamMemberStatus {
  const normalized = sanitizeString(value, 24) as WorkspaceTeamMemberStatus;
  return TEAM_MEMBER_STATUSES.has(normalized) ? normalized : fallback;
}

function sanitizeVerificationStatus(
  value: unknown,
  fallback: WorkspaceVerificationStatus
): WorkspaceVerificationStatus {
  const normalized = sanitizeString(value, 32) as WorkspaceVerificationStatus;
  return VERIFICATION_STATUSES.has(normalized) ? normalized : fallback;
}

function sanitizeVerificationLevel(
  value: unknown,
  fallback: WorkspaceVerificationLevel
): WorkspaceVerificationLevel {
  const normalized = sanitizeString(value, 32) as WorkspaceVerificationLevel;
  return VERIFICATION_LEVELS.has(normalized) ? normalized : fallback;
}

function sanitizeVerificationCheckStatus(
  value: unknown,
  fallback: WorkspaceVerificationCheckStatus
): WorkspaceVerificationCheckStatus {
  const normalized = sanitizeString(value, 32) as WorkspaceVerificationCheckStatus;
  return VERIFICATION_CHECK_STATUSES.has(normalized) ? normalized : fallback;
}

function sanitizePlanCode(
  value: unknown,
  fallback: WorkspaceSubscriptionPlan['planCode']
): WorkspaceSubscriptionPlan['planCode'] {
  const normalized = sanitizeString(value, 24) as WorkspaceSubscriptionPlan['planCode'];
  return SUBSCRIPTION_PLAN_CODES.has(normalized) ? normalized : fallback;
}

function sanitizeBillingCycle(
  value: unknown,
  fallback: WorkspaceSubscriptionPlan['billingCycle']
): WorkspaceSubscriptionPlan['billingCycle'] {
  const normalized = sanitizeString(value, 24) as WorkspaceSubscriptionPlan['billingCycle'];
  return BILLING_CYCLES.has(normalized) ? normalized : fallback;
}

function requireRole(req: Request, res: Response, role: 'CLIENT' | 'FREELANCER'): boolean {
  if (req.user?.role !== role) {
    res.status(403).json({
      success: false,
      error: `Only ${role.toLowerCase()} can access this resource`,
    });
    return false;
  }
  return true;
}

function detectCardBrand(cardNumber: string): string {
  if (/^4\d+/.test(cardNumber)) return 'Visa';
  if (/^5[1-5]\d+/.test(cardNumber)) return 'Mastercard';
  if (/^220[0-4]\d+/.test(cardNumber)) return 'Mir';
  if (/^62\d+/.test(cardNumber)) return 'UnionPay';
  return 'Card';
}

function maskNumericValue(value: string, prefix: string): string {
  const digits = value.replace(/\D/g, '');
  const tail = digits.slice(-4);
  return tail ? `${prefix} •••• ${tail}` : prefix;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object' && 'toNumber' in value && typeof (value as { toNumber: unknown }).toNumber === 'function') {
    return ((value as { toNumber: () => number }).toNumber()) || 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return new Date().toISOString();
}

function shiftIso(daysAgo = 0, hoursAgo = 0): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(date.getHours() - hoursAgo);
  return date.toISOString();
}

function resolveAvatarColor(index: number) {
  return AVATAR_COLORS[index % AVATAR_COLORS.length];
}

function computeSecurityScore(settings: WorkspaceSecuritySettings): number {
  let score = 54;
  if (settings.enforceMfa) score += 12;
  if (settings.requireDeviceApproval) score += 9;
  if (settings.anomalyAlerts) score += 8;
  if (settings.backupCodesGenerated) score += 6;
  if (settings.ipAllowlist.length > 0) score += 5;
  if (settings.allowedCountries.length > 0) score += 3;
  if (settings.auditRetentionDays >= 180) score += 3;
  if (settings.apiKeysCount <= 2) score += 4;
  return Math.min(98, Math.max(42, score));
}

function buildChartBuckets(months = 6) {
  const now = new Date();
  const buckets = Array.from({ length: months }).map((_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (months - index - 1), 1);
    return {
      key: `${date.getFullYear()}-${date.getMonth()}`,
      label: date.toLocaleString('en-US', { month: 'short' }),
      value: 0,
      secondaryValue: 0,
    };
  });
  return buckets;
}

function aggregateMonthlySeries(
  items: Array<{ at: string; value: number; secondaryValue?: number }>,
  months = 6
) {
  const buckets = buildChartBuckets(months);
  const indexByKey = new Map(buckets.map((bucket, index) => [bucket.key, index]));

  for (const item of items) {
    const parsed = new Date(item.at);
    if (Number.isNaN(parsed.getTime())) continue;
    const key = `${parsed.getFullYear()}-${parsed.getMonth()}`;
    const bucketIndex = indexByKey.get(key);
    if (bucketIndex === undefined) continue;
    buckets[bucketIndex].value += item.value;
    buckets[bucketIndex].secondaryValue += item.secondaryValue || 0;
  }

  return buckets;
}

function toneFromAction(action: string): WorkspaceActivityEntry['tone'] {
  if (/(COMPLETED|APPROVED|VERIFIED|PAID|RELEASED)/.test(action)) return 'success';
  if (/(FAILED|REJECTED|DENIED|CANCELLED|BLOCKED|DISPUTE)/.test(action)) return 'danger';
  if (/(PENDING|REVIEW|WAITING|HOLDING|REQUESTED)/.test(action)) return 'warning';
  if (/(CREATED|UPDATED|SUBMITTED|LINKED|LOGIN)/.test(action)) return 'info';
  return 'default';
}

function presentAction(action: string) {
  return action
    .split('_')
    .map((chunk) => `${chunk.slice(0, 1)}${chunk.slice(1).toLowerCase()}`)
    .join(' ');
}

function describeAuditAction(
  action: string,
  entityType?: string | null,
  details?: Record<string, unknown> | null
): string {
  const title = presentAction(action);
  if (!details) return title;

  if (typeof details.methodType === 'string') {
    return `${title} (${String(details.methodType).toLowerCase()})`;
  }

  if (typeof details.flag === 'string') {
    return `${title}: ${details.flag}`;
  }

  if (typeof details.entityType === 'string') {
    return `${title} • ${details.entityType}`;
  }

  if (entityType) return `${title} • ${entityType}`;
  return title;
}

function createDefaultClientProfile(user: Request['user']): ClientWorkspaceProfile {
  const safeUser = user!;
  const emailDomain = safeUser.email.split('@')[1] || 'workspace.local';
  const firstName = sanitizeString(safeUser.name.split(' ')[0], 60) || 'Northstar';
  const brandName =
    emailDomain
      .split('.')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1).toLowerCase()}`)
      .join(' ') || `${firstName} Workspace`;
  const websiteDomain = emailDomain.includes('.') ? emailDomain : `${emailDomain}.local`;

  return {
    company: `${brandName} Holdings`,
    website: `https://${websiteDomain}`,
    phone: '+996 555 480 210',
    industry: 'Marketplace and digital services',
    teamSize: '11-50',
    billingEmail: `finance@${websiteDomain}`,
    taxId: `KG-${safeUser.id.slice(0, 4).toUpperCase()}-${safeUser.id.slice(-4).toUpperCase()}`,
    address: 'Erkindik Avenue 72',
    city: 'Bishkek',
    country: 'Kyrgyzstan',
    about: `${brandName} runs a managed freelance operations workspace with escrow approvals, compliance documents, and distributed vendor workflows.`,
  };
}

function createDefaultResume(user: Request['user']): FreelancerResumeProfile {
  const safeUser = user!;
  const firstName = sanitizeString(safeUser.name.split(' ')[0], 60) || 'Independent';

  return {
    headline: `${firstName} builds product systems for SaaS and fintech teams`,
    availability: 'Available for one retained client and short delivery sprints',
    experience:
      '6+ years delivering dashboard UX, marketplace workflows, operations tooling, and handoff systems for startups and enterprise clients.',
    education: 'BSc in Computer Science',
    certifications: ['Product Analytics Fundamentals', 'Agile Project Management'],
    languages: ['English', 'Russian'],
    location: 'Bishkek',
    workPreference: 'Remote-first with overlapping EU and Asia working hours',
    rateNote: 'Preferred format: fixed milestones or monthly retainer depending on delivery scope',
  };
}

function createDefaultTeamMembers(user: Request['user']): WorkspaceTeamMember[] {
  const safeUser = user!;
  const emailDomain = safeUser.email.split('@')[1] || 'workspace.local';
  const firstName = sanitizeString(safeUser.name.split(' ')[0], 60) || 'Workspace';

  if (safeUser.role === 'CLIENT') {
    return [
      {
        id: 'owner',
        name: safeUser.name,
        email: safeUser.email,
        title: 'Workspace owner',
        role: 'OWNER',
        status: 'ACTIVE',
        location: 'Bishkek',
        avatarColor: resolveAvatarColor(0),
        mfaEnabled: true,
        permissions: ['orders.manage', 'finance.manage', 'team.manage'],
        seatsScope: ['workspace', 'finance', 'documents'],
        lastActiveAt: shiftIso(0, 1),
        inviteAcceptedAt: shiftIso(26),
      },
      {
        id: 'finance-lead',
        name: 'Ainura Finance',
        email: `finance@${emailDomain}`,
        title: 'Finance lead',
        role: 'FINANCE',
        status: 'ACTIVE',
        location: 'Bishkek',
        avatarColor: resolveAvatarColor(1),
        mfaEnabled: true,
        permissions: ['finance.read', 'payouts.approve', 'documents.read'],
        seatsScope: ['finance', 'billing'],
        lastActiveAt: shiftIso(0, 4),
        inviteAcceptedAt: shiftIso(18),
      },
      {
        id: 'ops-manager',
        name: `${firstName} Ops`,
        email: `ops@${emailDomain}`,
        title: 'Operations manager',
        role: 'OPERATIONS',
        status: 'ACTIVE',
        location: 'Almaty',
        avatarColor: resolveAvatarColor(2),
        mfaEnabled: false,
        permissions: ['orders.read', 'support.manage', 'documents.manage'],
        seatsScope: ['operations', 'support'],
        lastActiveAt: shiftIso(1, 2),
        inviteAcceptedAt: shiftIso(12),
      },
      {
        id: 'legal-review',
        name: 'Nurlan Legal',
        email: `legal@${emailDomain}`,
        title: 'Legal reviewer',
        role: 'LEGAL',
        status: 'INVITED',
        location: 'Bishkek',
        avatarColor: resolveAvatarColor(3),
        mfaEnabled: false,
        permissions: ['documents.read', 'documents.sign'],
        seatsScope: ['documents', 'compliance'],
        lastActiveAt: shiftIso(3, 0),
      },
    ];
  }

  return [
    {
      id: 'owner',
      name: safeUser.name,
      email: safeUser.email,
      title: 'Lead freelancer',
      role: 'OWNER',
      status: 'ACTIVE',
      location: 'Bishkek',
      avatarColor: resolveAvatarColor(0),
      mfaEnabled: true,
      permissions: ['orders.manage', 'finance.manage', 'profile.manage'],
      seatsScope: ['workspace', 'portfolio', 'finance'],
      lastActiveAt: shiftIso(0, 1),
      inviteAcceptedAt: shiftIso(30),
    },
    {
      id: 'assistant',
      name: 'Studio assistant',
      email: `assistant@${emailDomain}`,
      title: 'Operations assistant',
      role: 'OPERATIONS',
      status: 'ACTIVE',
      location: 'Remote',
      avatarColor: resolveAvatarColor(1),
      mfaEnabled: true,
      permissions: ['support.manage', 'documents.manage'],
      seatsScope: ['support', 'documents'],
      lastActiveAt: shiftIso(0, 7),
      inviteAcceptedAt: shiftIso(20),
    },
    {
      id: 'bookkeeper',
      name: 'Bookkeeper',
      email: `finance@${emailDomain}`,
      title: 'Payout accountant',
      role: 'FINANCE',
      status: 'INVITED',
      location: 'Remote',
      avatarColor: resolveAvatarColor(2),
      mfaEnabled: false,
      permissions: ['finance.read', 'payouts.manage'],
      seatsScope: ['finance'],
      lastActiveAt: shiftIso(2, 0),
    },
  ];
}

function createDefaultSecurity(user: Request['user']): WorkspaceSecuritySettings {
  const settings: WorkspaceSecuritySettings = {
    sessionTimeoutMinutes: user?.role === 'FREELANCER' ? 30 : 45,
    enforceMfa: true,
    requireDeviceApproval: true,
    anomalyAlerts: true,
    auditRetentionDays: user?.role === 'CLIENT' ? 365 : 180,
    ipAllowlist: ['127.0.0.1/32', '192.168.0.0/16'],
    allowedCountries:
      user?.role === 'CLIENT'
        ? ['Kyrgyzstan', 'Kazakhstan', 'United States']
        : ['Kyrgyzstan', 'Kazakhstan', 'Uzbekistan'],
    apiKeysCount: user?.role === 'CLIENT' ? 2 : 1,
    backupCodesGenerated: true,
    lastKeyRotationAt: shiftIso(9, 0),
    securityScore: 0,
  };
  settings.securityScore = computeSecurityScore(settings);
  return settings;
}

function createDefaultVerification(
  user: Request['user'],
  dbUser?: { freelancerProfile?: { isVerified?: boolean | null } | null }
): WorkspaceVerificationProfile {
  const isVerifiedFreelancer = Boolean(dbUser?.freelancerProfile?.isVerified);
  const clientStyle = user?.role === 'CLIENT';
  const status: WorkspaceVerificationStatus = clientStyle
    ? 'UNDER_REVIEW'
    : isVerifiedFreelancer
      ? 'VERIFIED'
      : 'UNDER_REVIEW';
  const level: WorkspaceVerificationLevel = clientStyle ? 'BUSINESS' : isVerifiedFreelancer ? 'BUSINESS' : 'BASIC';

  return {
    status,
    level,
    ownerName: user?.name || 'Workspace owner',
    legalEntityName: clientStyle ? `${user?.name || 'Workspace'} Holdings` : user?.name || 'Freelancer profile',
    country: 'Kyrgyzstan',
    documentType: clientStyle ? 'Company registration certificate' : 'Passport / ID',
    documentNumberMasked: clientStyle ? 'ORG-••••-8024' : 'ID-••••-1845',
    riskLevel: 'LOW',
    submittedAt: shiftIso(5, 0),
    approvedAt: status === 'VERIFIED' ? shiftIso(2, 0) : undefined,
    nextStep:
      status === 'VERIFIED'
        ? 'Verification is complete. Workspace can use premium finance and compliance features.'
        : 'Awaiting final compliance review and bank account ownership confirmation.',
    checks: [
      {
        id: 'identity',
        title: clientStyle ? 'Authorized representative' : 'Identity verification',
        status: 'APPROVED',
        updatedAt: shiftIso(6, 0),
      },
      {
        id: 'documents',
        title: clientStyle ? 'Business registry documents' : 'Tax residency / address',
        status: status === 'VERIFIED' ? 'APPROVED' : 'UNDER_REVIEW',
        updatedAt: shiftIso(4, 0),
      },
      {
        id: 'bank',
        title: 'Bank ownership confirmation',
        status: status === 'VERIFIED' ? 'APPROVED' : 'PENDING',
        updatedAt: shiftIso(1, 0),
      },
    ],
  };
}

function createDefaultSubscription(
  user: Request['user'],
  teamMembersCount: number,
  documentCount: number,
  activeProjects: number,
  monthlyVolume: number
): WorkspaceSubscriptionPlan {
  const isClient = user?.role === 'CLIENT';
  return {
    planCode: isClient ? 'scale' : 'growth',
    planName: isClient ? 'Scale Workspace' : 'Growth Studio',
    billingCycle: 'MONTHLY',
    priceMonthly: isClient ? 149 : 79,
    seatsIncluded: isClient ? 8 : 4,
    seatsUsed: Math.max(teamMembersCount, isClient ? 3 : 2),
    renewalDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 18).toISOString(),
    usage: {
      activeProjects: Math.max(activeProjects, isClient ? 3 : 2),
      storedDocuments: Math.max(documentCount, isClient ? 12 : 7),
      monthlyVolume: Math.max(Math.round(monthlyVolume), isClient ? 180000 : 95000),
    },
    addons: [
      {
        id: 'priority-support',
        name: 'Priority support',
        status: 'ACTIVE',
        priceMonthly: 39,
        usage: '24/7 SLA',
      },
      {
        id: 'advanced-analytics',
        name: 'Advanced analytics',
        status: 'TRIAL',
        priceMonthly: 29,
        usage: '11 days left',
      },
    ],
    invoices: [
      {
        id: 'invoice-last',
        title: 'Current subscription cycle',
        amount: isClient ? 149 : 79,
        status: 'PAID',
        issuedAt: shiftIso(11, 0),
        dueAt: shiftIso(10, 0),
      },
      {
        id: 'invoice-next',
        title: 'Upcoming renewal',
        amount: isClient ? 188 : 108,
        status: 'PENDING',
        issuedAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 17).toISOString(),
        dueAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 18).toISOString(),
      },
    ],
  };
}

function buildDerivedActivityEntries(args: {
  orders: Array<{
    id: string;
    title: string;
    status: string;
    updatedAt: Date;
  }>;
  documents: WorkspaceDocumentRecord[];
  methods: WorkspacePaymentMethod[];
  supportCases: Array<{
    id: string;
    title: string;
    status: string;
    createdAt: Date;
  }>;
  verification: WorkspaceVerificationProfile;
  subscription: WorkspaceSubscriptionPlan;
}) {
  const entries: WorkspaceActivityEntry[] = [];

  for (const order of args.orders.slice(0, 6)) {
    entries.push({
      id: `order-${order.id}`,
      action: `ORDER_${order.status}`,
      description: `${order.title} • ${presentAction(order.status)}`,
      createdAt: order.updatedAt.toISOString(),
      tone: /(COMPLETED)/.test(order.status) ? 'success' : /(CANCELLED|DISPUTED)/.test(order.status) ? 'danger' : 'info',
      entityType: 'order',
      entityId: order.id,
      metadata: null,
    });
  }

  for (const document of args.documents.slice(0, 4)) {
    entries.push({
      id: `document-${document.id}`,
      action: `DOCUMENT_${document.status}`,
      description: `${document.title} • ${presentAction(document.status)}`,
      createdAt: document.updatedAt || document.createdAt,
      tone: document.status === 'SIGNED' ? 'success' : document.status === 'UNDER_REVIEW' ? 'warning' : 'default',
      entityType: 'document',
      entityId: document.id,
      metadata: null,
    });
  }

  for (const method of args.methods.slice(0, 2)) {
    entries.push({
      id: `method-${method.id}`,
      action: 'PAYMENT_METHOD_STORED',
      description: `${method.title} added to workspace vault`,
      createdAt: method.createdAt,
      tone: 'info',
      entityType: 'payment_method',
      entityId: method.id,
      metadata: null,
    });
  }

  for (const supportCase of args.supportCases.slice(0, 3)) {
    entries.push({
      id: `case-${supportCase.id}`,
      action: `SUPPORT_${supportCase.status}`,
      description: `${supportCase.title} • ${presentAction(supportCase.status)}`,
      createdAt: supportCase.createdAt.toISOString(),
      tone: supportCase.status === 'RESOLVED' ? 'success' : 'warning',
      entityType: 'support_case',
      entityId: supportCase.id,
      metadata: null,
    });
  }

  entries.push({
    id: 'verification',
    action: `VERIFICATION_${args.verification.status}`,
    description: `Compliance profile • ${presentAction(args.verification.status)}`,
    createdAt: args.verification.approvedAt || args.verification.submittedAt || new Date().toISOString(),
    tone: args.verification.status === 'VERIFIED' ? 'success' : 'warning',
    entityType: 'verification',
    entityId: null,
    metadata: null,
  });

  entries.push({
    id: 'subscription',
    action: 'SUBSCRIPTION_SYNCED',
    description: `${args.subscription.planName} • renewal ${args.subscription.renewalDate.slice(0, 10)}`,
    createdAt: args.subscription.invoices[0]?.issuedAt || new Date().toISOString(),
    tone: 'info',
    entityType: 'subscription',
    entityId: null,
    metadata: null,
  });

  return entries;
}

function mergeActivityEntries(
  auditLogs: Array<{
    id: string;
    action: string;
    entityType: string | null;
    entityId: string | null;
    details: unknown;
    createdAt: Date;
  }>,
  derived: WorkspaceActivityEntry[]
) {
  const auditEntries: WorkspaceActivityEntry[] = auditLogs.map((log) => {
    const details = asRecord(log.details);
    return {
      id: `audit-${log.id}`,
      action: log.action,
      description: describeAuditAction(log.action, log.entityType, details),
      createdAt: log.createdAt.toISOString(),
      tone: toneFromAction(log.action),
      entityType: log.entityType,
      entityId: log.entityId,
      metadata: details,
    };
  });

  return [...auditEntries, ...derived]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 24);
}

function hasChartSignal(series: Array<{ value: number; secondaryValue?: number }>) {
  return series.some((point) => point.value > 0 || (point.secondaryValue || 0) > 0);
}

function buildFallbackVolumeSeries(
  subscription: WorkspaceSubscriptionPlan,
  role: 'CLIENT' | 'FREELANCER'
) {
  const baseline = Math.max(subscription.usage.activeProjects, role === 'CLIENT' ? 3 : 2);
  return buildChartBuckets().map((bucket, index) => ({
    label: bucket.label,
    value: Math.max(1, baseline - (5 - index) + (role === 'CLIENT' ? 1 : 0)),
    secondaryValue: Math.max(0, Math.round((baseline + index) / 2) - 1),
  }));
}

function buildFallbackCashflowSeries(subscription: WorkspaceSubscriptionPlan) {
  const monthlyVolume = Math.max(subscription.usage.monthlyVolume, subscription.priceMonthly * 1000);
  return buildChartBuckets().map((bucket, index) => {
    const factor = 0.55 + index * 0.08;
    const value = Math.round(monthlyVolume * factor);
    return {
      label: bucket.label,
      value,
      secondaryValue: Math.round(value * 0.72),
    };
  });
}

function buildOverviewSummary(args: {
  role: 'CLIENT' | 'FREELANCER';
  orders: Array<{
    id: string;
    title: string;
    status: string;
    budget: unknown;
    escrowAmount: unknown;
    deadline: Date;
    createdAt: Date;
    updatedAt: Date;
    client: { name: string };
    freelancer: { name: string } | null;
  }>;
  transactions: Array<{
    id: string;
    type: string;
    amount: unknown;
    status: string;
    createdAt: Date;
    order: { id: string; title: string } | null;
  }>;
  notifications: Array<{
    id: string;
    type: string;
    title: string;
    message: string;
    isRead: boolean;
    createdAt: Date;
  }>;
  supportCases: Array<{
    id: string;
    caseNumber: number;
    title: string;
    status: string;
    priority: string;
    createdAt: Date;
  }>;
  documents: WorkspaceDocumentRecord[];
  methods: WorkspacePaymentMethod[];
  teamMembers: WorkspaceTeamMember[];
  verification: WorkspaceVerificationProfile;
  subscription: WorkspaceSubscriptionPlan;
  activityFeed: WorkspaceActivityEntry[];
  freelancerStats?: {
    rating: number;
    balance: number;
    pendingWithdrawal: number;
    totalEarnings: number;
  };
}): WorkspaceOverviewSummary {
  const routeBase = args.role === 'CLIENT' ? '/dashboard/client' : '/dashboard/freelancer';
  const unreadNotifications = args.notifications.filter((item) => !item.isRead).length;
  const pendingApprovals =
    args.role === 'CLIENT'
      ? args.orders.filter((item) => item.status === 'SUBMITTED').length
      : args.orders.filter((item) => item.status === 'ACTIVE').length;
  const openCases = args.supportCases.filter(
    (item) => !['RESOLVED', 'CLOSED'].includes(item.status)
  ).length;
  const documentsInReview = args.documents.filter((item) => item.status === 'UNDER_REVIEW').length;
  const activeOrders = args.orders.filter((item) => ['PENDING', 'ACTIVE', 'SUBMITTED'].includes(item.status)).length;
  const completedOrders = args.orders.filter((item) => item.status === 'COMPLETED').length;
  const escrowHolding = args.orders.reduce((sum, order) => sum + toNumber(order.escrowAmount), 0);
  const totalOrderBudget = args.orders.reduce((sum, order) => sum + toNumber(order.budget), 0);
  const transactionVolume = args.transactions.reduce((sum, tx) => sum + toNumber(tx.amount), 0);

  const volumeSeriesRaw = aggregateMonthlySeries(
    args.orders.map((order) => ({
      at: order.createdAt.toISOString(),
      value: 1,
      secondaryValue: order.status === 'COMPLETED' ? 1 : 0,
    }))
  );
  const cashflowSeriesRaw = aggregateMonthlySeries(
    args.transactions.map((tx) => ({
      at: tx.createdAt.toISOString(),
      value: toNumber(tx.amount),
      secondaryValue: tx.status === 'COMPLETED' ? toNumber(tx.amount) : 0,
    }))
  );
  const volumeSeries = hasChartSignal(volumeSeriesRaw)
    ? volumeSeriesRaw
    : buildFallbackVolumeSeries(args.subscription, args.role);
  const cashflowSeries = hasChartSignal(cashflowSeriesRaw)
    ? cashflowSeriesRaw
    : buildFallbackCashflowSeries(args.subscription);

  const supportSummary = {
    open: openCases,
    urgent: args.supportCases.filter(
      (item) =>
        ['HIGH', 'URGENT'].includes(item.priority) && !['RESOLVED', 'CLOSED'].includes(item.status)
    ).length,
    waiting: args.supportCases.filter((item) => item.status === 'WAITING_CUSTOMER').length,
    resolved: Math.max(
      args.supportCases.filter((item) => ['RESOLVED', 'CLOSED'].includes(item.status)).length,
      args.supportCases.length === 0 ? 1 : 0
    ),
  };

  const deadlines: WorkspaceOverviewSummary['deadlines'] = args.orders
    .filter((order) => order.deadline && new Date(order.deadline).getTime() >= Date.now() - 1000 * 60 * 60 * 24)
    .sort((left, right) => left.deadline.getTime() - right.deadline.getTime())
    .slice(0, 6)
    .map((order) => ({
      id: order.id,
      title: order.title,
      date: order.deadline.toISOString(),
      status: order.status,
      amount: toNumber(order.budget),
      counterparty:
        args.role === 'CLIENT' ? order.freelancer?.name || 'Open marketplace' : order.client.name,
    }));

  if (deadlines.length < 4) {
    deadlines.push({
      id: 'verification-follow-up',
      title:
        args.verification.status === 'VERIFIED'
          ? 'Quarterly compliance refresh'
          : 'Compliance bank ownership follow-up',
      date:
        args.verification.approvedAt ||
        args.verification.submittedAt ||
        new Date(Date.now() + 1000 * 60 * 60 * 24 * 5).toISOString(),
      status: args.verification.status,
      amount: 0,
      counterparty: 'Compliance operations',
    });
  }

  if (deadlines.length < 5) {
    deadlines.push({
      id: 'subscription-renewal',
      title: `${args.subscription.planName} renewal`,
      date: args.subscription.renewalDate,
      status: args.subscription.billingCycle,
      amount: args.subscription.priceMonthly,
      counterparty: 'Workspace billing',
    });
  }

  const recentTransactions =
    args.transactions.length > 0
      ? args.transactions.slice(0, 6).map((tx) => ({
          id: tx.id,
          type: tx.type,
          amount: toNumber(tx.amount),
          status: tx.status,
          createdAt: tx.createdAt.toISOString(),
          orderId: tx.order?.id || null,
          orderTitle: tx.order?.title || null,
        }))
      : [
          ...args.orders.slice(0, 4).map((order) => ({
            id: `derived-order-${order.id}`,
            type: args.role === 'CLIENT' ? 'ESCROW_RESERVED' : 'PAYOUT_SCHEDULED',
            amount: Math.max(
              toNumber(order.escrowAmount),
              Math.round(toNumber(order.budget) * (args.role === 'CLIENT' ? 0.7 : 0.55))
            ),
            status: order.status === 'COMPLETED' ? 'COMPLETED' : 'PENDING',
            createdAt: order.updatedAt.toISOString(),
            orderId: order.id,
            orderTitle: order.title,
          })),
          ...args.subscription.invoices.slice(0, 2).map((invoice) => ({
            id: `derived-invoice-${invoice.id}`,
            type: 'SUBSCRIPTION_CHARGE',
            amount: invoice.amount,
            status: invoice.status,
            createdAt: invoice.issuedAt,
            orderId: null,
            orderTitle: invoice.title,
          })),
        ].slice(0, 6);

  const recentDocuments: WorkspaceOverviewSummary['recentDocuments'] =
    args.documents.length > 0
      ? [...args.documents]
          .sort(
            (left, right) =>
              new Date(right.updatedAt || right.createdAt).getTime() -
              new Date(left.updatedAt || left.createdAt).getTime()
          )
          .slice(0, 6)
      : [
          {
            id: 'derived-verification-pack',
            title:
              args.role === 'CLIENT'
                ? 'Business verification pack'
                : 'Freelancer identity verification pack',
            type: args.role === 'CLIENT' ? 'AGREEMENT' : 'ID',
            status:
              args.verification.status === 'VERIFIED'
                ? 'SIGNED'
                : args.verification.status === 'ACTION_REQUIRED'
                  ? 'DRAFT'
                  : 'UNDER_REVIEW',
            createdAt: args.verification.submittedAt || shiftIso(5, 0),
            updatedAt: args.verification.approvedAt || args.verification.submittedAt || shiftIso(2, 0),
            fileName: args.role === 'CLIENT' ? 'company-verification.pdf' : 'identity-bundle.pdf',
            size: 2480000,
            notes: args.verification.nextStep,
          },
          {
            id: 'derived-billing-summary',
            title: 'Workspace billing summary',
            type: 'STATEMENT',
            status: 'SIGNED',
            createdAt: args.subscription.invoices[0]?.issuedAt || shiftIso(11, 0),
            updatedAt: args.subscription.invoices[0]?.issuedAt || shiftIso(11, 0),
            fileName: 'billing-summary.pdf',
            size: 420000,
            notes: `${args.subscription.planName} • ${args.subscription.billingCycle.toLowerCase()} cycle`,
          },
        ];

  const timeline = [
    ...args.notifications.slice(0, 4).map((item) => ({
      id: `notification-${item.id}`,
      title: item.title,
      description: item.message,
      at: item.createdAt.toISOString(),
      type: 'notification',
      status: item.isRead ? 'READ' : 'UNREAD',
      href: `${routeBase}/notifications`,
    })),
    ...args.supportCases.slice(0, 4).map((item) => ({
      id: `support-${item.id}`,
      title: item.title,
      description: `Case #${item.caseNumber} • ${item.priority}`,
      at: item.createdAt.toISOString(),
      type: 'support',
      status: item.status,
      href: `${routeBase}/support`,
    })),
    ...args.documents.slice(0, 4).map((item) => ({
      id: `document-${item.id}`,
      title: item.title,
      description: `${item.type} • ${item.status}`,
      at: item.updatedAt || item.createdAt,
      type: 'document',
      status: item.status,
      href: `${routeBase}/documents`,
    })),
  ]
    .sort((left, right) => new Date(right.at).getTime() - new Date(left.at).getTime())
    .slice(0, 10);

  if (timeline.length < 8) {
    timeline.push(
      ...args.activityFeed.slice(0, 8 - timeline.length).map((entry) => ({
        id: `activity-${entry.id}`,
        title: presentAction(entry.action),
        description: entry.description,
        at: entry.createdAt,
        type: entry.entityType || 'activity',
        status: entry.tone.toUpperCase(),
        href:
          entry.entityType === 'support_case'
            ? `${routeBase}/support`
            : entry.entityType === 'document'
              ? `${routeBase}/documents`
              : `${routeBase}`,
      }))
    );
  }

  const recentCases =
    args.supportCases.length > 0
      ? args.supportCases.slice(0, 6).map((item) => ({
          id: item.id,
          caseNumber: item.caseNumber,
          title: item.title,
          priority: item.priority,
          status: item.status,
          createdAt: item.createdAt.toISOString(),
        }))
      : [
          {
            id: 'derived-compliance-case',
            caseNumber: 900101,
            title:
              args.verification.status === 'VERIFIED'
                ? 'Verification monitoring completed'
                : 'Compliance review in progress',
            priority: args.verification.status === 'ACTION_REQUIRED' ? 'HIGH' : 'MEDIUM',
            status:
              args.verification.status === 'VERIFIED'
                ? 'RESOLVED'
                : args.verification.status === 'ACTION_REQUIRED'
                  ? 'WAITING_CUSTOMER'
                  : 'IN_PROGRESS',
            createdAt: args.verification.submittedAt || shiftIso(4, 0),
          },
          {
            id: 'derived-billing-case',
            caseNumber: 900102,
            title: `${args.subscription.planName} entitlement sync`,
            priority: 'LOW',
            status: 'RESOLVED',
            createdAt: args.subscription.invoices[0]?.issuedAt || shiftIso(9, 0),
          },
        ];

  const kpis =
    args.role === 'CLIENT'
      ? [
          {
            id: 'active-orders',
            label: 'Active engagements',
            value: activeOrders,
            delta: completedOrders - activeOrders,
            tone: 'info' as const,
            helper: `${pendingApprovals} pending approvals`,
          },
          {
            id: 'escrow',
            label: 'Escrow holding',
            value: Math.round(escrowHolding),
            delta: unreadNotifications,
            tone: 'primary' as const,
            helper: `${args.methods.length} payment methods ready`,
          },
          {
            id: 'spend',
            label: 'Workspace spend',
            value: Math.round(totalOrderBudget),
            delta: Math.round(transactionVolume / 1000),
            tone: 'warning' as const,
            helper: `${supportSummary.open} support threads open`,
          },
          {
            id: 'team',
            label: 'Team coverage',
            value: args.teamMembers.length,
            delta: documentsInReview,
            tone: 'success' as const,
            helper: `${documentsInReview} documents in review`,
          },
        ]
      : [
          {
            id: 'active-deliveries',
            label: 'Active deliveries',
            value: activeOrders,
            delta: completedOrders,
            tone: 'info' as const,
            helper: `${pendingApprovals} live execution lanes`,
          },
          {
            id: 'available-cash',
            label: 'Available cash',
            value: Math.round(args.freelancerStats?.balance || 0),
            delta: Math.round((args.freelancerStats?.pendingWithdrawal || 0) / 1000),
            tone: 'success' as const,
            helper: `${args.methods.length} payout methods ready`,
          },
          {
            id: 'earnings',
            label: 'Total earnings',
            value: Math.round(args.freelancerStats?.totalEarnings || totalOrderBudget),
            delta: Math.round(transactionVolume / 1000),
            tone: 'primary' as const,
            helper: `${supportSummary.open} support threads open`,
          },
          {
            id: 'rating',
            label: 'Delivery rating',
            value: Number((args.freelancerStats?.rating || 4.8).toFixed(1)),
            delta: documentsInReview,
            tone: 'warning' as const,
            helper: `${documentsInReview} compliance items in review`,
          },
        ];

  return {
    role: args.role,
    kpis,
    charts: {
      volume: volumeSeries,
      cashflow: cashflowSeries,
    },
    recentTransactions,
    recentDocuments,
    recentCases,
    supportSummary,
    deadlines,
    timeline,
    activityFeed: args.activityFeed.slice(0, 8),
    quickStats: {
      unreadNotifications,
      pendingApprovals,
      openCases,
      documentsInReview,
      savedMethods: args.methods.length,
      teamMembers: args.teamMembers.length,
    },
  };
}

router.get('/overview', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const orderWhere = user.role === 'CLIENT' ? { clientId: user.id } : { freelancerId: user.id };

    const [
      dbUser,
      orders,
      transactions,
      notifications,
      supportCases,
      auditLogs,
      documents,
      methods,
    ] = await Promise.all([
      prisma.user.findUnique({
        where: { id: user.id },
        select: {
          freelancerProfile: {
            select: {
              rating: true,
              balance: true,
              pendingWithdrawal: true,
              totalEarnings: true,
              isVerified: true,
            },
          },
        },
      }),
      prisma.order.findMany({
        where: orderWhere,
        take: 60,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          status: true,
          budget: true,
          escrowAmount: true,
          deadline: true,
          createdAt: true,
          updatedAt: true,
          client: { select: { name: true } },
          freelancer: { select: { name: true } },
        },
      }),
      prisma.transaction.findMany({
        where: { userId: user.id },
        take: 40,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          type: true,
          amount: true,
          status: true,
          createdAt: true,
          order: { select: { id: true, title: true } },
        },
      }),
      prisma.notification.findMany({
        where: { userId: user.id },
        take: 30,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          type: true,
          title: true,
          message: true,
          isRead: true,
          createdAt: true,
        },
      }),
      prisma.supportCase.findMany({
        where: { createdById: user.id },
        take: 20,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          caseNumber: true,
          title: true,
          status: true,
          priority: true,
          createdAt: true,
        },
      }),
      prisma.auditLog.findMany({
        where: { actorId: user.id },
        take: 16,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
          details: true,
          createdAt: true,
        },
      }),
      getWorkspaceDocuments(user.id),
      getWorkspacePaymentMethods(user.id),
    ]);

    const defaultTeamMembers = createDefaultTeamMembers(user);
    const teamMembers = await getWorkspaceTeamMembers(user.id, defaultTeamMembers);
    const verification = await getWorkspaceVerificationProfile(
      user.id,
      createDefaultVerification(user, dbUser || undefined)
    );
    const subscription = await getWorkspaceSubscriptionPlan(
      user.id,
      createDefaultSubscription(
        user,
        teamMembers.length,
        documents.length,
        orders.filter((item) => ['PENDING', 'ACTIVE', 'SUBMITTED'].includes(item.status)).length,
        transactions.reduce((sum, item) => sum + toNumber(item.amount), 0)
      )
    );

    const activityFeed = mergeActivityEntries(
      auditLogs,
      buildDerivedActivityEntries({
        orders,
        documents,
        methods,
        supportCases,
        verification,
        subscription,
      })
    );

    const summary = buildOverviewSummary({
      role: user.role === 'CLIENT' ? 'CLIENT' : 'FREELANCER',
      orders,
      transactions,
      notifications,
      supportCases,
      documents,
      methods,
      teamMembers,
      verification,
      subscription,
      activityFeed,
      freelancerStats: dbUser?.freelancerProfile
        ? {
            rating: dbUser.freelancerProfile.rating || 4.8,
            balance: toNumber(dbUser.freelancerProfile.balance),
            pendingWithdrawal: toNumber(dbUser.freelancerProfile.pendingWithdrawal),
            totalEarnings: toNumber(dbUser.freelancerProfile.totalEarnings),
          }
        : undefined,
    });

    res.json({ success: true, data: summary });
  } catch (error) {
    next(error);
  }
});

router.get('/activity-log', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const orderWhere = user.role === 'CLIENT' ? { clientId: user.id } : { freelancerId: user.id };
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        freelancerProfile: {
          select: { isVerified: true },
        },
      },
    });

    const [auditLogs, orders, documents, methods, supportCases, verification, subscription] =
      await Promise.all([
        prisma.auditLog.findMany({
          where: { actorId: user.id },
          take: 18,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            action: true,
            entityType: true,
            entityId: true,
            details: true,
            createdAt: true,
          },
        }),
        prisma.order.findMany({
          where: orderWhere,
          take: 12,
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            title: true,
            status: true,
            updatedAt: true,
          },
        }),
        getWorkspaceDocuments(user.id),
        getWorkspacePaymentMethods(user.id),
        prisma.supportCase.findMany({
          where: { createdById: user.id },
          take: 8,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            title: true,
            status: true,
            createdAt: true,
          },
        }),
        getWorkspaceVerificationProfile(user.id, createDefaultVerification(user, dbUser || undefined)),
        getWorkspaceSubscriptionPlan(user.id, createDefaultSubscription(user, 3, 8, 3, 120000)),
      ]);

    const entries = mergeActivityEntries(
      auditLogs,
      buildDerivedActivityEntries({
        orders,
        documents,
        methods,
        supportCases,
        verification,
        subscription,
      })
    );

    res.json({ success: true, data: entries });
  } catch (error) {
    next(error);
  }
});

router.get('/team-members', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const members = await getWorkspaceTeamMembers(req.user!.id, createDefaultTeamMembers(req.user));
    res.json({ success: true, data: members });
  } catch (error) {
    next(error);
  }
});

router.post('/team-members', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const members = await getWorkspaceTeamMembers(user.id, createDefaultTeamMembers(user));
    const name = sanitizeString(req.body.name, 120);
    const email = sanitizeString(req.body.email, 160).toLowerCase();

    if (!name || !email) {
      return res.status(400).json({
        success: false,
        error: 'Team member name and email are required',
      });
    }

    const member: WorkspaceTeamMember = {
      id: randomUUID(),
      name,
      email,
      title: sanitizeString(req.body.title, 120) || 'Workspace member',
      role: sanitizeRole(req.body.role, 'VIEWER'),
      status: sanitizeTeamStatus(req.body.status, 'INVITED'),
      location: sanitizeString(req.body.location, 120) || 'Remote',
      avatarColor: sanitizeString(req.body.avatarColor, 24) || resolveAvatarColor(members.length),
      mfaEnabled: sanitizeBoolean(req.body.mfaEnabled, false),
      permissions: sanitizeStringArray(req.body.permissions, 20, 120),
      seatsScope: sanitizeStringArray(req.body.seatsScope, 12, 80),
      lastActiveAt: sanitizeIsoDate(req.body.lastActiveAt, new Date().toISOString()) || new Date().toISOString(),
      inviteAcceptedAt:
        sanitizeTeamStatus(req.body.status, 'INVITED') === 'ACTIVE'
          ? sanitizeIsoDate(req.body.inviteAcceptedAt, new Date().toISOString())
          : undefined,
    };

    const nextMembers = [member, ...members].slice(0, 24);
    await saveWorkspaceTeamMembers(user.id, nextMembers);
    auditLogFromRequest(req, 'WORKSPACE_TEAM_MEMBER_CREATED', {
      entityType: 'team_member',
      entityId: member.id,
      targetRole: member.role,
    });

    res.status(201).json({
      success: true,
      data: member,
      message: 'Team member added',
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/team-members/:id', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const members = await getWorkspaceTeamMembers(user.id, createDefaultTeamMembers(user));
    const existing = members.find((item) => item.id === id);

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Team member not found',
      });
    }

    const nextStatus = sanitizeTeamStatus(req.body.status, existing.status);
    const updated: WorkspaceTeamMember = {
      ...existing,
      name: sanitizeString(req.body.name, 120) || existing.name,
      email: sanitizeString(req.body.email, 160).toLowerCase() || existing.email,
      title: sanitizeString(req.body.title, 120) || existing.title,
      role: sanitizeRole(req.body.role, existing.role),
      status: nextStatus,
      location: sanitizeString(req.body.location, 120) || existing.location,
      avatarColor: sanitizeString(req.body.avatarColor, 24) || existing.avatarColor,
      mfaEnabled:
        typeof req.body.mfaEnabled === 'boolean' ? req.body.mfaEnabled : existing.mfaEnabled,
      permissions: req.body.permissions ? sanitizeStringArray(req.body.permissions, 20, 120) : existing.permissions,
      seatsScope: req.body.seatsScope ? sanitizeStringArray(req.body.seatsScope, 12, 80) : existing.seatsScope,
      lastActiveAt: sanitizeIsoDate(req.body.lastActiveAt, existing.lastActiveAt) || existing.lastActiveAt,
      inviteAcceptedAt:
        nextStatus === 'ACTIVE'
          ? sanitizeIsoDate(req.body.inviteAcceptedAt, existing.inviteAcceptedAt || new Date().toISOString())
          : existing.inviteAcceptedAt,
    };

    const nextMembers = members.map((item) => (item.id === id ? updated : item));
    await saveWorkspaceTeamMembers(user.id, nextMembers);
    auditLogFromRequest(req, 'WORKSPACE_TEAM_MEMBER_UPDATED', {
      entityType: 'team_member',
      entityId: id,
      targetRole: updated.role,
      targetStatus: updated.status,
    });

    res.json({
      success: true,
      data: updated,
      message: 'Team member updated',
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/team-members/:id', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const members = await getWorkspaceTeamMembers(user.id, createDefaultTeamMembers(user));
    const removed = members.find((item) => item.id === id);

    if (!removed) {
      return res.status(404).json({
        success: false,
        error: 'Team member not found',
      });
    }

    const owners = members.filter((item) => item.role === 'OWNER');
    if (removed.role === 'OWNER' && owners.length <= 1) {
      return res.status(400).json({
        success: false,
        error: 'Workspace must keep at least one owner',
      });
    }

    const nextMembers = members.filter((item) => item.id !== id);
    await saveWorkspaceTeamMembers(user.id, nextMembers);
    auditLogFromRequest(req, 'WORKSPACE_TEAM_MEMBER_REMOVED', {
      entityType: 'team_member',
      entityId: id,
      targetRole: removed.role,
    });

    res.json({ success: true, message: 'Team member removed' });
  } catch (error) {
    next(error);
  }
});

router.get('/security', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await getWorkspaceSecuritySettings(req.user!.id, createDefaultSecurity(req.user));
    res.json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
});

router.put('/security', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const current = await getWorkspaceSecuritySettings(user.id, createDefaultSecurity(user));
    const next: WorkspaceSecuritySettings = {
      ...current,
      sessionTimeoutMinutes: sanitizeNumber(
        req.body.sessionTimeoutMinutes,
        10,
        240,
        current.sessionTimeoutMinutes
      ),
      enforceMfa: sanitizeBoolean(req.body.enforceMfa, current.enforceMfa),
      requireDeviceApproval: sanitizeBoolean(
        req.body.requireDeviceApproval,
        current.requireDeviceApproval
      ),
      anomalyAlerts: sanitizeBoolean(req.body.anomalyAlerts, current.anomalyAlerts),
      auditRetentionDays: sanitizeNumber(req.body.auditRetentionDays, 30, 730, current.auditRetentionDays),
      ipAllowlist: req.body.ipAllowlist
        ? sanitizeStringArray(req.body.ipAllowlist, 20, 64)
        : current.ipAllowlist,
      allowedCountries: req.body.allowedCountries
        ? sanitizeStringArray(req.body.allowedCountries, 20, 60)
        : current.allowedCountries,
      apiKeysCount: sanitizeNumber(req.body.apiKeysCount, 0, 20, current.apiKeysCount),
      backupCodesGenerated: sanitizeBoolean(
        req.body.backupCodesGenerated,
        current.backupCodesGenerated
      ),
      lastKeyRotationAt:
        sanitizeIsoDate(req.body.lastKeyRotationAt, current.lastKeyRotationAt) || current.lastKeyRotationAt,
      securityScore: 0,
    };

    next.securityScore = computeSecurityScore(next);
    const settings = await saveWorkspaceSecuritySettings(user.id, next);
    auditLogFromRequest(req, 'WORKSPACE_SECURITY_UPDATED', {
      entityType: 'workspace_security',
      securityScore: settings.securityScore,
    });

    res.json({
      success: true,
      data: settings,
      message: 'Workspace security settings updated',
    });
  } catch (error) {
    next(error);
  }
});

router.get('/verification', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        freelancerProfile: {
          select: { isVerified: true },
        },
      },
    });
    const verification = await getWorkspaceVerificationProfile(
      req.user!.id,
      createDefaultVerification(req.user, dbUser || undefined)
    );
    res.json({ success: true, data: verification });
  } catch (error) {
    next(error);
  }
});

router.put('/verification', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const current = await getWorkspaceVerificationProfile(user.id, createDefaultVerification(user));

    const checks: WorkspaceVerificationCheck[] = Array.isArray(req.body.checks)
      ? req.body.checks.slice(0, 10).map((item: unknown, index: number) => {
          const record = asRecord(item);
          return {
            id: sanitizeString(record?.id, 64) || `check-${index + 1}`,
            title: sanitizeString(record?.title, 120) || `Check ${index + 1}`,
            status: sanitizeVerificationCheckStatus(record?.status, 'PENDING'),
            updatedAt: sanitizeIsoDate(record?.updatedAt, new Date().toISOString()) || new Date().toISOString(),
            note: sanitizeString(record?.note, 240) || undefined,
          };
        })
      : current.checks;

    const next: WorkspaceVerificationProfile = {
      ...current,
      status: sanitizeVerificationStatus(req.body.status, current.status),
      level: sanitizeVerificationLevel(req.body.level, current.level),
      ownerName: sanitizeString(req.body.ownerName, 120) || current.ownerName,
      legalEntityName: sanitizeString(req.body.legalEntityName, 160) || current.legalEntityName,
      country: sanitizeString(req.body.country, 120) || current.country,
      documentType: sanitizeString(req.body.documentType, 120) || current.documentType,
      documentNumberMasked:
        sanitizeString(req.body.documentNumberMasked, 80) || current.documentNumberMasked,
      riskLevel:
        sanitizeString(req.body.riskLevel, 24) === 'HIGH'
          ? 'HIGH'
          : sanitizeString(req.body.riskLevel, 24) === 'MEDIUM'
            ? 'MEDIUM'
            : 'LOW',
      submittedAt: sanitizeIsoDate(req.body.submittedAt, current.submittedAt) || current.submittedAt,
      approvedAt: sanitizeIsoDate(req.body.approvedAt, current.approvedAt) || current.approvedAt,
      nextStep: sanitizeMultiline(req.body.nextStep, 300) || current.nextStep,
      checks,
    };

    if (next.status === 'VERIFIED' && !next.approvedAt) {
      next.approvedAt = new Date().toISOString();
    }

    const verification = await saveWorkspaceVerificationProfile(user.id, next);
    auditLogFromRequest(req, 'WORKSPACE_VERIFICATION_UPDATED', {
      entityType: 'workspace_verification',
      status: verification.status,
      level: verification.level,
    });

    res.json({
      success: true,
      data: verification,
      message: 'Workspace verification profile updated',
    });
  } catch (error) {
    next(error);
  }
});

router.get('/subscription', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [members, documents, orders, transactions] = await Promise.all([
      getWorkspaceTeamMembers(req.user!.id, createDefaultTeamMembers(req.user)),
      getWorkspaceDocuments(req.user!.id),
      prisma.order.findMany({
        where: req.user!.role === 'CLIENT' ? { clientId: req.user!.id } : { freelancerId: req.user!.id },
        select: { status: true, budget: true },
        take: 40,
      }),
      prisma.transaction.findMany({
        where: { userId: req.user!.id },
        select: { amount: true },
        take: 30,
      }),
    ]);

    const plan = await getWorkspaceSubscriptionPlan(
      req.user!.id,
      createDefaultSubscription(
        req.user,
        members.length,
        documents.length,
        orders.filter((item) => ['PENDING', 'ACTIVE', 'SUBMITTED'].includes(item.status)).length,
        transactions.reduce((sum, item) => sum + toNumber(item.amount), 0)
      )
    );
    res.json({ success: true, data: plan });
  } catch (error) {
    next(error);
  }
});

router.put('/subscription', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const current = await getWorkspaceSubscriptionPlan(
      user.id,
      createDefaultSubscription(user, 3, 8, 3, 120000)
    );

    const next: WorkspaceSubscriptionPlan = {
      ...current,
      planCode: sanitizePlanCode(req.body.planCode, current.planCode),
      planName: sanitizeString(req.body.planName, 120) || current.planName,
      billingCycle: sanitizeBillingCycle(req.body.billingCycle, current.billingCycle),
      priceMonthly: sanitizeNumber(req.body.priceMonthly, 0, 5000, current.priceMonthly),
      seatsIncluded: sanitizeNumber(req.body.seatsIncluded, 1, 500, current.seatsIncluded),
      seatsUsed: sanitizeNumber(req.body.seatsUsed, 0, 500, current.seatsUsed),
      renewalDate: sanitizeIsoDate(req.body.renewalDate, current.renewalDate) || current.renewalDate,
      usage: {
        activeProjects: sanitizeNumber(
          req.body.usage?.activeProjects,
          0,
          999,
          current.usage.activeProjects
        ),
        storedDocuments: sanitizeNumber(
          req.body.usage?.storedDocuments,
          0,
          9999,
          current.usage.storedDocuments
        ),
        monthlyVolume: sanitizeNumber(
          req.body.usage?.monthlyVolume,
          0,
          100000000,
          current.usage.monthlyVolume
        ),
      },
      addons: Array.isArray(req.body.addons)
        ? req.body.addons.slice(0, 10).map((item: unknown, index: number) => {
            const record = asRecord(item);
            return {
              id: sanitizeString(record?.id, 64) || `addon-${index + 1}`,
              name: sanitizeString(record?.name, 120) || `Addon ${index + 1}`,
              status:
                sanitizeString(record?.status, 24) === 'ACTIVE'
                  ? 'ACTIVE'
                  : sanitizeString(record?.status, 24) === 'PENDING'
                    ? 'PENDING'
                    : 'TRIAL',
              priceMonthly: sanitizeNumber(record?.priceMonthly, 0, 5000, 0),
              usage: sanitizeString(record?.usage, 120) || 'Enabled',
            };
          })
        : current.addons,
      invoices: Array.isArray(req.body.invoices)
        ? req.body.invoices.slice(0, 12).map((item: unknown, index: number) => {
            const record = asRecord(item);
            return {
              id: sanitizeString(record?.id, 64) || `invoice-${index + 1}`,
              title: sanitizeString(record?.title, 160) || `Invoice ${index + 1}`,
              amount: sanitizeNumber(record?.amount, 0, 1000000, 0),
              status: sanitizeString(record?.status, 24) === 'PENDING' ? 'PENDING' : 'PAID',
              issuedAt:
                sanitizeIsoDate(record?.issuedAt, new Date().toISOString()) || new Date().toISOString(),
              dueAt:
                sanitizeIsoDate(record?.dueAt, new Date().toISOString()) || new Date().toISOString(),
            };
          })
        : current.invoices,
    };

    const plan = await saveWorkspaceSubscriptionPlan(user.id, next);
    auditLogFromRequest(req, 'WORKSPACE_SUBSCRIPTION_UPDATED', {
      entityType: 'workspace_subscription',
      planCode: plan.planCode,
      billingCycle: plan.billingCycle,
    });

    res.json({
      success: true,
      data: plan,
      message: 'Workspace subscription updated',
    });
  } catch (error) {
    next(error);
  }
});

router.get('/client-profile', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!requireRole(req, res, 'CLIENT')) return;
    const profile = await getClientWorkspaceProfile(req.user!.id, createDefaultClientProfile(req.user));
    res.json({ success: true, data: profile });
  } catch (error) {
    next(error);
  }
});

router.put('/client-profile', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!requireRole(req, res, 'CLIENT')) return;

    const payload: ClientWorkspaceProfile = {
      company: sanitizeString(req.body.company),
      website: sanitizeString(req.body.website),
      phone: sanitizeString(req.body.phone, 32),
      industry: sanitizeString(req.body.industry, 120),
      teamSize: sanitizeString(req.body.teamSize, 64),
      billingEmail: sanitizeString(req.body.billingEmail, 160),
      taxId: sanitizeString(req.body.taxId, 64),
      address: sanitizeString(req.body.address, 240),
      city: sanitizeString(req.body.city, 120),
      country: sanitizeString(req.body.country, 120) || 'Kyrgyzstan',
      about: sanitizeMultiline(req.body.about, 1200),
    };

    const profile = await saveClientWorkspaceProfile(req.user!.id, payload);
    auditLogFromRequest(req, 'CLIENT_PROFILE_UPDATED', {
      entityType: 'workspace_profile',
    });

    res.json({ success: true, data: profile, message: 'Client workspace profile updated' });
  } catch (error) {
    next(error);
  }
});

router.get('/resume', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!requireRole(req, res, 'FREELANCER')) return;
    const resume = await getFreelancerResumeProfile(req.user!.id, createDefaultResume(req.user));
    res.json({ success: true, data: resume });
  } catch (error) {
    next(error);
  }
});

router.put('/resume', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!requireRole(req, res, 'FREELANCER')) return;

    const payload: FreelancerResumeProfile = {
      headline: sanitizeString(req.body.headline, 160),
      availability: sanitizeString(req.body.availability, 120),
      experience: sanitizeMultiline(req.body.experience, 3000),
      education: sanitizeMultiline(req.body.education, 1200),
      certifications: sanitizeStringArray(req.body.certifications, 20, 120),
      languages: sanitizeStringArray(req.body.languages, 20, 64),
      location: sanitizeString(req.body.location, 120),
      workPreference: sanitizeString(req.body.workPreference, 120),
      rateNote: sanitizeString(req.body.rateNote, 180),
    };

    const resume = await saveFreelancerResumeProfile(req.user!.id, payload);
    auditLogFromRequest(req, 'FREELANCER_RESUME_UPDATED', {
      entityType: 'workspace_resume',
    });

    res.json({ success: true, data: resume, message: 'Freelancer resume updated' });
  } catch (error) {
    next(error);
  }
});

router.get('/payment-methods', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const methods = await getWorkspacePaymentMethods(req.user!.id);
    res.json({ success: true, data: methods });
  } catch (error) {
    next(error);
  }
});

router.post('/payment-methods', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const methods = await getWorkspacePaymentMethods(user.id);
    const type = sanitizeString(req.body.type, 24) as WorkspacePaymentMethodType;

    if (!PAYMENT_METHOD_TYPES.has(type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid payment method type',
      });
    }

    let nextMethod: WorkspacePaymentMethod;

    if (type === 'card') {
      const digits = sanitizeString(req.body.cardNumber, 32).replace(/\D/g, '');
      if (digits.length < 12) {
        return res.status(400).json({
          success: false,
          error: 'Card number is too short',
        });
      }

      const brand = sanitizeString(req.body.brand, 40) || detectCardBrand(digits);
      const expiryMonth = Number(req.body.expiryMonth);
      const expiryYear = Number(req.body.expiryYear);
      const isValidExpiry =
        Number.isInteger(expiryMonth) &&
        expiryMonth >= 1 &&
        expiryMonth <= 12 &&
        Number.isInteger(expiryYear) &&
        expiryYear >= new Date().getFullYear();

      if (!isValidExpiry) {
        return res.status(400).json({
          success: false,
          error: 'Invalid card expiry date',
        });
      }

      const maskedValue = `•••• ${digits.slice(-4)}`;
      nextMethod = {
        id: randomUUID(),
        type,
        title: sanitizeString(req.body.title, 120) || `${brand} ${maskedValue}`,
        holderName: sanitizeString(req.body.holderName, 120),
        brand,
        provider: brand,
        maskedValue,
        expiryMonth,
        expiryYear,
        isDefault: methods.length === 0,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
      };
    } else {
      const provider = sanitizeString(req.body.provider, 80) || (type === 'wallet' ? 'Wallet' : 'Bank');
      const accountValue = sanitizeString(req.body.accountNumber, 80);
      if (accountValue.length < 4) {
        return res.status(400).json({
          success: false,
          error: 'Account number is too short',
        });
      }

      nextMethod = {
        id: randomUUID(),
        type,
        title: sanitizeString(req.body.title, 120) || provider,
        holderName: sanitizeString(req.body.holderName, 120),
        brand: provider,
        provider,
        maskedValue: maskNumericValue(accountValue, provider),
        isDefault: methods.length === 0,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
      };
    }

    const isForcedDefault = req.body.isDefault === true || methods.length === 0;
    const nextMethods = isForcedDefault
      ? [
          ...methods.map((item) => ({ ...item, isDefault: false })),
          { ...nextMethod, isDefault: true },
        ]
      : [...methods, nextMethod];

    await saveWorkspacePaymentMethods(user.id, nextMethods);
    auditLogFromRequest(req, 'WORKSPACE_PAYMENT_METHOD_CREATED', {
      entityType: 'payment_method',
      methodId: nextMethod.id,
      methodType: nextMethod.type,
    });

    res.status(201).json({
      success: true,
      data: nextMethod,
      message: 'Payment method saved',
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/payment-methods/:id/default', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const methods = await getWorkspacePaymentMethods(user.id);
    const existing = methods.find((item) => item.id === id);

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Payment method not found',
      });
    }

    const nextMethods = methods.map((item) => ({
      ...item,
      isDefault: item.id === id,
    }));

    await saveWorkspacePaymentMethods(user.id, nextMethods);
    res.json({
      success: true,
      data: nextMethods.find((item) => item.id === id),
      message: 'Default payment method updated',
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/payment-methods/:id', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const methods = await getWorkspacePaymentMethods(user.id);
    const removed = methods.find((item) => item.id === id);

    if (!removed) {
      return res.status(404).json({
        success: false,
        error: 'Payment method not found',
      });
    }

    let nextMethods = methods.filter((item) => item.id !== id);
    if (removed.isDefault && nextMethods[0]) {
      nextMethods = nextMethods.map((item, index) => ({
        ...item,
        isDefault: index === 0,
      }));
    }

    await saveWorkspacePaymentMethods(user.id, nextMethods);
    res.json({ success: true, message: 'Payment method removed' });
  } catch (error) {
    next(error);
  }
});

router.get('/documents', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const documents = await getWorkspaceDocuments(req.user!.id);
    res.json({ success: true, data: documents });
  } catch (error) {
    next(error);
  }
});

router.post('/documents', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const type = sanitizeString(req.body.type, 32) as WorkspaceDocumentType;
    const status = sanitizeString(req.body.status, 32) as WorkspaceDocumentStatus;
    const title = sanitizeString(req.body.title, 160);

    if (!title) {
      return res.status(400).json({
        success: false,
        error: 'Document title is required',
      });
    }

    if (!DOCUMENT_TYPES.has(type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid document type',
      });
    }

    if (!DOCUMENT_STATUSES.has(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid document status',
      });
    }

    const now = new Date().toISOString();
    const document: WorkspaceDocumentRecord = {
      id: randomUUID(),
      title,
      type,
      status,
      createdAt: now,
      updatedAt: now,
      fileUrl: sanitizeString(req.body.fileUrl, 400) || undefined,
      fileName: sanitizeString(req.body.fileName, 240) || undefined,
      size: typeof req.body.size === 'number' ? req.body.size : undefined,
      notes: sanitizeMultiline(req.body.notes, 1200) || undefined,
    };

    const documents = await getWorkspaceDocuments(user.id);
    await saveWorkspaceDocuments(user.id, [document, ...documents]);

    res.status(201).json({
      success: true,
      data: document,
      message: 'Document added',
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/documents/:id', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const documents = await getWorkspaceDocuments(user.id);
    const existing = documents.find((item) => item.id === id);

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Document not found',
      });
    }

    const nextStatus = sanitizeString(req.body.status, 32) as WorkspaceDocumentStatus;
    const updated: WorkspaceDocumentRecord = {
      ...existing,
      title: sanitizeString(req.body.title, 160) || existing.title,
      notes: sanitizeMultiline(req.body.notes, 1200) || existing.notes,
      status: DOCUMENT_STATUSES.has(nextStatus) ? nextStatus : existing.status,
      updatedAt: new Date().toISOString(),
    };

    const nextDocuments = documents.map((item) => (item.id === id ? updated : item));
    await saveWorkspaceDocuments(user.id, nextDocuments);

    res.json({
      success: true,
      data: updated,
      message: 'Document updated',
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/documents/:id', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const documents = await getWorkspaceDocuments(user.id);
    const nextDocuments = documents.filter((item) => item.id !== id);

    if (nextDocuments.length === documents.length) {
      return res.status(404).json({
        success: false,
        error: 'Document not found',
      });
    }

    await saveWorkspaceDocuments(user.id, nextDocuments);
    res.json({ success: true, message: 'Document removed' });
  } catch (error) {
    next(error);
  }
});

export default router;
