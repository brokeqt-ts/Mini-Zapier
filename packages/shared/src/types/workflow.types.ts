export enum WorkflowStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  ERROR = 'ERROR',
}

export enum NodeType {
  TRIGGER_WEBHOOK = 'TRIGGER_WEBHOOK',
  TRIGGER_CRON = 'TRIGGER_CRON',
  TRIGGER_EMAIL = 'TRIGGER_EMAIL',
  ACTION_HTTP_REQUEST = 'ACTION_HTTP_REQUEST',
  ACTION_EMAIL = 'ACTION_EMAIL',
  ACTION_TELEGRAM = 'ACTION_TELEGRAM',
  ACTION_DB_QUERY = 'ACTION_DB_QUERY',
  ACTION_DATA_TRANSFORM = 'ACTION_DATA_TRANSFORM',
}

export const TRIGGER_TYPES = [
  NodeType.TRIGGER_WEBHOOK,
  NodeType.TRIGGER_CRON,
  NodeType.TRIGGER_EMAIL,
] as const;

export const ACTION_TYPES = [
  NodeType.ACTION_HTTP_REQUEST,
  NodeType.ACTION_EMAIL,
  NodeType.ACTION_TELEGRAM,
  NodeType.ACTION_DB_QUERY,
  NodeType.ACTION_DATA_TRANSFORM,
] as const;

export function isTriggerType(type: NodeType): boolean {
  return (TRIGGER_TYPES as readonly NodeType[]).includes(type);
}

export interface WorkflowNodeData {
  id: string;
  type: NodeType;
  label: string;
  config: Record<string, unknown>;
  positionX: number;
  positionY: number;
}

export interface WorkflowEdgeData {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  conditionExpr?: string;
}
