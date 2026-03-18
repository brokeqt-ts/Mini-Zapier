import { useState, useRef, useEffect } from 'react';
import type { Node } from '@xyflow/react';
import { buildVarEntries } from '../utils/fieldSuggestions';
import { useLangStore } from '../../../store/language.store';

/** Wraps a <textarea> and adds an "Insert variable" button that opens a picker. */
interface VariablePickerProps {
  value: string;
  onChange: (v: string) => void;
  nodes: Node[];
  currentNodeId: string;
  /** 'template' wraps in {{…}}, 'jsonata' inserts bare path */
  format?: 'template' | 'jsonata';
  rows?: number;
  placeholder?: string;
  label?: string;
}

export function VariablePicker({
  value,
  onChange,
  nodes,
  currentNodeId,
  format = 'template',
  rows = 3,
  placeholder,
  label,
}: VariablePickerProps) {
  const { t, lang } = useLangStore();
  const [open, setOpen]       = useState(false);
  const [dropPos, setDropPos] = useState<{ bottom: number; left: number } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const btnRef      = useRef<HTMLButtonElement>(null);

  const groups = buildVarGroups(buildVarEntries(nodes, currentNodeId, lang));

  // close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.var-picker-dropdown') && target !== btnRef.current) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // close if panel scrolls
  useEffect(() => {
    if (!open) return;
    const panel = btnRef.current?.closest('.config-panel');
    if (!panel) return;
    const handler = () => setOpen(false);
    panel.addEventListener('scroll', handler);
    return () => panel.removeEventListener('scroll', handler);
  }, [open]);

  const insert = (path: string) => {
    const snippet = format === 'template' ? `{{${path}}}` : path;
    const ta = textareaRef.current;
    if (!ta) {
      onChange(value + snippet);
    } else {
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const next = value.slice(0, start) + snippet + value.slice(end);
      onChange(next);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + snippet.length;
        ta.focus();
      });
    }
    setOpen(false);
  };

  const handleBtnMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) setDropPos({ bottom: rect.bottom + 4, left: rect.left });
    setOpen((v) => !v);
  };

  return (
    <div className="var-picker-wrap">
      {label && <label>{label}</label>}

      {groups.length > 0 && (
        <div className="var-picker-bar">
          <button
            ref={btnRef}
            type="button"
            className="var-picker-btn"
            onMouseDown={handleBtnMouseDown}
          >
            {t.insert_variable}
          </button>
          {open && dropPos && (
            <div
              className="var-picker-dropdown"
              style={{ position: 'fixed', top: dropPos.bottom, left: dropPos.left, zIndex: 9999 }}
            >
              {groups.map((g) => (
                <div key={g.groupLabel} className="var-picker-group">
                  <div className="var-picker-group-label">{g.groupLabel}</div>
                  {g.entries.map((v) => (
                    <button
                      key={v.path}
                      type="button"
                      className="var-picker-item"
                      onMouseDown={(e) => { e.preventDefault(); insert(v.path); }}
                    >
                      <span className="var-picker-path">
                        {format === 'template' ? `{{${v.path}}}` : v.path}
                      </span>
                      <span className="var-picker-field-label">{v.label}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <textarea
        ref={textareaRef}
        className="input config-textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
      />
    </div>
  );
}

// ─── VarInput: single-line input with variable picker ─────────────────────────

interface VarInputProps {
  value: string;
  onChange: (v: string) => void;
  nodes: Node[];
  currentNodeId: string;
  placeholder?: string;
  format?: 'template' | 'jsonata';
}

export function VarInput({
  value,
  onChange,
  nodes,
  currentNodeId,
  placeholder,
  format = 'template',
}: VarInputProps) {
  const { t, lang } = useLangStore();
  const [open, setOpen]       = useState(false);
  const [dropPos, setDropPos] = useState<{ bottom: number; right: number } | null>(null);
  const inputRef  = useRef<HTMLInputElement>(null);
  const wrapRef   = useRef<HTMLDivElement>(null);
  const btnRef    = useRef<HTMLButtonElement>(null);
  const cursorRef = useRef<{ start: number; end: number } | null>(null);

  const groups = buildVarGroups(buildVarEntries(nodes, currentNodeId, lang));

  // close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.var-picker-dropdown') && target !== btnRef.current) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // close if panel scrolls
  useEffect(() => {
    if (!open) return;
    const panel = wrapRef.current?.closest('.config-panel');
    if (!panel) return;
    const handler = () => setOpen(false);
    panel.addEventListener('scroll', handler);
    return () => panel.removeEventListener('scroll', handler);
  }, [open]);

  const insert = (path: string) => {
    const snippet = format === 'template' ? `{{${path}}}` : path;
    const el = inputRef.current;
    const saved = cursorRef.current;
    if (!el) {
      onChange(value + snippet);
    } else {
      const start = saved?.start ?? el.selectionStart ?? value.length;
      const end   = saved?.end   ?? el.selectionEnd   ?? value.length;
      const next  = value.slice(0, start) + snippet + value.slice(end);
      onChange(next);
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + snippet.length;
        el.focus();
      });
    }
    cursorRef.current = null;
    setOpen(false);
  };

  if (groups.length === 0) {
    return (
      <input
        ref={inputRef}
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    );
  }

  return (
    <div className="var-input-wrap" ref={wrapRef}>
      <input
        ref={inputRef}
        className="input var-input-field"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      <button
        ref={btnRef}
        type="button"
        className="var-input-btn"
        title={t.insert_variable_title}
        onMouseDown={(e) => {
          // prevent input from losing focus / scrolling to end
          e.preventDefault();
          const el = inputRef.current;
          if (el) {
            cursorRef.current = {
              start: el.selectionStart ?? value.length,
              end:   el.selectionEnd   ?? value.length,
            };
          }
          const rect = btnRef.current?.getBoundingClientRect();
          if (rect) {
            setDropPos({ bottom: rect.bottom + 4, right: window.innerWidth - rect.right });
          }
          setOpen((v) => !v);
        }}
      >
        {'{'}{'}'}
      </button>
      {open && dropPos && (
        <div
          className="var-picker-dropdown"
          style={{
            position: 'fixed',
            top: dropPos.bottom,
            right: dropPos.right,
            left: 'auto',
            zIndex: 9999,
          }}
        >
          {groups.map((g) => (
            <div key={g.groupLabel} className="var-picker-group">
              <div className="var-picker-group-label">{g.groupLabel}</div>
              {g.entries.map((v) => (
                <button
                  key={v.path}
                  type="button"
                  className="var-picker-item"
                  onMouseDown={(e) => { e.preventDefault(); insert(v.path); }}
                >
                  <span className="var-picker-path">
                    {format === 'template' ? `{{${v.path}}}` : v.path}
                  </span>
                  <span className="var-picker-field-label">{v.label}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── helpers ──────────────────────────────────────────────────────────────────

import type { VarEntry } from '../utils/fieldSuggestions';

interface VarGroup { groupLabel: string; entries: VarEntry[] }

function buildVarGroups(entries: VarEntry[]): VarGroup[] {
  const map = new Map<string, VarEntry[]>();
  for (const e of entries) {
    if (!map.has(e.group)) map.set(e.group, []);
    map.get(e.group)!.push(e);
  }
  return Array.from(map.entries()).map(([groupLabel, ents]) => ({ groupLabel, entries: ents }));
}
