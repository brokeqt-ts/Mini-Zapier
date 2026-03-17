import api from './client';

export interface Workflow {
  id: string;
  name: string;
  description: string | null;
  status: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  _count?: { nodes: number; executions: number };
  nodes?: WorkflowNode[];
  edges?: WorkflowEdge[];
}

export interface WorkflowNode {
  id: string;
  type: string;
  label: string;
  config: Record<string, unknown>;
  positionX: number;
  positionY: number;
}

export interface WorkflowEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  conditionExpr?: string;
}

export const workflowsApi = {
  list: () => api.get<Workflow[]>('/workflows'),

  get: (id: string) => api.get<Workflow>(`/workflows/${id}`),

  create: (data: { name: string; description?: string }) =>
    api.post<Workflow>('/workflows', data),

  update: (id: string, data: { name?: string; description?: string }) =>
    api.put<Workflow>(`/workflows/${id}`, data),

  delete: (id: string) => api.delete(`/workflows/${id}`),

  saveCanvas: (
    id: string,
    data: { nodes: WorkflowNode[]; edges: WorkflowEdge[] },
  ) => api.put<Workflow>(`/workflows/${id}/canvas`, data),

  activate: (id: string) => api.post<Workflow>(`/workflows/${id}/activate`),

  deactivate: (id: string) =>
    api.post<Workflow>(`/workflows/${id}/deactivate`),

  execute: (id: string) =>
    api.post<{ id: string }>(`/workflows/${id}/execute`),
};
