import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { telegramApi } from '../api/telegram.api';
import { useAuthStore } from '../store/auth.store';
import { useLangStore } from '../store/language.store';
import './SettingsPage.css';

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
                    Открыть @{botInfo.botUsername}
                  </a>
                )}
                <p className="tg-step tg-waiting">
                  <span className="tg-spinner" /> {t.tg_step3}
                </p>
                <button
                  className="btn btn-secondary"
                  onClick={() => { stopPolling(); setConnecting(false); setConnectCode(null); }}
                >
                  Отмена
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
    </div>
  );
}
