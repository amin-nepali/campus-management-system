import { z } from 'zod';
import {
  useEffect,
  useState,
  type FormEvent,
} from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  Save,
  Trash2,
  User as LucideUser,
  Settings,
  Edit,
  RefreshCw,
  Lock,
  Bell,
  Info,
} from 'lucide-react';

import { useAuth } from '../auth/AuthProvider';
import { type User } from '../../types/user';

interface SettingsFormValues {
  displayName: string;
  email: string;
  phone?: string;
  photoUrl?: string;
}

const settingsSchema = z.object({
  displayName: z.string().min(1, 'Display name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional().or(z.literal('')).transform((val) => val === '' ? undefined : val),
  photoUrl: z.string().url('Invalid URL').optional().or(z.literal('')).transform((val) => val === '' ? undefined : val),
});

function blankValues(): SettingsFormValues {
  return {
    displayName: '',
    email: '',
    phone: undefined,
    photoUrl: undefined,
  };
}

function inputValues(user: User | null): SettingsFormValues {
  if (!user) return blankValues();

  return {
    displayName: user.displayName,
    email: user.email,
    phone: user.phone ?? undefined,
    photoUrl: user.photoUrl ?? undefined,
  };
}

export function SettingsPage() {
  const { user, updateUserProfile } = useAuth();
  const navigate = useNavigate();
  const [values, setValues] = useState<SettingsFormValues>(() =>
    user ? inputValues(user) : blankValues()
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (user) {
      setValues(inputValues(user));
    }
  }, [user]);

  function resetForm() {
    if (user) {
      setValues(inputValues(user));
    } else {
      setValues(blankValues());
    }
    setFieldErrors({});
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setFieldErrors({});

    const payload = {
      displayName: values.displayName,
      email: values.email,
      phone: values.phone ?? undefined,
      photoUrl: values.photoUrl ?? undefined,
    };

    const validation = settingsSchema.safeParse(payload);
    if (!validation.success) {
      const errors = validation.error.flatten().fieldErrors;
      setFieldErrors(
        Object.fromEntries(
          Object.entries(errors).map(([key, messages]) => [
            key,
            messages?.[0] ?? 'Invalid value.',
          ])
        ),
      );
      setSaving(false);
      return;
    }

    try {
      await updateUserProfile(validation.data);
      setSaving(false);

      // Show success message temporarily
      const submitButton = document.querySelector('.academic-submit') as HTMLButtonElement | null;
      if (submitButton) {
        const originalText = submitButton.textContent;
        submitButton.textContent = 'Saved!';
        setTimeout(() => {
          if (submitButton) submitButton.textContent = originalText || 'Save changes';
        }, 1500);
      }
    } catch (caught) {
      setError(
        'Could not save your settings. Please try again.'
      );
      setSaving(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAccount() {
    if (!window.confirm(
      'Are you sure you want to delete your account? This action cannot be undone.'
    )) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Note: In a real app, you would call a delete account function
      // For now, we'll just show a message
      setLoading(false);
      alert('Account deletion would be implemented here. For now, please contact support.');
    } catch (err) {
      setError('Could not delete account. Please try again.');
      setLoading(false);
    }
  }

  if (!user) {
    return (
      <section className="page-content">
        <h1>Settings</h1>
        <p>Please sign in to continue.</p>
        <Link to="/login">Go to login</Link>
      </section>
    );
  }

  return (
    <section className="page-content settings-page">
      <p className="eyebrow">ACCOUNT SETTINGS</p>
      <h1>Settings</h1>
      <p className="page-lede">
        Manage your profile information and account preferences.
      </p>

      <div className="settings-grid">
        {/* Profile Information Card */}
        <div className="settings-card">
          <div className="settings-card-header">
            <LucideUser size={24} />
            <h2>Profile Information</h2>
          </div>
          <div className="settings-card-body">
            <form
              id="settings-form"
              className="academic-form"
              onSubmit={handleSubmit}
              noValidate
            >
              <div className="academic-form-heading">
                <div>
                  <h2>Edit Profile</h2>
                  <p>
                    Update your display name, email, and other profile details.
                  </p>
                </div>
                <button
                  className="icon-command"
                  type="button"
                  onClick={resetForm}
                  aria-label="Reset form"
                  title="Reset form"
                >
                  <Edit size={17} />
                </button>
              </div>
              <div className="academic-fields">
                <div className="academic-field">
                  <label htmlFor="settings-display-name">Display Name</label>
                  <input
                    id="settings-display-name"
                    type="text"
                    defaultValue={values.displayName}
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        displayName: event.target.value,
                      }))
                    }
                    required
                  />
                  {fieldErrors.displayName && (
                    <span className="field-error" role="alert">
                      {fieldErrors.displayName}
                    </span>
                  )}
                </div>

                <div className="academic-field">
                  <label htmlFor="settings-email">Email Address</label>
                  <input
                    id="settings-email"
                    type="email"
                    defaultValue={values.email}
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                    required
                  />
                  {fieldErrors.email && (
                    <span className="field-error" role="alert">
                      {fieldErrors.email}
                    </span>
                  )}
                </div>

                <div className="academic-field">
                  <label htmlFor="settings-phone">Phone Number (Optional)</label>
                  <input
                    id="settings-phone"
                    type="tel"
                    defaultValue={values.phone ?? ''}
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        phone: event.target.value || undefined,
                      }))
                    }
                  />
                </div>

                <div className="academic-field">
                  <label htmlFor="settings-photo-url">Profile Photo URL (Optional)</label>
                  <input
                    id="settings-photo-url"
                    type="text"
                    defaultValue={values.photoUrl ?? ''}
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        photoUrl: event.target.value || undefined,
                      }))
                    }
                    placeholder="https://example.com/photo.jpg"
                  />
                  {fieldErrors.photoUrl && (
                    <span className="field-error" role="alert">
                      {fieldErrors.photoUrl}
                    </span>
                  )}
                </div>
              </div>

              {error && (
                <p className="academic-error" role="alert">
                  {error}
                )
              )}

              <div className="academic-form-actions">
                <button
                  className="primary-button academic-submit"
                  type="submit"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Save size={16} className="spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      Save changes
                    </>
                  )}
                </button>
                <button className="text-command" type="button" onClick={resetForm}>
                  <RefreshCw size={15} /> Reset
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Account Actions Card */}
        <div className="settings-card">
          <div className="settings-card-header">
            <Settings size={24} />
            <h2>Account Actions</h2>
          </div>
          <div className="settings-card-body">
            <div className="settings-actions">
              <button
                className="settings-action-button"
                onClick={() => {
                  // In a real app, this would navigate to a password change page
                  alert('Password change functionality would be implemented here.');
                }}
              >
                <Lock size={20} />
                <span>Change Password</span>
              </button>

              <button
                className="settings-action-button"
                onClick={() => {
                  // Notification preferences would go here
                  alert('Notification preferences would be implemented here.');
                }}
              >
                <Bell size={20} />
                <span>Notification Preferences</span>
              </button>

              <button
                className="settings-action-button danger"
                onClick={handleDeleteAccount}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <RefreshCw size={20} className="spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 size={20} />
                    Delete Account
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* App Information Card */}
        <div className="settings-card">
          <div className="settings-card-header">
            <Info size={24} />
            <h2>About</h2>
          </div>
          <div className="settings-card-body">
            <div className="about-info">
              <p><strong>Campus Management System</strong></p>
              <p>Version 0.1.0</p>
              <p>
                A role-based campus operations platform for students, teachers,
                parents, and administrators.
              </p>
              <p className="muted">
                Built with React, TypeScript, Firebase, and Vite.
              </p>
              <Link to="https://github.com/yourusername/campus-management-system"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-command">
                View on GitHub
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}