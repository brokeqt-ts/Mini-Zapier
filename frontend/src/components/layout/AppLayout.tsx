import { useEffect } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import { useLangStore } from '../../store/language.store';
import './AppLayout.css';

export function AppLayout() {
  const { user, loadProfile, logout } = useAuthStore();
  const { t, toggle } = useLangStore();
  const navigate = useNavigate();

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1 className="logo">Mini-Zapier</h1>
        </div>
        <nav className="sidebar-nav">
          <Link to="/" className="nav-link">{t.nav_dashboard}</Link>
          <Link to="/settings" className="nav-link">{t.settings}</Link>
        </nav>
        <div className="sidebar-footer">
          <span className="user-email">{user?.email}</span>
          <button className="btn btn-secondary" style={{ fontSize: '12px', padding: '4px 10px' }} onClick={toggle}>
            {t.lang_toggle}
          </button>
          <button className="btn btn-secondary" onClick={handleLogout}>
            {t.logout}
          </button>
        </div>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
