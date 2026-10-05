import {
  Trash2,
  Edit2,
  Send,
  Archive,
} from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthProvider';
import {
  archiveNotice,
  createNotice,
  deleteNotice,
  listNotices,
  publishNotice,
  updateNotice,
} from './repository';
import {
  noticeSchemas,
  noticePriorities,
  audienceTypes,
  type Notice,
} from './schema';
import { listAcademicRecords } from '../academic/repository';
import type { AcademicRecord } from '../academic/schema';

interface NoticeForm {
  campusId: string;
  title: string;
  body: string;
  audienceType: (typeof audienceTypes)[number];
  audienceIds: string[];
  priority: (typeof noticePriorities)[number];
}

const defaultForm: NoticeForm = {
  campusId: '',
  title: '',
  body: '',
  audienceType: 'campus',
  audienceIds: [],
  priority: 'normal',
};

export function NoticesPage() {
  const { user } = useAuth();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [campuses, setCampuses] = useState<AcademicRecord<'campuses'>[]>([]);
  const [form, setForm] = useState<NoticeForm>(defaultForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isAdmin = user?.role === 'admin';
  const isTeacher = user?.role === 'teacher';

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [campusList, teacherNotices, allNotices] = await Promise.all([
        listAcademicRecords('campuses'),
        isAdmin ? Promise.resolve([] as Notice[]) : listNotices(),
        listNotices(),
      ]);

      setCampuses(campusList);

      if (isTeacher || user.role === 'student' || user.role === 'parent') {
        setNotices(teacherNotices);
      } else {
        setNotices(allNotices);
      }
    } catch {
      setError('Could not load notices.');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, isTeacher, user]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    const validation = noticeSchemas.notices.safeParse({
      ...form,
      authorId: user.id,
      authorName: user.displayName,
      status: 'draft',
      publishedAt: null,
    });

    if (!validation.success) {
      setError(validation.error.issues[0]?.message ?? 'Please check the form fields.');
      setSaving(false);
      return;
    }

    try {
      if (editingId) {
        await updateNotice(editingId, validation.data);
        setSuccess('Notice updated successfully.');
      } else {
        await createNotice(validation.data);
        setSuccess('Notice created successfully.');
      }
      setForm(defaultForm);
      setEditingId(null);
      await loadData();
    } catch {
      setError('Could not save the notice.');
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish(id: string) {
    if (!user) return;
    try {
      await publishNotice(id);
      setSuccess('Notice published successfully.');
      await loadData();
    } catch {
      setError('Could not publish the notice.');
    }
  }

  async function handleArchive(id: string) {
    try {
      await archiveNotice(id);
      setSuccess('Notice archived.');
      await loadData();
    } catch {
      setError('Could not archive the notice.');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this notice?')) return;
    try {
      await deleteNotice(id);
      setSuccess('Notice deleted.');
      await loadData();
    } catch {
      setError('Could not delete the notice.');
    }
  }

  function handleEdit(notice: Notice) {
    setEditingId(notice.id);
    setForm({
      campusId: notice.campusId,
      title: notice.title,
      body: notice.body,
      audienceType: notice.audienceType,
      audienceIds: notice.audienceIds,
      priority: notice.priority,
    });
  }

  return (
    <section className="page-content">
      <div className="section-header">
        <div>
          <p className="eyebrow">COMMUNICATIONS</p>
          <h1>Notices</h1>
          <p className="page-lede">
            View and manage campus and class notices.
          </p>
        </div>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}
      {success && <p className="success-message">{success}</p>}

      {isAdmin && (
        <div className="card-panel" style={{ marginBottom: '2rem', padding: '1.5rem', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
          <h3>{editingId ? 'Edit Notice' : 'Create New Notice'}</h3>
          <form onSubmit={handleSave} style={{ display: 'grid', gap: '1rem', marginTop: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div>
                <label>Campus</label>
                <select
                  value={form.campusId}
                  onChange={(e) => setForm({ ...form, campusId: e.target.value })}
                  required
                >
                  <option value="">Select Campus</option>
                  {campuses.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label>Audience Type</label>
                <select
                  value={form.audienceType}
                  onChange={(e) => setForm({ ...form, audienceType: e.target.value as (typeof audienceTypes)[number] })}
                >
                  {audienceTypes.map((t) => (
                    <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label>Priority</label>
                <select
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value as (typeof noticePriorities)[number] })}
                >
                  {noticePriorities.map((p) => (
                    <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label>Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Notice title..."
                minLength={3}
                maxLength={160}
                required
              />
            </div>
            <div>
              <label>Content</label>
              <textarea
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                placeholder="Write the notice content..."
                rows={4}
                minLength={10}
                maxLength={2000}
                required
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="primary-button" type="submit" disabled={saving}>
                {editingId ? 'Update' : 'Save Draft'}
              </button>
              {editingId && (
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setForm(defaultForm);
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* Notices List */}
      <div className="table-responsive">
        {loading ? (
          <p>Loading notices...</p>
        ) : notices.length === 0 ? (
          <p>No notices available.</p>
        ) : (
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                <th style={{ padding: '0.75rem' }}>Priority</th>
                <th style={{ padding: '0.75rem' }}>Title</th>
                <th style={{ padding: '0.75rem' }}>Audience</th>
                <th style={{ padding: '0.75rem' }}>Date</th>
                {isAdmin && <th style={{ padding: '0.75rem' }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {notices.map((notice) => (
                <tr key={notice.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '0.75rem' }}>
                    <span style={{
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      backgroundColor: notice.priority === 'urgent' ? '#fee2e2' :
                                      notice.priority === 'important' ? '#fef3c7' : '#e0f2fe',
                      color: notice.priority === 'urgent' ? '#991b1b' :
                              notice.priority === 'important' ? '#92400e' : '#0369a1',
                    }}>
                      {notice.priority}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem', fontWeight: 600 }}>
                    {notice.title}
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    {notice.audienceType}
                    {notice.audienceIds.length > 0 && ` (${notice.audienceIds.length})`}
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    {notice.publishedAt
                      ? new Date(notice.publishedAt).toLocaleDateString()
                      : '-'}
                  </td>
                  {isAdmin && (
                    <td style={{ padding: '0.75rem' }}>
                      <button
                        className="icon-button"
                        onClick={() => handleEdit(notice)}
                        title="Edit"
                        style={{ marginRight: '0.5rem', background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        <Edit2 size={16} />
                      </button>
                      {notice.status !== 'published' && (
                        <button
                          className="icon-button"
                          onClick={() => handlePublish(notice.id)}
                          title="Publish"
                          style={{ marginRight: '0.5rem', background: 'none', border: 'none', cursor: 'pointer', color: 'green' }}
                        >
                          <Send size={16} />
                        </button>
                      )}
                      {notice.status !== 'archived' && (
                        <button
                          className="icon-button"
                          onClick={() => handleArchive(notice.id)}
                          title="Archive"
                          style={{ marginRight: '0.5rem', background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                          <Archive size={16} />
                        </button>
                      )}
                      <button
                        className="icon-button"
                        onClick={() => handleDelete(notice.id)}
                        title="Delete"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'red' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}