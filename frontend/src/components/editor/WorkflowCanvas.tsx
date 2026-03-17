import { useCallback, useRef, DragEvent } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useWorkflowEditorStore } from '../../store/workflow-editor.store';
import { TriggerNode } from './nodes/TriggerNode';
import { ActionNode } from './nodes/ActionNode';
import { ConditionalEdge } from './edges/ConditionalEdge';
import './WorkflowCanvas.css';

const nodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
};

const edgeTypes = {
  conditional: ConditionalEdge,
};

const defaultEdgeOptions = {
  type: 'conditional',
};

let nodeId = 0;
const getNewId = () => `node_${Date.now()}_${nodeId++}`;

export function WorkflowCanvas() {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    selectNode,
    selectEdge,
  } = useWorkflowEditorStore();

  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();

      const data = event.dataTransfer.getData('application/reactflow');
      if (!data) return;

      const { nodeType, label } = JSON.parse(data);
      const bounds = (event.target as HTMLElement)
        .closest('.react-flow')
        ?.getBoundingClientRect();
      if (!bounds || !reactFlowInstance.current) return;

      const position = reactFlowInstance.current.screenToFlowPosition({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });

      const type = nodeType.startsWith('TRIGGER_') ? 'trigger' : 'action';

      addNode({
        id: getNewId(),
        type,
        position,
        data: { label, nodeType, config: {} },
      });
    },
    [addNode],
  );

  const onDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  return (
    <div className="canvas-wrapper">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onInit={(instance) => {
          reactFlowInstance.current = instance;
        }}
        onNodeClick={(_event, node) => selectNode(node.id)}
        onEdgeClick={(_event, edge) => selectEdge(edge.id)}
        onPaneClick={() => {
          selectNode(null);
          selectEdge(null);
        }}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        snapToGrid
        snapGrid={[15, 15]}
      >
        <Background gap={15} />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
