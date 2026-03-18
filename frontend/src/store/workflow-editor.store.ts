import { create } from 'zustand';
import {
  Node,
  Edge,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  Connection,
} from '@xyflow/react';

interface WorkflowEditorState {
  workflowId: string | null;
  workflowName: string;
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  setWorkflow: (id: string, name: string, nodes: Node[], edges: Edge[]) => void;
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  addNode: (node: Node) => void;
  deleteNode: (nodeId: string) => void;
  updateNodeConfig: (nodeId: string, config: Record<string, unknown>) => void;
  updateNodeLabel: (nodeId: string, label: string) => void;
  selectNode: (nodeId: string | null) => void;
  selectEdge: (edgeId: string | null) => void;
  updateEdgeCondition: (edgeId: string, conditionExpr: string) => void;
  setWorkflowName: (name: string) => void;
  clear: () => void;
}

export const useWorkflowEditorStore = create<WorkflowEditorState>(
  (set, get) => ({
    workflowId: null,
    workflowName: '',
    nodes: [],
    edges: [],
    selectedNodeId: null,
    selectedEdgeId: null,

    setWorkflow: (id, name, nodes, edges) =>
      set({
        workflowId: id,
        workflowName: name,
        nodes,
        edges,
        selectedNodeId: null,
        selectedEdgeId: null,
      }),

    onNodesChange: (changes) =>
      set({ nodes: applyNodeChanges(changes, get().nodes) }),

    onEdgesChange: (changes) =>
      set({ edges: applyEdgeChanges(changes, get().edges) }),

    onConnect: (connection: Connection) =>
      set({ edges: addEdge(connection, get().edges) }),

    addNode: (node) => set({ nodes: [...get().nodes, node] }),

    deleteNode: (nodeId) =>
      set({
        nodes: get().nodes.filter((n) => n.id !== nodeId),
        edges: get().edges.filter(
          (e) => e.source !== nodeId && e.target !== nodeId,
        ),
        selectedNodeId:
          get().selectedNodeId === nodeId ? null : get().selectedNodeId,
      }),

    updateNodeConfig: (nodeId, config) =>
      set({
        nodes: get().nodes.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, config } } : n,
        ),
      }),

    updateNodeLabel: (nodeId, label) =>
      set({
        nodes: get().nodes.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, label } } : n,
        ),
      }),

    selectNode: (nodeId) =>
      set({ selectedNodeId: nodeId, selectedEdgeId: null }),

    selectEdge: (edgeId) =>
      set({ selectedEdgeId: edgeId, selectedNodeId: null }),

    updateEdgeCondition: (edgeId, conditionExpr) =>
      set({
        edges: get().edges.map((e) =>
          e.id === edgeId
            ? { ...e, data: { ...e.data, conditionExpr } }
            : e,
        ),
      }),

    setWorkflowName: (name) => set({ workflowName: name }),

    clear: () =>
      set({
        workflowId: null,
        workflowName: '',
        nodes: [],
        edges: [],
        selectedNodeId: null,
        selectedEdgeId: null,
      }),
  }),
);
