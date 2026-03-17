import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { workflowsApi, Workflow } from '../api/workflows.api';
import { useWorkflowEditorStore } from '../store/workflow-editor.store';
import { useLangStore } from '../store/language.store';
import { WorkflowCanvas } from '../components/editor/WorkflowCanvas';
import { NodePalette } from '../components/editor/NodePalette';
import { NodeConfigPanel } from '../components/editor/panels/NodeConfigPanel';
import { EdgeConfigPanel } from '../components/editor/panels/EdgeConfigPanel';
import './WorkflowEditorPage.css';

export function WorkflowEditorPage() {
  const { id } = useParams<{ id: string }>();
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [saving, setSaving] = useState(false);
  const store = useWorkflowEditorStore();
  const { t } = useLangStore();

  useEffect(() => {
    if (!id) return;
    workflowsApi.get(id).then(({ data }) => {
      setWorkflow(data);
      const nodes = (data.nodes || []).map((n) => ({
        id: n.id,
        type: n.type.startsWith('TRIGGER_') ? 'trigger' : 'action',
        position: { x: n.positionX, y: n.positionY },
        data: { label: n.label, nodeType: n.type, config: n.config },
      }));
      const edges = (data.edges || []).map((e) => ({
        id: e.id,
        source: e.sourceNodeId,
        target: e.targetNodeId,
        data: { conditionExpr: e.conditionExpr },
      }));
      store.setWorkflow(id, data.name, nodes, edges);
    });

    return () => store.clear();
  }, [id]);

  const handleSave = useCallback(async () => {
    if (!id) return;
    setSaving(true);
    try {
      const nodes = store.nodes.map((n) => ({
        id: n.id,
        type: n.data.nodeType as string,
        label: (n.data.label as string) || 'Untitled',
        config: (n.data.config as Record<string, unknown>) || {},
        positionX: n.position.x,
        positionY: n.position.y,
      }));
      const edges = store.edges.map((e) => ({
        id: e.id,
        sourceNodeId: e.source,
        targetNodeId: e.target,
        conditionExpr: e.data?.conditionExpr as string | undefined,
      }));

      await workflowsApi.saveCanvas(id, { nodes, edges });

      if (store.workflowName !== workflow?.name) {
        await workflowsApi.update(id, { name: store.workflowName });
      }

      toast.success(t.saved);
    } catch {
      toast.error(t.save_error);
    } finally {
      setSaving(false);
    }
  }, [id, store.nodes, store.edges, store.workflowName, workflow?.name, t]);

  const handleActivate = async () => {
    if (!id) return;
    try {
      const { data } = await workflowsApi.activate(id);
      setWorkflow(data);
      toast.success(t.activate_success);
    } catch {
      toast.error(t.activate_error);
    }
  };

  const handleDeactivate = async () => {
    if (!id) return;
    try {
      const { data } = await workflowsApi.deactivate(id);
      setWorkflow(data);
      toast.success(t.deactivate_success);
    } catch {
      toast.error(t.deactivate_error);
    }
  };

  const handleTestRun = async () => {
    if (!id) return;
    try {
      await workflowsApi.execute(id);
      toast.success(t.test_success);
    } catch {
      toast.error(t.test_error);
    }
  };

  if (!workflow) return <div>{t.loading}</div>;

  return (
    <div className="editor-page">
      <div className="editor-toolbar">
        <input
          className="input wf-name-input"
          value={store.workflowName}
          onChange={(e) => store.setWorkflowName(e.target.value)}
        />
        <div className="toolbar-actions">
          <Link
            to={`/workflows/${id}/executions`}
            className="btn btn-secondary"
          >
            {t.history}
          </Link>
          <button className="btn btn-secondary" onClick={handleTestRun}>
            {t.test_run}
          </button>
          {workflow.status === 'ACTIVE' ? (
            <button className="btn btn-secondary" onClick={handleDeactivate}>
              {t.deactivate}
            </button>
          ) : (
            <button className="btn btn-secondary" onClick={handleActivate}>
              {t.activate}
            </button>
          )}
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? t.saving : t.save}
          </button>
        </div>
      </div>
      <div className="editor-body">
        <NodePalette />
        <WorkflowCanvas />
        {store.selectedNodeId && <NodeConfigPanel />}
        {store.selectedEdgeId && <EdgeConfigPanel />}
      </div>
    </div>
  );
}
