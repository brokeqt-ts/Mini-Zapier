import { useState } from 'react';
import type { Node } from '@xyflow/react';
import { TemplateEditor } from './TemplateEditor';
import { useLangStore } from '../../../store/language.store';

interface BodyPair { key: string; value: string }

function parsePairs(body: string): BodyPair[] | null {
  if (!body?.trim()) return [];
  // Replace {{...}} with a placeholder so JSON.parse works
  const placeholders: string[] = [];
  const sanitized = body.replace(/\{\{[^}]+\}\}/g, (m) => {
    placeholders.push(m);
    return `__PH${placeholders.length - 1}__`;
  });
  try {
    const parsed = JSON.parse(sanitized);
    if (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null) return null;
    return Object.entries(parsed).map(([k, v]) => ({
      key: k,
      value: typeof v === 'string'
        ? v.replace(/__PH(\d+)__/g, (_, i) => placeholders[+i])
        : JSON.stringify(v),
    }));
  } catch {
    return null;
  }
}

function pairsToJson(pairs: BodyPair[]): string {
  const valid = pairs.filter((p) => p.key);
  if (valid.length === 0) return '{}';
  const lines = valid.map((p) => `  "${p.key}": "${p.value}"`);
  return `{\n${lines.join(',\n')}\n}`;
}

interface HttpBodyBuilderProps {
  value: string;            // current JSON body string
  onChange: (v: string) => void;
  nodes: Node[];
  currentNodeId: string;
}

export function HttpBodyBuilder({ value, onChange, nodes, currentNodeId }: HttpBodyBuilderProps) {
  const { t } = useLangStore();
  const initPairs = parsePairs(value);
  const [pairs, setPairs] = useState<BodyPair[]>(initPairs ?? [{ key: '', value: '' }]);
  const [showRaw, setShowRaw] = useState(initPairs === null);

  const applyPairs = (next: BodyPair[]) => {
    setPairs(next);
    onChange(pairsToJson(next));
  };

  const updatePair = (i: number, patch: Partial<BodyPair>) => {
    const next = pairs.map((p, idx) => idx === i ? { ...p, ...patch } : p);
    applyPairs(next);
  };

  const addPair = () => applyPairs([...pairs, { key: '', value: '' }]);

  const removePair = (i: number) => applyPairs(pairs.filter((_, idx) => idx !== i));

  const toggleRaw = () => {
    if (!showRaw) {
      // switching to raw — show current JSON
      onChange(pairsToJson(pairs));
    } else {
      // switching back to builder — try to parse
      const parsed = parsePairs(value);
      if (parsed !== null) setPairs(parsed);
    }
    setShowRaw(!showRaw);
  };

  return (
    <div className="body-builder">
      {!showRaw && (
        <>
          <div className="body-builder-header">
            <span className="body-builder-col-label">{t.http_key}</span>
            <span className="body-builder-col-label">{t.http_value}</span>
          </div>

          {pairs.map((pair, i) => (
            <div key={i} className="body-builder-row">
              <input
                className="input body-builder-key"
                value={pair.key}
                onChange={(e) => updatePair(i, { key: e.target.value })}
                placeholder={t.http_key_ph}
              />
              <TemplateEditor
                value={pair.value}
                onChange={(v) => updatePair(i, { value: v })}
                nodes={nodes}
                currentNodeId={currentNodeId}
                placeholder={t.http_value_ph}
              />
              <button className="body-builder-remove" onClick={() => removePair(i)} title={t.http_remove}>
                ×
              </button>
            </div>
          ))}

          <button className="btn btn-secondary body-builder-add" onClick={addPair}>
            {t.http_add_field}
          </button>
        </>
      )}

      <div className="widget-advanced-section">
        <button className="widget-advanced-toggle" onClick={toggleRaw}>
          ⚙ {showRaw ? t.hide : t.dev_mode}
        </button>
        {showRaw && (
          <textarea
            className="input config-textarea"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={5}
            placeholder={'{\n  "key": "{{trigger.body.field}}"\n}'}
          />
        )}
      </div>
    </div>
  );
}
