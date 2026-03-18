import { useEffect, useRef, useState } from 'react';
import type { Node as FlowNode } from '@xyflow/react';
import { buildVarEntries } from '../utils/fieldSuggestions';
import type { VarEntry } from '../utils/fieldSuggestions';
import { chipColor, groupEntries, TilePicker } from './VarTilePicker';
import { useLangStore } from '../../../store/language.store';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Convert `{{path}}` template string → HTML with chip spans */
function valueToHtml(value: string, entries: VarEntry[]): string {
  const parts = (value ?? '').split(/(\{\{[^}]+\}\})/);
  return parts.map(part => {
    const m = part.match(/^\{\{([^}]+)\}\}$/);
    if (!m) {
      return part
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    }
    const path  = m[1].trim();
    const entry = entries.find(e => e.path === path);
    const label = entry?.label || path.split('.').at(-1) || path;
    const color = chipColor(entry?.group || '');
    return `<span class="tpl-chip tpl-chip--${color}" contenteditable="false" data-var="${path}"><span class="tpl-chip-label">${escHtml(label)}</span><button type="button" class="tpl-chip-remove" data-remove="1">×</button></span>`;
  }).join('');
}

/** Read contenteditable div → reconstruct `{{path}}` template string */
function htmlToValue(el: HTMLElement, isRoot = true): string {
  let result = '';
  const children = Array.from(el.childNodes);
  for (let i = 0; i < children.length; i++) {
    const node = children[i];
    if (node.nodeType === Node.TEXT_NODE) {
      result += node.textContent ?? '';
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const span = node as HTMLElement;
      const varPath = span.getAttribute('data-var');
      if (varPath) {
        result += `{{${varPath}}}`;
      } else if (span.tagName === 'BR') {
        result += '\n';
      } else if (span.tagName === 'DIV') {
        if (!isRoot || i > 0) result += '\n';
        result += htmlToValue(span, false);
      } else {
        result += htmlToValue(span, false);
      }
    }
  }
  return result;
}

// ─── TemplateEditor ───────────────────────────────────────────────────────────

export interface TemplateEditorProps {
  value: string;
  onChange: (v: string) => void;
  nodes?: FlowNode[];
  currentNodeId?: string;
  placeholder?: string;
  multiline?: boolean;
  label?: string;
}

export function TemplateEditor({
  value,
  onChange,
  nodes = [],
  currentNodeId = '',
  placeholder,
  multiline,
  label,
}: TemplateEditorProps) {
  const { t, lang } = useLangStore();
  const entries = buildVarEntries(nodes, currentNodeId, lang);
  const groups  = groupEntries(entries);

  const editorRef       = useRef<HTMLDivElement>(null);
  const btnRef          = useRef<HTMLButtonElement>(null);
  const lastSyncedValue = useRef<string>('\x00');
  const savedRange      = useRef<Range | null>(null);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerPos,  setPickerPos]  = useState<{ anchorTop: number; anchorBottom: number; left: number } | null>(null);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (value === lastSyncedValue.current) return;
    lastSyncedValue.current = value;
    const html = valueToHtml(value, entries);
    if (el.innerHTML !== html) {
      el.innerHTML = html || '';
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleInput = () => {
    const el = editorRef.current;
    if (!el) return;
    const newValue = htmlToValue(el);
    lastSyncedValue.current = newValue;
    onChange(newValue);
  };

  const handleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.getAttribute('data-remove')) {
      e.preventDefault();
      const chip = target.closest('[data-var]') as HTMLElement | null;
      if (chip) {
        chip.remove();
        const newValue = htmlToValue(editorRef.current!);
        lastSyncedValue.current = newValue;
        onChange(newValue);
      }
    }
  };

  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
      savedRange.current = sel.getRangeAt(0).cloneRange();
    }
  };

  const insertVar = (entry: VarEntry) => {
    const el = editorRef.current;
    if (!el) return;

    const color  = chipColor(entry.group);
    const chipEl = document.createElement('span');
    chipEl.className = `tpl-chip tpl-chip--${color}`;
    chipEl.setAttribute('contenteditable', 'false');
    chipEl.setAttribute('data-var', entry.path);
    chipEl.innerHTML = `<span class="tpl-chip-label">${escHtml(entry.label)}</span><button type="button" class="tpl-chip-remove" data-remove="1">×</button>`;

    const space = document.createTextNode('\u00A0');

    const range = savedRange.current;
    if (range && el.contains(range.commonAncestorContainer)) {
      range.deleteContents();
      range.insertNode(space);
      range.insertNode(chipEl);
      range.setStartAfter(space);
      range.collapse(true);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    } else {
      el.appendChild(chipEl);
      el.appendChild(space);
    }

    const newValue = htmlToValue(el);
    lastSyncedValue.current = newValue;
    onChange(newValue);
    setPickerOpen(false);
    requestAnimationFrame(() => el.focus());
  };

  return (
    <div className="tpl-editor-wrap">
      {label && <label>{label}</label>}
      <div
        ref={editorRef}
        className={`tpl-editor${multiline ? ' tpl-editor--multi' : ''}`}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onClick={handleClick}
        onMouseUp={saveSelection}
        onKeyUp={saveSelection}
        onBlur={saveSelection}
        data-placeholder={!value ? (placeholder ?? '') : ''}
      />

      {groups.length > 0 && (
        <button
          ref={btnRef}
          type="button"
          className="tpl-add-var-btn"
          onClick={() => {
            const rect = btnRef.current?.getBoundingClientRect();
            if (rect) setPickerPos({ anchorTop: rect.top, anchorBottom: rect.bottom, left: rect.left });
            setPickerOpen(v => !v);
          }}
        >
          {t.add_variable}
        </button>
      )}

      {pickerOpen && pickerPos && (
        <TilePicker
          groups={groups}
          pos={pickerPos}
          onSelect={insertVar}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}
