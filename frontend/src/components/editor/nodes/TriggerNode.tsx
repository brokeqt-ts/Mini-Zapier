import { Handle, Position, NodeProps } from '@xyflow/react';
import { useLangStore } from '../../../store/language.store';
import { useWorkflowEditorStore } from '../../../store/workflow-editor.store';
import './Nodes.css';

export function TriggerNode({ id, data }: NodeProps) {
  const { t } = useLangStore();
  const deleteNode = useWorkflowEditorStore((s) => s.deleteNode);

  return (
    <div className="custom-node trigger-node">
      <div className="node-header trigger-header">
        {t.trigger}
        <button
          className="node-delete-btn"
          title="Удалить узел"
          onClick={(e) => {
            e.stopPropagation();
            deleteNode(id);
          }}
        >
          🗑
        </button>
      </div>
      <div className="node-body">
        <div className="node-label">{data.label as string}</div>
        <div className="node-type">{(data.nodeType as string).replace('TRIGGER_', '')}</div>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
