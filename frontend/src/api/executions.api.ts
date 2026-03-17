import api from './client';

export interface Execution {
  id: string;
  workflowId: string;
  status: string;
  triggerData: Record<string, unknown> | null;
  context: Record<string, unknown>;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  retryCount: number;
  createdAt: string;
  workflow?: { id: string; name: string };
  logs?: ExecutionLog[];
}

export interface ExecutionLog {
  id: string;
  nodeId: string | null;
  level: string;
  message: string;
  inputData: unknown;
  outputData: unknown;
  error: string | null;
  durationMs: number | null;
  createdAt: string;
}

export const executionsApi = {
  listByWorkflow: (workflowId: string) =>
    api.get<Execution[]>(`/workflows/${workflowId}/executions`),

  get: (id: string) => api.get<Execution>(`/executions/${id}`),

  cancel: (id: string) => api.post(`/executions/${id}/cancel`),

  retry: (id: string) => api.post<Execution>(`/executions/${id}/retry`),

  delete: (id: string) => api.delete(`/executions/${id}`),
};
