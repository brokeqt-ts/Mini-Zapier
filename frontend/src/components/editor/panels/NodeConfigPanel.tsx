import { useState, useEffect } from 'react';
import { useWorkflowEditorStore } from '../../../store/workflow-editor.store';
import { useLangStore } from '../../../store/language.store';
import { useAuthStore } from '../../../store/auth.store';
import { useEmailAccountsStore } from '../../../store/email-accounts.store';
import { useDbConnectionsStore } from '../../../store/db-connections.store';
import { T } from '../../../i18n/translations';

function getTimezones(t: T) {
  return [
    { value: 'UTC',                label: t.tz_utc },
    { value: 'Europe/Moscow',      label: t.tz_moscow },
    { value: 'Europe/Minsk',       label: t.tz_minsk },
    { value: 'Europe/Kiev',        label: t.tz_kiev },
    { value: 'Europe/Kaliningrad', label: t.tz_kaliningrad },
    { value: 'Asia/Yekaterinburg', label: t.tz_yekaterinburg },
    { value: 'Asia/Omsk',          label: t.tz_omsk },
    { value: 'Asia/Krasnoyarsk',   label: t.tz_krasnoyarsk },
    { value: 'Asia/Irkutsk',       label: t.tz_irkutsk },
    { value: 'Asia/Yakutsk',       label: t.tz_yakutsk },
    { value: 'Asia/Vladivostok',   label: t.tz_vladivostok },
    { value: 'Asia/Magadan',       label: t.tz_magadan },
    { value: 'Europe/London',      label: t.tz_london },
    { value: 'Europe/Paris',       label: t.tz_paris },
    { value: 'America/New_York',   label: t.tz_new_york },
    { value: 'America/Chicago',    label: t.tz_chicago },
    { value: 'America/Los_Angeles',label: t.tz_la },
    { value: 'Asia/Dubai',         label: t.tz_dubai },
    { value: 'Asia/Kolkata',       label: t.tz_india },
    { value: 'Asia/Shanghai',      label: t.tz_shanghai },
    { value: 'Asia/Tokyo',         label: t.tz_tokyo },
    { value: 'Australia/Sydney',   label: t.tz_sydney },
  ];
}

function getEmailProviders(t: T) {
  return [
    { label: t.imap_select_provider, host: '', port: '', hint: '', hintUrl: '' },
    { label: 'Gmail', host: 'imap.gmail.com', port: '993', hint: t.imap_hint_app_password, hintUrl: 'https://myaccount.google.com/apppasswords' },
    { label: 'Outlook / Hotmail', host: 'outlook.office365.com', port: '993', hint: '', hintUrl: '' },
    { label: 'Yahoo Mail', host: 'imap.mail.yahoo.com', port: '993', hint: t.imap_hint_app_password, hintUrl: 'https://login.yahoo.com/account/security' },
    { label: 'Yandex', host: 'imap.yandex.ru', port: '993', hint: t.imap_hint_yandex, hintUrl: 'https://id.yandex.ru/security' },
    { label: 'Mail.ru', host: 'imap.mail.ru', port: '993', hint: t.imap_hint_mailru, hintUrl: 'https://account.mail.ru/user/2-step-auth/passwords/' },
    { label: 'Rambler', host: 'imap.rambler.ru', port: '993', hint: '', hintUrl: '' },
    { label: 'iCloud', host: 'imap.mail.me.com', port: '993', hint: t.imap_hint_app_password, hintUrl: 'https://appleid.apple.com/account/manage' },
  ];
}
import { CronBuilder } from './CronBuilder';
import { HttpBodyBuilder } from './HttpBodyBuilder';
import { SqlQueryBuilder } from './SqlQueryBuilder';
import { DataTransformMapper } from './DataTransformMapper';
import { TemplateEditor } from './TemplateEditor';
import './NodeConfigPanel.css';
import './FieldWidgets.css';

type FieldDef = { labelKey: keyof T; key: string; type?: string };

const FIELD_SCHEMAS: Record<string, FieldDef[]> = {
  TRIGGER_WEBHOOK: [
    { labelKey: 'field_webhookPath', key: 'webhookPath' },
  ],
  TRIGGER_CRON: [
    { labelKey: 'field_cronExpression', key: 'cronExpression' },
    { labelKey: 'field_timezone', key: 'timezone' },
  ],
  TRIGGER_EMAIL: [
    { labelKey: 'field_imapHost', key: 'imapHost' },
    { labelKey: 'field_imapPort', key: 'imapPort', type: 'number' },
    { labelKey: 'field_imapUser', key: 'imapUser' },
    { labelKey: 'field_imapPass', key: 'imapPass', type: 'password' },
    { labelKey: 'field_subjectFilter', key: 'subjectFilter' },
  ],
  ACTION_HTTP_REQUEST: [
    { labelKey: 'field_url', key: 'url' },
    { labelKey: 'field_method', key: 'method' },
    { labelKey: 'field_body', key: 'body', type: 'textarea' },
    { labelKey: 'field_timeout', key: 'timeout', type: 'number' },
  ],
  ACTION_EMAIL: [
    { labelKey: 'field_to', key: 'to' },
    { labelKey: 'field_subject', key: 'subject' },
    { labelKey: 'field_bodyTemplate', key: 'bodyTemplate', type: 'textarea' },
  ],
  ACTION_TELEGRAM: [
    { labelKey: 'field_botToken', key: 'botToken' },
    { labelKey: 'field_chatId', key: 'chatId' },
    { labelKey: 'field_messageTemplate', key: 'messageTemplate', type: 'textarea' },
  ],
  ACTION_DB_QUERY: [
    { labelKey: 'field_connectionString', key: 'connectionString' },
    { labelKey: 'field_query', key: 'query', type: 'textarea' },
  ],
  ACTION_DATA_TRANSFORM: [
    { labelKey: 'field_expression', key: 'expression', type: 'textarea' },
  ],
};


export function NodeConfigPanel() {
  const { nodes, selectedNodeId, updateNodeConfig } = useWorkflowEditorStore();
  const { t } = useLangStore();
  const user = useAuthStore((s) => s.user);
  const { accounts, loaded, load } = useEmailAccountsStore();
  const { connections: dbConnections, loaded: dbLoaded, load: dbLoad } = useDbConnectionsStore();
  const [showAdvanced, setShowAdvanced] = useState(false);

  const TIMEZONES = getTimezones(t);
  const EMAIL_PROVIDERS = getEmailProviders(t);

  useEffect(() => {
    if (!loaded) load();
  }, [loaded, load]);

  useEffect(() => {
    if (!dbLoaded) dbLoad();
  }, [dbLoaded, dbLoad]);

  const node = nodes.find((n) => n.id === selectedNodeId);
  if (!node) return null;

  const nodeType = node.data.nodeType as string;
  const config = (node.data.config as Record<string, unknown>) || {};
  const fields = FIELD_SCHEMAS[nodeType] || [];

  const val = (key: string) => (config[key] as string) || '';
  const set = (key: string, value: string) =>
    updateNodeConfig(node.id, { ...config, [key]: value });

  const handleProviderSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const provider = EMAIL_PROVIDERS.find((p) => p.host === e.target.value);
    if (!provider?.host) return;
    updateNodeConfig(node.id, { ...config, imapHost: provider.host, imapPort: provider.port });
  };

  const selectedProvider = EMAIL_PROVIDERS.find((p) => p.host === val('imapHost'));

  // Accounts with IMAP configured (for TRIGGER_EMAIL)
  const imapAccounts = accounts.filter(a => a.imapHost);

  // Selected email account id
  const emailAccountId = (config.emailAccountId as string) || '';

  const selectedEmailAccount = accounts.find(a => a.id === emailAccountId);

  return (
    <div className="config-panel">
      <h4 className="config-title">{node.data.label as string}</h4>
      <div className="config-type">{nodeType.replace(/_/g, ' ')}</div>

      <div className="config-fields">

        {/* ── TRIGGER_EMAIL: saved account selector ── */}
        {nodeType === 'TRIGGER_EMAIL' && (
          <>
            <div className="form-group">
              <label>{t.use_saved_account}</label>
              {imapAccounts.length > 0 ? (
                <>
                  <select
                    className="input"
                    value={emailAccountId}
                    onChange={e => updateNodeConfig(node.id, { ...config, emailAccountId: e.target.value })}
                  >
                    <option value="">{t.enter_manually}</option>
                    {imapAccounts.map(a => (
                      <option key={a.id} value={a.id}>{a.label} ({a.smtpUser})</option>
                    ))}
                  </select>
                  {emailAccountId && selectedEmailAccount && (
                    <div className="tg-account-info" style={{ marginTop: 6 }}>
                      IMAP: <strong>{selectedEmailAccount.imapHost}:{selectedEmailAccount.imapPort ?? 993}</strong>
                      {' '}/ {t.login_label} <strong>{selectedEmailAccount.smtpUser}</strong>
                    </div>
                  )}
                </>
              ) : (
                <div className="field-hint">
                  {t.add_imap_hint}{' '}
                  <a href="/settings" target="_blank" rel="noreferrer">{t.settings_link}</a>{' '}
                  — тогда не нужно вводить данные вручную.
                </div>
              )}
            </div>

            {/* Manual IMAP fields — only shown when no saved account selected */}
            {!emailAccountId && (
              <>
                <div className="form-group">
                  <label>{t.provider_label}</label>
                  <select className="input" value={val('imapHost')} onChange={handleProviderSelect}>
                    {EMAIL_PROVIDERS.map((p) => (
                      <option key={p.host} value={p.host}>{p.label}</option>
                    ))}
                  </select>
                  {selectedProvider?.hint && (
                    <div className="field-hint">
                      ⚠️ {selectedProvider.hint}
                      {selectedProvider.hintUrl && (
                        <> — <a href={selectedProvider.hintUrl} target="_blank" rel="noreferrer">{t.imap_get_link}</a></>
                      )}
                    </div>
                  )}
                </div>
                {fields
                  .filter(f => f.key !== 'subjectFilter')
                  .map((field) => (
                    <div className="form-group" key={field.key}>
                      <label>{t[field.labelKey] as string}</label>
                      <input
                        className="input"
                        type={field.type || 'text'}
                        value={val(field.key)}
                        onChange={(e) => set(field.key, e.target.value)}
                      />
                    </div>
                  ))}
              </>
            )}

            {/* Subject/from filters always visible */}
            <div className="form-group">
              <label>{t.field_subjectFilter as string}</label>
              <input
                className="input"
                value={val('subjectFilter')}
                onChange={(e) => set('subjectFilter', e.target.value)}
              />
            </div>
          </>
        )}

        {/* ── ACTION_EMAIL: account selector ── */}
        {nodeType === 'ACTION_EMAIL' && (
          <div className="form-group">
            <label>{t.send_from_label}</label>
            <select
              className="input"
              value={emailAccountId}
              onChange={e => updateNodeConfig(node.id, { ...config, emailAccountId: e.target.value })}
            >
              <option value="">{t.no_account_manual}</option>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.label} ({a.smtpUser})</option>
              ))}
            </select>
            {emailAccountId && selectedEmailAccount && (
              <div className="tg-account-info" style={{ marginTop: 6 }}>
                {t.will_send_from} <strong>{selectedEmailAccount.smtpUser}</strong>
              </div>
            )}
            {!emailAccountId && accounts.length === 0 && (
              <div className="field-hint">
                {t.add_smtp_hint}{' '}
                <a href="/settings" target="_blank" rel="noreferrer">{t.settings_link}</a>{' '}
                {t.smtp_hint_suffix}
              </div>
            )}
          </div>
        )}

        {/* ── ACTION_EMAIL: manual SMTP fields (shown when no account selected) ── */}
        {nodeType === 'ACTION_EMAIL' && !emailAccountId && (
          <>
            <div className="form-group">
              <label>{t.smtp_server}</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input className="input" style={{ flex: 1 }} placeholder="smtp.yandex.ru" value={val('smtpHost')} onChange={e => set('smtpHost', e.target.value)} />
                <input className="input" style={{ width: 70 }} placeholder="465" value={val('smtpPort')} onChange={e => set('smtpPort', e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label>{t.smtp_login}</label>
              <input className="input" placeholder="user@yandex.ru" value={val('smtpUser')} onChange={e => set('smtpUser', e.target.value)} />
            </div>
            <div className="form-group">
              <label>{t.smtp_password}</label>
              <input className="input" type="password" autoComplete="new-password" placeholder="••••••••" value={val('smtpPass')} onChange={e => set('smtpPass', e.target.value)} />
            </div>
          </>
        )}

        {/* ── ACTION_TELEGRAM: use connected account ── */}
        {nodeType === 'ACTION_TELEGRAM' && user?.telegramChatId && (
          <div className="tg-account-toggle">
            <label className="tg-toggle-label">
              <input
                type="checkbox"
                checked={!!config.useUserAccount}
                onChange={(e) =>
                  updateNodeConfig(node.id, { ...config, useUserAccount: e.target.checked })
                }
              />
              <span>{t.use_my_telegram}</span>
            </label>
            {!!config.useUserAccount && (
              <div className="tg-account-info">
                {t.tg_will_receive}
                <br />
                <small>Chat ID: {user.telegramChatId}</small>
              </div>
            )}
          </div>
        )}

        {nodeType === 'ACTION_TELEGRAM' && !user?.telegramChatId && (
          <div className="field-hint">
            {t.connect_tg_hint}{' '}
            <a href="/settings" target="_blank" rel="noreferrer">{t.settings_link}</a>{' '}
            {t.connect_tg_suffix}
          </div>
        )}

        {/* ── TRIGGER_CRON: cron builder (replaces cronExpression textarea) ── */}
        {nodeType === 'TRIGGER_CRON' && (
          <>
            <CronBuilder value={val('cronExpression')} onChange={(v) => set('cronExpression', v)} />
            <div className="form-group">
              <label>{t.field_timezone}</label>
              <select
                className="input"
                value={val('timezone') || 'UTC'}
                onChange={(e) => set('timezone', e.target.value)}
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>{tz.label}</option>
                ))}
              </select>
            </div>
          </>
        )}

        {/* ── ACTION_HTTP_REQUEST: URL/method + headers + body builder ── */}
        {nodeType === 'ACTION_HTTP_REQUEST' && (() => {
          const method = val('method') || 'GET';
          const bodyMethods = ['POST', 'PUT', 'PATCH'];
          return (
            <>
              <div className="form-group">
                <label>{t.field_url}</label>
                <input
                  className="input"
                  value={val('url')}
                  onChange={e => set('url', e.target.value)}
                  placeholder="https://api.example.com/endpoint"
                />
              </div>
              <div className="form-group">
                <label>{t.field_method}</label>
                <select className="input" value={method} onChange={(e) => set('method', e.target.value)}>
                  {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>{t.headers_label}</label>
                <HttpBodyBuilder
                  value={val('headers')}
                  onChange={(v) => set('headers', v)}
                  nodes={nodes}
                  currentNodeId={node.id}
                />
              </div>
              {bodyMethods.includes(method) && (
                <div className="form-group">
                  <label>{t.field_body}</label>
                  <HttpBodyBuilder
                    value={val('body')}
                    onChange={(v) => set('body', v)}
                    nodes={nodes}
                    currentNodeId={node.id}
                  />
                </div>
              )}
              <div className="form-group">
                <label>{t.field_timeout}</label>
                <input className="input" type="number" value={val('timeout')} onChange={(e) => set('timeout', e.target.value)} />
              </div>
            </>
          );
        })()}

        {/* ── ACTION_EMAIL: template with variable picker ── */}
        {nodeType === 'ACTION_EMAIL' && (
          <>
            <div className="form-group">
              <label>{t.field_to}</label>
              <input
                className="input"
                type="email"
                value={val('to')}
                onChange={(e) => set('to', e.target.value)}
                placeholder="user@example.com"
              />
            </div>
            <div className="form-group">
              <TemplateEditor
                label={t.field_subject}
                value={val('subject')}
                onChange={(v) => set('subject', v)}
                nodes={nodes}
                currentNodeId={node.id}
                placeholder={t.email_subject_ph}
              />
            </div>
            <div className="form-group">
              <TemplateEditor
                label={t.field_bodyTemplate}
                value={val('bodyTemplate')}
                onChange={(v) => set('bodyTemplate', v)}
                nodes={nodes}
                currentNodeId={node.id}
                placeholder={t.body_text_ph}
                multiline
              />
            </div>
          </>
        )}

        {/* ── ACTION_TELEGRAM: template with variable picker ── */}
        {nodeType === 'ACTION_TELEGRAM' && (
          <>
            {/* botToken / chatId only when not using connected account */}
            {!config.useUserAccount && (
              <>
                <div className="form-group">
                  <label>{t.field_botToken}</label>
                  <input className="input" value={val('botToken')} onChange={(e) => set('botToken', e.target.value)} />
                </div>
                <div className="form-group">
                  <TemplateEditor
                    label={t.field_chatId}
                    value={val('chatId')}
                    onChange={(v) => set('chatId', v)}
                    nodes={nodes}
                    currentNodeId={node.id}
                    placeholder="123456789"
                  />
                </div>
              </>
            )}
            <div className="form-group">
              <TemplateEditor
                label={t.field_messageTemplate}
                value={val('messageTemplate')}
                onChange={(v) => set('messageTemplate', v)}
                nodes={nodes}
                currentNodeId={node.id}
                placeholder={t.message_template_ph}
                multiline
              />
            </div>
          </>
        )}

        {/* ── ACTION_DB_QUERY: SQL builder ── */}
        {nodeType === 'ACTION_DB_QUERY' && (
          <>
            <div className="form-group">
              <label>{t.db_conn_select}</label>
              <select
                className="input"
                value={(config.dbConnectionId as string) || ''}
                onChange={e => updateNodeConfig(node.id, { ...config, dbConnectionId: e.target.value, connectionString: e.target.value ? '' : config.connectionString })}
              >
                <option value="">{t.db_conn_none}</option>
                {dbConnections.map(c => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
              {dbConnections.length === 0 && (
                <div className="field-hint">
                  💡 <a href="/settings" target="_blank" rel="noreferrer">{t.settings_link}</a> → {t.db_connections_title}
                </div>
              )}
            </div>
            {!config.dbConnectionId && (
              <div className="form-group">
                <label>{t.field_connectionString}</label>
                <input
                  className="input"
                  type="password" autoComplete="new-password"
                  value={val('connectionString')}
                  onChange={(e) => set('connectionString', e.target.value)}
                  placeholder="postgresql://user:pass@host:5432/dbname"
                />
                {!val('connectionString') && (
                  <div className="field-hint">
                    {t.no_conn_hint}
                    {' '}{t.format_label} <code>postgresql://user:pass@host:5432/db</code>
                  </div>
                )}
              </div>
            )}
            <div className="form-group">
              <label>{t.query_mode}</label>
              <select
                className="input"
                value={config.readOnly === false ? 'write' : 'read'}
                onChange={(e) =>
                  updateNodeConfig(node.id, { ...config, readOnly: e.target.value === 'read' })
                }
              >
                <option value="read">{t.read_only_mode}</option>
                <option value="write">{t.write_mode}</option>
              </select>
            </div>
            <div className="form-group">
              <label>{t.field_query}</label>
              <SqlQueryBuilder
                value={val('query')}
                onChange={(v) => set('query', v)}
                readOnly={config.readOnly !== false}
                nodes={nodes}
                currentNodeId={node.id}
              />
            </div>
          </>
        )}

        {/* ── ACTION_DATA_TRANSFORM: field mapper ── */}
        {nodeType === 'ACTION_DATA_TRANSFORM' && (
          <div className="form-group">
            <label>{t.field_expression}</label>
            <DataTransformMapper
              value={val('expression')}
              onChange={(v) => set('expression', v)}
              nodes={nodes}
              currentNodeId={node.id}
            />
          </div>
        )}

        {/* ── Fallback: generic rendering for TRIGGER_WEBHOOK ── */}
        {!['TRIGGER_CRON', 'TRIGGER_EMAIL', 'ACTION_HTTP_REQUEST', 'ACTION_EMAIL', 'ACTION_TELEGRAM',
           'ACTION_DB_QUERY', 'ACTION_DATA_TRANSFORM'].includes(nodeType) &&
          fields
            .filter((f) =>
              !(config.useUserAccount && nodeType === 'ACTION_TELEGRAM' &&
                (f.key === 'botToken' || f.key === 'chatId')),
            )
            .map((field) => (
              <div className="form-group" key={field.key}>
                <label>{t[field.labelKey] as string}</label>
                {field.type === 'textarea' ? (
                  <textarea
                    className="input config-textarea"
                    value={val(field.key)}
                    onChange={(e) => set(field.key, e.target.value)}
                    rows={3}
                  />
                ) : (
                  <input
                    className="input"
                    type={field.type || 'text'}
                    value={val(field.key)}
                    onChange={(e) => set(field.key, e.target.value)}
                  />
                )}
              </div>
            ))}

        {/* ── Advanced / Retry ── */}
        <div className="widget-advanced-section">
          <button className="widget-advanced-toggle" onClick={() => setShowAdvanced(v => !v)}>
            ⚙ {showAdvanced ? t.hide_advanced : t.show_advanced}
          </button>
          {showAdvanced && (
            <div className="form-group">
              <label>{t.field_retry}</label>
              <input
                className="input"
                type="number"
                min={1}
                max={10}
                value={((config.retry as Record<string, unknown>)?.maxAttempts as number) || 1}
                onChange={(e) =>
                  set('retry', JSON.stringify({
                    ...((config.retry as Record<string, unknown>) || {}),
                    maxAttempts: parseInt(e.target.value) || 1,
                    backoffMs: 1000,
                    backoffMultiplier: 2,
                  }))
                }
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
