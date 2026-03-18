import { useState, useRef, useEffect } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { useLangStore } from '../../../store/language.store';
import { useWorkflowEditorStore } from '../../../store/workflow-editor.store';
import './Nodes.css';

export function ActionNode({ id, data }: NodeProps) {
  const { t } = useLangStore();

  const NODE_TYPE_DISPLAY: Record<string, string> = {
    ACTION_HTTP_REQUEST:    t.node_type_http,
    ACTION_EMAIL:           t.node_type_email_action,
    ACTION_TELEGRAM:        'Telegram',
    ACTION_DB_QUERY:        t.node_type_db,
    ACTION_DATA_TRANSFORM:  t.node_type_transform,
  };
  const deleteNode      = useWorkflowEditorStore((s) => s.deleteNode);
  const updateNodeLabel = useWorkflowEditorStore((s) => s.updateNodeLabel);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDraft(data.label as string);
    setEditing(true);
  };

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed) updateNodeLabel(id, trimmed);
    setEditing(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commit();
    if (e.key === 'Escape') setEditing(false);
  };

  const nodeType = data.nodeType as string;
  const typeDisplay = NODE_TYPE_DISPLAY[nodeType] ?? nodeType.replace('ACTION_', '');

  return (
    <div className="custom-node action-node">
      <div className="node-header action-header">
        {t.action}
        <button
          className="node-delete-btn"
          title={t.delete_node}
          onClick={(e) => { e.stopPropagation(); deleteNode(id); }}
        >
          🗑
        </button>
      </div>
      <div className="node-body">
        {editing ? (
          <input
            ref={inputRef}
            className="node-label-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={onKeyDown}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div className="node-label node-label-editable" onDoubleClick={startEdit} title={t.rename_hint}>
            {data.label as string}
          </div>
        )}
        <div className="node-type">{typeDisplay}</div>
      </div>
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
