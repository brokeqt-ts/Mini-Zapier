import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/auth.store';
import { useLangStore } from '../store/language.store';
import './AuthPage.css';

export function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const register = useAuthStore((s) => s.register);
  const { t, toggle, lang } = useLangStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(email, password, name || undefined);
      navigate('/');
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response: { data: { message: string } } }).response?.data
              ?.message
          : t.register_error;
      toast.error(msg || t.register_error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div style={{ position: 'absolute', top: 16, right: 16 }}>
        <button className="btn btn-secondary" style={{ fontSize: '12px', padding: '4px 10px' }} onClick={toggle}>
          {lang === 'ru' ? 'EN' : 'RU'}
        </button>
      </div>
      <form className="auth-form card" onSubmit={handleSubmit}>
        <h2>{t.register_title}</h2>
        <div className="form-group">
          <label>{t.name}</label>
          <input
            className="input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>{t.email}</label>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label>{t.password}</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </div>
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? t.creating : t.register_btn}
        </button>
        <p className="auth-link">
          {t.have_account} <Link to="/login">{t.login_link}</Link>
        </p>
      </form>
    </div>
  );
}
