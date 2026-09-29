import { ArrowRight, BookOpen, ShieldCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { firebaseConfigError } from '../../lib/firebase';
import { useAuth } from './AuthProvider';

export function LoginPage() {
  const { authUser, loading, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <main className="center-state" aria-label="Loading session">
        Loading session...
      </main>
    );
  }
  if (authUser) {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
    } catch {
      setError(
        'Sign-in failed. Check your email and password, then try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-aside" aria-label="Campus Management System">
        <a className="brand brand-light" href="/login" aria-label="Campus home">
          <span className="brand-mark">
            <BookOpen size={20} strokeWidth={2.2} />
          </span>
          <span>
            Campus<span className="brand-sub">MANAGEMENT SYSTEM</span>
          </span>
        </a>
        <div className="login-message">
          <p className="eyebrow">CAMPUS OPERATIONS</p>
          <h1>Good work starts with a clear view.</h1>
          <p>One dependable place for your campus community to stay in step.</p>
        </div>
        <div className="aside-footer">
          <ShieldCheck size={16} /> Protected campus access
        </div>
      </section>

      <section className="login-panel">
        <div className="login-form-wrap">
          <p className="eyebrow">WELCOME BACK</p>
          <h2>Sign in to your account</h2>
          <p className="form-intro">
            Use the school account provided by your administrator.
          </p>
          <form onSubmit={handleSubmit}>
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            {(error || firebaseConfigError) && (
              <p className="form-error" role="alert">
                {error ?? firebaseConfigError}
              </p>
            )}
            <button
              className="primary-button"
              type="submit"
              disabled={submitting}
            >
              {submitting ? 'Signing in...' : 'Sign in'}
              {!submitting && <ArrowRight size={17} aria-hidden="true" />}
            </button>
          </form>
          <p className="login-note">
            Need access? Contact your campus administrator.
          </p>
        </div>
        <footer className="login-legal">
          Campus Management System <span>·</span> Secure sign-in
        </footer>
      </section>
    </main>
  );
}
