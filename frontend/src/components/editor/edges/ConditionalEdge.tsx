import {
  BaseEdge,
  EdgeLabelRenderer,
  EdgeProps,
  getBezierPath,
} from '@xyflow/react';
import { useWorkflowEditorStore } from '../../../store/workflow-editor.store';
import { useLangStore } from '../../../store/language.store';
import './ConditionalEdge.css';

export function ConditionalEdge(props: EdgeProps) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data } = props;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const selectEdge = useWorkflowEditorStore((s) => s.selectEdge);
  const { t } = useLangStore();
  const conditionExpr = (data?.conditionExpr as string) || '';

  return (
    <>
      <BaseEdge path={edgePath} />
      <EdgeLabelRenderer>
        <div
          className="edge-label-container"
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
        >
          <button
            className="edge-label-btn"
            onClick={(e) => {
              e.stopPropagation();
              selectEdge(id);
            }}
            title={conditionExpr || t.add_condition}
          >
            {conditionExpr ? 'if(...)' : '+'}
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
