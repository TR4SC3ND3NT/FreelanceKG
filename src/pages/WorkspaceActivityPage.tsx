import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  Activity,
  BellRing,
  Clock3,
  FileClock,
  Filter,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import api, { WorkspaceActivityEntry, WorkspaceOverviewSummary } from '@/services/api';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { getClientSidebarItems, getFreelancerSidebarItems } from '@/components/dashboard/dashboardNav';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { Input } from '@/components/ui/Input';
import {
  ActivityFeedList,
  MetricTrendCard,
  type Tone,
  TimelineRail,
} from '@/components/dashboard/WorkspaceInsights';
import { WORKSPACE_PATH } from '@/utils/routes';
import { formatDateTime } from '@/utils/locale';

const TONE_FILTERS = ['ALL', 'success', 'warning', 'danger', 'info', 'default'] as const;
type ToneFilter = (typeof TONE_FILTERS)[number];

function activityTone(tone: WorkspaceActivityEntry['tone']): Tone {
  if (tone === 'default') return 'primary';
  return tone;
}

function presentAction(action: string) {
  return action
    .split('_')
    .map((chunk) => `${chunk.slice(0, 1)}${chunk.slice(1).toLowerCase()}`)
    .join(' ');
}

function entryVariant(tone: WorkspaceActivityEntry['tone']): 'default' | 'success' | 'warning' | 'danger' | 'info' {
  return tone === 'default' ? 'default' : tone;
}

function timelineTone(status: string): Tone {
  if (status === 'UNREAD' || status === 'UNDER_REVIEW') return 'warning';
  if (status === 'READ' || status === 'VERIFIED' || status === 'COMPLETED') return 'success';
  if (status === 'ACTION_REQUIRED') return 'danger';
  return 'info';
}

export function WorkspaceActivityPage() {
  const { t, i18n } = useTranslation();
  const { isDark } = useTheme();
  const { user, logout } = useAuth();
  const [overview, setOverview] = useState<WorkspaceOverviewSummary | null>(null);
  const [entries, setEntries] = useState<WorkspaceActivityEntry[]>([]);
  const [query, setQuery] = useState('');
  const [toneFilter, setToneFilter] = useState<ToneFilter>('ALL');
  const [entityFilter, setEntityFilter] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isWorkspaceUser = user?.role === 'CLIENT' || user?.role === 'FREELANCER';
  const isFreelancer = user?.role === 'FREELANCER';
  const roleBase = isFreelancer ? '/dashboard/freelancer' : '/dashboard/client';
  const sidebarItems = useMemo(
    () => (isFreelancer ? getFreelancerSidebarItems() : getClientSidebarItems()),
    [isFreelancer]
  );

  const loadActivity = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [overviewResult, entriesResult] = await Promise.all([
        api.getWorkspaceOverview(),
        api.getWorkspaceActivityLog({ limit: 80 }),
      ]);
      setOverview(overviewResult);
      setEntries(entriesResult);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('activityLog.loadFailed', { defaultValue: 'Failed to load activity log.' })
      );
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadActivity();
  }, [loadActivity]);

  const entities = useMemo(
    () => Array.from(new Set(entries.map((item) => item.entityType).filter(Boolean))) as string[],
    [entries]
  );

  const filteredEntries = useMemo(
    () =>
      entries.filter((item) => {
        const matchesTone = toneFilter === 'ALL' || item.tone === toneFilter;
        const matchesEntity = entityFilter === 'ALL' || item.entityType === entityFilter;
        const source = `${item.action} ${item.description} ${item.entityType || ''}`.toLowerCase();
        const matchesQuery = !query.trim() || source.includes(query.trim().toLowerCase());
        return matchesTone && matchesEntity && matchesQuery;
      }),
    [entries, entityFilter, query, toneFilter]
  );

  const stats = useMemo(() => {
    const warnings = entries.filter((item) => item.tone === 'warning' || item.tone === 'danger').length;
    const finance = entries.filter((item) => /(PAY|ESCROW|BILLING|SUBSCRIPTION|WITHDRAW)/.test(item.action)).length;
    const docs = entries.filter((item) => /(DOCUMENT|VERIFICATION)/.test(item.action)).length;
    const unreadTimeline = overview?.timeline.filter((item) => item.status === 'UNREAD').length || 0;
    return { warnings, finance, docs, unreadTimeline };
  }, [entries, overview]);

  const activityItems = useMemo(
    () =>
      filteredEntries.slice(0, 8).map((item) => ({
        id: item.id,
        title: presentAction(item.action),
        subtitle: item.description,
        meta: formatDateTime(item.createdAt, i18n.language),
        badge: item.entityType || item.action,
        tone: activityTone(item.tone),
      })),
    [filteredEntries, i18n.language]
  );

  const timelineItems = useMemo(
    () =>
      (overview?.timeline || []).slice(0, 8).map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        meta: formatDateTime(item.at, i18n.language),
        tone: timelineTone(item.status),
      })),
    [i18n.language, overview]
  );

  const columns = useMemo<Array<DataTableColumn<WorkspaceActivityEntry>>>(
    () => [
      {
        key: 'action',
        header: t('activityLog.action', { defaultValue: 'Action' }),
        render: (item) => (
          <div>
            <p className="font-semibold text-[var(--color-text)]">{presentAction(item.action)}</p>
            <p className="text-xs text-[var(--color-text-soft)]">{item.entityType || 'workspace'}</p>
          </div>
        ),
      },
      {
        key: 'description',
        header: t('common.details', { defaultValue: 'Details' }),
        className: 'min-w-[300px]',
        render: (item) => <span className="text-sm text-[var(--color-text-muted)]">{item.description}</span>,
      },
      {
        key: 'status',
        header: t('common.status', { defaultValue: 'Status' }),
        render: (item) => <Badge variant={entryVariant(item.tone)}>{item.tone.toUpperCase()}</Badge>,
      },
      {
        key: 'createdAt',
        header: t('common.date', { defaultValue: 'Date' }),
        render: (item) => <span className="text-sm text-[var(--color-text-muted)]">{formatDateTime(item.createdAt, i18n.language)}</span>,
      },
    ],
    [i18n.language, t]
  );

  const latestCritical = filteredEntries.find((item) => item.tone === 'danger' || item.tone === 'warning');

  if (!user) return <Navigate to="/login" replace />;
  if (!isWorkspaceUser) return <Navigate to={WORKSPACE_PATH} replace />;

  return (
    <DashboardShell
      isDark={isDark}
      sidebarTitle={user.name || t('topbar.user', { defaultValue: 'User' })}
      sidebarSubtitle={t('activityLog.subtitle', { defaultValue: 'Audit-ready workspace history' })}
      sidebarItems={sidebarItems}
      onLogout={logout}
    >
      <PageHeader
        title={t('activityLog.title', { defaultValue: 'Activity log' })}
        subtitle={t('activityLog.pageSubtitle', {
          defaultValue: 'A realistic audit stream of security, finance, document, support and workspace events.',
        })}
        badges={
          <>
            <Badge variant="info">{entries.length} {t('activityLog.events', { defaultValue: 'events' })}</Badge>
            <Badge variant="warning">{stats.warnings} {t('activityLog.requiresAttention', { defaultValue: 'attention' })}</Badge>
          </>
        }
        actions={
          <Button type="button" variant="outline" onClick={() => void loadActivity()} leftIcon={<RefreshCcw className="h-4 w-4" />}>
            {t('common.refresh', { defaultValue: 'Refresh' })}
          </Button>
        }
      />

      {error ? (
        <div className="rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--color-danger)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_12%,transparent)] px-4 py-3 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      ) : null}

      <section className="surface-glow p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-soft)]">
              {t('activityLog.heroKicker', { defaultValue: 'Workspace audit stream' })}
            </p>
            <h2 className="mt-2 font-[var(--font-family-display)] text-[clamp(1.6rem,2.7vw,2.2rem)] font-semibold leading-[1.04] tracking-[-0.04em] text-[var(--color-text)]">
              {t('activityLog.heroTitle', { defaultValue: 'Track every meaningful workspace action through one polished audit layer.' })}
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-[var(--color-text-muted)]">
              {t('activityLog.heroText', { defaultValue: 'Filters, timeline context and operational severity turn the local demo into something that feels governed and enterprise-ready.' })}
            </p>
          </div>

          <div className="grid w-full max-w-md grid-cols-2 gap-3">
            <div className="rounded-[18px] border border-[color-mix(in_srgb,var(--color-warning)_24%,transparent)] bg-[color-mix(in_srgb,var(--color-warning)_10%,transparent)] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-soft)]">{t('activityLog.focusEntity', { defaultValue: 'Entity scope' })}</p>
              <p className="mt-2 text-lg font-semibold text-[var(--color-text)]">{entityFilter === 'ALL' ? 'workspace' : entityFilter}</p>
            </div>
            <div className="rounded-[18px] border border-[color-mix(in_srgb,var(--color-primary)_24%,transparent)] bg-[color-mix(in_srgb,var(--color-primary)_10%,transparent)] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-soft)]">{t('activityLog.filterState', { defaultValue: 'Filter mode' })}</p>
              <p className="mt-2 text-lg font-semibold text-[var(--color-text)]">{toneFilter === 'ALL' ? t('common.all', { defaultValue: 'All' }) : toneFilter}</p>
            </div>
            <div className="rounded-[18px] border border-[color-mix(in_srgb,var(--color-success)_24%,transparent)] bg-[color-mix(in_srgb,var(--color-success)_10%,transparent)] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-soft)]">{t('activityLog.totalEvents', { defaultValue: 'Total events' })}</p>
              <p className="mt-2 text-lg font-semibold text-[var(--color-text)]">{entries.length}</p>
            </div>
            <div className="rounded-[18px] border border-[color-mix(in_srgb,var(--color-danger)_24%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-soft)]">{t('activityLog.warningEvents', { defaultValue: 'Warnings' })}</p>
              <p className="mt-2 text-lg font-semibold text-[var(--color-text)]">{stats.warnings}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricTrendCard label={t('activityLog.totalEvents', { defaultValue: 'Total events' })} value={String(entries.length)} icon={Activity} trend={[6, 9, 12, 14, 16, entries.length]} />
        <MetricTrendCard label={t('activityLog.warningEvents', { defaultValue: 'Warnings' })} value={String(stats.warnings)} icon={Clock3} tone="warning" trend={[1, 2, 2, 3, 4, stats.warnings]} />
        <MetricTrendCard label={t('activityLog.financeEvents', { defaultValue: 'Finance events' })} value={String(stats.finance)} icon={Wallet} tone="success" trend={[2, 3, 4, 5, 6, stats.finance]} />
        <MetricTrendCard label={t('activityLog.complianceEvents', { defaultValue: 'Compliance events' })} value={String(stats.docs)} icon={ShieldCheck} tone="info" trend={[1, 1, 2, 3, 3, stats.docs]} />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-8">
          <section className="surface p-5 sm:p-6">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="section-title">{t('activityLog.filteredFeed', { defaultValue: 'Filtered activity feed' })}</h2>
                <p className="section-subtitle mt-1">
                  {t('activityLog.filteredFeedHint', { defaultValue: 'Search and segment the workspace audit stream for demo-friendly governance review.' })}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <div className="min-w-[220px]">
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={t('activityLog.search', { defaultValue: 'Search action or details' })}
                  />
                </div>
                <select
                  value={toneFilter}
                  onChange={(event) => setToneFilter(event.target.value as ToneFilter)}
                  className={selectClassName()}
                >
                  {TONE_FILTERS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <select
                  value={entityFilter}
                  onChange={(event) => setEntityFilter(event.target.value)}
                  className={selectClassName()}
                >
                  <option value="ALL">{t('common.all', { defaultValue: 'All' })}</option>
                  {entities.map((entity) => (
                    <option key={entity} value={entity}>
                      {entity}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <ActivityFeedList
              items={activityItems}
              emptyTitle={t('activityLog.emptyTitle', { defaultValue: 'No matching events' })}
              emptyDescription={t('activityLog.emptyDescription', { defaultValue: 'Adjust the filters or run more product workflows to populate the audit stream.' })}
            />
          </section>

          <section className="surface p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="section-title">{t('activityLog.auditTable', { defaultValue: 'Audit table' })}</h2>
                <p className="section-subtitle mt-1">
                  {t('activityLog.auditTableHint', { defaultValue: 'Dense tabular history for finance, compliance and support operations.' })}
                </p>
              </div>
              <Badge variant="info">{filteredEntries.length}</Badge>
            </div>
            <DataTable
              columns={columns}
              data={filteredEntries}
              rowKey={(row) => row.id}
              isLoading={isLoading}
              emptyTitle={t('activityLog.tableEmpty', { defaultValue: 'No audit rows' })}
              emptyDescription={t('activityLog.tableEmptyHint', { defaultValue: 'Workspace events will appear after the first operational actions.' })}
            />
          </section>
        </div>

        <aside className="space-y-6 xl:col-span-4">
          <section className="surface p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="section-title">{t('activityLog.timelineTitle', { defaultValue: 'Workspace timeline' })}</h2>
              <Sparkles className="h-4 w-4 text-[var(--color-primary)]" />
            </div>
            <div className="mt-4">
              <TimelineRail items={timelineItems} />
            </div>
          </section>

          <section className="surface p-5 sm:p-6">
            <div className="grid gap-3">
              {latestCritical ? (
                <div className="surface-muted p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-[var(--color-text)]">{t('activityLog.watchItem', { defaultValue: 'Watch item' })}</p>
                    <Badge variant={entryVariant(latestCritical.tone)}>{latestCritical.tone.toUpperCase()}</Badge>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-[var(--color-text)]">{presentAction(latestCritical.action)}</p>
                  <p className="mt-1 text-sm text-[var(--color-text-muted)]">{latestCritical.description}</p>
                </div>
              ) : null}

              <div className="grid gap-3">
              {[
                {
                  title: t('activityLog.unreadEvents', { defaultValue: 'Unread timeline alerts' }),
                  value: stats.unreadTimeline,
                  icon: BellRing,
                },
                {
                  title: t('activityLog.filterState', { defaultValue: 'Filter mode' }),
                  value: toneFilter === 'ALL' ? t('common.all', { defaultValue: 'All' }) : toneFilter,
                  icon: Filter,
                },
                {
                  title: t('activityLog.focusEntity', { defaultValue: 'Entity scope' }),
                  value: entityFilter === 'ALL' ? 'workspace' : entityFilter,
                  icon: FileClock,
                },
              ].map((item) => (
                <div key={item.title} className="surface-muted flex items-center justify-between gap-3 p-4">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-[14px] border border-[color-mix(in_srgb,var(--color-primary)_24%,transparent)] bg-[color-mix(in_srgb,var(--color-primary)_10%,transparent)] text-[var(--color-primary)]">
                      <item.icon className="h-5 w-5" />
                    </span>
                    <span className="text-sm font-semibold text-[var(--color-text)]">{item.title}</span>
                  </div>
                  <span className="text-sm font-semibold text-[var(--color-text)]">{item.value}</span>
                </div>
              ))}
              </div>
            </div>
          </section>

          <section className="surface p-5 sm:p-6">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.08em] text-[var(--color-text-soft)]">
              {t('activityLog.relatedLinks', { defaultValue: 'Connected sections' })}
            </h3>
            <div className="grid gap-2">
              <Link to={`${roleBase}/analytics`} className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm font-medium text-[var(--color-text)]">
                {t('activityLog.analyticsLink', { defaultValue: 'Analytics and reports' })}
              </Link>
              <Link to={`${roleBase}/security`} className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm font-medium text-[var(--color-text)]">
                {t('activityLog.securityLink', { defaultValue: 'Security center' })}
              </Link>
              <Link to={`${roleBase}/support`} className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm font-medium text-[var(--color-text)]">
                {t('activityLog.supportLink', { defaultValue: 'Support center' })}
              </Link>
            </div>
          </section>
        </aside>
      </section>
    </DashboardShell>
  );
}

function selectClassName() {
  return 'h-11 rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--color-border)_72%,transparent)] bg-[var(--color-surface)] px-3.5 text-sm text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-ring)]';
}
