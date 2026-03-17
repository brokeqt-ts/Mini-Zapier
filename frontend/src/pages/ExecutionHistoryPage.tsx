import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { executionsApi, Execution } from '../api/executions.api';
import { useLangStore } from '../store/language.store';
import './ExecutionPages.css';

const statusBadge: Record<string, string> = {
  COMPLETED: 'badge-success',
  RUNNING: 'badge-info',
  FAILED: 'badge-error',
  PENDING: 'badge-gray',
  PAUSED: 'badge-warning',
  CANCELLED: 'badge-gray',
};

export function ExecutionHistoryPage() {
  const { id } = useParams<{ id: string }>();
  const [executions, setExecutions] = useState<Execution[]>([]);
  const { t } = useLangStore();

  const statusLabel: Record<string, string> = {
    COMPLETED: t.status_COMPLETED,
    RUNNING: t.status_RUNNING,
    FAILED: t.status_FAILED,
    PENDING: t.status_PENDING,
    PAUSED: t.status_PAUSED,
    CANCELLED: t.status_CANCELLED,
  };

  useEffect(() => {
    if (!id) return;
    executionsApi.listByWorkflow(id).then(({ data }) => setExecutions(data));
  }, [id]);

  const handleDelete = async (execId: string) => {
    if (!window.confirm(t.delete_confirm)) return;
    try {
      await executionsApi.delete(execId);
      setExecutions((prev) => prev.filter((e) => e.id !== execId));
      toast.success('✓');
    } catch {
      toast.error(t.delete_error);
    }
  };

  return (
    <div className="exec-page">
      <div className="exec-header">
        <h2>{t.exec_history}</h2>
        <Link to={`/workflows/${id}`} className="btn btn-secondary">
          {t.back_to_editor}
        </Link>
      </div>

      <table className="exec-table">
        <thead>
          <tr>
            <th>{t.col_id}</th>
            <th>{t.col_status}</th>
            <th>{t.col_started}</th>
            <th>{t.col_duration}</th>
            <th>{t.col_retries}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {executions.map((exec) => (
            <tr key={exec.id}>
              <td className="exec-id">{exec.id.slice(0, 8)}</td>
              <td>
                <span className={`badge ${statusBadge[exec.status]}`}>
                  {statusLabel[exec.status] ?? exec.status}
                </span>
              </td>
              <td>
                {exec.startedAt
                  ? new Date(exec.startedAt).toLocaleString()
                  : '-'}
              </td>
              <td>
                {exec.startedAt && exec.completedAt
                  ? `${Math.round(
                      (new Date(exec.completedAt).getTime() -
                        new Date(exec.startedAt).getTime()) /
                        1000,
                    )}s`
                  : '-'}
              </td>
              <td>{exec.retryCount}</td>
              <td style={{ display: 'flex', gap: '6px' }}>
                <Link to={`/executions/${exec.id}`} className="btn btn-secondary">
                  {t.open}
                </Link>
                <button
                  className="btn-trash-inline"
                  title={t.delete_confirm}
                  onClick={() => handleDelete(exec.id)}
                >
                  🗑
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {executions.length === 0 && (
        <p className="empty-text">{t.no_executions}</p>
      )}
    </div>
  );
}
