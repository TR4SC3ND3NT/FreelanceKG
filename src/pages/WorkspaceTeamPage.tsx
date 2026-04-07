import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { BadgeCheck, MailPlus, Search, ShieldCheck, Users2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import api, { WorkspaceTeamMember } from '@/services/api';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { getClientSidebarItems, getFreelancerSidebarItems } from '@/components/dashboard/dashboardNav';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { Input } from '@/components/ui/Input';
import { MetricTrendCard } from '@/components/dashboard/WorkspaceInsights';
import { WORKSPACE_PATH } from '@/utils/routes';
import { formatDateTime } from '@/utils/locale';

type MemberForm = {
  name: string;
  email: string;
  role: WorkspaceTeamMember['role'];
  title: string;
  location: string;
  permissionsText: string;
  seatsScopeText: string;
  status: WorkspaceTeamMember['status'];
};

const DEFAULT_FORM: MemberForm = {
  name: '',
  email: '',
  role: 'ADMIN',
  title: '',
  location: 'Remote',
  permissionsText: 'workspace.read, documents.read',
  seatsScopeText: 'workspace, documents',
  status: 'INVITED',
};

export function WorkspaceTeamPage() {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const { user, logout } = useAuth();
  const [members, setMembers] = useState<WorkspaceTeamMember[]>([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | WorkspaceTeamMember['status']>('ALL');
  const [form, setForm] = useState<MemberForm>(DEFAULT_FORM);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isWorkspaceUser = user?.role === 'CLIENT' || user?.role === 'FREELANCER';
  const isFreelancer = user?.role === 'FREELANCER';

  const sidebarItems = useMemo(
    () => (isFreelancer ? getFreelancerSidebarItems() : getClientSidebarItems()),
    [isFreelancer]
  );

  const loadMembers = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await api.getWorkspaceTeamMembers();
      setMembers(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('team.loadFailed', { defaultValue: 'Failed to load workspace members' }));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  const filteredMembers = useMemo(
    () =>
      members.filter((member) => {
        const matchesStatus = statusFilter === 'ALL' || member.status === statusFilter;
        const source = `${member.name} ${member.email} ${member.title} ${member.location} ${member.permissions.join(' ')} ${member.seatsScope.join(' ')}`.toLowerCase();
        const matchesQuery = !query.trim() || source.includes(query.trim().toLowerCase());
        return matchesStatus && matchesQuery;
      }),
    [members, query, statusFilter]
  );

  const stats = useMemo(() => {
    const active = members.filter((member) => member.status === 'ACTIVE').length;
    const invited = members.filter((member) => member.status === 'INVITED').length;
    const mfaReady = members.filter((member) => member.mfaEnabled).length;
    const accessZones = new Set(members.flatMap((member) => member.seatsScope).filter(Boolean)).size;
    return { active, invited, mfaReady, accessZones };
  }, [members]);

  const columns = useMemo<Array<DataTableColumn<WorkspaceTeamMember>>>(
    () => [
      {
        key: 'member',
        header: t('team.member', { defaultValue: 'Member' }),
        className: 'min-w-[260px]',
        render: (member) => (
          <div>
            <p className="font-semibold text-[var(--color-text)]">{member.name}</p>
            <p className="text-xs text-[var(--color-text-soft)]">{member.email}</p>
          </div>
        ),
      },
      {
        key: 'title',
        header: t('team.roleTitle', { defaultValue: 'Role and title' }),
        render: (member) => (
          <div>
            <p className="font-medium text-[var(--color-text)]">{member.title}</p>
            <p className="text-xs text-[var(--color-text-soft)]">
              {member.role} • {member.location}
            </p>
          </div>
        ),
      },
      {
        key: 'access',
        header: t('team.access', { defaultValue: 'Access' }),
        render: (member) => (
          <span className="text-sm text-[var(--color-text-muted)]">
            {member.permissions.slice(0, 2).join(', ') || member.seatsScope.join(', ') || '-'}
          </span>
        ),
      },
      {
        key: 'status',
        header: t('common.status', { defaultValue: 'Status' }),
        render: (member) => (
          <div className="flex flex-wrap gap-2">
            <Badge variant={member.status === 'ACTIVE' ? 'success' : member.status === 'INVITED' ? 'info' : 'danger'}>
              {member.status}
            </Badge>
            {member.mfaEnabled ? <Badge variant="success">MFA</Badge> : null}
          </div>
        ),
      },
      {
        key: 'lastActive',
        header: t('team.lastActive', { defaultValue: 'Last active' }),
        render: (member) => (
          <span className="text-sm text-[var(--color-text-muted)]">
            {member.lastActiveAt ? formatDateTime(member.lastActiveAt, 'ru') : t('team.noActivity', { defaultValue: 'Not yet' })}
          </span>
        ),
      },
    ],
    [t]
  );

  const handleCreateMember = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setIsSaving(true);
      setError(null);
      setSuccess(null);

      const created = await api.createWorkspaceTeamMember({
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role,
        title: form.title.trim(),
        location: form.location.trim() || 'Remote',
        permissions: form.permissionsText.split(',').map((item) => item.trim()).filter(Boolean),
        seatsScope: form.seatsScopeText.split(',').map((item) => item.trim()).filter(Boolean),
        status: form.status,
      });

      setMembers((prev) => [created, ...prev]);
      setForm(DEFAULT_FORM);
      setSuccess(t('team.memberAdded', { defaultValue: 'Workspace member added' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('team.memberAddFailed', { defaultValue: 'Failed to add workspace member' }));
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (member: WorkspaceTeamMember, status: WorkspaceTeamMember['status']) => {
    try {
      setError(null);
      const updated = await api.updateWorkspaceTeamMember(member.id, { status });
      setMembers((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('team.statusFailed', { defaultValue: 'Failed to update member status' }));
    }
  };

  const handleDelete = async (memberId: string) => {
    try {
      setError(null);
      await api.deleteWorkspaceTeamMember(memberId);
      setMembers((prev) => prev.filter((item) => item.id !== memberId));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('team.deleteFailed', { defaultValue: 'Failed to delete member' }));
    }
  };

  if (!user) return <Navigate to="/login" replace />;
  if (!isWorkspaceUser) return <Navigate to={WORKSPACE_PATH} replace />;

  return (
    <DashboardShell
      isDark={isDark}
      sidebarTitle={user.name || t('topbar.user', { defaultValue: 'User' })}
      sidebarSubtitle={t('team.subtitle', { defaultValue: 'Workspace access and governance' })}
      sidebarItems={sidebarItems}
      onLogout={logout}
    >
      <PageHeader
        title={t('team.title', { defaultValue: 'Team members' })}
        subtitle={t('team.pageSubtitle', {
          defaultValue: 'Control workspace access, operational roles and review permissions from one enterprise-grade directory.',
        })}
        badges={
          <>
            <Badge variant="info">{t('team.membersCount', { defaultValue: 'Members' })}: {members.length}</Badge>
            <Badge variant="success">{t('team.mfaCount', { defaultValue: 'MFA ready' })}: {stats.mfaReady}</Badge>
          </>
        }
      />

      {error ? (
        <div className="rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--color-danger)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_12%,transparent)] px-4 py-3 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--color-success)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-success)_12%,transparent)] px-4 py-3 text-sm text-[var(--color-success)]">
          {success}
        </div>
      ) : null}

      <section className="surface-glow p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-soft)]">
              {t('team.heroKicker', { defaultValue: 'Workspace governance layer' })}
            </p>
            <h2 className="mt-2 font-[var(--font-family-display)] text-[clamp(1.6rem,2.8vw,2.25rem)] font-semibold leading-[1.04] tracking-[-0.04em] text-[var(--color-text)]">
              {t('team.heroTitle', { defaultValue: 'Present a real access-controlled workspace with operators, reviewers and finance roles.' })}
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-[var(--color-text-muted)]">
              {t('team.heroText', { defaultValue: 'This directory turns the demo into an actual operating environment with seat coverage, access scopes and role separation.' })}
            </p>
          </div>

          <div className="grid w-full max-w-md grid-cols-2 gap-3">
            <div className="rounded-[18px] border border-[color-mix(in_srgb,var(--color-primary)_24%,transparent)] bg-[color-mix(in_srgb,var(--color-primary)_10%,transparent)] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-soft)]">{t('team.active', { defaultValue: 'Active' })}</p>
              <p className="mt-2 text-lg font-semibold text-[var(--color-text)]">{stats.active}</p>
            </div>
            <div className="rounded-[18px] border border-[color-mix(in_srgb,var(--color-success)_24%,transparent)] bg-[color-mix(in_srgb,var(--color-success)_10%,transparent)] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-soft)]">{t('team.mfaReady', { defaultValue: 'MFA ready' })}</p>
              <p className="mt-2 text-lg font-semibold text-[var(--color-text)]">{stats.mfaReady}</p>
            </div>
            <div className="rounded-[18px] border border-[color-mix(in_srgb,var(--color-info)_24%,transparent)] bg-[color-mix(in_srgb,var(--color-info)_10%,transparent)] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-soft)]">{t('team.invited', { defaultValue: 'Invited' })}</p>
              <p className="mt-2 text-lg font-semibold text-[var(--color-text)]">{stats.invited}</p>
            </div>
            <div className="rounded-[18px] border border-[color-mix(in_srgb,var(--color-warning)_24%,transparent)] bg-[color-mix(in_srgb,var(--color-warning)_10%,transparent)] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-soft)]">{t('team.departments', { defaultValue: 'Access zones' })}</p>
              <p className="mt-2 text-lg font-semibold text-[var(--color-text)]">{stats.accessZones}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricTrendCard label={t('team.active', { defaultValue: 'Active' })} value={String(stats.active)} icon={Users2} trend={[2, 3, 4, 4, 5, stats.active]} />
        <MetricTrendCard label={t('team.invited', { defaultValue: 'Invited' })} value={String(stats.invited)} icon={MailPlus} tone="info" trend={[1, 1, 2, 2, 2, stats.invited]} />
        <MetricTrendCard label={t('team.mfaReady', { defaultValue: 'MFA ready' })} value={String(stats.mfaReady)} icon={ShieldCheck} tone="success" trend={[1, 2, 2, 3, 4, stats.mfaReady]} />
        <MetricTrendCard label={t('team.departments', { defaultValue: 'Access zones' })} value={String(stats.accessZones)} icon={BadgeCheck} tone="warning" trend={[1, 1, 2, 3, 3, stats.accessZones]} />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-8">
          <section className="surface p-5 sm:p-6">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="section-title">{t('team.directory', { defaultValue: 'Workspace directory' })}</h2>
                <p className="section-subtitle mt-1">
                  {t('team.directoryHint', { defaultValue: 'Search stakeholders, reviewers, finance operators and delivery managers.' })}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <div className="relative min-w-[220px]">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-soft)]" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={t('team.search', { defaultValue: 'Search member, role or access' })}
                    className="h-10 w-full rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] pl-10 pr-3.5 text-sm text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-ring)]"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as 'ALL' | WorkspaceTeamMember['status'])}
                  className="h-10 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 text-sm text-[var(--color-text)]"
                >
                  <option value="ALL">{t('common.all', { defaultValue: 'All' })}</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INVITED">INVITED</option>
                  <option value="SUSPENDED">SUSPENDED</option>
                </select>
              </div>
            </div>

            <DataTable
              columns={columns}
              data={filteredMembers}
              rowKey={(row) => row.id}
              isLoading={isLoading}
              emptyTitle={t('team.emptyTitle', { defaultValue: 'No team members yet' })}
              emptyDescription={t('team.emptyDescription', { defaultValue: 'Invite finance, legal and reviewer roles to make the workspace look production-ready.' })}
            />
          </section>

          <section className="surface p-5 sm:p-6">
            <h2 className="section-title mb-4">{t('team.actions', { defaultValue: 'Access actions' })}</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {filteredMembers.slice(0, 4).map((member) => (
                <div key={member.id} className="surface-muted p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span
                        className="inline-flex h-11 w-11 items-center justify-center rounded-[14px] text-sm font-semibold text-white"
                        style={{ backgroundColor: member.avatarColor }}
                      >
                        {member.name.slice(0, 2).toUpperCase()}
                      </span>
                      <div>
                      <p className="font-semibold text-[var(--color-text)]">{member.name}</p>
                      <p className="text-xs text-[var(--color-text-soft)]">{member.title} • {member.location}</p>
                      </div>
                    </div>
                    <Badge variant={member.status === 'ACTIVE' ? 'success' : member.status === 'INVITED' ? 'info' : 'danger'}>
                      {member.status}
                    </Badge>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge variant="default">{member.role}</Badge>
                    {member.mfaEnabled ? <Badge variant="success">MFA</Badge> : <Badge variant="warning">No MFA</Badge>}
                    {member.seatsScope.slice(0, 2).map((scope) => (
                      <Badge key={scope} variant="info">{scope}</Badge>
                    ))}
                  </div>

                  <p className="mt-3 text-xs text-[var(--color-text-soft)]">
                    {member.permissions.slice(0, 3).join(' • ') || t('team.access', { defaultValue: 'Access' })}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {member.status !== 'ACTIVE' ? (
                      <Button type="button" size="sm" variant="outline" onClick={() => void handleStatusChange(member, 'ACTIVE')}>
                        {t('team.activate', { defaultValue: 'Activate' })}
                      </Button>
                    ) : null}
                    {member.status !== 'SUSPENDED' ? (
                      <Button type="button" size="sm" variant="ghost" onClick={() => void handleStatusChange(member, 'SUSPENDED')}>
                        {t('team.suspend', { defaultValue: 'Suspend' })}
                      </Button>
                    ) : null}
                    <Button type="button" size="sm" variant="ghost" onClick={() => void handleDelete(member.id)}>
                      {t('common.delete', { defaultValue: 'Delete' })}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-6 xl:col-span-4">
          <section className="surface p-5 sm:p-6">
            <h2 className="section-title mb-4">{t('team.inviteMember', { defaultValue: 'Invite member' })}</h2>
            <form className="space-y-3" onSubmit={handleCreateMember}>
              <Input
                label={t('auth.name', { defaultValue: 'Name' })}
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Aizada Abdykadyrova"
              />
              <Input
                label={t('auth.email', { defaultValue: 'Email' })}
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                placeholder="ops@workspace.kg"
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-[var(--color-text)]">{t('team.role', { defaultValue: 'Role' })}</span>
                  <select
                    value={form.role}
                    onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value as WorkspaceTeamMember['role'] }))}
                    className={selectClassName()}
                  >
                    {['ADMIN', 'FINANCE', 'LEGAL', 'OPERATIONS', 'VIEWER'].map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-[var(--color-text)]">{t('common.status', { defaultValue: 'Status' })}</span>
                  <select
                    value={form.status}
                    onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as WorkspaceTeamMember['status'] }))}
                    className={selectClassName()}
                  >
                    {['INVITED', 'ACTIVE'].map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <Input
                label={t('team.titleField', { defaultValue: 'Title' })}
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="Operations lead"
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input
                  label={t('team.department', { defaultValue: 'Location' })}
                  value={form.location}
                  onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))}
                  placeholder="Bishkek"
                />
                <Input
                  label={t('team.accessLevel', { defaultValue: 'Permissions' })}
                  value={form.permissionsText}
                  onChange={(event) => setForm((prev) => ({ ...prev, permissionsText: event.target.value }))}
                  placeholder="finance.read, documents.read"
                />
              </div>
              <Input
                label={t('team.scopeCoverage', { defaultValue: 'Access scope' })}
                value={form.seatsScopeText}
                onChange={(event) => setForm((prev) => ({ ...prev, seatsScopeText: event.target.value }))}
                placeholder="workspace, finance, documents"
              />
              <Button type="submit" className="w-full" isLoading={isSaving}>
                {t('team.sendInvite', { defaultValue: 'Add member' })}
              </Button>
            </form>
          </section>

          <section className="surface p-5 sm:p-6">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.08em] text-[var(--color-text-soft)]">
              {t('team.policyTitle', { defaultValue: 'Access policy' })}
            </h3>
            <div className="space-y-2 text-sm text-[var(--color-text-muted)]">
              <p>{t('team.policy1', { defaultValue: 'Separate finance, legal and reviewer roles to make approvals look realistic during local demo.' })}</p>
              <p>{t('team.policy2', { defaultValue: 'Use invited status for pending stakeholders and active status for production-ready operators.' })}</p>
              <p>{t('team.policy3', { defaultValue: 'Pair this page with activity log and security center to show enterprise governance.' })}</p>
            </div>
            <div className="mt-4 grid gap-2">
              <Link to={isFreelancer ? '/dashboard/freelancer/security' : '/dashboard/client/security'} className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm font-medium text-[var(--color-text)]">
                {t('topbar.securityCenter', { defaultValue: 'Security center' })}
              </Link>
              <Link to={isFreelancer ? '/dashboard/freelancer/activity' : '/dashboard/client/activity'} className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm font-medium text-[var(--color-text)]">
                {t('team.activityLog', { defaultValue: 'Activity log' })}
              </Link>
            </div>
          </section>
        </aside>
      </section>
    </DashboardShell>
  );
}

function selectClassName() {
  return 'h-11 w-full rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--color-border)_72%,transparent)] bg-[var(--color-surface)] px-3.5 text-sm text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-ring)]';
}
