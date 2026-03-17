import { useWorkflowEditorStore } from '../../../store/workflow-editor.store';
import { useLangStore } from '../../../store/language.store';
import { useAuthStore } from '../../../store/auth.store';
import { T } from '../../../i18n/translations';
import './NodeConfigPanel.css';

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

const EMAIL_PROVIDERS = [
  { label: '— Выбрать провайдер —', host: '', port: '', hint: '', hintUrl: '' },
  { label: 'Gmail', host: 'imap.gmail.com', port: '993', hint: 'Нужен пароль приложения', hintUrl: 'https://myaccount.google.com/apppasswords' },
  { label: 'Outlook / Hotmail', host: 'outlook.office365.com', port: '993', hint: '', hintUrl: '' },
  { label: 'Yahoo Mail', host: 'imap.mail.yahoo.com', port: '993', hint: 'Нужен пароль приложения', hintUrl: 'https://login.yahoo.com/account/security' },
  { label: 'Yandex', host: 'imap.yandex.ru', port: '993', hint: 'Включите IMAP в настройках Яндекс.Почты', hintUrl: 'https://id.yandex.ru/security' },
  { label: 'Mail.ru', host: 'imap.mail.ru', port: '993', hint: 'Включите IMAP и создайте пароль для приложения', hintUrl: 'https://account.mail.ru/user/2-step-auth/passwords/' },
  { label: 'Rambler', host: 'imap.rambler.ru', port: '993', hint: '', hintUrl: '' },
  { label: 'iCloud', host: 'imap.mail.me.com', port: '993', hint: 'Нужен пароль приложения', hintUrl: 'https://appleid.apple.com/account/manage' },
];

export function NodeConfigPanel() {
  const { nodes, selectedNodeId, updateNodeConfig } =
    useWorkflowEditorStore();
  const { t } = useLangStore();
  const user = useAuthStore((s) => s.user);

  const node = nodes.find((n) => n.id === selectedNodeId);
  if (!node) return null;

  const nodeType = node.data.nodeType as string;
  const config = (node.data.config as Record<string, unknown>) || {};
  const fields = FIELD_SCHEMAS[nodeType] || [];

  const handleChange = (key: string, value: string) => {
    updateNodeConfig(node.id, { ...config, [key]: value });
  };

  const handleProviderSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const provider = EMAIL_PROVIDERS.find((p) => p.host === e.target.value);
    if (!provider || !provider.host) return;
    updateNodeConfig(node.id, {
      ...config,
      imapHost: provider.host,
      imapPort: provider.port,
    });
  };

  const selectedProvider = EMAIL_PROVIDERS.find(
    (p) => p.host === (config.imapHost as string),
  );

  return (
    <div className="config-panel">
      <h4 className="config-title">{node.data.label as string}</h4>
      <div className="config-type">{nodeType.replace(/_/g, ' ')}</div>

      <div className="config-fields">
        {/* Provider quick-select for email trigger */}
        {nodeType === 'TRIGGER_EMAIL' && (
          <div className="form-group">
            <label>Провайдер</label>
            <select
              className="input"
              value={(config.imapHost as string) || ''}
              onChange={handleProviderSelect}
            >
              {EMAIL_PROVIDERS.map((p) => (
                <option key={p.host} value={p.host}>
                  {p.label}
                </option>
              ))}
            </select>
            {selectedProvider?.hint && (
              <div className="field-hint">
                ⚠️ {selectedProvider.hint}
                {selectedProvider.hintUrl && (
                  <>
                    {' — '}
                    <a href={selectedProvider.hintUrl} target="_blank" rel="noreferrer">
                      Получить
                    </a>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Telegram: auto-fill from connected account */}
        {nodeType === 'ACTION_TELEGRAM' && user?.telegramChatId && (
          <div className="tg-account-toggle">
            <label className="tg-toggle-label">
              <input
                type="checkbox"
                checked={!!config.useUserAccount}
                onChange={(e) =>
                  updateNodeConfig(node.id, {
                    ...config,
                    useUserAccount: e.target.checked,
                  })
                }
              />
              <span>Использовать мой Telegram</span>
            </label>
            {!!config.useUserAccount && (
              <div className="tg-account-info">
                ✅ Сообщение придёт на ваш аккаунт
                <br />
                <small>Chat ID: {user.telegramChatId}</small>
              </div>
            )}
          </div>
        )}

        {nodeType === 'ACTION_TELEGRAM' && !user?.telegramChatId && (
          <div className="field-hint">
            💡 Подключите Telegram в{' '}
            <a href="/settings" target="_blank" rel="noreferrer">
              настройках
            </a>{' '}
            — и не нужно будет вводить токен вручную
          </div>
        )}

        {/* Hide botToken/chatId when using connected account */}
        {fields
          .filter(
            (f) =>
              !(
                config.useUserAccount &&
                nodeType === 'ACTION_TELEGRAM' &&
                (f.key === 'botToken' || f.key === 'chatId')
              ),
          )
          .map((field) => (
            <div className="form-group" key={field.key}>
              <label>{t[field.labelKey] as string}</label>
              {field.type === 'textarea' ? (
                <textarea
                  className="input config-textarea"
                  value={(config[field.key] as string) || ''}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  rows={3}
                />
              ) : (
                <input
                  className="input"
                  type={field.type || 'text'}
                  value={(config[field.key] as string) || ''}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                />
              )}
            </div>
          ))}

        <div className="form-group">
          <label>{t.field_retry}</label>
          <input
            className="input"
            type="number"
            min={1}
            max={10}
            value={
              ((config.retry as Record<string, unknown>)?.maxAttempts as number) || 1
            }
            onChange={(e) =>
              handleChange('retry', JSON.stringify({
                ...((config.retry as Record<string, unknown>) || {}),
                maxAttempts: parseInt(e.target.value) || 1,
                backoffMs: 1000,
                backoffMultiplier: 2,
              }))
            }
          />
        </div>
      </div>
    </div>
  );
}
