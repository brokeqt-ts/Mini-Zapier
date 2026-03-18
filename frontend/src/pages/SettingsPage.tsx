import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { telegramApi } from '../api/telegram.api';
import { useAuthStore } from '../store/auth.store';
import { useLangStore } from '../store/language.store';
import type { T } from '../i18n/translations';
import { useEmailAccountsStore } from '../store/email-accounts.store';
import { EmailAccount, CreateEmailAccountDto } from '../api/email-accounts.api';
import './SettingsPage.css';

interface MailProvider {
  name: string;
  smtpHost: string;
  smtpPort: number;
  imapHost: string;
  imapPort: number;
  railwayOk?: boolean; // works reliably from cloud/Railway
  railwayWarn?: boolean; // known to block cloud IPs
}

// Relay services — work from Railway and any cloud provider
const PROVIDERS_RELAY: MailProvider[] = [
  { name: 'Resend',   smtpHost: 'smtp.resend.com',      smtpPort: 465, imapHost: '', imapPort: 0, railwayOk: true },
  { name: 'SendGrid', smtpHost: 'smtp.sendgrid.net',     smtpPort: 587, imapHost: '', imapPort: 0, railwayOk: true },
  { name: 'Brevo',    smtpHost: 'smtp-relay.brevo.com',  smtpPort: 587, imapHost: '', imapPort: 0, railwayOk: true },
];

// Standard mail providers — may be blocked from cloud IPs
const PROVIDERS_STANDARD: MailProvider[] = [
  { name: 'Gmail',           smtpHost: 'smtp.gmail.com',         smtpPort: 587, imapHost: 'imap.gmail.com',         imapPort: 993 },
  { name: 'Outlook / Hotmail', smtpHost: 'smtp-mail.outlook.com', smtpPort: 587, imapHost: 'outlook.office365.com',  imapPort: 993 },
  { name: 'Yahoo Mail',      smtpHost: 'smtp.mail.yahoo.com',    smtpPort: 465, imapHost: 'imap.mail.yahoo.com',    imapPort: 993 },
  { name: 'iCloud',          smtpHost: 'smtp.mail.me.com',       smtpPort: 587, imapHost: 'imap.mail.me.com',       imapPort: 993 },
  { name: 'Яндекс',          smtpHost: 'smtp.yandex.com',        smtpPort: 465, imapHost: 'imap.yandex.ru',         imapPort: 993, railwayWarn: true },
  { name: 'Mail.ru',         smtpHost: 'smtp.mail.ru',           smtpPort: 465, imapHost: 'imap.mail.ru',           imapPort: 993, railwayWarn: true },
  { name: 'Rambler',         smtpHost: 'smtp.rambler.ru',        smtpPort: 465, imapHost: 'imap.rambler.ru',        imapPort: 993, railwayWarn: true },
];

const PROVIDERS: MailProvider[] = [...PROVIDERS_RELAY, ...PROVIDERS_STANDARD];

/** Maps known SMTP hosts → IMAP host. Falls back to smtp→imap prefix swap. */
const SMTP_TO_IMAP: Record<string, string> = {
  'smtp.yandex.com':      'imap.yandex.ru',
  'smtp.yandex.ru':       'imap.yandex.ru',
  'smtp.gmail.com':       'imap.gmail.com',
  'smtp.mail.ru':         'imap.mail.ru',
  'smtp.rambler.ru':      'imap.rambler.ru',
  'smtp.mail.yahoo.com':  'imap.mail.yahoo.com',
  'smtp.mail.me.com':     'imap.mail.me.com',
  'smtp-mail.outlook.com':'outlook.office365.com',
  'smtp.office365.com':   'outlook.office365.com',
  'smtp.live.com':        'outlook.office365.com',
  'smtp.hotmail.com':     'outlook.office365.com',
};

function guessImapHost(smtpHost: string): string {
  const h = smtpHost.trim().toLowerCase();
  if (SMTP_TO_IMAP[h]) return SMTP_TO_IMAP[h];
  // Generic fallback: replace leading "smtp." with "imap."
  if (h.startsWith('smtp.')) return 'imap.' + h.slice(5);
  return '';
}

const SMTP_HINTS_BASE: { match: string[]; name: string; hintKey: keyof T; url: string }[] = [
  { match: ['resend.com'],                   name: 'Resend',   hintKey: 'smtp_hint_resend',   url: 'https://resend.com/api-keys' },
  { match: ['sendgrid'],                     name: 'SendGrid', hintKey: 'smtp_hint_sendgrid', url: 'https://app.sendgrid.com/settings/api_keys' },
  { match: ['brevo'],                        name: 'Brevo',    hintKey: 'smtp_hint_brevo',    url: 'https://app.brevo.com/settings/keys/smtp' },
  { match: ['yandex'],                       name: 'Яндекс',   hintKey: 'smtp_hint_yandex',   url: 'https://id.yandex.ru/security/app-passwords' },
  { match: ['gmail', 'googlemail'],          name: 'Gmail',    hintKey: 'smtp_hint_gmail',    url: 'https://myaccount.google.com/apppasswords' },
  { match: ['mail.ru'],                      name: 'Mail.ru',  hintKey: 'smtp_hint_mailru',   url: 'https://account.mail.ru/user/2-step-auth/passwords/' },
  { match: ['yahoo'],                        name: 'Yahoo',    hintKey: 'smtp_hint_yahoo',    url: 'https://login.yahoo.com/account/security' },
  { match: ['outlook','hotmail','office365','live.com'], name: 'Outlook', hintKey: 'smtp_hint_outlook', url: 'https://support.microsoft.com/office/pop-imap-and-smtp-settings-8361e398-8af4-4e97-b147-6c6c4ac95353' },
  { match: ['rambler'],                      name: 'Rambler',  hintKey: 'smtp_hint_rambler',  url: 'https://help.rambler.ru/mail/1237/' },
  { match: ['icloud', 'me.com', 'mac.com'], name: 'iCloud',   hintKey: 'smtp_hint_icloud',   url: 'https://appleid.apple.com/account/manage' },
];

const emptyForm = (): CreateEmailAccountDto & { smtpPortStr: string; imapPortStr: string } => ({
  label: '',
  smtpHost: '',
  smtpPortStr: '465',
  smtpPort: 465,
  smtpUser: '',
  smtpPass: '',
  imapHost: '',
  imapPortStr: '993',
  imapPort: undefined,
});

function EmailAccountsManager() {
  const { t } = useLangStore();
  const { accounts, loaded, load, add, update, remove } = useEmailAccountsStore();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loaded) load();
  }, [loaded, load]);

  const smtpHintBase = SMTP_HINTS_BASE.find(p =>
    p.match.some(m => form.smtpHost.toLowerCase().includes(m)),
  );
  const smtpHint = smtpHintBase ? { ...smtpHintBase, hint: t[smtpHintBase.hintKey] as string } : null;

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm());
    setShowForm(true);
  };

  const openEdit = (account: EmailAccount) => {
    setEditingId(account.id);
    setForm({
      label: account.label,
      smtpHost: account.smtpHost,
      smtpPortStr: String(account.smtpPort),
      smtpPort: account.smtpPort,
      smtpUser: account.smtpUser,
      smtpPass: '',
      imapHost: account.imapHost || '',
      imapPortStr: account.imapPort ? String(account.imapPort) : '993',
      imapPort: account.imapPort ?? undefined,
    });
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm());
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const dto: CreateEmailAccountDto = {
        label: form.label,
        smtpHost: form.smtpHost,
        smtpPort: Number(form.smtpPortStr) || 465,
        smtpUser: form.smtpUser,
        smtpPass: form.smtpPass,
        imapHost: form.imapHost || undefined,
        imapPort: form.imapHost && form.imapPortStr ? Number(form.imapPortStr) || undefined : undefined,
      };

      if (editingId) {
        const updateDto: Partial<CreateEmailAccountDto> = { ...dto };
        if (!updateDto.smtpPass) delete updateDto.smtpPass;
        await update(editingId, updateDto);
        toast.success(t.account_updated);
      } else {
        await add(dto);
        toast.success(t.account_added);
      }
      cancelForm();
    } catch {
      toast.error(t.save_error_msg);
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (id: string) => {
    if (!window.confirm(t.delete_confirm_msg)) return;
    try {
      await remove(id);
      toast.success(t.account_deleted);
    } catch {
      toast.error(t.delete_error_msg);
    }
  };

  return (
    <div className="tg-body">
      {accounts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          {accounts.map(account => (
            <div key={account.id} className="tg-connected-info" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <div style={{ fontWeight: 600 }}>{account.label}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  <code>{account.smtpUser}</code> — {account.smtpHost}:{account.smtpPort}
                  {account.imapHost && (
                    <> &nbsp;·&nbsp; IMAP: {account.imapHost}:{account.imapPort ?? 993}</>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button className="btn btn-secondary" onClick={() => openEdit(account)}>{t.edit_btn}</button>
                <button className="btn btn-danger" onClick={() => handleRemove(account.id)}>{t.delete_btn}</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {accounts.length === 0 && !showForm && (
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 12 }}>{t.no_accounts}</p>
      )}

      {!showForm && (
        <button className="btn btn-primary" onClick={openAdd}>{t.add_account}</button>
      )}

      {showForm && (
        <div className="tg-connect-flow" style={{ marginTop: 12 }}>
          <div className="form-group">
            <label>{t.provider_select}</label>
            <select
              className="input"
              value={PROVIDERS.find(p => p.smtpHost === form.smtpHost)?.name ?? ''}
              onChange={e => {
                const p = PROVIDERS.find(pr => pr.name === e.target.value);
                if (!p) return;
                setForm(f => ({
                  ...f,
                  smtpHost: p.smtpHost,
                  smtpPortStr: String(p.smtpPort),
                  smtpPort: p.smtpPort,
                  imapHost: p.imapHost,
                  imapPortStr: p.imapPort ? String(p.imapPort) : '',
                  imapPort: p.imapPort || undefined,
                  label: f.label || p.name,
                }));
              }}
            >
              <option value="">{t.provider_custom}</option>
              <optgroup label={`⚡ ${t.smtp_relay_badge}`}>
                {PROVIDERS_RELAY.map(p => (
                  <option key={p.smtpHost} value={p.name}>{p.name}</option>
                ))}
              </optgroup>
              <optgroup label="— Standard —">
                {PROVIDERS_STANDARD.map(p => (
                  <option key={p.smtpHost} value={p.name}>{p.name}</option>
                ))}
              </optgroup>
            </select>
            {(() => {
              const sel = PROVIDERS.find(p => p.smtpHost === form.smtpHost);
              if (sel?.railwayOk) return (
                <div className="smtp-hint" style={{ marginTop: 6 }}>
                  <span className="smtp-hint-icon">⚡</span>
                  <span>{t.smtp_relay_badge}</span>
                </div>
              );
              if (sel?.railwayWarn) return (
                <div className="smtp-hint smtp-hint--generic" style={{ marginTop: 6 }}>
                  <span className="smtp-hint-icon">⚠️</span>
                  <span>{t.smtp_relay_warning}</span>
                </div>
              );
              return null;
            })()}
          </div>
          <div className="form-group">
            <label>{t.account_name}</label>
            <input
              className="input"
              placeholder={t.account_name_ph}
              value={form.label}
              onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label>{t.smtp_server}</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="input"
                style={{ flex: 1 }}
                placeholder="smtp.yandex.com"
                value={form.smtpHost}
                onChange={e => {
                  const smtpHost = e.target.value;
                  setForm(f => {
                    const autoImap = guessImapHost(f.imapHost || '') === f.imapHost || !f.imapHost;
                    return {
                      ...f,
                      smtpHost,
                      imapHost: autoImap ? guessImapHost(smtpHost) : f.imapHost,
                    };
                  });
                }}
              />
              <input
                className="input"
                style={{ width: 80 }}
                placeholder="465"
                value={form.smtpPortStr}
                onChange={e => setForm(f => ({ ...f, smtpPortStr: e.target.value }))}
              />
            </div>
          </div>
          <div className="form-group">
            <label>{t.smtp_login}</label>
            <input
              className="input"
              placeholder="user@yandex.ru"
              value={form.smtpUser}
              onChange={e => setForm(f => ({ ...f, smtpUser: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label>
              {t.smtp_password}{' '}
              {editingId && (
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{t.smtp_password_keep}</span>
              )}
            </label>
            <input
              className="input"
              type="password"
              placeholder="••••••••"
              value={form.smtpPass}
              onChange={e => setForm(f => ({ ...f, smtpPass: e.target.value }))}
            />
            {smtpHint ? (
              <div className="smtp-hint">
                <span className="smtp-hint-icon">🔑</span>
                <span>
                  {smtpHint.hint}{' '}
                  <a href={smtpHint.url} target="_blank" rel="noreferrer">
                    {t.create_app_password}
                  </a>
                </span>
              </div>
            ) : form.smtpHost ? (
              <div className="smtp-hint smtp-hint--generic">
                <span className="smtp-hint-icon">💡</span>
                <span>{t.app_password_hint}</span>
              </div>
            ) : null}
          </div>
          <div className="form-group">
            <label>
              {t.imap_server}{' '}
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{t.imap_trigger_hint}</span>
              {form.imapHost && form.imapHost === guessImapHost(form.smtpHost) && (
                <span style={{ fontSize: 11, color: 'var(--primary)', marginLeft: 6 }}>{t.imap_auto_filled}</span>
              )}
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="input"
                style={{ flex: 1 }}
                placeholder="imap.yandex.ru"
                value={form.imapHost}
                onChange={e => setForm(f => ({ ...f, imapHost: e.target.value }))}
              />
              <input
                className="input"
                style={{ width: 80 }}
                placeholder="993"
                value={form.imapPortStr}
                onChange={e => setForm(f => ({ ...f, imapPortStr: e.target.value }))}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving || !form.label || !form.smtpHost || !form.smtpUser || (!editingId && !form.smtpPass)}
            >
              {saving ? t.saving : editingId ? t.save_changes : t.add_btn}
            </button>
            <button className="btn btn-secondary" onClick={cancelForm}>{t.cancel}</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function SettingsPage() {
  const { t } = useLangStore();
  const { user, loadProfile } = useAuthStore();

  const [botInfo, setBotInfo] = useState<{ configured: boolean; botUsername: string | null } | null>(null);
  const [connectCode, setConnectCode] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    telegramApi.getBotInfo().then(({ data }) => setBotInfo(data));
    return () => stopPolling();
  }, []);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const handleConnect = async () => {
    try {
      const { data } = await telegramApi.connect();
      setConnectCode(data.code);
      setConnecting(true);

      // Poll for confirmation every 2 seconds
      pollRef.current = setInterval(async () => {
        try {
          const { data: status } = await telegramApi.getStatus();
          if (status.connected) {
            stopPolling();
            setConnecting(false);
            setConnectCode(null);
            await loadProfile();
            toast.success(t.tg_success);
          }
        } catch { /* ignore */ }
      }, 2000);

      // Stop polling after 10 minutes
      setTimeout(() => {
        if (connecting) {
          stopPolling();
          setConnecting(false);
          setConnectCode(null);
        }
      }, 10 * 60 * 1000);
    } catch {
      toast.error(t.tg_error);
    }
  };

  const handleDisconnect = async () => {
    try {
      await telegramApi.disconnect();
      await loadProfile();
      toast.success(t.tg_disconnect_success);
    } catch {
      toast.error(t.tg_error);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isConnected = !!user?.telegramChatId;
  const startCommand = `/start ${connectCode}`;

  return (
    <div className="settings-page">
      <h2>{t.settings}</h2>

      <div className="settings-section card">
        <div className="settings-section-header">
          <div className="settings-section-icon">✈️</div>
          <div>
            <h3>{t.tg_section}</h3>
            <p className="settings-desc">{t.tg_desc}</p>
          </div>
          <div className={`tg-status-badge ${isConnected ? 'badge-success' : 'badge-gray'}`}>
            {isConnected ? t.tg_connected : t.tg_not_connected}
          </div>
        </div>

        {!botInfo?.configured && (
          <div className="settings-warning">
            ⚠️ {t.tg_not_configured}
          </div>
        )}

        {botInfo?.configured && (
          <div className="tg-body">
            {isConnected ? (
              <div className="tg-connected-info">
                <div className="info-row">
                  <span>{t.tg_chat_id}</span>
                  <code>{user.telegramChatId}</code>
                </div>
                {botInfo.botUsername && (
                  <div className="info-row">
                    <span>Bot:</span>
                    <a
                      href={`https://t.me/${botInfo.botUsername}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      @{botInfo.botUsername}
                    </a>
                  </div>
                )}
                <button className="btn btn-danger" onClick={handleDisconnect}>
                  {t.tg_disconnect_btn}
                </button>
              </div>
            ) : connecting && connectCode ? (
              <div className="tg-connect-flow">
                <p className="tg-step">1. {t.tg_step2}</p>
                <div className="tg-code-row">
                  <code className="tg-code">{startCommand}</code>
                  <button
                    className="btn btn-secondary"
                    onClick={() => handleCopy(startCommand)}
                  >
                    {copied ? t.tg_copied : t.tg_copy}
                  </button>
                </div>
                {botInfo.botUsername && (
                  <a
                    className="btn btn-primary tg-open-btn"
                    href={`https://t.me/${botInfo.botUsername}?start=${connectCode}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t.open} @{botInfo.botUsername}
                  </a>
                )}
                <p className="tg-step tg-waiting">
                  <span className="tg-spinner" /> {t.tg_step3}
                </p>
                <button
                  className="btn btn-secondary"
                  onClick={() => { stopPolling(); setConnecting(false); setConnectCode(null); }}
                >
                  {t.cancel}
                </button>
              </div>
            ) : (
              <div className="tg-connect-flow">
                <p className="tg-step">{t.tg_step1}</p>
                <button className="btn btn-primary" onClick={handleConnect}>
                  {t.tg_connect_btn}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Email accounts section */}
      <div className="settings-section card">
        <div className="settings-section-header">
          <div className="settings-section-icon">✉️</div>
          <div>
            <h3>{t.email_accounts_title}</h3>
            <p className="settings-desc">{t.email_accounts_desc}</p>
          </div>
        </div>
        <EmailAccountsManager />
      </div>
    </div>
  );
}
