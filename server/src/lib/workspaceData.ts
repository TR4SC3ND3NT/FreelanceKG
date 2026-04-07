import { prisma } from './prisma';

const CLIENT_PROFILE_PREFIX = 'workspace_client_profile:';
const FREELANCER_RESUME_PREFIX = 'workspace_freelancer_resume:';
const PAYMENT_METHODS_PREFIX = 'workspace_payment_methods:';
const DOCUMENTS_PREFIX = 'workspace_documents:';
const TEAM_MEMBERS_PREFIX = 'workspace_team_members:';
const SECURITY_SETTINGS_PREFIX = 'workspace_security_settings:';
const VERIFICATION_PROFILE_PREFIX = 'workspace_verification_profile:';
const SUBSCRIPTION_PLAN_PREFIX = 'workspace_subscription_plan:';

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

export interface WorkspacePaymentMethod {
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

export type WorkspaceDocumentType =
  | 'INVOICE'
  | 'AGREEMENT'
  | 'BRIEF'
  | 'REPORT'
  | 'ID'
  | 'PORTFOLIO'
  | 'STATEMENT';

export type WorkspaceDocumentStatus = 'DRAFT' | 'UNDER_REVIEW' | 'SIGNED' | 'ARCHIVED';

export interface WorkspaceDocumentRecord {
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

export type WorkspaceTeamMemberRole =
  | 'OWNER'
  | 'ADMIN'
  | 'FINANCE'
  | 'LEGAL'
  | 'OPERATIONS'
  | 'VIEWER';

export type WorkspaceTeamMemberStatus = 'ACTIVE' | 'INVITED' | 'SUSPENDED';

export interface WorkspaceTeamMember {
  id: string;
  name: string;
  email: string;
  title: string;
  role: WorkspaceTeamMemberRole;
  status: WorkspaceTeamMemberStatus;
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

export type WorkspaceVerificationStatus =
  | 'NOT_STARTED'
  | 'UNDER_REVIEW'
  | 'VERIFIED'
  | 'ACTION_REQUIRED';

export type WorkspaceVerificationLevel = 'BASIC' | 'BUSINESS' | 'ENTERPRISE';

export type WorkspaceVerificationCheckStatus =
  | 'PENDING'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REQUIRES_UPDATE';

export interface WorkspaceVerificationCheck {
  id: string;
  title: string;
  status: WorkspaceVerificationCheckStatus;
  updatedAt: string;
  note?: string;
}

export interface WorkspaceVerificationProfile {
  status: WorkspaceVerificationStatus;
  level: WorkspaceVerificationLevel;
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

export interface WorkspaceOverviewSummary {
  role: 'CLIENT' | 'FREELANCER';
  kpis: WorkspaceOverviewKpi[];
  charts: {
    volume: WorkspaceOverviewChartPoint[];
    cashflow: WorkspaceOverviewChartPoint[];
  };
  recentTransactions: WorkspaceOverviewTransaction[];
  recentDocuments: WorkspaceDocumentRecord[];
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

const DEFAULT_CLIENT_PROFILE: ClientWorkspaceProfile = {
  company: 'Atlas Commerce Group',
  website: 'https://atlasworkspace.local',
  phone: '+996 555 120 900',
  industry: 'Fintech operations',
  teamSize: '11-50',
  billingEmail: 'billing@atlasworkspace.local',
  taxId: 'KG-4021-7785',
  address: 'Erkindik Avenue 72',
  city: 'Bishkek',
  country: 'Kyrgyzstan',
  about:
    'Enterprise workspace for managing freelance procurement, escrow approvals, compliance documents, and vendor operations.',
};

const DEFAULT_FREELANCER_RESUME: FreelancerResumeProfile = {
  headline: 'Senior product designer and systems operator for SaaS teams',
  availability: 'Open for 1 retained project and short discovery sprints',
  experience:
    '7+ years shipping product systems, marketplace interfaces, and fintech operations dashboards for startup and enterprise teams.',
  education: 'BSc in Applied Informatics, AUCA',
  certifications: ['Google UX Design', 'Scrum Product Owner'],
  languages: ['English', 'Russian'],
  location: 'Bishkek',
  workPreference: 'Remote-first with async collaboration',
  rateNote: 'Preferred billing: milestone or monthly retainer depending on scope',
};

const DEFAULT_WORKSPACE_SECURITY: WorkspaceSecuritySettings = {
  sessionTimeoutMinutes: 45,
  enforceMfa: true,
  requireDeviceApproval: true,
  anomalyAlerts: true,
  auditRetentionDays: 180,
  ipAllowlist: ['127.0.0.1/32'],
  allowedCountries: ['Kyrgyzstan', 'Kazakhstan', 'Uzbekistan'],
  apiKeysCount: 2,
  backupCodesGenerated: true,
  lastKeyRotationAt: new Date().toISOString(),
  securityScore: 88,
};

const DEFAULT_WORKSPACE_VERIFICATION: WorkspaceVerificationProfile = {
  status: 'UNDER_REVIEW',
  level: 'BUSINESS',
  ownerName: '',
  legalEntityName: '',
  country: 'Kyrgyzstan',
  documentType: 'Business registration',
  documentNumberMasked: 'REG-••••-2451',
  riskLevel: 'LOW',
  submittedAt: new Date().toISOString(),
  approvedAt: undefined,
  nextStep: 'Compliance review is in progress. Final bank account verification will complete the process.',
  checks: [
    {
      id: 'identity',
      title: 'Identity verification',
      status: 'APPROVED',
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'business',
      title: 'Business documents',
      status: 'UNDER_REVIEW',
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'bank',
      title: 'Bank account ownership',
      status: 'PENDING',
      updatedAt: new Date().toISOString(),
    },
  ],
};

const DEFAULT_WORKSPACE_SUBSCRIPTION: WorkspaceSubscriptionPlan = {
  planCode: 'scale',
  planName: 'Scale Workspace',
  billingCycle: 'MONTHLY',
  priceMonthly: 149,
  seatsIncluded: 8,
  seatsUsed: 3,
  renewalDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 18).toISOString(),
  usage: {
    activeProjects: 4,
    storedDocuments: 18,
    monthlyVolume: 245000,
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
      id: 'advanced-compliance',
      name: 'Advanced compliance',
      status: 'TRIAL',
      priceMonthly: 29,
      usage: '7 days left',
    },
  ],
  invoices: [
    {
      id: 'inv-current',
      title: 'Workspace subscription',
      amount: 149,
      status: 'PAID',
      issuedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12).toISOString(),
      dueAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 11).toISOString(),
    },
    {
      id: 'inv-next',
      title: 'Upcoming renewal',
      amount: 188,
      status: 'PENDING',
      issuedAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 17).toISOString(),
      dueAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 18).toISOString(),
    },
  ],
};

function parseJson<T>(value: string | null | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

async function readJsonSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await prisma.systemSetting.findUnique({
    where: { key },
    select: { value: true },
  });

  const parsed = parseJson<T>(row?.value);
  return parsed ?? fallback;
}

async function saveJsonSetting<T>(key: string, value: T, updatedBy: string): Promise<T> {
  await prisma.systemSetting.upsert({
    where: { key },
    update: {
      value: JSON.stringify(value),
      type: 'json',
      updatedBy,
    },
    create: {
      key,
      value: JSON.stringify(value),
      type: 'json',
      updatedBy,
    },
  });

  return value;
}

export function clientProfileKey(userId: string) {
  return `${CLIENT_PROFILE_PREFIX}${userId}`;
}

export function freelancerResumeKey(userId: string) {
  return `${FREELANCER_RESUME_PREFIX}${userId}`;
}

export function paymentMethodsKey(userId: string) {
  return `${PAYMENT_METHODS_PREFIX}${userId}`;
}

export function documentsKey(userId: string) {
  return `${DOCUMENTS_PREFIX}${userId}`;
}

export function teamMembersKey(userId: string) {
  return `${TEAM_MEMBERS_PREFIX}${userId}`;
}

export function securitySettingsKey(userId: string) {
  return `${SECURITY_SETTINGS_PREFIX}${userId}`;
}

export function verificationProfileKey(userId: string) {
  return `${VERIFICATION_PROFILE_PREFIX}${userId}`;
}

export function subscriptionPlanKey(userId: string) {
  return `${SUBSCRIPTION_PLAN_PREFIX}${userId}`;
}

export async function getClientWorkspaceProfile(
  userId: string,
  fallback: ClientWorkspaceProfile = DEFAULT_CLIENT_PROFILE
): Promise<ClientWorkspaceProfile> {
  const saved = await readJsonSetting<Partial<ClientWorkspaceProfile>>(
    clientProfileKey(userId),
    fallback
  );
  return {
    ...fallback,
    ...saved,
  };
}

export async function saveClientWorkspaceProfile(
  userId: string,
  value: ClientWorkspaceProfile
): Promise<ClientWorkspaceProfile> {
  return saveJsonSetting(clientProfileKey(userId), value, userId);
}

export async function getFreelancerResumeProfile(
  userId: string,
  fallback: FreelancerResumeProfile = DEFAULT_FREELANCER_RESUME
): Promise<FreelancerResumeProfile> {
  const saved = await readJsonSetting<Partial<FreelancerResumeProfile>>(
    freelancerResumeKey(userId),
    fallback
  );
  return {
    ...fallback,
    ...saved,
    certifications: Array.isArray(saved.certifications) ? saved.certifications : [],
    languages: Array.isArray(saved.languages) ? saved.languages : [],
  };
}

export async function saveFreelancerResumeProfile(
  userId: string,
  value: FreelancerResumeProfile
): Promise<FreelancerResumeProfile> {
  return saveJsonSetting(freelancerResumeKey(userId), value, userId);
}

export async function getWorkspacePaymentMethods(userId: string): Promise<WorkspacePaymentMethod[]> {
  const methods = await readJsonSetting<WorkspacePaymentMethod[]>(paymentMethodsKey(userId), []);
  return Array.isArray(methods) ? methods : [];
}

export async function saveWorkspacePaymentMethods(
  userId: string,
  methods: WorkspacePaymentMethod[]
): Promise<WorkspacePaymentMethod[]> {
  return saveJsonSetting(paymentMethodsKey(userId), methods, userId);
}

export async function getWorkspaceDocuments(userId: string): Promise<WorkspaceDocumentRecord[]> {
  const documents = await readJsonSetting<WorkspaceDocumentRecord[]>(documentsKey(userId), []);
  return Array.isArray(documents) ? documents : [];
}

export async function saveWorkspaceDocuments(
  userId: string,
  documents: WorkspaceDocumentRecord[]
): Promise<WorkspaceDocumentRecord[]> {
  return saveJsonSetting(documentsKey(userId), documents, userId);
}

export async function getWorkspaceTeamMembers(
  userId: string,
  fallback: WorkspaceTeamMember[] = []
): Promise<WorkspaceTeamMember[]> {
  const members = await readJsonSetting<WorkspaceTeamMember[]>(teamMembersKey(userId), fallback);
  return Array.isArray(members) ? members : fallback;
}

export async function saveWorkspaceTeamMembers(
  userId: string,
  members: WorkspaceTeamMember[]
): Promise<WorkspaceTeamMember[]> {
  return saveJsonSetting(teamMembersKey(userId), members, userId);
}

export async function getWorkspaceSecuritySettings(
  userId: string,
  fallback: WorkspaceSecuritySettings = DEFAULT_WORKSPACE_SECURITY
): Promise<WorkspaceSecuritySettings> {
  const saved = await readJsonSetting<Partial<WorkspaceSecuritySettings>>(
    securitySettingsKey(userId),
    fallback
  );
  return {
    ...fallback,
    ...saved,
    ipAllowlist: Array.isArray(saved.ipAllowlist) ? saved.ipAllowlist : fallback.ipAllowlist,
    allowedCountries: Array.isArray(saved.allowedCountries)
      ? saved.allowedCountries
      : fallback.allowedCountries,
  };
}

export async function saveWorkspaceSecuritySettings(
  userId: string,
  settings: WorkspaceSecuritySettings
): Promise<WorkspaceSecuritySettings> {
  return saveJsonSetting(securitySettingsKey(userId), settings, userId);
}

export async function getWorkspaceVerificationProfile(
  userId: string,
  fallback: WorkspaceVerificationProfile = DEFAULT_WORKSPACE_VERIFICATION
): Promise<WorkspaceVerificationProfile> {
  const saved = await readJsonSetting<Partial<WorkspaceVerificationProfile>>(
    verificationProfileKey(userId),
    fallback
  );
  return {
    ...fallback,
    ...saved,
    checks: Array.isArray(saved.checks) ? saved.checks : fallback.checks,
  };
}

export async function saveWorkspaceVerificationProfile(
  userId: string,
  profile: WorkspaceVerificationProfile
): Promise<WorkspaceVerificationProfile> {
  return saveJsonSetting(verificationProfileKey(userId), profile, userId);
}

export async function getWorkspaceSubscriptionPlan(
  userId: string,
  fallback: WorkspaceSubscriptionPlan = DEFAULT_WORKSPACE_SUBSCRIPTION
): Promise<WorkspaceSubscriptionPlan> {
  const saved = await readJsonSetting<Partial<WorkspaceSubscriptionPlan>>(
    subscriptionPlanKey(userId),
    fallback
  );
  return {
    ...fallback,
    ...saved,
    usage: {
      ...fallback.usage,
      ...(saved.usage || {}),
    },
    addons: Array.isArray(saved.addons) ? saved.addons : fallback.addons,
    invoices: Array.isArray(saved.invoices) ? saved.invoices : fallback.invoices,
  };
}

export async function saveWorkspaceSubscriptionPlan(
  userId: string,
  plan: WorkspaceSubscriptionPlan
): Promise<WorkspaceSubscriptionPlan> {
  return saveJsonSetting(subscriptionPlanKey(userId), plan, userId);
}
