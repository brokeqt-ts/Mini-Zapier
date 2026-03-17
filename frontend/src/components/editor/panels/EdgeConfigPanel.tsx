import { useState, useEffect } from 'react';
import { useWorkflowEditorStore } from '../../../store/workflow-editor.store';
import { useLangStore } from '../../../store/language.store';
import './NodeConfigPanel.css';
import './EdgeConfigPanel.css';

type Operator =
  | 'eq' | 'neq'
  | 'contains' | 'not_contains'
  | 'gt' | 'lt' | 'gte' | 'lte'
  | 'empty' | 'not_empty';

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

const TRIGGER_NODE_TYPES = ['TRIGGER_WEBHOOK', 'TRIGGER_CRON', 'TRIGGER_EMAIL'];

function buildExpr(rule: ConditionRule): string {
  const base = rule.source === 'trigger'
    ? 'context.trigger'
    : `context['${rule.source}']`;
  const path = rule.field ? `${base}.${rule.field}` : base;

  switch (rule.operator) {
    case 'eq':          return `${path} === "${rule.value}"`;
    case 'neq':         return `${path} !== "${rule.value}"`;
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

function parsePath(path: string): { source: string; field: string } {
  const triggerM = path.match(/^context\.trigger(?:\.(.+))?$/);
  if (triggerM) return { source: 'trigger', field: triggerM[1] || '' };
  const nodeM = path.match(/^context\['([^']+)'\](?:\.(.+))?$/);
  if (nodeM) return { source: nodeM[1], field: nodeM[2] || '' };
  return { source: 'trigger', field: '' };
}

function parseExpr(expr: string): ConditionRule | null {
  if (!expr.trim()) return null;

  // !!path  or  !path
  let m = expr.match(/^(!{1,2})(context(?:\.trigger|\['[^']+'\])(?:\.[a-zA-Z0-9_.]+)?)$/);
  if (m) {
    const { source, field } = parsePath(m[2]);
    return { source, field, operator: m[1].length === 2 ? 'not_empty' : 'empty', value: '' };
  }

  // (!?)String(path).includes("value")
  m = expr.match(/^(!?)String\((context(?:\.trigger|\['[^']+'\])(?:\.[a-zA-Z0-9_.]+)?)\)\.includes\("([^"]*)"\)$/);
  if (m) {
    const { source, field } = parsePath(m[2]);
    return { source, field, operator: m[1] ? 'not_contains' : 'contains', value: m[3] };
  }

  // Number(path) >= <= > < value
  m = expr.match(/^Number\((context(?:\.trigger|\['[^']+'\])(?:\.[a-zA-Z0-9_.]+)?)\)\s*(>=|<=|>|<)\s*(-?\d+(?:\.\d+)?)$/);
  if (m) {
    const { source, field } = parsePath(m[1]);
    const opMap: Record<string, Operator> = { '>': 'gt', '<': 'lt', '>=': 'gte', '<=': 'lte' };
    return { source, field, operator: opMap[m[2]], value: m[3] };
  }

  // path === "value"  or  path !== "value"
  m = expr.match(/^(context(?:\.trigger|\['[^']+'\])(?:\.[a-zA-Z0-9_.]+)?)\s*(===|!==)\s*"([^"]*)"$/);
  if (m) {
    const { source, field } = parsePath(m[1]);
    return { source, field, operator: m[2] === '===' ? 'eq' : 'neq', value: m[3] };
  }

  return null;
}

export function EdgeConfigPanel() {
  const { edges, nodes, selectedEdgeId, updateEdgeCondition, selectEdge } =
    useWorkflowEditorStore();
  const { t } = useLangStore();

  const edge = edges.find((e) => e.id === selectedEdgeId);
  const initialExpr = (edge?.data?.conditionExpr as string) || '';

  const [rule, setRule] = useState<ConditionRule>(() => parseExpr(initialExpr) ?? { ...DEFAULT_RULE });
  const [mode, setMode] = useState<'builder' | 'advanced'>(() =>
    initialExpr && !parseExpr(initialExpr) ? 'advanced' : 'builder',
  );
  const [hasCondition, setHasCondition] = useState(() => !!initialExpr);
  const [advancedValue, setAdvancedValue] = useState(initialExpr);

  // Sync local state when user selects a different edge
  useEffect(() => {
    const expr = (edge?.data?.conditionExpr as string) || '';
    const parsed = parseExpr(expr);
    if (parsed) {
      setRule(parsed);
      setMode('builder');
    } else if (expr) {
      setAdvancedValue(expr);
      setMode('advanced');
    } else {
      setRule({ ...DEFAULT_RULE });
      setMode('builder');
    }
    setHasCondition(!!expr);
    setAdvancedValue(expr);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEdgeId]);

  if (!edge) return null;

  const sourceOptions = [
    { value: 'trigger', label: t.cond_trigger },
    ...nodes
      .filter((n) => !TRIGGER_NODE_TYPES.includes(n.data.nodeType as string))
      .map((n) => ({ value: n.id, label: n.data.label as string })),
  ];

  const handleRuleChange = (patch: Partial<ConditionRule>) => {
    const newRule = { ...rule, ...patch };
    setRule(newRule);
    updateEdgeCondition(edge.id, buildExpr(newRule));
  };

  const handleAddCondition = () => {
    const newRule = { ...DEFAULT_RULE };
    setRule(newRule);
    setHasCondition(true);
    setMode('builder');
    updateEdgeCondition(edge.id, buildExpr(newRule));
  };

  const handleRemove = () => {
    setHasCondition(false);
    setRule({ ...DEFAULT_RULE });
    setAdvancedValue('');
    updateEdgeCondition(edge.id, '');
  };

  const toggleMode = () => {
    if (mode === 'builder') {
      setAdvancedValue(buildExpr(rule));
      setMode('advanced');
    } else {
      const parsed = parseExpr(advancedValue);
      if (parsed) {
        setRule(parsed);
        setMode('builder');
      }
    }
  };

  const canSwitchToBuilder = mode === 'advanced' ? !!parseExpr(advancedValue) : true;

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
        ) : mode === 'builder' ? (
          <div className="cond-builder">
            <div className="form-group">
              <label>{t.cond_source}</label>
              <select
                className="input"
                value={rule.source}
                onChange={(e) => handleRuleChange({ source: e.target.value })}
              >
                {sourceOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>{t.cond_field}</label>
              <input
                className="input"
                value={rule.field}
                onChange={(e) => handleRuleChange({ field: e.target.value })}
                placeholder={t.cond_field_placeholder}
              />
            </div>

            <div className="form-group">
              <label>{t.cond_operator}</label>
              <select
                className="input"
                value={rule.operator}
                onChange={(e) => handleRuleChange({ operator: e.target.value as Operator })}
              >
                {OPERATORS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {t[o.labelKey as keyof typeof t] as string}
                  </option>
                ))}
              </select>
            </div>

            {!VALUE_LESS_OPS.has(rule.operator) && (
              <div className="form-group">
                <label>{t.cond_value}</label>
                <input
                  className="input"
                  value={rule.value}
                  onChange={(e) => handleRuleChange({ value: e.target.value })}
                  placeholder="200"
                />
              </div>
            )}

            <div className="cond-result">
              <span className="cond-result-label">{t.cond_result}:</span>
              <code className="cond-result-code">{buildExpr(rule)}</code>
            </div>
          </div>
        ) : (
          <div className="form-group">
            <label>{t.condition_expression}</label>
            <textarea
              className="input config-textarea"
              value={advancedValue}
              onChange={(e) => {
                setAdvancedValue(e.target.value);
                updateEdgeCondition(edge.id, e.target.value);
              }}
              rows={4}
              placeholder='context.trigger.status === "success"'
            />
          </div>
        )}

        {hasCondition && (
          <div className="cond-footer">
            <button
              className="btn btn-secondary cond-mode-btn"
              onClick={toggleMode}
              disabled={!canSwitchToBuilder}
              title={!canSwitchToBuilder ? 'Выражение нельзя разобрать автоматически' : undefined}
            >
              {mode === 'builder' ? t.cond_advanced : t.cond_simple}
            </button>
            <button
              className="btn cond-remove-btn"
              onClick={handleRemove}
            >
              {t.remove_condition}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
