import { useParams } from 'react-router-dom';
import { getNavigationForRole } from './navigation';
import { useAuth } from '../features/auth/AuthProvider';

export function DashboardPage() {
  const { user } = useAuth();

  return (
    <section className="page-content">
      <p className="eyebrow">YOUR CAMPUS</p>
      <h1>Welcome, {user?.displayName.split(' ')[0]}.</h1>
      <p className="page-lede">Your campus workspace is ready. Role-specific tools will appear here as they are added.</p>
      <div className="workspace-strip">
        <span className="workspace-dot" />
        <span>Signed in as <strong>{user?.role}</strong></span>
        <span className="strip-divider" />
        <span>{user?.campusIds.length ?? 0} campus memberships</span>
      </div>
    </section>
  );
}

export function PlaceholderPage() {
  const { section } = useParams();
  const { user } = useAuth();
  const item = user && getNavigationForRole(user.role).find((entry) => entry.path === `/${section}`);

  if (!item) {
    return <section className="page-content"><h1>Page not found</h1></section>;
  }

  return (
    <section className="page-content">
      <p className="eyebrow">CAMPUS WORKSPACE</p>
      <h1>{item.label}</h1>
      <p className="page-lede">This section is reserved for a future project phase.</p>
      <div className="placeholder-line"><span />Foundation placeholder</div>
    </section>
  );
}