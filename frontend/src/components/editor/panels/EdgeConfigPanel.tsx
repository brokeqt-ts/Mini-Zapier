import { useState, useEffect, useRef } from 'react';
import { useWorkflowEditorStore } from '../../../store/workflow-editor.store';
import { useLangStore } from '../../../store/language.store';
import { TRIGGER_NODE_TYPES, FIELD_SUGGESTIONS, buildContextKeyMap, type FieldSuggestion } from '../utils/fieldSuggestions';
import './NodeConfigPanel.css';
import './EdgeConfigPanel.css';

type Operator =
  | 'eq' | 'neq'
  | 'contains' | 'not_contains'
  | 'gt' | 'lt' | 'gte' | 'lte'
  | 'empty' | 'not_empty';

type Logic = 'AND' | 'OR';

interface ConditionRule {
  source: string;
  field: string;
  operator: Operator;
  value: string;
}

const DEFAULT_RULE: ConditionRule = { source: 'trigger', field: '', operator: 'eq', value: '' };

const OPERATORS: { value: Operator; labelKey: string }[] = [
  { value: 'eq',          labelKey: 'cond_op_eq' },
  { value: 'neq',         labelKey: 'cond_op_neq' },
  { value: 'contains',    labelKey: 'cond_op_contains' },
  { value: 'not_contains',labelKey: 'cond_op_not_contains' },
  { value: 'gt',          labelKey: 'cond_op_gt' },
  { value: 'lt',          labelKey: 'cond_op_lt' },
  { value: 'gte',         labelKey: 'cond_op_gte' },
  { value: 'lte',         labelKey: 'cond_op_lte' },
  { value: 'empty',       labelKey: 'cond_op_empty' },
  { value: 'not_empty',   labelKey: 'cond_op_not_empty' },
];

const VALUE_LESS_OPS = new Set<Operator>(['empty', 'not_empty']);

function buildExpr(rule: ConditionRule): string {
  const base = rule.source === 'trigger'
    ? 'context.trigger'
    : `context['${rule.source}']`;
  const path = rule.field ? `${base}.${rule.field}` : base;

  switch (rule.operator) {
    case 'eq':          return `String(${path}) === "${rule.value}"`;
    case 'neq':         return `String(${path}) !== "${rule.value}"`;
    case 'contains':    return `String(${path}).includes("${rule.value}")`;
    case 'not_contains':return `!String(${path}).includes("${rule.value}")`;
    case 'gt':          return `Number(${path}) > ${Number(rule.value) || 0}`;
    case 'lt':          return `Number(${path}) < ${Number(rule.value) || 0}`;
    case 'gte':         return `Number(${path}) >= ${Number(rule.value) || 0}`;
    case 'lte':         return `Number(${path}) <= ${Number(rule.value) || 0}`;
    case 'empty':       return `!${path}`;
    case 'not_empty':   return `!!${path}`;
  }
}

function buildMultiExpr(rules: ConditionRule[], logic: Logic): string {
  const parts = rules.map(buildExpr);
  if (parts.length === 1) return parts[0];
  const sep = logic === 'AND' ? ') && (' : ') || (';
  return `(${parts.join(sep)})`;
}

function parsePath(path: string): { source: string; field: string } {
  const triggerM = path.match(/^context\.trigger(?:\.(.+))?$/);
  if (triggerM) return { source: 'trigger', field: triggerM[1] || '' };
  const nodeM = path.match(/^context\['([^']+)'\](?:\.(.+))?$/);
  if (nodeM) return { source: nodeM[1], field: nodeM[2] || '' };
  return { source: 'trigger', field: '' };
}

function parseExpr(expr: string): ConditionRule | null {
  if (!expr.trim()) return null;

  let m = expr.match(/^(!{1,2})(context(?:\.trigger|\['[^']+'\])(?:\.[a-zA-Z0-9_.]+)?)$/);
  if (m) {
    const { source, field } = parsePath(m[2]);
    return { source, field, operator: m[1].length === 2 ? 'not_empty' : 'empty', value: '' };
  }

  m = expr.match(/^(!?)String\((context(?:\.trigger|\['[^']+'\])(?:\.[a-zA-Z0-9_.]+)?)\)\.includes\("([^"]*)"\)$/);
  if (m) {
    const { source, field } = parsePath(m[2]);
    return { source, field, operator: m[1] ? 'not_contains' : 'contains', value: m[3] };
  }

  m = expr.match(/^Number\((context(?:\.trigger|\['[^']+'\])(?:\.[a-zA-Z0-9_.]+)?)\)\s*(>=|<=|>|<)\s*(-?\d+(?:\.\d+)?)$/);
  if (m) {
    const { source, field } = parsePath(m[1]);
    const opMap: Record<string, Operator> = { '>': 'gt', '<': 'lt', '>=': 'gte', '<=': 'lte' };
    return { source, field, operator: opMap[m[2]], value: m[3] };
  }

  // New format: String(path) === "val"
  m = expr.match(/^String\((context(?:\.trigger|\['[^']+'\])(?:\.[a-zA-Z0-9_.]+)?)\)\s*(===|!==)\s*"([^"]*)"$/);
  if (m) {
    const { source, field } = parsePath(m[1]);
    return { source, field, operator: m[2] === '===' ? 'eq' : 'neq', value: m[3] };
  }
  // Legacy format: path === "val"
  m = expr.match(/^(context(?:\.trigger|\['[^']+'\])(?:\.[a-zA-Z0-9_.]+)?)\s*(===|!==)\s*"([^"]*)"$/);
  if (m) {
    const { source, field } = parsePath(m[1]);
    return { source, field, operator: m[2] === '===' ? 'eq' : 'neq', value: m[3] };
  }

  return null;
}

function parseMultiExpr(expr: string): { rules: ConditionRule[]; logic: Logic } | null {
  if (!expr.trim()) return null;

  const single = parseExpr(expr);
  if (single) return { rules: [single], logic: 'AND' };

  for (const logic of ['AND', 'OR'] as Logic[]) {
    const sep = logic === 'AND' ? ') && (' : ') || (';
    if (expr.includes(sep)) {
      const raw =
        expr.startsWith('(') && expr.endsWith(')')
          ? expr.slice(1, -1)
          : expr;
      const parts = raw.split(sep);
      const rules = parts.map((p) => parseExpr(p));
      if (rules.every((r) => r !== null)) {
        return { rules: rules as ConditionRule[], logic };
      }
    }
  }

  return null;
}

// ─── Field picker for one rule ───────────────────────────────────────────────

interface FieldPickerProps {
  value: string;
  suggestions: FieldSuggestion[];
  placeholder: string;
  onChange: (v: string) => void;
}

function FieldPicker({ value, suggestions, placeholder, onChange }: FieldPickerProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const filtered = suggestions.filter(
    (s) => !value || s.field.includes(value) || s.label.toLowerCase().includes(value.toLowerCase()),
  );

  return (
    <div className="field-picker-wrap" ref={wrapRef}>
      <input
        className="input"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <ul className="field-picker-list">
          {filtered.map((s) => (
            <li
              key={s.field}
              className="field-picker-item"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(s.field);
                setOpen(false);
              }}
            >
              <span className="field-picker-field">{s.field}</span>
              <span className="field-picker-label">{s.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Main panel ──────────────────────────────────────────────────────────────

export function EdgeConfigPanel() {
  const { edges, nodes, selectedEdgeId, updateEdgeCondition, selectEdge } =
    useWorkflowEditorStore();
  const { t } = useLangStore();

  const edge = edges.find((e) => e.id === selectedEdgeId);
  const initialExpr = (edge?.data?.conditionExpr as string) || '';

  const initParsed = parseMultiExpr(initialExpr);

  const [rules, setRules] = useState<ConditionRule[]>(
    initParsed?.rules ?? [{ ...DEFAULT_RULE }],
  );
  const [logic, setLogic] = useState<Logic>(initParsed?.logic ?? 'AND');
  const [hasCondition, setHasCondition] = useState(() => !!initialExpr);
  const [showAdvanced, setShowAdvanced] = useState(
    () => !!initialExpr && !parseMultiExpr(initialExpr),
  );
  const [advancedValue, setAdvancedValue] = useState(initialExpr);

  useEffect(() => {
    const expr = (edge?.data?.conditionExpr as string) || '';
    const p = parseMultiExpr(expr);
    if (p) {
      setRules(p.rules);
      setLogic(p.logic);
      setShowAdvanced(false);
    } else if (expr) {
      setAdvancedValue(expr);
      setShowAdvanced(true);
    } else {
      setRules([{ ...DEFAULT_RULE }]);
      setLogic('AND');
      setShowAdvanced(false);
    }
    setHasCondition(!!expr);
    setAdvancedValue(expr);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEdgeId]);

  if (!edge) return null;

  const contextKeyMap = buildContextKeyMap(nodes);

  const sourceOptions = [
    { value: 'trigger', label: t.cond_trigger },
    ...nodes
      .filter((n) => !TRIGGER_NODE_TYPES.includes(n.data.nodeType as string))
      .map((n) => ({
        value: contextKeyMap.get(n.id) ?? n.id,
        label: n.data.label as string,
      })),
  ];

  // Resolve suggestions for a source value (source is now a context key)
  const getSuggestions = (source: string): FieldSuggestion[] => {
    if (source === 'trigger') {
      const triggerNode = nodes.find((n) =>
        TRIGGER_NODE_TYPES.includes(n.data.nodeType as string),
      );
      return FIELD_SUGGESTIONS[triggerNode?.data.nodeType as string] ?? [];
    }
    const nodeId = [...contextKeyMap.entries()].find(([, v]) => v === source)?.[0];
    const node = nodes.find((n) => n.id === nodeId);
    return FIELD_SUGGESTIONS[node?.data.nodeType as string] ?? [];
  };

  const applyRules = (newRules: ConditionRule[], newLogic: Logic) => {
    const expr = buildMultiExpr(newRules, newLogic);
    setAdvancedValue(expr);
    updateEdgeCondition(edge.id, expr);
  };

  const handleRuleChange = (index: number, patch: Partial<ConditionRule>) => {
    const newRules = rules.map((r, i) => (i === index ? { ...r, ...patch } : r));
    setRules(newRules);
    applyRules(newRules, logic);
  };

  const handleAddRule = () => {
    const newRules = [...rules, { ...DEFAULT_RULE }];
    setRules(newRules);
    applyRules(newRules, logic);
  };

  const handleRemoveRule = (index: number) => {
    const newRules = rules.filter((_, i) => i !== index);
    setRules(newRules);
    applyRules(newRules, logic);
  };

  const handleLogicChange = (newLogic: Logic) => {
    setLogic(newLogic);
    applyRules(rules, newLogic);
  };

  const handleAddCondition = () => {
    setHasCondition(true);
    setShowAdvanced(false);
    const newRules = [{ ...DEFAULT_RULE }];
    setRules(newRules);
    setLogic('AND');
    const expr = buildExpr(newRules[0]);
    setAdvancedValue(expr);
    updateEdgeCondition(edge.id, expr);
  };

  const handleRemove = () => {
    setHasCondition(false);
    setRules([{ ...DEFAULT_RULE }]);
    setLogic('AND');
    setAdvancedValue('');
    setShowAdvanced(false);
    updateEdgeCondition(edge.id, '');
  };

  const handleToggleAdvanced = () => {
    if (!showAdvanced) setAdvancedValue(buildMultiExpr(rules, logic));
    setShowAdvanced(!showAdvanced);
  };

  const handleAdvancedChange = (value: string) => {
    setAdvancedValue(value);
    updateEdgeCondition(edge.id, value);
    const p = parseMultiExpr(value);
    if (p) { setRules(p.rules); setLogic(p.logic); }
  };

  return (
    <div className="config-panel">
      <div className="edge-panel-header">
        <h4 className="config-title">{t.edge_condition_title}</h4>
        <button
          className="btn btn-secondary"
          style={{ padding: '4px 8px', fontSize: '12px' }}
          onClick={() => selectEdge(null)}
        >
          {t.close}
        </button>
      </div>
      <div className="config-type">{t.conditional_transition}</div>

      <div className="config-fields">
        {!hasCondition ? (
          <div className="cond-empty-state">
            <div className="cond-always-label">{t.cond_always_run}</div>
            <button className="btn btn-primary cond-add-btn" onClick={handleAddCondition}>
              + {t.cond_add_condition}
            </button>
          </div>
        ) : (
          <div className="cond-builder">
            {rules.length > 1 && (
              <div className="cond-logic-row">
                <span className="cond-logic-label">{t.cond_logic_label}:</span>
                <div className="cond-logic-toggle">
                  <button
                    className={`cond-logic-btn${logic === 'AND' ? ' active' : ''}`}
                    onClick={() => handleLogicChange('AND')}
                  >
                    {t.cond_logic_and}
                  </button>
                  <button
                    className={`cond-logic-btn${logic === 'OR' ? ' active' : ''}`}
                    onClick={() => handleLogicChange('OR')}
                  >
                    {t.cond_logic_or}
                  </button>
                </div>
              </div>
            )}

            {rules.map((rule, index) => (
              <div key={index} className="cond-rule-card">
                {rules.length > 1 && index > 0 && (
                  <div className="cond-rule-badge">
                    {logic === 'AND' ? t.cond_logic_and : t.cond_logic_or}
                  </div>
                )}

                {/* Row 1: source + field (inline, no labels) */}
                <div className="cond-row">
                  <select
                    className="input cond-select"
                    value={rule.source}
                    onChange={(e) => handleRuleChange(index, { source: e.target.value })}
                    title={t.cond_source}
                  >
                    {sourceOptions.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>

                  <FieldPicker
                    value={rule.field}
                    suggestions={getSuggestions(rule.source)}
                    placeholder={t.cond_field_placeholder}
                    onChange={(v) => handleRuleChange(index, { field: v })}
                  />

                  {rules.length > 1 && (
                    <button
                      className="cond-remove-rule-btn"
                      onClick={() => handleRemoveRule(index)}
                      title={t.remove_condition}
                    >
                      ×
                    </button>
                  )}
                </div>

                {/* Row 2: operator + value */}
                <div className="cond-row">
                  <select
                    className="input cond-select"
                    value={rule.operator}
                    onChange={(e) => handleRuleChange(index, { operator: e.target.value as Operator })}
                    title={t.cond_operator}
                  >
                    {OPERATORS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {t[o.labelKey as keyof typeof t] as string}
                      </option>
                    ))}
                  </select>

                  {!VALUE_LESS_OPS.has(rule.operator) && (
                    <input
                      className="input"
                      value={rule.value}
                      onChange={(e) => handleRuleChange(index, { value: e.target.value })}
                      placeholder={t.cond_value}
                      title={t.cond_value}
                    />
                  )}
                </div>
              </div>
            ))}

            <button className="btn btn-secondary cond-add-rule-btn" onClick={handleAddRule}>
              + {t.cond_add_rule}
            </button>

            <div className="cond-advanced-section">
              <button className="cond-advanced-toggle" onClick={handleToggleAdvanced}>
                ⚙ {showAdvanced ? t.cond_hide_advanced : t.cond_show_advanced}
              </button>
              {showAdvanced && (
                <textarea
                  className="input config-textarea cond-advanced-textarea"
                  value={advancedValue}
                  onChange={(e) => handleAdvancedChange(e.target.value)}
                  rows={3}
                  placeholder='context.trigger.status === "success"'
                />
              )}
            </div>

            <button className="btn cond-remove-btn" onClick={handleRemove}>
              {t.remove_condition}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
