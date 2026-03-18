import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { workflowsApi, Workflow } from '../api/workflows.api';
import { dashboardApi, DashboardStats } from '../api/dashboard.api';
import { Execution } from '../api/executions.api';
import { useLangStore } from '../store/language.store';
import './DashboardPage.css';

const statusBadge: Record<string, string> = {
  DRAFT: 'badge-gray',
  ACTIVE: 'badge-success',
  PAUSED: 'badge-warning',
  ERROR: 'badge-error',
  COMPLETED: 'badge-success',
  RUNNING: 'badge-info',
  FAILED: 'badge-error',
  PENDING: 'badge-gray',
};

export function DashboardPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentExecs, setRecentExecs] = useState<Execution[]>([]);
  const [newName, setNewName] = useState('');
  const { t } = useLangStore();
  const navigate = useNavigate();

  const statusLabel: Record<string, string> = {
    DRAFT: t.status_DRAFT,
    ACTIVE: t.status_ACTIVE,
    PAUSED: t.status_PAUSED,
    ERROR: t.status_ERROR,
    COMPLETED: t.status_COMPLETED,
    RUNNING: t.status_RUNNING,
    FAILED: t.status_FAILED,
    PENDING: t.status_PENDING,
    CANCELLED: t.status_CANCELLED,
  };

  const load = async () => {
    try {
      const [wf, st, re] = await Promise.all([
        workflowsApi.list(),
        dashboardApi.getStats(),
        dashboardApi.getRecentExecutions(),
      ]);
      setWorkflows(wf.data);
      setStats(st.data);
      setRecentExecs(re.data);
    } catch {
      toast.error(t.load_error);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const { data } = await workflowsApi.create({ name: newName.trim() });
      setNewName('');
      navigate(`/workflows/${data.id}`);
    } catch {
      toast.error(t.create_error);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(t.delete_confirm)) return;
    try {
      await workflowsApi.delete(id);
      setWorkflows((prev) => prev.filter((w) => w.id !== id));
      toast.success('✓');
    } catch {
      toast.error(t.delete_error);
    }
  };

  return (
    <div className="dashboard">
      <h2>{t.dashboard}</h2>

      <div className="dashboard-layout">
        {/* ── Left column ── */}
        <div className="dashboard-main">
          {stats && (
            <div className="stats-row">
              <div className="stat-card card">
                <div className="stat-value">{stats.totalWorkflows}</div>
                <div className="stat-label">{t.total_workflows}</div>
              </div>
              <div className="stat-card card">
                <div className="stat-value">{stats.activeWorkflows}</div>
                <div className="stat-label">{t.active_count}</div>
              </div>
              <div className="stat-card card">
                <div className="stat-value">{stats.totalExecutions}</div>
                <div className="stat-label">{t.total_executions}</div>
              </div>
              <div className="stat-card card">
                <div className="stat-value">{stats.successRate}%</div>
                <div className="stat-label">{t.success_rate}</div>
              </div>
            </div>
          )}

          <div className="section">
            <h3>{t.workflows_section}</h3>
            <div className="create-row">
              <input
                className="input"
                placeholder={t.new_workflow_placeholder}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
              <button className="btn btn-primary" onClick={handleCreate}>
                {t.create}
              </button>
            </div>
            <div className="workflow-grid">
              {workflows.map((wf) => (
                <div key={wf.id} style={{ position: 'relative' }}>
                  <Link to={`/workflows/${wf.id}`} className="card workflow-card">
                    <div className="wf-header">
                      <span className="wf-name">{wf.name}</span>
                      <span className={`badge ${statusBadge[wf.status]}`}>
                        {statusLabel[wf.status] ?? wf.status}
                      </span>
                    </div>
                    {wf.description && (
                      <p className="wf-desc">{wf.description}</p>
                    )}
                    <div className="wf-meta">
                      <span>{wf._count?.nodes ?? 0} {t.nodes_count}</span>
                      <span>{wf._count?.executions ?? 0} {t.executions_count}</span>
                    </div>
                  </Link>
                  <button
                    className="btn-trash"
                    title={t.delete_confirm}
                    onClick={(e) => handleDelete(e, wf.id)}
                  >
                    🗑
                  </button>
                </div>
              ))}
              {workflows.length === 0 && (
                <p className="empty-text">{t.no_workflows}</p>
              )}
            </div>
          </div>
        </div>

        {/* ── Right column: recent executions ── */}
        {recentExecs.length > 0 && (
          <div className="dashboard-sidebar">
            <h3>{t.recent_executions}</h3>
            <div className="exec-list">
              {recentExecs.slice(0, 15).map((exec) => (
                <Link key={exec.id} to={`/executions/${exec.id}`} className="exec-item">
                  <div className="exec-item-name">
                    {exec.workflow?.name ?? exec.workflowId.slice(0, 8)}
                  </div>
                  <div className="exec-item-meta">
                    <span className={`badge ${statusBadge[exec.status]}`}>
                      {statusLabel[exec.status] ?? exec.status}
                    </span>
                    <span className="exec-item-time">
                      {exec.startedAt
                        ? new Date(exec.startedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                        : '-'}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
