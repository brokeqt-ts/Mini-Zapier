import type { Node } from '@xyflow/react';
import type { Lang } from '../../../i18n/translations';

export const TRIGGER_NODE_TYPES = ['TRIGGER_WEBHOOK', 'TRIGGER_CRON', 'TRIGGER_EMAIL'];

export interface FieldSuggestion {
  field: string;
  label: string;       // Russian (default)
  labelEn?: string;    // English override
}

export const FIELD_SUGGESTIONS: Record<string, FieldSuggestion[]> = {
  TRIGGER_WEBHOOK: [
    // Common body fields (spread to trigger.* top level by the backend)
    { field: 'message',   label: '"message"' },
    { field: 'text',      label: '"text"' },
    { field: 'title',     label: '"title"' },
    { field: 'name',      label: '"name"' },
    { field: 'id',        label: '"id"' },
    { field: 'status',    label: '"status"' },
    { field: 'amount',    label: '"amount"' },
    { field: 'price',     label: '"price"' },
    { field: 'customer',  label: '"customer"' },
    { field: 'email',     label: '"email"' },
    { field: 'phone',     label: '"phone"' },
    { field: 'data',      label: '"data"' },
    { field: 'source',    label: '"source"' },
    { field: 'type',      label: '"type"' },
    { field: 'url',       label: '"url"' },
    // Whole objects
    { field: 'body',                 label: 'Тело целиком (объект)',     labelEn: 'Whole body (object)' },
    { field: 'headers.user-agent',   label: 'User-Agent' },
    { field: 'headers.content-type', label: 'Content-Type' },
    { field: 'headers',              label: 'Заголовки целиком (объект)', labelEn: 'All headers (object)' },
    { field: 'query',                label: 'Параметры URL',              labelEn: 'URL parameters' },
    { field: 'method',               label: 'Метод (GET/POST…)',          labelEn: 'Method (GET/POST…)' },
  ],
  TRIGGER_EMAIL: [
    { field: 'from',    label: 'Отправитель',  labelEn: 'Sender' },
    { field: 'subject', label: 'Тема письма',  labelEn: 'Email subject' },
    { field: 'body',    label: 'Тело письма',  labelEn: 'Email body' },
    { field: 'date',    label: 'Дата',          labelEn: 'Date' },
  ],
  TRIGGER_CRON: [
    { field: 'triggeredAt', label: 'Время запуска', labelEn: 'Run time' },
  ],
  ACTION_HTTP_REQUEST: [
    { field: 'status',  label: 'Код ответа (число)', labelEn: 'Response status code' },
    { field: 'body',    label: 'Данные ответа',       labelEn: 'Response data' },
    { field: 'headers', label: 'Заголовки ответа',    labelEn: 'Response headers' },
  ],
  ACTION_EMAIL: [
    { field: 'sent',      label: 'Успешно отправлено', labelEn: 'Sent successfully' },
    { field: 'messageId', label: 'ID сообщения',        labelEn: 'Message ID' },
  ],
  ACTION_TELEGRAM: [
    { field: 'sent',      label: 'Успешно отправлено', labelEn: 'Sent successfully' },
    { field: 'messageId', label: 'ID сообщения',        labelEn: 'Message ID' },
  ],
  ACTION_DB_QUERY: [
    { field: 'rows',     label: 'Строки результата', labelEn: 'Result rows' },
    { field: 'rowCount', label: 'Количество строк',   labelEn: 'Row count' },
  ],
  ACTION_DATA_TRANSFORM: [
    { field: 'result', label: 'Результат преобразования', labelEn: 'Transform result' },
  ],
};

export interface VarEntry {
  path: string;   // context path to insert (uses sanitized label key)
  label: string;  // human label for the field
  group: string;  // group header (node display name)
  nodeId: string; // original node id
}

/**
 * Converts a node label into a valid context key.
 * "HTTP Request" → "http_request", "Отправить письмо" → "отправить_письмо"
 * Must stay in sync with nodeToContextKey() in the backend execution engine.
 */
export function nodeToContextKey(label: string): string {
  return (label || 'node')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^\w\u0400-\u04FF]/g, '')
    || 'node';
}

/**
 * Builds a map from node.id → context key, resolving duplicate label collisions.
 */
export function buildContextKeyMap(nodes: Node[]): Map<string, string> {
  const map = new Map<string, string>();
  const usedKeys = new Set<string>();

  for (const node of nodes) {
    const nodeType = node.data.nodeType as string;
    if (TRIGGER_NODE_TYPES.includes(nodeType)) {
      map.set(node.id, 'trigger');
      continue;
    }
    const base = nodeToContextKey(node.data.label as string);
    let key = base;
    let i = 2;
    while (usedKeys.has(key)) {
      key = `${base}_${i++}`;
    }
    usedKeys.add(key);
    map.set(node.id, key);
  }

  return map;
}

/**
 * Extracts output key names from a JSONata object expression.
 * `{"firstTitle": ..., "postCount": ...}` → ["firstTitle", "postCount"]
 */
function extractTransformKeys(expression: string): string[] {
  if (!expression?.trim().startsWith('{')) return [];
  const keys: string[] = [];
  const pattern = /"([^"]+)"\s*:/g;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(expression)) !== null) {
    keys.push(m[1]);
  }
  return keys;
}

export function buildVarEntries(nodes: Node[], currentNodeId?: string, lang: Lang = 'ru'): VarEntry[] {
  const keyMap = buildContextKeyMap(nodes);
  const entries: VarEntry[] = [];

  for (const node of nodes) {
    if (node.id === currentNodeId) continue;
    const nodeType = node.data.nodeType as string;
    const prefix = keyMap.get(node.id) ?? node.id;
    const group = node.data.label as string;

    // DATA_TRANSFORM: generate result.key entries from the expression
    if (nodeType === 'ACTION_DATA_TRANSFORM') {
      const expression = (node.data.config as Record<string, unknown>)?.expression as string;
      const keys = extractTransformKeys(expression);
      if (keys.length > 0) {
        for (const key of keys) {
          entries.push({ path: `${prefix}.result.${key}`, label: `"${key}"`, group, nodeId: node.id });
        }
      } else {
        const label = lang === 'en' ? 'Transform result' : 'Результат преобразования';
        entries.push({ path: `${prefix}.result`, label, group, nodeId: node.id });
      }
      continue;
    }

    const suggestions = FIELD_SUGGESTIONS[nodeType] ?? [];
    for (const s of suggestions) {
      const label = lang === 'en' && s.labelEn ? s.labelEn : s.label;
      entries.push({ path: `${prefix}.${s.field}`, label, group, nodeId: node.id });
    }
  }

  return entries;
}
