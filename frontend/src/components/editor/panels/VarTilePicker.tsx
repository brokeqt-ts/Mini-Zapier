import { useEffect, useRef, useState } from 'react';
import type { Node as FlowNode } from '@xyflow/react';
import { buildVarEntries } from '../utils/fieldSuggestions';
import type { VarEntry } from '../utils/fieldSuggestions';
import { useLangStore } from '../../../store/language.store';

// ─── Shared helpers ────────────────────────────────────────────────────────────

export function chipColor(group: string): string {
  const g = (group ?? '').toLowerCase();
  if (g.includes('http') || g.includes('запрос') || g.includes('webhook') || g.includes('request')) return 'http';
  if (g.includes('email') || g.includes('почт') || g.includes('mail')) return 'email';
  if (g.includes('telegram')) return 'tg';
  if (g.includes('db') || g.includes('база') || g.includes('sql') || g.includes('database') || g.includes('query')) return 'db';
  if (g.includes('transform') || g.includes('преобраз') || g.includes('data')) return 'transform';
  return 'default';
}

export interface VarGroup { groupLabel: string; entries: VarEntry[] }

export function groupEntries(entries: VarEntry[]): VarGroup[] {
  const map = new Map<string, VarEntry[]>();
  for (const e of entries) {
    if (!map.has(e.group)) map.set(e.group, []);
    map.get(e.group)!.push(e);
  }
  return Array.from(map.entries()).map(([groupLabel, entries]) => ({ groupLabel, entries }));
}

function escHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─── TilePicker ────────────────────────────────────────────────────────────────

const PICKER_HEIGHT = 320;
const PICKER_WIDTH  = 340;

export function TilePicker({ groups, pos, onSelect, onClose }: {
  groups: VarGroup[];
  pos: { anchorTop: number; anchorBottom: number; left: number };
  onSelect: (e: VarEntry) => void;
  onClose: () => void;
}) {
  const { t } = useLangStore();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const openDown = pos.anchorBottom + PICKER_HEIGHT + 8 <= window.innerHeight;
  const left     = Math.min(pos.left, window.innerWidth - PICKER_WIDTH - 8);
  const posStyle = openDown
    ? { top:    pos.anchorBottom + 4 }
    : { bottom: window.innerHeight - pos.anchorTop + 4 };

  return (
    <div ref={ref} className="tpl-tile-picker" style={{
      position: 'fixed',
      ...posStyle,
      left,
      zIndex: 9999,
    }}>
      <div className="tpl-tile-picker-header">{t.pick_variable_header}</div>
      {groups.map(g => (
        <div key={g.groupLabel} className="tpl-tile-group">
          <div className="tpl-tile-group-label">{g.groupLabel}</div>
          <div className="tpl-tile-grid">
            {g.entries.map(entry => (
              <button
                key={entry.path}
                type="button"
                className={`tpl-tile tpl-tile--${chipColor(entry.group)}`}
                onClick={() => onSelect(entry)}
                title={entry.path}
              >
                {entry.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── VarChipPicker — single-value chip selector ────────────────────────────────
// Shows a chip when a variable is selected; a button to open TilePicker otherwise.

interface VarChipPickerProps {
  value: string;               // selected path, e.g. "trigger.from"
  onChange: (path: string) => void;
  nodes: FlowNode[];
  currentNodeId: string;
  placeholder?: string;
}

export function VarChipPicker({ value, onChange, nodes, currentNodeId, placeholder }: VarChipPickerProps) {
  const { t, lang } = useLangStore();
  const [open, setOpen]   = useState(false);
  const [pos, setPos]     = useState<{ anchorTop: number; anchorBottom: number; left: number } | null>(null);
  const btnRef            = useRef<HTMLButtonElement>(null);

  const entries = buildVarEntries(nodes, currentNodeId, lang);
  const groups  = groupEntries(entries);
  const entry   = entries.find(e => e.path === value);
  const label   = entry?.label ?? value.split('.').at(-1) ?? value;
  const color   = chipColor(entry?.group ?? '');

  if (value) {
    return (
      <span className={`tpl-chip tpl-chip--${color} var-chip-selected`}>
        <span dangerouslySetInnerHTML={{ __html: escHtml(label) }} />
        <button
          type="button"
          className="tpl-chip-remove"
          onClick={() => onChange('')}
        >
          ×
        </button>
      </span>
    );
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="var-chip-empty-btn"
        onClick={() => {
          const rect = btnRef.current?.getBoundingClientRect();
          if (rect) setPos({ anchorTop: rect.top, anchorBottom: rect.bottom, left: rect.left });
          setOpen(true);
        }}
      >
        + {placeholder ?? t.pick_variable_btn}
      </button>
      {open && pos && groups.length > 0 && (
        <TilePicker
          groups={groups}
          pos={pos}
          onSelect={e => { onChange(e.path); setOpen(false); }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
