import {
  Activity,
  BarChart3,
  Bell,
  ClipboardList,
  CreditCard,
  FilePlus2,
  FileText,
  Headset,
  Inbox,
  LayoutDashboard,
  MessageCircle,
  Settings,
  ShieldCheck,
  ShieldEllipsis,
  Sparkles,
  UserCircle2,
  Users2,
  Wallet,
  BadgeCheck,
} from 'lucide-react';
import { DashboardNavItem } from './DashboardSidebar';
import i18n from '@/i18n';

function t() {
  return i18n.t.bind(i18n);
}

export function getFreelancerSidebarItems(): DashboardNavItem[] {
  const tx = t();

  return [
    {
      icon: LayoutDashboard,
      label: tx('sidebar.items.overview', { defaultValue: 'Overview' }),
      to: '/dashboard/freelancer/overview',
      group: tx('sidebar.groups.overview', { defaultValue: 'Overview' }),
      caption: tx('sidebar.items.overviewHint', { defaultValue: 'Revenue cockpit and operating snapshot' }),
      badge: 'Live',
    },
    {
      icon: BarChart3,
      label: tx('sidebar.items.analytics', { defaultValue: 'Analytics' }),
      to: '/dashboard/freelancer/analytics',
      group: tx('sidebar.groups.overview', { defaultValue: 'Overview' }),
      caption: tx('sidebar.items.analyticsHint', { defaultValue: 'Cashflow, delivery velocity and demand trends' }),
    },
    {
      icon: Activity,
      label: tx('sidebar.items.activityLog', { defaultValue: 'Activity log' }),
      to: '/dashboard/freelancer/activity',
      group: tx('sidebar.groups.overview', { defaultValue: 'Overview' }),
      caption: tx('sidebar.items.activityLogHint', { defaultValue: 'Audit-ready stream of product events' }),
    },
    {
      icon: Inbox,
      label: tx('sidebar.items.availableOrders', { defaultValue: 'Available orders' }),
      to: '/dashboard/freelancer/market',
      group: tx('sidebar.groups.operations', { defaultValue: 'Operations' }),
      caption: tx('sidebar.items.availableOrdersHint', { defaultValue: 'Fresh client opportunities and escrow demand' }),
    },
    {
      icon: ClipboardList,
      label: tx('sidebar.items.myOrders', { defaultValue: 'My orders' }),
      to: '/dashboard/freelancer/orders',
      group: tx('sidebar.groups.operations', { defaultValue: 'Operations' }),
      caption: tx('sidebar.items.myOrdersHint', { defaultValue: 'Live delivery pipeline and approvals' }),
    },
    {
      icon: FileText,
      label: tx('sidebar.items.documents', { defaultValue: 'Documents' }),
      to: '/dashboard/freelancer/documents',
      group: tx('sidebar.groups.operations', { defaultValue: 'Operations' }),
      caption: tx('sidebar.items.documentsHint', { defaultValue: 'Contracts, IDs, statements and signed files' }),
    },
    {
      icon: Wallet,
      label: tx('sidebar.items.finance', { defaultValue: 'Finance' }),
      to: '/dashboard/freelancer/finance',
      group: tx('sidebar.groups.finance', { defaultValue: 'Finance' }),
      caption: tx('sidebar.items.financeHint', { defaultValue: 'Balance, releases and withdrawal history' }),
    },
    {
      icon: CreditCard,
      label: tx('sidebar.items.payoutMethods', { defaultValue: 'Payout methods' }),
      to: '/dashboard/freelancer/payouts',
      group: tx('sidebar.groups.finance', { defaultValue: 'Finance' }),
      caption: tx('sidebar.items.payoutMethodsHint', { defaultValue: 'Cards, wallets and bank rails' }),
    },
    {
      icon: Sparkles,
      label: tx('sidebar.items.subscription', { defaultValue: 'Subscription' }),
      to: '/dashboard/freelancer/subscription',
      group: tx('sidebar.groups.finance', { defaultValue: 'Finance' }),
      caption: tx('sidebar.items.subscriptionHint', { defaultValue: 'Plan tier, add-ons and invoices' }),
      badge: 'Pro',
    },
    {
      icon: BadgeCheck,
      label: tx('sidebar.items.resume', { defaultValue: 'Resume' }),
      to: '/dashboard/freelancer/resume',
      group: tx('sidebar.groups.governance', { defaultValue: 'Governance' }),
      caption: tx('sidebar.items.resumeHint', { defaultValue: 'Portfolio narrative and public positioning' }),
    },
    {
      icon: Users2,
      label: tx('sidebar.items.team', { defaultValue: 'Team members' }),
      to: '/dashboard/freelancer/team',
      group: tx('sidebar.groups.governance', { defaultValue: 'Governance' }),
      caption: tx('sidebar.items.teamHint', { defaultValue: 'Studio assistants, finance and operations access' }),
    },
    {
      icon: ShieldCheck,
      label: tx('sidebar.items.verification', { defaultValue: 'Verification' }),
      to: '/dashboard/freelancer/verification',
      group: tx('sidebar.groups.governance', { defaultValue: 'Governance' }),
      caption: tx('sidebar.items.verificationHint', { defaultValue: 'Identity, compliance and payout readiness' }),
      badge: 'KYC',
    },
    {
      icon: ShieldEllipsis,
      label: tx('sidebar.items.security', { defaultValue: 'Security' }),
      to: '/dashboard/freelancer/security',
      group: tx('sidebar.groups.governance', { defaultValue: 'Governance' }),
      caption: tx('sidebar.items.securityHint', { defaultValue: 'Session, MFA and audit posture' }),
    },
    {
      icon: Bell,
      label: tx('sidebar.items.notifications', { defaultValue: 'Notifications' }),
      to: '/dashboard/freelancer/notifications',
      group: tx('sidebar.groups.communication', { defaultValue: 'Communication' }),
      caption: tx('sidebar.items.notificationsHint', { defaultValue: 'Alerts, approvals and delivery signals' }),
    },
    {
      icon: MessageCircle,
      label: tx('sidebar.items.messages', { defaultValue: 'Messages' }),
      to: '/dashboard/freelancer/messages',
      group: tx('sidebar.groups.communication', { defaultValue: 'Communication' }),
      caption: tx('sidebar.items.messagesHint', { defaultValue: 'Client communication and handoff threads' }),
    },
    {
      icon: Headset,
      label: tx('sidebar.items.support', { defaultValue: 'Support' }),
      to: '/dashboard/freelancer/support',
      group: tx('sidebar.groups.communication', { defaultValue: 'Communication' }),
      caption: tx('sidebar.items.supportHint', { defaultValue: 'Incidents, finance tickets and SLA flow' }),
      badge: 'SLA',
    },
    {
      icon: UserCircle2,
      label: tx('sidebar.items.myProfile', { defaultValue: 'My profile' }),
      to: '/dashboard/freelancer/profile',
      group: tx('sidebar.groups.workspace', { defaultValue: 'Workspace' }),
      caption: tx('sidebar.items.myProfileHint', { defaultValue: 'Account profile and visible identity' }),
    },
    {
      icon: Settings,
      label: tx('sidebar.items.settings', { defaultValue: 'Settings' }),
      to: '/dashboard/freelancer/settings',
      group: tx('sidebar.groups.workspace', { defaultValue: 'Workspace' }),
      caption: tx('sidebar.items.settingsHint', { defaultValue: 'Preferences, locale, theme and integrations' }),
    },
  ];
}

export function getClientSidebarItems(): DashboardNavItem[] {
  const tx = t();

  return [
    {
      icon: LayoutDashboard,
      label: tx('sidebar.items.overview', { defaultValue: 'Overview' }),
      to: '/dashboard/client/overview',
      group: tx('sidebar.groups.overview', { defaultValue: 'Overview' }),
      caption: tx('sidebar.items.overviewHint', { defaultValue: 'Executive command layer and workspace pulse' }),
      badge: 'Live',
    },
    {
      icon: BarChart3,
      label: tx('sidebar.items.analytics', { defaultValue: 'Analytics' }),
      to: '/dashboard/client/analytics',
      group: tx('sidebar.groups.overview', { defaultValue: 'Overview' }),
      caption: tx('sidebar.items.analyticsHint', { defaultValue: 'Spend, approvals, SLA and operating reports' }),
    },
    {
      icon: Activity,
      label: tx('sidebar.items.activityLog', { defaultValue: 'Activity log' }),
      to: '/dashboard/client/activity',
      group: tx('sidebar.groups.overview', { defaultValue: 'Overview' }),
      caption: tx('sidebar.items.activityLogHint', { defaultValue: 'Audit history across billing and workspace actions' }),
    },
    {
      icon: ClipboardList,
      label: tx('sidebar.items.myOrders', { defaultValue: 'My orders' }),
      to: '/dashboard/client/orders',
      group: tx('sidebar.groups.operations', { defaultValue: 'Operations' }),
      caption: tx('sidebar.items.myOrdersHint', { defaultValue: 'Engagements, approvals and vendor delivery' }),
    },
    {
      icon: FilePlus2,
      label: tx('sidebar.items.createOrder', { defaultValue: 'Create order' }),
      to: '/orders/new',
      group: tx('sidebar.groups.operations', { defaultValue: 'Operations' }),
      caption: tx('sidebar.items.createOrderHint', { defaultValue: 'Launch a new escrow-backed project' }),
      badge: 'New',
    },
    {
      icon: FileText,
      label: tx('sidebar.items.documents', { defaultValue: 'Documents' }),
      to: '/dashboard/client/documents',
      group: tx('sidebar.groups.operations', { defaultValue: 'Operations' }),
      caption: tx('sidebar.items.documentsHint', { defaultValue: 'Briefs, agreements, invoices and statements' }),
    },
    {
      icon: Headset,
      label: tx('sidebar.items.support', { defaultValue: 'Support' }),
      to: '/dashboard/client/support',
      group: tx('sidebar.groups.operations', { defaultValue: 'Operations' }),
      caption: tx('sidebar.items.supportHint', { defaultValue: 'Billing incidents, disputes and workspace SLA' }),
      badge: 'SLA',
    },
    {
      icon: Wallet,
      label: tx('sidebar.items.finance', { defaultValue: 'Finance' }),
      to: '/dashboard/client/finance',
      group: tx('sidebar.groups.finance', { defaultValue: 'Finance' }),
      caption: tx('sidebar.items.financeHint', { defaultValue: 'Escrow, spend and transaction operations' }),
    },
    {
      icon: CreditCard,
      label: tx('sidebar.items.billing', { defaultValue: 'Cards and wallets' }),
      to: '/dashboard/client/billing',
      group: tx('sidebar.groups.finance', { defaultValue: 'Finance' }),
      caption: tx('sidebar.items.billingHint', { defaultValue: 'Saved checkout methods and funding sources' }),
    },
    {
      icon: Sparkles,
      label: tx('sidebar.items.subscription', { defaultValue: 'Subscription' }),
      to: '/dashboard/client/subscription',
      group: tx('sidebar.groups.finance', { defaultValue: 'Finance' }),
      caption: tx('sidebar.items.subscriptionHint', { defaultValue: 'Plan entitlements, seats and invoices' }),
      badge: 'Scale',
    },
    {
      icon: Users2,
      label: tx('sidebar.items.team', { defaultValue: 'Team members' }),
      to: '/dashboard/client/team',
      group: tx('sidebar.groups.governance', { defaultValue: 'Governance' }),
      caption: tx('sidebar.items.teamHint', { defaultValue: 'Stakeholders, reviewers and finance operators' }),
    },
    {
      icon: ShieldCheck,
      label: tx('sidebar.items.verification', { defaultValue: 'Verification' }),
      to: '/dashboard/client/verification',
      group: tx('sidebar.groups.governance', { defaultValue: 'Governance' }),
      caption: tx('sidebar.items.verificationHint', { defaultValue: 'Business KYC, compliance and account checks' }),
      badge: 'KYC',
    },
    {
      icon: ShieldEllipsis,
      label: tx('sidebar.items.security', { defaultValue: 'Security' }),
      to: '/dashboard/client/security',
      group: tx('sidebar.groups.governance', { defaultValue: 'Governance' }),
      caption: tx('sidebar.items.securityHint', { defaultValue: 'MFA, devices, retention and access posture' }),
    },
    {
      icon: Bell,
      label: tx('sidebar.items.notifications', { defaultValue: 'Notifications' }),
      to: '/dashboard/client/notifications',
      group: tx('sidebar.groups.communication', { defaultValue: 'Communication' }),
      caption: tx('sidebar.items.notificationsHint', { defaultValue: 'Approvals, alerts and product events' }),
    },
    {
      icon: MessageCircle,
      label: tx('sidebar.items.messages', { defaultValue: 'Messages' }),
      to: '/dashboard/client/messages',
      group: tx('sidebar.groups.communication', { defaultValue: 'Communication' }),
      caption: tx('sidebar.items.messagesHint', { defaultValue: 'Vendor threads and delivery coordination' }),
    },
    {
      icon: UserCircle2,
      label: tx('sidebar.items.myProfile', { defaultValue: 'Company profile' }),
      to: '/dashboard/client/profile',
      group: tx('sidebar.groups.workspace', { defaultValue: 'Workspace' }),
      caption: tx('sidebar.items.myProfileHint', { defaultValue: 'Company data, billing identity and workspace brand' }),
    },
    {
      icon: Settings,
      label: tx('sidebar.items.settings', { defaultValue: 'Settings' }),
      to: '/dashboard/client/settings',
      group: tx('sidebar.groups.workspace', { defaultValue: 'Workspace' }),
      caption: tx('sidebar.items.settingsHint', { defaultValue: 'Preferences, locale, theme and integrations' }),
    },
  ];
}

export function getAdminSidebarItems(): DashboardNavItem[] {
  const tx = t();
  return [
    {
      icon: LayoutDashboard,
      label: tx('sidebar.items.adminDashboard', { defaultValue: 'Control tower' }),
      to: '/admin',
      group: tx('sidebar.groups.overview', { defaultValue: 'Overview' }),
      caption: tx('sidebar.items.adminDashboardHint', { defaultValue: 'Platform pulse, growth mix and live ops snapshot' }),
      badge: 'Live',
    },
    {
      icon: Users2,
      label: tx('admin.users', { defaultValue: 'Users' }),
      to: '/admin#users',
      group: tx('sidebar.groups.operations', { defaultValue: 'Operations' }),
      caption: tx('admin.usersHint', { defaultValue: 'Search accounts, review roles and apply account controls' }),
    },
    {
      icon: ClipboardList,
      label: tx('admin.orders', { defaultValue: 'Orders' }),
      to: '/admin#orders',
      group: tx('sidebar.groups.operations', { defaultValue: 'Operations' }),
      caption: tx('admin.ordersHint', { defaultValue: 'Moderate order flow, statuses and delivery ownership' }),
    },
    {
      icon: ShieldCheck,
      label: tx('admin.disputes', { defaultValue: 'Disputes' }),
      to: '/admin#disputes',
      group: tx('sidebar.groups.operations', { defaultValue: 'Operations' }),
      caption: tx('admin.disputesHint', { defaultValue: 'Resolve escrow conflicts and review case context' }),
      badge: 'SLA',
    },
    {
      icon: FileText,
      label: tx('admin.auditLogs', { defaultValue: 'Audit log' }),
      to: '/admin#audit',
      group: tx('sidebar.groups.governance', { defaultValue: 'Governance' }),
      caption: tx('admin.auditLogsHint', { defaultValue: 'Trace privileged actions, actors and entity changes' }),
    },
    {
      icon: Wallet,
      label: tx('admin.ledger', { defaultValue: 'Ledger' }),
      to: '/admin#ledger',
      group: tx('sidebar.groups.governance', { defaultValue: 'Governance' }),
      caption: tx('admin.ledgerHint', { defaultValue: 'Inspect double-entry balances, batches and references' }),
    },
    {
      icon: Settings,
      label: tx('admin.featureFlags', { defaultValue: 'Feature flags' }),
      to: '/admin#flags',
      group: tx('sidebar.groups.governance', { defaultValue: 'Governance' }),
      caption: tx('admin.featureFlagsHint', { defaultValue: 'Control platform capabilities without redeploying' }),
    },
  ];
}
