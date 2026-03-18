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
  type: 'resend' | 'imap';
  smtpHost: string;
  smtpPort: number;
  imapHost: string;
  imapPort: number;
}

const PROVIDERS: MailProvider[] = [
  { name: 'Resend',              type: 'resend', smtpHost: 'smtp.resend.com', smtpPort: 465, imapHost: '',                     imapPort: 0   },
  { name: 'Gmail',               type: 'imap',   smtpHost: '',               smtpPort: 0,   imapHost: 'imap.gmail.com',        imapPort: 993 },
  { name: 'Outlook / Hotmail',   type: 'imap',   smtpHost: '',               smtpPort: 0,   imapHost: 'outlook.office365.com', imapPort: 993 },
  { name: 'Яндекс',              type: 'imap',   smtpHost: '',               smtpPort: 0,   imapHost: 'imap.yandex.ru',        imapPort: 993 },
  { name: 'Mail.ru',             type: 'imap',   smtpHost: '',               smtpPort: 0,   imapHost: 'imap.mail.ru',          imapPort: 993 },
  { name: 'Rambler',             type: 'imap',   smtpHost: '',               smtpPort: 0,   imapHost: 'imap.rambler.ru',       imapPort: 993 },
];

const IMAP_HINTS: Record<string, { hintKey: keyof T; url: string }> = {
  'Яндекс':            { hintKey: 'smtp_hint_yandex',  url: 'https://id.yandex.ru/security/app-passwords' },
  'Gmail':             { hintKey: 'smtp_hint_gmail',    url: 'https://myaccount.google.com/apppasswords' },
  'Mail.ru':           { hintKey: 'smtp_hint_mailru',   url: 'https://account.mail.ru/user/2-step-auth/passwords/' },
  'Rambler':           { hintKey: 'smtp_hint_rambler',  url: 'https://help.rambler.ru/mail/1237/' },
  'Outlook / Hotmail': { hintKey: 'smtp_hint_outlook',  url: 'https://support.microsoft.com/office/pop-imap-and-smtp-settings-8361e398-8af4-4e97-b147-6c6c4ac95353' },
};

const emptyForm = (): CreateEmailAccountDto & { smtpPortStr: string; imapPortStr: string; selectedProviderName: string } => ({
  label: '',
  selectedProviderName: '',
  smtpHost: '',
  smtpPortStr: '0',
  smtpPort: 0,
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

  const selectedProvider = PROVIDERS.find(p => p.name === form.selectedProviderName) ?? null;
  const providerType: 'resend' | 'imap' | null =
    selectedProvider?.type ??
    (form.smtpHost === 'smtp.resend.com' ? 'resend' : form.imapHost && !form.smtpHost ? 'imap' : null);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm());
    setShowForm(true);
  };

  const openEdit = (account: EmailAccount) => {
    setEditingId(account.id);
    let selectedProviderName = '';
    if (account.smtpHost === 'smtp.resend.com') {
      selectedProviderName = 'Resend';
    } else if (!account.smtpHost && account.imapHost) {
      selectedProviderName = PROVIDERS.find(p => p.imapHost === account.imapHost)?.name ?? '';
    }
    setForm({
      label: account.label,
      selectedProviderName,
      smtpHost: account.smtpHost,
      smtpPortStr: String(account.smtpPort ?? 0),
      smtpPort: account.smtpPort ?? 0,
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
      let dto: CreateEmailAccountDto;
      if (providerType === 'resend') {
        dto = {
          label: form.label,
          smtpHost: 'smtp.resend.com',
          smtpPort: 465,
          smtpUser: form.smtpUser,
          smtpPass: form.smtpPass,
          imapHost: undefined,
          imapPort: undefined,
        };
      } else if (providerType === 'imap' && selectedProvider) {
        dto = {
          label: form.label,
          smtpHost: '',
          smtpPort: 0,
          smtpUser: form.smtpUser,
          smtpPass: form.smtpPass,
          imapHost: selectedProvider.imapHost,
          imapPort: selectedProvider.imapPort,
        };
      } else {
        // legacy custom / no provider selected
        dto = {
          label: form.label,
          smtpHost: form.smtpHost,
          smtpPort: Number(form.smtpPortStr) || 0,
          smtpUser: form.smtpUser,
          smtpPass: form.smtpPass,
          imapHost: form.imapHost || undefined,
          imapPort: form.imapHost && form.imapPortStr ? Number(form.imapPortStr) || undefined : undefined,
        };
      }

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

  const imapHint = form.selectedProviderName ? IMAP_HINTS[form.selectedProviderName] ?? null : null;

  const isSaveDisabled = saving || !form.label || !form.smtpUser || (!editingId && !form.smtpPass);

  return (
    <div className="tg-body">
      {accounts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          {accounts.map(account => {
            const isResend = account.smtpHost === 'smtp.resend.com';
            const isImap = !account.smtpHost && !!account.imapHost;
            return (
              <div key={account.id} className="tg-connected-info" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{account.label}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    {isResend ? (
                      <><code>{account.smtpUser}</code> · Resend API</>
                    ) : isImap ? (
                      <><code>{account.smtpUser}</code> · IMAP: {account.imapHost}:{account.imapPort ?? 993}</>
                    ) : (
                      <><code>{account.smtpUser}</code> · {account.smtpHost}:{account.smtpPort}</>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button className="btn btn-secondary" onClick={() => openEdit(account)}>{t.edit_btn}</button>
                  <button className="btn btn-danger" onClick={() => handleRemove(account.id)}>{t.delete_btn}</button>
                </div>
              </div>
            );
          })}
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
          {/* Provider selector */}
          <div className="form-group">
            <label>{t.provider_select}</label>
            <select
              className="input"
              value={form.selectedProviderName}
              onChange={e => {
                const p = PROVIDERS.find(pr => pr.name === e.target.value);
                if (!p) {
                  setForm(f => ({ ...f, selectedProviderName: '' }));
                  return;
                }
                setForm(f => ({
                  ...f,
                  selectedProviderName: p.name,
                  smtpHost: p.smtpHost,
                  smtpPort: p.smtpPort,
                  smtpPortStr: String(p.smtpPort),
                  imapHost: p.imapHost,
                  imapPort: p.imapPort || undefined,
                  imapPortStr: p.imapPort ? String(p.imapPort) : '993',
                  label: f.label || p.name,
                }));
              }}
            >
              <option value="">{t.provider_custom}</option>
              {PROVIDERS.map(p => (
                <option key={p.name} value={p.name}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Account label */}
          <div className="form-group">
            <label>{t.account_name}</label>
            <input
              className="input"
              placeholder={t.account_name_ph}
              value={form.label}
              onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
            />
          </div>

          {/* ── Resend form ── */}
          {providerType === 'resend' && (
            <>
              <div className="form-group">
                <label>{t.resend_from_label}</label>
                <input
                  className="input"
                  placeholder={t.resend_from_ph}
                  value={form.smtpUser}
                  onChange={e => setForm(f => ({ ...f, smtpUser: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>
                  {t.resend_api_key_label}{' '}
                  {editingId && (
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{t.smtp_password_keep}</span>
                  )}
                </label>
                <input
                  className="input"
                  type="password"
                  placeholder={t.resend_api_key_ph}
                  value={form.smtpPass}
                  onChange={e => setForm(f => ({ ...f, smtpPass: e.target.value }))}
                />
                <div className="smtp-hint">
                  <span className="smtp-hint-icon">🔑</span>
                  <span>
                    {t.resend_api_hint}{' '}
                    <a href="https://resend.com/api-keys" target="_blank" rel="noreferrer">
                      resend.com/api-keys
                    </a>
                  </span>
                </div>
              </div>
            </>
          )}

          {/* ── IMAP provider form ── */}
          {providerType === 'imap' && (
            <>
              <div className="form-group">
                <label>{t.smtp_login}</label>
                <input
                  className="input"
                  placeholder="user@gmail.com"
                  value={form.smtpUser}
                  onChange={e => setForm(f => ({ ...f, smtpUser: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>
                  {t.imap_password_label}{' '}
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
                {imapHint ? (
                  <div className="smtp-hint">
                    <span className="smtp-hint-icon">🔑</span>
                    <span>
                      {t[imapHint.hintKey] as string}{' '}
                      <a href={imapHint.url} target="_blank" rel="noreferrer">
                        {t.create_app_password}
                      </a>
                    </span>
                  </div>
                ) : (
                  <div className="smtp-hint smtp-hint--generic">
                    <span className="smtp-hint-icon">💡</span>
                    <span>{t.app_password_hint}</span>
                  </div>
                )}
              </div>
              {selectedProvider && (
                <div className="smtp-hint smtp-hint--generic" style={{ marginTop: 0 }}>
                  <span className="smtp-hint-icon">✓</span>
                  <span>{t.imap_auto_configured}: {selectedProvider.imapHost}:{selectedProvider.imapPort}</span>
                </div>
              )}
            </>
          )}

          {/* ── Custom / legacy form ── */}
          {providerType === null && (
            <>
              <div className="form-group">
                <label>{t.smtp_login}</label>
                <input
                  className="input"
                  placeholder="user@example.com"
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
              </div>
              <div className="form-group">
                <label>{t.smtp_server}</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    className="input"
                    style={{ flex: 1 }}
                    placeholder="smtp.example.com"
                    value={form.smtpHost}
                    onChange={e => setForm(f => ({ ...f, smtpHost: e.target.value }))}
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
                <label>
                  {t.imap_server}{' '}
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{t.imap_trigger_hint}</span>
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    className="input"
                    style={{ flex: 1 }}
                    placeholder="imap.example.com"
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
            </>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={isSaveDisabled}
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
