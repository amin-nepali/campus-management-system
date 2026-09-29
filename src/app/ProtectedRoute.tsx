import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthProvider';

export function ProtectedRoute() {
  const { authUser, loading, profileError, signOutUser, user } = useAuth();

  if (loading) {
    return (
      <main className="center-state" aria-label="Loading session">
        Loading session...
      </main>
    );
  }
  if (!authUser) {
    return <Navigate to="/login" replace />;
  }
  if (profileError || !user) {
    return (
      <main className="center-state">
        <div className="access-message">
          <p className="eyebrow">ACCOUNT ACCESS</p>
          <h1>We couldn't verify your campus profile.</h1>
          <p>{profileError ?? 'Contact your campus administrator for help.'}</p>
          <button
            className="secondary-button"
            onClick={() => void signOutUser()}
          >
            Sign out
          </button>
        </div>
      </main>
    );
  }
  return <Outlet />;
}
