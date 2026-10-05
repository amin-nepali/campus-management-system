import {
  Clock,
  Trash2,
  Edit2,
} from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { listStudentAccess } from '../learning-materials/repository';
import {
  createRoutineEntry,
  deleteRoutineEntry,
  listRoutineEntries,
  updateRoutineEntry,
} from './repository';
import {
  routineSchemas,
  weekdays,
  type RoutineEntry,
} from './schema';
import { listAcademicRecords } from '../academic/repository';
import type { AcademicRecord } from '../academic/schema';

interface RoutineFormData {
  campusId: string;
  academicYearId: string;
  classId: string;
  sectionId: string;
  subjectId: string;
  teacherId: string;
  weekday: (typeof weekdays)[number];
  startsAt: string;
  endsAt: string;
  room: string;
  active: boolean;
}

const defaultForm = (): RoutineFormData => ({
  campusId: '',
  academicYearId: '',
  classId: '',
  sectionId: '',
  subjectId: '',
  teacherId: '',
  weekday: 'Monday',
  startsAt: '09:00',
  endsAt: '09:45',
  room: '',
  active: true,
});

export function RoutinePage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<RoutineEntry[]>([]);
  const [campuses, setCampuses] = useState<AcademicRecord<'campuses'>[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicRecord<'academicYears'>[]>([]);
  const [classes, setClasses] = useState<AcademicRecord<'classes'>[]>([]);
  const [sections, setSections] = useState<AcademicRecord<'sections'>[]>([]);
  const [subjects, setSubjects] = useState<AcademicRecord<'subjects'>[]>([]);
  const [teachers, setTeachers] = useState<AcademicRecord<'teachers'>[]>([]);

  const [form, setForm] = useState<RoutineFormData>(defaultForm);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [selectedDay, setSelectedDay] = useState<(typeof weekdays)[number]>('Monday');

    const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = user?.role === 'admin';
  const isTeacher = user?.role === 'teacher';
  const isStudent = user?.role === 'student';

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      if (isAdmin) {
        const [
          campusList,
          yearList,
          classList,
          sectionList,
          subjectList,
          teacherList,
          routineList,
        ] = await Promise.all([
          listAcademicRecords('campuses'),
          listAcademicRecords('academicYears'),
          listAcademicRecords('classes'),
          listAcademicRecords('sections'),
          listAcademicRecords('subjects'),
          listAcademicRecords('teachers'),
          listRoutineEntries(),
        ]);
        setCampuses(campusList);
        setAcademicYears(yearList);
        setClasses(classList);
        setSections(sectionList);
        setSubjects(subjectList);
        setTeachers(teacherList);
        setEntries(routineList);
      } else if (isTeacher) {
        const [subjectList, routineList] = await Promise.all([
          listAcademicRecords('subjects'),
          listRoutineEntries({ teacherId: user.id }),
        ]);
        setSubjects(subjectList);
        setEntries(routineList);
      } else if (isStudent) {
        const access = await listStudentAccess(user.id);
        const [subjectList, teacherList] = await Promise.all([
          listAcademicRecords('subjects'),
          listAcademicRecords('teachers'),
        ]);
        setSubjects(subjectList);
        setTeachers(teacherList);
        const studentEntries: RoutineEntry[] = [];
        await Promise.all(
          access.map(async (acc) => {
            const list = await listRoutineEntries({
              academicYearId: acc.academicYearId,
              classId: acc.classId,
              sectionId: acc.sectionId,
            });
            studentEntries.push(...list);
          }),
        );
        setEntries(studentEntries);
      }
    } catch {
      setError('Could not load routine entries.');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, isStudent, isTeacher, user]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !isAdmin) return;

    setSaving(true);
    setError(null);

    const validation = routineSchemas.routineEntries.safeParse(form);
    if (!validation.success) {
      setError(
        validation.error.issues[0]?.message ?? 'Please check the form fields.',
      );
      setSaving(false);
      return;
    }

    try {
      if (editingId) {
        await updateRoutineEntry(editingId, validation.data);
      } else {
        await createRoutineEntry(validation.data);
      }
      setForm(defaultForm());
      setEditingId(null);
      await loadData();
    } catch {
      setError('Could not save the routine entry.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this routine entry?')) return;
    try {
      await deleteRoutineEntry(id);
      await loadData();
    } catch {
      setError('Could not delete the routine entry.');
    }
  }

  function handleEdit(entry: RoutineEntry) {
    setEditingId(entry.id);
    setForm({
      campusId: entry.campusId,
      academicYearId: entry.academicYearId,
      classId: entry.classId,
      sectionId: entry.sectionId,
      subjectId: entry.subjectId,
      teacherId: entry.teacherId,
      weekday: entry.weekday,
      startsAt: entry.startsAt,
      endsAt: entry.endsAt,
      room: entry.room,
      active: entry.active,
    });
  }

  const filteredEntries = entries.filter((entry) => {
    if (entry.weekday !== selectedDay) return false;
    return true;
  }).sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  const getSubjectName = (id: string) =>
    subjects.find((s) => s.id === id)?.name ?? id;
  const getTeacherName = (id: string) =>
    teachers.find((t) => t.userId === id || t.id === id)?.fullName ?? id;
  const getClassName = (id: string) =>
    classes.find((c) => c.id === id)?.name ?? id;
  const getSectionName = (id: string) =>
    sections.find((s) => s.id === id)?.name ?? id;

  return (
    <section className="page-content">
      <div className="section-header">
        <div>
          <p className="eyebrow">TIMETABLE</p>
          <h1>Class Routine</h1>
          <p className="page-lede">
            View and manage class schedules and weekly routines.
          </p>
        </div>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}

      {/* Weekday Selector */}
      <div className="tab-strip" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
        {weekdays.map((day) => (
          <button
            key={day}
            className={`tab-item ${selectedDay === day ? 'active' : ''}`}
            onClick={() => setSelectedDay(day)}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              border: '1px solid var(--border-color, #e2e8f0)',
              backgroundColor: selectedDay === day ? 'var(--primary, #3b82f6)' : 'transparent',
              color: selectedDay === day ? '#fff' : 'inherit',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            {day}
          </button>
        ))}
      </div>

      {isAdmin && (
        <div className="card-panel" style={{ marginBottom: '2rem', padding: '1.5rem', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
          <h3>{editingId ? 'Edit Routine Entry' : 'Add New Routine Entry'}</h3>
          <form onSubmit={handleSave} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
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
              <label>Academic Year</label>
              <select
                value={form.academicYearId}
                onChange={(e) => setForm({ ...form, academicYearId: e.target.value })}
                required
              >
                <option value="">Select Year</option>
                {academicYears.map((y) => (
                  <option key={y.id} value={y.id}>{y.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label>Class</label>
              <select
                value={form.classId}
                onChange={(e) => setForm({ ...form, classId: e.target.value })}
                required
              >
                <option value="">Select Class</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label>Section</label>
              <select
                value={form.sectionId}
                onChange={(e) => setForm({ ...form, sectionId: e.target.value })}
                required
              >
                <option value="">Select Section</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label>Subject</label>
              <select
                value={form.subjectId}
                onChange={(e) => setForm({ ...form, subjectId: e.target.value })}
                required
              >
                <option value="">Select Subject</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                ))}
              </select>
            </div>

            <div>
              <label>Teacher</label>
              <select
                value={form.teacherId}
                onChange={(e) => setForm({ ...form, teacherId: e.target.value })}
                required
              >
                <option value="">Select Teacher</option>
                {teachers.map((t) => (
                  <option key={t.userId} value={t.userId}>{t.fullName}</option>
                ))}
              </select>
            </div>

            <div>
              <label>Day of Week</label>
              <select
                value={form.weekday}
                onChange={(e) => setForm({ ...form, weekday: e.target.value as (typeof weekdays)[number] })}
                required
              >
                {weekdays.map((w) => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
            </div>

            <div>
              <label>Start Time</label>
              <input
                type="time"
                value={form.startsAt}
                onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                required
              />
            </div>

            <div>
              <label>End Time</label>
              <input
                type="time"
                value={form.endsAt}
                onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                required
              />
            </div>

            <div>
              <label>Room</label>
              <input
                type="text"
                value={form.room}
                placeholder="e.g. Room 101"
                onChange={(e) => setForm({ ...form, room: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
              <button className="primary-button" type="submit" disabled={saving}>
                {editingId ? 'Update' : 'Save'}
              </button>
              {editingId && (
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setForm(defaultForm());
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* Routine Timetable Grid */}
      <div className="table-responsive">
        {loading ? (
          <p>Loading routine...</p>
        ) : filteredEntries.length === 0 ? (
          <p>No classes scheduled for {selectedDay}.</p>
        ) : (
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                <th style={{ padding: '0.75rem' }}>Time</th>
                <th style={{ padding: '0.75rem' }}>Subject</th>
                <th style={{ padding: '0.75rem' }}>Class & Section</th>
                <th style={{ padding: '0.75rem' }}>Teacher</th>
                <th style={{ padding: '0.75rem' }}>Room</th>
                {isAdmin && <th style={{ padding: '0.75rem' }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((entry) => (
                <tr key={entry.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '0.75rem', fontWeight: 500 }}>
                    <Clock size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                    {entry.startsAt} - {entry.endsAt}
                  </td>
                  <td style={{ padding: '0.75rem', fontWeight: 600 }}>
                    {getSubjectName(entry.subjectId)}
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    {getClassName(entry.classId)} ({getSectionName(entry.sectionId)})
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    {getTeacherName(entry.teacherId)}
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    {entry.room || '-'}
                  </td>
                  {isAdmin && (
                    <td style={{ padding: '0.75rem' }}>
                      <button
                        className="icon-button"
                        onClick={() => handleEdit(entry)}
                        title="Edit"
                        style={{ marginRight: '0.5rem', background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        className="icon-button"
                        onClick={() => handleDelete(entry.id)}
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