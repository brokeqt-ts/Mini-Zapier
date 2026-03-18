import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { executionsApi, Execution } from '../api/executions.api';
import { useLangStore } from '../store/language.store';
import './ExecutionPages.css';

const levelColors: Record<string, string> = {
  INFO: '#3b82f6',
  WARN: '#f59e0b',
  ERROR: '#ef4444',
  DEBUG: '#8b5cf6',
};

export function ExecutionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [execution, setExecution] = useState<Execution | null>(null);
  const { t } = useLangStore();

  const statusLabel: Record<string, string> = {
    COMPLETED: t.status_COMPLETED,
    RUNNING: t.status_RUNNING,
    FAILED: t.status_FAILED,
    PENDING: t.status_PENDING,
    PAUSED: t.status_PAUSED,
    CANCELLED: t.status_CANCELLED,
  };

  const load = () => {
    if (!id) return;
    executionsApi.get(id).then(({ data }) => setExecution(data));
  };

  useEffect(() => {
    load();
  }, [id]);

  useEffect(() => {
    if (!execution || !['PENDING', 'RUNNING'].includes(execution.status)) return;
    const interval = setInterval(load, 2000);
    return () => clearInterval(interval);
  }, [execution?.status]);

  const handleRetry = async () => {
    if (!id) return;
    try {
      await executionsApi.retry(id);
      toast.success(t.retry_success);
    } catch {
      toast.error(t.retry_error);
    }
  };

  const handleCancel = async () => {
    if (!id) return;
    try {
      await executionsApi.cancel(id);
      toast.success(t.cancel_success);
      load();
    } catch {
      toast.error(t.cancel_error);
    }
  };

  if (!execution) return <div>{t.loading}</div>;

  return (
    <div className="exec-page">
      <div className="exec-header">
        <div>
          <h2>{t.execution} {execution.id.slice(0, 8)}</h2>
          <span
            className={`badge ${
              execution.status === 'COMPLETED'
                ? 'badge-success'
                : execution.status === 'FAILED'
                ? 'badge-error'
                : 'badge-gray'
            }`}
          >
            {statusLabel[execution.status] ?? execution.status}
          </span>
        </div>
        <div className="exec-actions">
          {execution.status === 'RUNNING' && (
            <button className="btn btn-danger" onClick={handleCancel}>
              {t.cancel}
            </button>
          )}
          {execution.status === 'FAILED' && (
            <button className="btn btn-primary" onClick={handleRetry}>
              {t.retry}
            </button>
          )}
          <Link
            to={`/workflows/${execution.workflowId}/executions`}
            className="btn btn-secondary"
          >
            {t.back}
          </Link>
        </div>
      </div>

      <div className="exec-info card">
        <div className="info-row">
          <span>{t.col_workflow_label}</span>
          <Link to={`/workflows/${execution.workflowId}`}>
            {execution.workflow?.name ?? execution.workflowId}
          </Link>
        </div>
        <div className="info-row">
          <span>{t.started}</span>
          <span>
            {execution.startedAt
              ? new Date(execution.startedAt).toLocaleString()
              : '-'}
          </span>
        </div>
        <div className="info-row">
          <span>{t.completed}</span>
          <span>
            {execution.completedAt
              ? new Date(execution.completedAt).toLocaleString()
              : '-'}
          </span>
        </div>
        {execution.errorMessage && (
          <div className="info-row error-row">
            <span>{t.error_label}</span>
            <span>{execution.errorMessage}</span>
          </div>
        )}
      </div>

      <h3>{t.exec_logs}</h3>
      <div className="logs-list">
        {execution.logs?.map((log) => (
          <div key={log.id} className="log-entry card">
            <div className="log-header">
              <span
                className="log-level"
                style={{ color: levelColors[log.level] }}
              >
                {log.level}
              </span>
              <span className="log-time">
                {new Date(log.createdAt).toLocaleTimeString()}
              </span>
              {log.durationMs != null && (
                <span className="log-duration">{log.durationMs}ms</span>
              )}
            </div>
            <div className="log-message">{log.message}</div>
            {log.outputData != null && (
              <details className="log-data">
                <summary>{t.output}</summary>
                <pre>{JSON.stringify(log.outputData as object, null, 2)}</pre>
              </details>
            )}
            {log.error && (
              <div className="log-error">{log.error}</div>
            )}
          </div>
        ))}
        {(!execution.logs || execution.logs.length === 0) && (
          <p className="empty-text">{t.no_logs}</p>
        )}
      </div>
    </div>
  );
}
