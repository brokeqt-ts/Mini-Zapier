import api from './client';
import { Execution } from './executions.api';

export interface DashboardStats {
  totalWorkflows: number;
  activeWorkflows: number;
  totalExecutions: number;
  failedExecutions: number;
  successRate: number;
}

export const dashboardApi = {
  getStats: () => api.get<DashboardStats>('/dashboard/stats'),

  getRecentExecutions: () =>
    api.get<Execution[]>('/dashboard/recent-executions'),
};
