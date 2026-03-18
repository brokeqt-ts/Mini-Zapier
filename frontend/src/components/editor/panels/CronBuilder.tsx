import { useState } from 'react';
import { useLangStore } from '../../../store/language.store';

type CronPreset =
  | 'every_minute'
  | 'every_n_min'
  | 'every_hour'
  | 'every_n_hour'
  | 'daily' | 'weekdays' | 'weekends' | 'weekly' | 'monthly'
  | 'custom';

interface CronState {
  preset:      CronPreset;
  intervalMin:  number;   // for every_n_min
  intervalHour: number;   // for every_n_hour
  hour:        number;
  minute:      number;
  weekDay:     number;    // 0=Sun … 6=Sat
  monthDay:    number;    // 1..28
}

const PRESET_KEYS: CronPreset[] = [
  'every_minute', 'every_n_min', 'every_hour', 'every_n_hour',
  'daily', 'weekdays', 'weekends', 'weekly', 'monthly', 'custom',
];

const NEEDS_TIME = new Set<CronPreset>(['daily', 'weekdays', 'weekends', 'weekly', 'monthly']);

const DEFAULT_STATE: CronState = {
  preset: 'daily', intervalMin: 5, intervalHour: 2,
  hour: 9, minute: 0, weekDay: 1, monthDay: 1,
};

function buildCron(s: CronState): string {
  const mm = s.minute;
  const hh = s.hour;
  const n  = Math.max(1, s.intervalMin  || 5);
  const nh = Math.max(1, s.intervalHour || 2);
  switch (s.preset) {
    case 'every_minute': return '* * * * *';
    case 'every_n_min':  return `*/${n} * * * *`;
    case 'every_hour':   return '0 * * * *';
    case 'every_n_hour': return `0 */${nh} * * *`;
    case 'daily':        return `${mm} ${hh} * * *`;
    case 'weekdays':     return `${mm} ${hh} * * 1-5`;
    case 'weekends':     return `${mm} ${hh} * * 0,6`;
    case 'weekly':       return `${mm} ${hh} * * ${s.weekDay}`;
    case 'monthly':      return `${mm} ${hh} ${s.monthDay} * *`;
    default:             return '';
  }
}

function parseCron(cron: string): CronState {
  if (!cron?.trim()) return { ...DEFAULT_STATE, preset: 'daily' };

  if (cron === '* * * * *') return { ...DEFAULT_STATE, preset: 'every_minute' };
  if (cron === '0 * * * *') return { ...DEFAULT_STATE, preset: 'every_hour' };

  // every N minutes: */N * * * *
  const mMin = cron.match(/^\*\/(\d+) \* \* \* \*$/);
  if (mMin) return { ...DEFAULT_STATE, preset: 'every_n_min', intervalMin: parseInt(mMin[1]) };

  // every N hours: 0 */N * * *
  const mHour = cron.match(/^0 \*\/(\d+) \* \* \*$/);
  if (mHour) return { ...DEFAULT_STATE, preset: 'every_n_hour', intervalHour: parseInt(mHour[1]) };

  const parts = cron.split(' ');
  if (parts.length !== 5) return { ...DEFAULT_STATE, preset: 'custom' };
  const [rawMm, rawHh, dom, , dow] = parts;
  const minute = parseInt(rawMm) || 0;
  const hour   = parseInt(rawHh) || 0;

  if (dom === '*' && dow === '1-5') return { ...DEFAULT_STATE, preset: 'weekdays', hour, minute };
  if (dom === '*' && dow === '0,6') return { ...DEFAULT_STATE, preset: 'weekends', hour, minute };
  if (dom === '*' && dow !== '*') {
    const d = parseInt(dow);
    if (!isNaN(d) && d >= 0 && d <= 6)
      return { ...DEFAULT_STATE, preset: 'weekly', hour, minute, weekDay: d };
  }
  if (dom !== '*' && dow === '*') {
    const d = parseInt(dom);
    if (!isNaN(d) && d >= 1 && d <= 28)
      return { ...DEFAULT_STATE, preset: 'monthly', hour, minute, monthDay: d };
  }
  if (dom === '*' && dow === '*') return { ...DEFAULT_STATE, preset: 'daily', hour, minute };

  return { ...DEFAULT_STATE, preset: 'custom' };
}

interface CronBuilderProps {
  value: string;
  onChange: (v: string) => void;
}

export function CronBuilder({ value, onChange }: CronBuilderProps) {
  const { t } = useLangStore();
  const [state, setState] = useState<CronState>(() => parseCron(value));

  const update = (patch: Partial<CronState>) => {
    const next = { ...state, ...patch };
    setState(next);
    if (next.preset !== 'custom') onChange(buildCron(next));
    else onChange(value);
  };

  const needsTime     = NEEDS_TIME.has(state.preset);
  const needsWeekDay  = state.preset === 'weekly';
  const needsMonthDay = state.preset === 'monthly';

  const PRESET_LABELS: Record<CronPreset, string> = {
    every_minute: t.cron_every_minute,
    every_n_min:  t.cron_every_n_min,
    every_hour:   t.cron_every_hour,
    every_n_hour: t.cron_every_n_hour,
    daily:        t.cron_daily,
    weekdays:     t.cron_weekdays,
    weekends:     t.cron_weekends,
    weekly:       t.cron_weekly,
    monthly:      t.cron_monthly,
    custom:       t.cron_custom,
  };

  const WEEK_DAYS = [
    t.cron_weekday_sun, t.cron_weekday_mon, t.cron_weekday_tue, t.cron_weekday_wed,
    t.cron_weekday_thu, t.cron_weekday_fri, t.cron_weekday_sat,
  ];

  return (
    <div className="cron-builder">
      <div className="form-group">
        <label>{t.cron_schedule}</label>
        <select
          className="input"
          value={state.preset}
          onChange={(e) => update({ preset: e.target.value as CronPreset })}
        >
          {PRESET_KEYS.map((v) => (
            <option key={v} value={v}>{PRESET_LABELS[v]}</option>
          ))}
        </select>
      </div>

      {state.preset === 'every_n_min' && (
        <div className="cron-interval-row">
          <label>{t.cron_every}</label>
          <input
            className="input cron-interval-input"
            type="number"
            min={1}
            max={59}
            value={state.intervalMin}
            onChange={(e) => update({ intervalMin: Math.min(59, Math.max(1, +e.target.value)) })}
          />
          <span className="cron-interval-unit">{t.cron_minutes}</span>
        </div>
      )}

      {state.preset === 'every_n_hour' && (
        <div className="cron-interval-row">
          <label>{t.cron_every}</label>
          <input
            className="input cron-interval-input"
            type="number"
            min={1}
            max={23}
            value={state.intervalHour}
            onChange={(e) => update({ intervalHour: Math.min(23, Math.max(1, +e.target.value)) })}
          />
          <span className="cron-interval-unit">{t.cron_hours}</span>
        </div>
      )}

      {needsTime && (
        <div className="cron-time-row">
          {needsWeekDay && (
            <div className="form-group">
              <label>{t.cron_weekday_label}</label>
              <select
                className="input"
                value={state.weekDay}
                onChange={(e) => update({ weekDay: +e.target.value })}
              >
                {WEEK_DAYS.map((d, i) => (
                  <option key={i} value={i}>{d}</option>
                ))}
              </select>
            </div>
          )}

          {needsMonthDay && (
            <div className="form-group">
              <label>{t.cron_monthday_label}</label>
              <input
                className="input"
                type="number"
                min={1}
                max={28}
                value={state.monthDay}
                onChange={(e) => update({ monthDay: Math.min(28, Math.max(1, +e.target.value)) })}
              />
            </div>
          )}

          <div className="form-group">
            <label>{t.cron_time_label}</label>
            <input
              className="input"
              type="time"
              value={`${String(state.hour).padStart(2, '0')}:${String(state.minute).padStart(2, '0')}`}
              onChange={(e) => {
                const [h, m] = e.target.value.split(':').map(Number);
                update({ hour: h || 0, minute: m || 0 });
              }}
            />
          </div>
        </div>
      )}

      {state.preset === 'custom' && (
        <div className="form-group">
          <label>{t.cron_expression_label}</label>
          <input
            className="input"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="0 9 * * 1-5"
          />
          <div className="cron-format-hint">{t.cron_format_hint}</div>
        </div>
      )}
    </div>
  );
}
