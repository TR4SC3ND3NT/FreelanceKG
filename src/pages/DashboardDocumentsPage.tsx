import { type ChangeEvent, type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Archive,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  FileWarning,
  Plus,
  RefreshCcw,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import api, { WorkspaceDocument, WorkspaceDocumentStatus, WorkspaceDocumentType } from '@/services/api';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { getClientSidebarItems, getFreelancerSidebarItems } from '@/components/dashboard/dashboardNav';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { useTranslation } from 'react-i18next';
import { formatDateTime } from '@/utils/locale';
import { WORKSPACE_PATH } from '@/utils/routes';

interface DocumentFormState {
  title: string;
  type: WorkspaceDocumentType;
  status: WorkspaceDocumentStatus;
  notes: string;
  file: File | null;
}

const DEFAULT_FORM: DocumentFormState = {
  title: '',
  type: 'BRIEF',
  status: 'DRAFT',
  notes: '',
  file: null,
};

function typeIcon(type: WorkspaceDocumentType) {
  if (type === 'INVOICE' || type === 'STATEMENT') return <FileSpreadsheet className="h-4 w-4" />;
  if (type === 'AGREEMENT' || type === 'ID') return <FileWarning className="h-4 w-4" />;
  return <FileText className="h-4 w-4" />;
}

function statusVariant(
  status: WorkspaceDocumentStatus
): 'default' | 'success' | 'warning' | 'danger' | 'info' {
  if (status === 'SIGNED') return 'success';
  if (status === 'UNDER_REVIEW') return 'info';
  if (status === 'ARCHIVED') return 'default';
  return 'warning';
}

export function DashboardDocumentsPage() {
  const { t, i18n } = useTranslation();
  const { isDark } = useTheme();
  const { user, logout } = useAuth();
  const [documents, setDocuments] = useState<WorkspaceDocument[]>([]);
  const [form, setForm] = useState<DocumentFormState>(DEFAULT_FORM);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [busyDocumentId, setBusyDocumentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isWorkspaceUser = user?.role === 'CLIENT' || user?.role === 'FREELANCER';

  const loadDocuments = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await api.getWorkspaceDocuments();
      setDocuments(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('documents.loadFailed', { defaultValue: 'Failed to load documents' })
      );
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const sidebarItems = useMemo(() => {
    if (!user) return [];
    return user.role === 'FREELANCER' ? getFreelancerSidebarItems() : getClientSidebarItems();
  }, [user]);

  const reviewCount = useMemo(
    () => documents.filter((item) => item.status === 'UNDER_REVIEW').length,
    [documents]
  );

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({
      ...prev,
      file: event.target.files?.[0] || null,
    }));
  };

  const handleCreateDocument = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setIsSaving(true);
      setError(null);
      setSuccess(null);

      let uploaded:
        | {
            url: string;
            originalName?: string;
            fileName?: string;
            size?: number;
          }
        | undefined;

      if (form.file) {
        uploaded = await api.uploadFile(form.file);
      }

      const created = await api.createWorkspaceDocument({
        title: form.title.trim(),
        type: form.type,
        status: form.status,
        fileUrl: uploaded?.url,
        fileName: uploaded?.originalName || uploaded?.fileName || form.file?.name,
        size: uploaded?.size || form.file?.size,
        notes: form.notes.trim() || undefined,
      });

      setDocuments((prev) => [created, ...prev]);
      setForm({
        ...DEFAULT_FORM,
        type: form.type,
      });
      setSuccess(t('documents.created', { defaultValue: 'Document added to workspace' }));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('documents.createFailed', { defaultValue: 'Failed to create document' })
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (
    document: WorkspaceDocument,
    status: WorkspaceDocumentStatus
  ) => {
    try {
      setBusyDocumentId(document.id);
      setError(null);

      const updated = await api.updateWorkspaceDocument(document.id, { status });
      setDocuments((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('documents.statusFailed', { defaultValue: 'Failed to update document status' })
      );
    } finally {
      setBusyDocumentId(null);
    }
  };

  const handleDelete = async (documentId: string) => {
    try {
      setBusyDocumentId(documentId);
      setError(null);
      await api.deleteWorkspaceDocument(documentId);
      setDocuments((prev) => prev.filter((item) => item.id !== documentId));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('documents.deleteFailed', { defaultValue: 'Failed to delete document' })
      );
    } finally {
      setBusyDocumentId(null);
    }
  };

  if (!user) return <Navigate to="/login" replace />;
  if (!isWorkspaceUser) return <Navigate to={WORKSPACE_PATH} replace />;

  const columns: Array<DataTableColumn<WorkspaceDocument>> = [
    {
      key: 'title',
      header: t('documents.table.document', { defaultValue: 'Document' }),
      className: 'min-w-[280px]',
      render: (item) => (
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-soft)]">
            {typeIcon(item.type)}
          </span>
          <div>
            <p className="font-semibold text-[var(--color-text)]">{item.title}</p>
            <p className="text-xs text-[var(--color-text-soft)]">
              {[item.type, item.fileName].filter(Boolean).join(' • ')}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: t('common.status', { defaultValue: 'Status' }),
      render: (item) => <Badge variant={statusVariant(item.status)}>{item.status}</Badge>,
    },
    {
      key: 'date',
      header: t('documents.updatedAt', { defaultValue: 'Updated' }),
      render: (item) => formatDateTime(item.updatedAt || item.createdAt, i18n.language),
    },
    {
      key: 'actions',
      header: t('common.actions', { defaultValue: 'Actions' }),
      className: 'min-w-[280px] text-right',
      cellClassName: 'text-right',
      render: (item) => (
        <div className="flex flex-wrap justify-end gap-2">
          {item.fileUrl ? (
            <>
              <a
                href={item.fileUrl}
                target="_blank"
                rel="noreferrer"
                className={actionLinkClassName()}
              >
                <Eye className="h-3.5 w-3.5" />
                {t('documents.open', { defaultValue: 'Open' })}
              </a>
              <a href={item.fileUrl} download className={actionLinkClassName()}>
                <Download className="h-3.5 w-3.5" />
                {t('documents.download', { defaultValue: 'Download' })}
              </a>
            </>
          ) : null}

          {item.status === 'DRAFT' ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busyDocumentId === item.id}
              onClick={() => void handleStatusChange(item, 'UNDER_REVIEW')}
            >
              {t('documents.sendToReview', { defaultValue: 'To review' })}
            </Button>
          ) : null}

          {item.status === 'UNDER_REVIEW' ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busyDocumentId === item.id}
              onClick={() => void handleStatusChange(item, 'SIGNED')}
            >
              {t('documents.sign', { defaultValue: 'Sign' })}
            </Button>
          ) : null}

          {item.status === 'SIGNED' ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busyDocumentId === item.id}
              onClick={() => void handleStatusChange(item, 'ARCHIVED')}
            >
              <Archive className="h-3.5 w-3.5" />
              {t('documents.archive', { defaultValue: 'Archive' })}
            </Button>
          ) : null}

          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={busyDocumentId === item.id}
            onClick={() => void handleDelete(item.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            {t('common.delete', { defaultValue: 'Delete' })}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <DashboardShell
      isDark={isDark}
      sidebarTitle={user.name || t('topbar.user')}
      sidebarSubtitle={t('topbar.workspace')}
      sidebarItems={sidebarItems}
      onLogout={logout}
    >
      <PageHeader
        title={t('documents.title', { defaultValue: 'Documents center' })}
        subtitle={t('documents.subtitle', {
          defaultValue: 'Store briefs, invoices, agreements and portfolio files in one workspace feed.',
        })}
        badges={
          <>
            <Badge variant="info">
              {t('documents.total', { defaultValue: 'Documents' })}: {documents.length}
            </Badge>
            <Badge variant="warning">
              {t('documents.review', { defaultValue: 'In review' })}: {reviewCount}
            </Badge>
          </>
        }
        actions={
          <Button type="button" variant="outline" onClick={() => void loadDocuments()}>
            <RefreshCcw className="h-4 w-4" />
            {t('common.refresh', { defaultValue: 'Refresh' })}
          </Button>
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

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-8">
          <section className="surface p-5 sm:p-6">
            <DataTable
              columns={columns}
              data={documents}
              rowKey={(row) => row.id}
              isLoading={isLoading}
              emptyTitle={t('documents.emptyTitle', { defaultValue: 'No documents yet' })}
              emptyDescription={t('documents.emptyDescription', {
                defaultValue: 'Add a brief, agreement, ID file or invoice to make the workspace look production-ready.',
              })}
            />
          </section>

          <section className="surface p-5 sm:p-6">
            <h2 className="mb-3 text-lg font-semibold text-[var(--color-text)]">
              {t('documents.legalTitle', { defaultValue: 'Workspace shortcuts' })}
            </h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <Link
                to={user.role === 'CLIENT' ? '/dashboard/client/finance' : '/dashboard/freelancer/finance'}
                className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3 text-sm font-medium text-[var(--color-text)]"
              >
                {t('sidebar.items.finance', { defaultValue: 'Finance' })}
              </Link>
              <Link
                to={user.role === 'CLIENT' ? '/dashboard/client/support' : '/dashboard/freelancer/support'}
                className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3 text-sm font-medium text-[var(--color-text)]"
              >
                {t('sidebar.items.support', { defaultValue: 'Support' })}
              </Link>
              <Link
                to="/terms"
                className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3 text-sm font-medium text-[var(--color-text)]"
              >
                {t('documents.platformTerms', { defaultValue: 'Platform terms' })}
              </Link>
            </div>
          </section>
        </div>

        <aside className="space-y-6 xl:col-span-4">
          <section className="surface p-5 sm:p-6">
            <h2 className="mb-4 text-lg font-semibold text-[var(--color-text)]">
              {t('documents.newDocument', { defaultValue: 'New document' })}
            </h2>
            <form className="space-y-3" onSubmit={handleCreateDocument}>
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--color-text)]">
                  {t('documents.titleField', { defaultValue: 'Title' })}
                </span>
                <input
                  value={form.title}
                  onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder={t('documents.titlePlaceholder', { defaultValue: 'Website redesign brief' })}
                  className={inputClassName()}
                  disabled={isSaving}
                />
              </label>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-[var(--color-text)]">
                    {t('documents.type', { defaultValue: 'Type' })}
                  </span>
                  <select
                    value={form.type}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        type: event.target.value as WorkspaceDocumentType,
                      }))
                    }
                    className={inputClassName()}
                    disabled={isSaving}
                  >
                    {(['BRIEF', 'AGREEMENT', 'INVOICE', 'REPORT', 'ID', 'PORTFOLIO', 'STATEMENT'] as const).map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-[var(--color-text)]">
                    {t('documents.initialStatus', { defaultValue: 'Initial status' })}
                  </span>
                  <select
                    value={form.status}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        status: event.target.value as WorkspaceDocumentStatus,
                      }))
                    }
                    className={inputClassName()}
                    disabled={isSaving}
                  >
                    {(['DRAFT', 'UNDER_REVIEW', 'SIGNED', 'ARCHIVED'] as const).map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--color-text)]">
                  {t('documents.notes', { defaultValue: 'Notes' })}
                </span>
                <textarea
                  value={form.notes}
                  onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                  rows={4}
                  placeholder={t('documents.notesPlaceholder', {
                    defaultValue: 'Describe the version, counterparty or approval notes for this document.',
                  })}
                  className={textareaClassName()}
                  disabled={isSaving}
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--color-text)]">
                  {t('documents.file', { defaultValue: 'File' })}
                </span>
                <label className="inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 text-sm font-medium text-[var(--color-text)]">
                  <Upload className="h-4 w-4" />
                  {form.file?.name || t('documents.attachFile', { defaultValue: 'Attach file' })}
                  <input type="file" className="hidden" onChange={handleFileChange} disabled={isSaving} />
                </label>
              </label>

              <Button type="submit" isLoading={isSaving} className="w-full">
                <Plus className="h-4 w-4" />
                {t('documents.addAction', { defaultValue: 'Add document' })}
              </Button>
            </form>
          </section>

          <section className="surface p-5 sm:p-6">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-primary)]">
              <ShieldCheck className="h-4 w-4" />
              {t('documents.opsTitle', { defaultValue: 'Ops checklist' })}
            </p>
            <div className="mt-3 space-y-2 text-sm text-[var(--color-text-muted)]">
              <p>{t('documents.opsLine1', { defaultValue: 'Upload briefs, invoices and signed agreements to make order flows look complete.' })}</p>
              <p>{t('documents.opsLine2', { defaultValue: 'Use status transitions Draft -> Review -> Signed -> Archived during the local demo.' })}</p>
              <p>{t('documents.opsLine3', { defaultValue: 'Files are stored through the real upload endpoint and records are saved in workspace storage.' })}</p>
            </div>
          </section>
        </aside>
      </section>
    </DashboardShell>
  );
}

function inputClassName() {
  return 'h-11 w-full rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--color-border)_72%,transparent)] bg-[var(--color-surface)] px-3.5 text-sm text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-ring)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-ring)_30%,transparent)]';
}

function textareaClassName() {
  return 'w-full rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--color-border)_72%,transparent)] bg-[var(--color-surface)] px-3.5 py-3 text-sm text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-ring)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-ring)_30%,transparent)]';
}

function actionLinkClassName() {
  return 'inline-flex h-9 items-center gap-1 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-xs font-semibold text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-2)]';
}
