import { BookOpen, LogOut } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { getNavigationForRole } from '../../app/navigation';
import { useAuth } from '../../features/auth/AuthProvider';

export function AppShell() {
  const { user, signOutUser } = useAuth();
  if (!user) {
    return null;
  }

  const navigation = getNavigationForRole(user.role);
  const initials = user.displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return (
    <div className="app-frame">
      <aside className="sidebar">
        <NavLink className="brand" to="/dashboard">
          <span className="brand-mark"><BookOpen size={19} strokeWidth={2.2} /></span>
          <span>Campus<span className="brand-sub">MANAGEMENT SYSTEM</span></span>
        </NavLink>
        <div className="nav-heading">WORKSPACE</div>
        <nav className="primary-nav" aria-label="Main navigation">
          {navigation.map((item, index) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/dashboard'}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              <span className="nav-index">{String(index + 1).padStart(2, '0')}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="profile-summary">
            <span className="avatar">{initials || 'U'}</span>
            <span className="profile-copy"><strong>{user.displayName}</strong><span>{user.role}</span></span>
          </div>
          <button className="logout-button" onClick={() => void signOutUser()}>
            <LogOut size={16} aria-hidden="true" /> Sign out
          </button>
        </div>
      </aside>
      <main className="main-panel">
        <header className="topbar">
          <span>Campus operations</span>
          <span className="topbar-user">{user.email}</span>
        </header>
        <div className="mobile-nav-wrap">
          <nav className="mobile-nav" aria-label="Main navigation">
            {navigation.map((item) => (
              <NavLink key={item.path} to={item.path} end={item.path === '/dashboard'}>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <Outlet />
      </main>
    </div>
  );
}