import { useState } from 'react';
import type { Node } from '@xyflow/react';
import { TemplateEditor } from './TemplateEditor';
import { useLangStore } from '../../../store/language.store';

const WHERE_OPS = ['=', '!=', '>', '<', '>=', '<=', 'LIKE', 'IS NULL', 'IS NOT NULL'];
const VALUE_LESS_OPS = new Set(['IS NULL', 'IS NOT NULL']);

const PG_TYPES = [
  'TEXT', 'VARCHAR(255)', 'INTEGER', 'BIGINT', 'SERIAL', 'BIGSERIAL',
  'BOOLEAN', 'NUMERIC', 'FLOAT', 'TIMESTAMP', 'DATE', 'JSONB', 'UUID',
];

interface WhereClause { field: string; op: string; value: string }
interface InsertRow   { column: string; value: string }

interface SqlState {
  table: string;
  fields: string;
  where: WhereClause[];
  orderBy: string;
  orderDir: 'ASC' | 'DESC';
  limit: string;
}

interface ColumnDef { name: string; type: string; nullable: boolean; defaultVal: string }

const DEFAULT_STATE: SqlState = {
  table: '',
  fields: '*',
  where: [],
  orderBy: '',
  orderDir: 'ASC',
  limit: '',
};

function buildSql(s: SqlState): string {
  const table = s.table || 'table_name';
  const fields = s.fields || '*';
  let sql = `SELECT ${fields} FROM ${table}`;

  const clauses = s.where.filter((w) => w.field);
  if (clauses.length > 0) {
    const parts = clauses.map((w) =>
      VALUE_LESS_OPS.has(w.op)
        ? `${w.field} ${w.op}`
        : `${w.field} ${w.op} '${w.value}'`,
    );
    sql += ` WHERE ${parts.join(' AND ')}`;
  }

  if (s.orderBy) sql += ` ORDER BY ${s.orderBy} ${s.orderDir}`;
  if (s.limit)   sql += ` LIMIT ${s.limit}`;

  return sql;
}

function parseSql(sql: string): SqlState | null {
  if (!sql?.trim()) return null;

  const m = sql.match(
    /^SELECT\s+(.+?)\s+FROM\s+(\w+)((?:\s+WHERE\s+.+?)?)(?:\s+ORDER BY\s+(\w+)\s+(ASC|DESC))?(?:\s+LIMIT\s+(\d+))?$/i,
  );
  if (!m) return null;

  const fields = m[1].trim();
  const table  = m[2];
  const whereRaw = m[3]?.trim().replace(/^WHERE\s+/i, '') || '';
  const orderBy  = m[4] || '';
  const orderDir = (m[5] as 'ASC' | 'DESC') || 'ASC';
  const limit    = m[6] || '';

  const where: WhereClause[] = [];
  if (whereRaw) {
    for (const part of whereRaw.split(/\s+AND\s+/i)) {
      const nullM = part.match(/^(\w+)\s+(IS NULL|IS NOT NULL)$/i);
      if (nullM) { where.push({ field: nullM[1], op: nullM[2].toUpperCase(), value: '' }); continue; }
      const cmpM = part.match(/^(\w+)\s*(=|!=|>=|<=|>|<|LIKE)\s*'([^']*)'$/i);
      if (cmpM) { where.push({ field: cmpM[1], op: cmpM[2].toUpperCase(), value: cmpM[3] }); continue; }
      return null;
    }
  }

  return { table, fields, where, orderBy, orderDir, limit };
}

function buildInsertSql(table: string, rows: InsertRow[]): string {
  const valid = rows.filter(r => r.column.trim());
  if (!table || valid.length === 0) return '';
  const cols = valid.map(r => r.column).join(', ');
  const vals = valid.map(r => `'${r.value}'`).join(', ');
  return `INSERT INTO ${table} (${cols}) VALUES (${vals})`;
}

function parseInsertSql(sql: string): { table: string; rows: InsertRow[] } | null {
  if (!sql?.trim().toUpperCase().startsWith('INSERT')) return null;
  const m = sql.match(/^INSERT\s+INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\((.+)\)$/is);
  if (!m) return null;
  const columns = m[2].split(',').map(s => s.trim());
  const values  = m[3].match(/'(?:[^']|\\')*'|[^,]+/g)?.map(s => s.trim().replace(/^'|'$/g, '')) ?? [];
  if (columns.length !== values.length) return null;
  return { table: m[1], rows: columns.map((column, i) => ({ column, value: values[i] })) };
}

function buildCreateSql(table: string, cols: ColumnDef[]): string {
  if (!table || cols.length === 0) return '';
  const colDefs = cols.map(c => {
    let def = `  ${c.name} ${c.type}`;
    if (!c.nullable) def += ' NOT NULL';
    if (c.defaultVal) def += ` DEFAULT ${c.defaultVal}`;
    return def;
  });
  return `CREATE TABLE IF NOT EXISTS ${table} (\n${colDefs.join(',\n')}\n)`;
}

interface SqlQueryBuilderProps {
  value: string;
  onChange: (v: string) => void;
  readOnly?: boolean;
  nodes?: Node[];
  currentNodeId?: string;
}

type BuilderMode = 'select' | 'insert' | 'create' | 'raw';

export function SqlQueryBuilder({ value, onChange, readOnly = true, nodes = [], currentNodeId = '' }: SqlQueryBuilderProps) {
  const { t } = useLangStore();
  const initState     = parseSql(value);
  const initInsert    = parseInsertSql(value);
  const isCreateSql   = value?.trim().toUpperCase().startsWith('CREATE TABLE');

  const [mode, setMode] = useState<BuilderMode>(
    isCreateSql ? 'create'
    : initInsert ? 'insert'
    : (!!value && initState === null ? 'raw' : 'select')
  );
  const [state, setState] = useState<SqlState>(initState ?? DEFAULT_STATE);
  const [insertTable, setInsertTable] = useState(initInsert?.table ?? '');
  const [insertRows,  setInsertRows]  = useState<InsertRow[]>(
    initInsert?.rows ?? [{ column: '', value: '' }]
  );
  const [createTable, setCreateTable] = useState(isCreateSql ? (value.match(/CREATE TABLE IF NOT EXISTS (\w+)/i)?.[1] ?? '') : '');
  const [cols, setCols] = useState<ColumnDef[]>(
    isCreateSql ? [] : [
      { name: 'id', type: 'SERIAL', nullable: false, defaultVal: '' },
      { name: 'created_at', type: 'TIMESTAMP', nullable: false, defaultVal: 'NOW()' },
    ]
  );

  const switchMode = (next: BuilderMode) => {
    setMode(next);
    if (next === 'select') onChange(buildSql(state));
    if (next === 'insert') onChange(buildInsertSql(insertTable, insertRows));
    if (next === 'create') onChange(buildCreateSql(createTable, cols));
  };

  const updateInsertTable = (name: string) => {
    setInsertTable(name);
    onChange(buildInsertSql(name, insertRows));
  };
  const updateInsertRow = (i: number, patch: Partial<InsertRow>) => {
    const next = insertRows.map((r, idx) => idx === i ? { ...r, ...patch } : r);
    setInsertRows(next);
    onChange(buildInsertSql(insertTable, next));
  };
  const addInsertRow = () => {
    const next = [...insertRows, { column: '', value: '' }];
    setInsertRows(next);
    onChange(buildInsertSql(insertTable, next));
  };
  const removeInsertRow = (i: number) => {
    const next = insertRows.filter((_, idx) => idx !== i);
    setInsertRows(next);
    onChange(buildInsertSql(insertTable, next));
  };

  const update = (patch: Partial<SqlState>) => {
    const next = { ...state, ...patch };
    setState(next);
    onChange(buildSql(next));
  };

  const updateWhere = (i: number, patch: Partial<WhereClause>) => {
    const next = state.where.map((w, idx) => idx === i ? { ...w, ...patch } : w);
    update({ where: next });
  };

  const addWhere = () => update({ where: [...state.where, { field: '', op: '=', value: '' }] });
  const removeWhere = (i: number) => update({ where: state.where.filter((_, idx) => idx !== i) });

  const updateCol = (i: number, patch: Partial<ColumnDef>) => {
    const next = cols.map((c, idx) => idx === i ? { ...c, ...patch } : c);
    setCols(next);
    onChange(buildCreateSql(createTable, next));
  };
  const addCol = () => {
    const next = [...cols, { name: '', type: 'TEXT', nullable: true, defaultVal: '' }];
    setCols(next);
    onChange(buildCreateSql(createTable, next));
  };
  const removeCol = (i: number) => {
    const next = cols.filter((_, idx) => idx !== i);
    setCols(next);
    onChange(buildCreateSql(createTable, next));
  };
  const updateCreateTable = (name: string) => {
    setCreateTable(name);
    onChange(buildCreateSql(name, cols));
  };

  const modeOptions: { value: BuilderMode; label: string }[] = [
    { value: 'select', label: t.sql_mode_select },
    ...(readOnly ? [] : [
      { value: 'insert' as BuilderMode, label: t.sql_mode_insert },
      { value: 'create' as BuilderMode, label: 'CREATE TABLE IF NOT EXISTS' },
    ]),
    { value: 'raw', label: t.sql_mode_raw },
  ];

  return (
    <div className="sql-builder">
      <div className="form-group">
        <label>{t.sql_query_type}</label>
        <select className="input" value={mode} onChange={e => switchMode(e.target.value as BuilderMode)}>
          {modeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* ── SELECT builder ── */}
      {mode === 'select' && (
        <>
          <div className="form-group">
            <label>{t.sql_table}</label>
            <input className="input" value={state.table} onChange={(e) => update({ table: e.target.value })} placeholder="users" />
          </div>
          <div className="form-group">
            <label>{t.sql_fields}</label>
            <input className="input" value={state.fields} onChange={(e) => update({ fields: e.target.value })} placeholder="* или id, name, email" />
          </div>
          <div className="sql-section-label">{t.sql_where}</div>
          {state.where.map((clause, i) => (
            <div key={i} className="sql-where-block">
              <div className="sql-where-top">
                <input className="input sql-where-field" value={clause.field} onChange={(e) => updateWhere(i, { field: e.target.value })} placeholder={t.sql_field_ph} />
                <select className="input sql-where-op" value={clause.op} onChange={(e) => updateWhere(i, { op: e.target.value })}>
                  {WHERE_OPS.map((op) => <option key={op} value={op}>{op}</option>)}
                </select>
                <button className="sql-where-remove" onClick={() => removeWhere(i)}>×</button>
              </div>
              {!VALUE_LESS_OPS.has(clause.op) && (
                <TemplateEditor value={clause.value} onChange={(v) => updateWhere(i, { value: v })} nodes={nodes} currentNodeId={currentNodeId} placeholder={t.sql_value_ph} />
              )}
            </div>
          ))}
          <button className="btn btn-secondary sql-add-where" onClick={addWhere}>{t.sql_add_where}</button>
          <div className="sql-row-two">
            <div className="form-group">
              <label>{t.sql_order}</label>
              <input className="input" value={state.orderBy} onChange={(e) => update({ orderBy: e.target.value })} placeholder="created_at" />
            </div>
            <div className="form-group">
              <label>{t.sql_direction}</label>
              <select className="input" value={state.orderDir} onChange={(e) => update({ orderDir: e.target.value as 'ASC' | 'DESC' })}>
                <option value="ASC">{t.sql_asc}</option>
                <option value="DESC">{t.sql_desc}</option>
              </select>
            </div>
            <div className="form-group">
              <label>{t.sql_limit}</label>
              <input className="input" type="number" min={1} value={state.limit} onChange={(e) => update({ limit: e.target.value })} placeholder="100" />
            </div>
          </div>
          {buildSql(state) && (
            <div className="sql-preview">
              <span className="sql-preview-label">SQL:</span>
              <code className="sql-preview-code">{buildSql(state)}</code>
            </div>
          )}
        </>
      )}

      {/* ── INSERT builder ── */}
      {mode === 'insert' && (
        <>
          <div className="form-group">
            <label>{t.sql_table}</label>
            <input className="input" value={insertTable} onChange={e => updateInsertTable(e.target.value)} placeholder="sync_log" />
          </div>
          <div className="sql-section-label">{t.sql_columns_values}</div>
          {insertRows.map((row, i) => (
            <div key={i} className="sql-where-block">
              <div className="sql-where-top">
                <input
                  className="input sql-where-field"
                  value={row.column}
                  onChange={e => updateInsertRow(i, { column: e.target.value })}
                  placeholder={t.sql_column_ph}
                />
                <button className="sql-where-remove" onClick={() => removeInsertRow(i)}>×</button>
              </div>
              <TemplateEditor
                value={row.value}
                onChange={v => updateInsertRow(i, { value: v })}
                nodes={nodes}
                currentNodeId={currentNodeId}
                placeholder={t.sql_value_var_ph}
              />
            </div>
          ))}
          <button className="btn btn-secondary sql-add-where" onClick={addInsertRow}>{t.sql_add_column}</button>
          {buildInsertSql(insertTable, insertRows) && (
            <div className="sql-preview">
              <span className="sql-preview-label">SQL:</span>
              <code className="sql-preview-code">{buildInsertSql(insertTable, insertRows)}</code>
            </div>
          )}
        </>
      )}

      {/* ── CREATE TABLE builder ── */}
      {mode === 'create' && (
        <>
          <div className="form-group">
            <label>{t.sql_table_name}</label>
            <input className="input" value={createTable} onChange={e => updateCreateTable(e.target.value)} placeholder="sync_log" />
          </div>
          <div className="sql-section-label">{t.sql_columns}</div>
          {cols.map((col, i) => (
            <div key={i} className="sql-where-block">
              <div className="sql-where-top" style={{ flexWrap: 'wrap', gap: 4 }}>
                <input className="input sql-where-field" value={col.name} onChange={e => updateCol(i, { name: e.target.value })} placeholder={t.sql_col_name_ph} />
                <select className="input sql-where-op" value={col.type} onChange={e => updateCol(i, { type: e.target.value })}>
                  {PG_TYPES.map(pgType => <option key={pgType} value={pgType}>{pgType}</option>)}
                </select>
                <input className="input" style={{ width: 90 }} value={col.defaultVal} onChange={e => updateCol(i, { defaultVal: e.target.value })} placeholder="DEFAULT" />
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                  <input type="checkbox" checked={col.nullable} onChange={e => updateCol(i, { nullable: e.target.checked })} />
                  NULL
                </label>
                <button className="sql-where-remove" onClick={() => removeCol(i)}>×</button>
              </div>
            </div>
          ))}
          <button className="btn btn-secondary sql-add-where" onClick={addCol}>{t.sql_add_column}</button>
          {buildCreateSql(createTable, cols) && (
            <div className="sql-preview">
              <span className="sql-preview-label">SQL:</span>
              <code className="sql-preview-code" style={{ whiteSpace: 'pre' }}>{buildCreateSql(createTable, cols)}</code>
            </div>
          )}
        </>
      )}

      {/* ── Raw SQL ── */}
      {mode === 'raw' && (
        <textarea
          className="input config-textarea"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          placeholder="SELECT * FROM users WHERE active = '1' LIMIT 100"
        />
      )}
    </div>
  );
}
