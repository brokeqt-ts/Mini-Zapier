import { useEffect, useRef, useState } from 'react';
import type { Node } from '@xyflow/react';
import { VarChipPicker } from './VarTilePicker';
import { buildVarEntries } from '../utils/fieldSuggestions';
import { useLangStore } from '../../../store/language.store';

// ─── Types ────────────────────────────────────────────────────────────────────

type RowMode = 'field' | 'array' | 'func';

interface Mapping {
  outputKey:  string;
  mode:       RowMode;
  basePath:   string;
  arrayIndex: string;
  subPath:    string;
  fn:         string;
}

const EMPTY_MAPPING: Mapping = {
  outputKey: '', mode: 'field', basePath: '',
  arrayIndex: '0', subPath: '', fn: '$count',
};

// Static list of func values used for parsing (labels come from i18n in components)
const FUNC_VALUES = ['$count', '$sum', '$number', '$string', '$uppercase', '$lowercase'];

// ─── parseJsonata (forward declaration needed by collectSubPathSuggestions) ───

function parseJsonata(expr: string): Mapping[] | null {
  if (!expr?.trim()) return [];
  const trimmed = expr.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null;
  const inner = trimmed.slice(1, -1).trim();
  if (!inner) return [];

  const keyPattern = /"([^"]+)"\s*:/g;
  const positions: Array<{ key: string; valueStart: number; start: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = keyPattern.exec(inner)) !== null) {
    positions.push({ key: m[1], valueStart: m.index + m[0].length, start: m.index });
  }
  if (positions.length === 0) return null;

  const result: Mapping[] = [];
  for (let i = 0; i < positions.length; i++) {
    const { key, valueStart } = positions[i];
    const rawEnd = i + 1 < positions.length ? positions[i + 1].start : inner.length;
    const rawValue = inner.slice(valueStart, rawEnd).trim().replace(/,\s*$/, '').trim();
    if (!rawValue) return null;
    result.push({ outputKey: key, ...sourceToMapping(rawValue) });
  }
  return result.length > 0 ? result : null;
}

// ─── Collect subPath suggestions ─────────────────────────────────────────────

function collectSubPathSuggestions(nodes: Node[], currentNodeId: string): string[] {
  const set = new Set<string>();

  // 1. Leaf field names from all upstream variable paths
  const entries = buildVarEntries(nodes, currentNodeId);
  for (const e of entries) {
    const leaf = e.path.split('.').at(-1);
    if (leaf) set.add(leaf);
  }

  // 2. subPath values already used in other DATA_TRANSFORM nodes
  for (const node of nodes) {
    if (node.id === currentNodeId) continue;
    if (node.data.nodeType !== 'ACTION_DATA_TRANSFORM') continue;
    const expr = (node.data.config as Record<string, unknown>)?.expression as string;
    const mappings = parseJsonata(expr);
    if (!mappings) continue;
    for (const m of mappings) {
      if (m.subPath) set.add(m.subPath);
    }
  }

  return [...set].filter(Boolean).sort();
}

// ─── SubPathInput — text input with custom styled suggestions ─────────────────

function SubPathInput({ value, onChange, suggestions }: {
  value: string;
  onChange: (v: string) => void;
  suggestions: string[];
}) {
  const { t } = useLangStore();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const filtered = suggestions.filter(s =>
    !value || s.toLowerCase().includes(value.toLowerCase()),
  );

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as HTMLElement)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="subpath-input-wrap" ref={wrapRef}>
      <input
        className="input transform-array-subpath"
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={t.subpath_ph}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div className="subpath-dropdown">
          {filtered.map(s => (
            <button
              key={s}
              type="button"
              className="subpath-option"
              onMouseDown={e => { e.preventDefault(); onChange(s); setOpen(false); }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Compute / parse source path ─────────────────────────────────────────────

function mappingToSource(m: Mapping): string {
  let path = m.basePath;
  if (m.mode === 'array') {
    path += `[${m.arrayIndex || '0'}]`;
    if (m.subPath) path += `.${m.subPath}`;
  } else if (m.mode === 'func') {
    return `${m.fn || '$count'}(${path})`;
  }
  return path;
}

function sourceToMapping(src: string): Omit<Mapping, 'outputKey'> {
  const base = { arrayIndex: '0', subPath: '', fn: '$count' };

  const fnM = src.match(/^(\$\w+)\((.+)\)$/);
  if (fnM && FUNC_VALUES.includes(fnM[1])) {
    const inner = fnM[2];
    const arrM = inner.match(/^(.+?)\[(\d+)\](?:\.(.+))?$/);
    if (arrM) return { ...base, mode: 'func', fn: fnM[1], basePath: arrM[1], arrayIndex: arrM[2], subPath: arrM[3] || '' };
    return { ...base, mode: 'func', fn: fnM[1], basePath: inner };
  }

  const arrM = src.match(/^(.+?)\[(\d+)\](?:\.(.+))?$/);
  if (arrM) return { ...base, mode: 'array', basePath: arrM[1], arrayIndex: arrM[2], subPath: arrM[3] || '' };

  return { ...base, mode: 'field', basePath: src };
}

// ─── JSONata ←→ Mappings ──────────────────────────────────────────────────────

function buildJsonata(mappings: Mapping[]): string {
  const valid = mappings.filter(m => m.outputKey && m.basePath);
  if (valid.length === 0) return '{}';
  const pairs = valid.map(m => `"${m.outputKey}": ${mappingToSource(m)}`);
  return `{${pairs.join(', ')}}`;
}

// ─── Single mapping row ───────────────────────────────────────────────────────

interface MappingRowProps {
  mapping: Mapping;
  nodes: Node[];
  currentNodeId: string;
  onUpdate: (patch: Partial<Mapping>) => void;
  onRemove: () => void;
}

function MappingRow({ mapping: m, nodes, currentNodeId, onUpdate, onRemove }: MappingRowProps) {
  const { t } = useLangStore();
  const subPathSuggestions = collectSubPathSuggestions(nodes, currentNodeId);

  const FUNC_OPTIONS = [
    { value: '$count',     label: t.fn_count },
    { value: '$sum',       label: t.fn_sum },
    { value: '$number',    label: t.fn_to_number },
    { value: '$string',    label: t.fn_to_string },
    { value: '$uppercase', label: t.fn_upper },
    { value: '$lowercase', label: t.fn_lower },
  ];

  const MODE_LABELS: Record<RowMode, string> = {
    field: t.tab_field,
    array: t.tab_array_item,
    func:  t.tab_function,
  };

  return (
    <div className="transform-row-block">
      {/* Header: output name + remove */}
      <div className="transform-row-top">
        <input
          className="input transform-key"
          value={m.outputKey}
          onChange={e => onUpdate({ outputKey: e.target.value })}
          placeholder={t.field_name_ph}
        />
        <span className="transform-arrow">→</span>
        <button className="transform-remove" onClick={onRemove}>×</button>
      </div>

      {/* Mode selector */}
      <div className="transform-mode-tabs">
        {(['field', 'array', 'func'] as RowMode[]).map(mode => (
          <button
            key={mode}
            type="button"
            className={`transform-mode-tab${m.mode === mode ? ' active' : ''}`}
            onClick={() => onUpdate({ mode })}
          >
            {MODE_LABELS[mode]}
          </button>
        ))}
      </div>

      {/* Source */}
      <div className="transform-source-row">
        {m.mode === 'field' && (
          <VarChipPicker
            value={m.basePath}
            onChange={v => onUpdate({ basePath: v })}
            nodes={nodes}
            currentNodeId={currentNodeId}
            placeholder={t.pick_variable_btn}
          />
        )}

        {m.mode === 'array' && (
          <div className="transform-array-inputs">
            <div className="transform-array-base-label">{t.array_label}</div>
            <VarChipPicker
              value={m.basePath}
              onChange={v => onUpdate({ basePath: v })}
              nodes={nodes}
              currentNodeId={currentNodeId}
              placeholder={t.pick_array_btn}
            />
            <div className="transform-array-index-row">
              <span className="transform-array-bracket">[</span>
              <input
                className="input transform-array-index"
                type="number"
                min={0}
                value={m.arrayIndex}
                onChange={e => onUpdate({ arrayIndex: e.target.value })}
                title={t.index_title}
              />
              <span className="transform-array-bracket">]</span>
              <span className="transform-array-dot">.</span>
              <SubPathInput
                value={m.subPath}
                onChange={v => onUpdate({ subPath: v })}
                suggestions={subPathSuggestions}
              />
            </div>
          </div>
        )}

        {m.mode === 'func' && (
          <div className="transform-func-inputs">
            <select
              className="input transform-func-select"
              value={m.fn}
              onChange={e => onUpdate({ fn: e.target.value })}
            >
              {FUNC_OPTIONS.map(f => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
            <div className="transform-func-arg-row">
              <VarChipPicker
                value={m.basePath}
                onChange={v => onUpdate({ basePath: v })}
                nodes={nodes}
                currentNodeId={currentNodeId}
                placeholder={t.pick_variable_btn}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface DataTransformMapperProps {
  value: string;
  onChange: (v: string) => void;
  nodes: Node[];
  currentNodeId: string;
}

export function DataTransformMapper({ value, onChange, nodes, currentNodeId }: DataTransformMapperProps) {
  const { t } = useLangStore();
  const initMappings = parseJsonata(value);
  const [mappings, setMappings] = useState<Mapping[]>(
    initMappings ?? [{ ...EMPTY_MAPPING }],
  );
  const [showRaw, setShowRaw] = useState(!!value && initMappings === null);

  const apply = (next: Mapping[]) => {
    setMappings(next);
    onChange(buildJsonata(next));
  };

  const update = (i: number, patch: Partial<Mapping>) =>
    apply(mappings.map((m, idx) => idx === i ? { ...m, ...patch } : m));

  const add    = () => apply([...mappings, { ...EMPTY_MAPPING }]);
  const remove = (i: number) => apply(mappings.filter((_, idx) => idx !== i));

  const toggleRaw = () => {
    if (!showRaw) {
      onChange(buildJsonata(mappings));
    } else {
      const parsed = parseJsonata(value);
      if (parsed) setMappings(parsed);
    }
    setShowRaw(v => !v);
  };

  return (
    <div className="transform-mapper">
      {!showRaw && (
        <>
          {mappings.map((m, i) => (
            <MappingRow
              key={i}
              mapping={m}
              nodes={nodes}
              currentNodeId={currentNodeId}
              onUpdate={patch => update(i, patch)}
              onRemove={() => remove(i)}
            />
          ))}

          <button className="btn btn-secondary transform-add" onClick={add}>
            {t.add_field}
          </button>
        </>
      )}

      <div className="widget-advanced-section">
        <button className="widget-advanced-toggle" onClick={toggleRaw}>
          ⚙ {showRaw ? t.hide : t.dev_mode_jsonata}
        </button>
        {showRaw && (
          <textarea
            className="input config-textarea"
            value={value}
            onChange={e => onChange(e.target.value)}
            rows={4}
            placeholder='{"email": trigger.body.email, "count": $count(получить_посты.data)}'
          />
        )}
      </div>
    </div>
  );
}
