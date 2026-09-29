import { CalendarDays, RefreshCw, Save } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import { useAuth } from '../auth/AuthProvider';
import { listTeacherAccess } from '../learning-materials/repository';
import type {
  StudentClassAccess,
  TeachingAccess,
} from '../learning-materials/schema';
import {
  appendAuditLog,
  createAttendanceSession,
  listAttendanceRoster,
  listAttendanceRecords,
  listAttendanceSessions,
  saveAttendanceRecord,
  updateAttendanceSession,
} from './repository';
import {
  attendanceSchemas,
  attendanceStatuses,
  type AttendanceRecord,
  type AttendanceSession,
  type AttendanceStatus,
} from './schema';

interface AttendanceFormState {
  scopeId: string;
  date: string;
  periodLabel: string;
}

const defaultForm = (): AttendanceFormState => ({
  scopeId: '',
  date: new Date().toISOString().slice(0, 10),
  periodLabel: 'Period 1',
});

export function AttendancePage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [teachingAccess, setTeachingAccess] = useState<TeachingAccess[]>([]);
  const [students, setStudents] = useState<StudentClassAccess[]>([]);
  const [form, setForm] = useState<AttendanceFormState>(defaultForm);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [records, setRecords] = useState<Record<string, AttendanceRecord>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isTeacher = user?.role === 'teacher';
  const isAdmin = user?.role === 'admin';

  const visibleSessions = useMemo(
    () =>
      sessions.filter((session) => isAdmin || session.teacherId === user?.id),
    [isAdmin, sessions, user],
  );

  const selectedSession = visibleSessions.find(
    (session) => session.id === selectedSessionId,
  );

  const selectedScope = teachingAccess.find(
    (scope) => scope.id === form.scopeId,
  );
  const sessionStudents = selectedSession
    ? students.filter(
        (student) =>
          student.academicYearId === selectedSession.academicYearId &&
          student.classId === selectedSession.classId &&
          student.sectionId === selectedSession.sectionId,
      )
    : [];

  const loadData = useCallback(async () => {
    if (!user) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const access = isTeacher ? await listTeacherAccess(user.id) : [];
      const [roster, sessionList] = await Promise.all([
        isTeacher ? listAttendanceRoster(access) : Promise.resolve([]),
        isTeacher || isAdmin
          ? listAttendanceSessions(isTeacher ? user.id : undefined)
          : Promise.resolve([]),
      ]);

      setTeachingAccess(access);
      setStudents(roster);
      setSessions(sessionList);

      const nextVisible = sessionList.filter(
        (session) => isAdmin || session.teacherId === user.id,
      );
      setSelectedSessionId((current) => {
        if (current && nextVisible.some((item) => item.id === current)) {
          return current;
        }
        return nextVisible[0]?.id ?? '';
      });
    } catch {
      setError(
        'Could not load attendance records. Check your connection and access permissions.',
      );
    } finally {
      setLoading(false);
    }
  }, [isAdmin, isTeacher, user]);

  useEffect(() => {
    if (user) {
      setForm(defaultForm());
      void loadData();
    }
  }, [loadData, user]);

  const loadSelectedSessionRecords = useCallback(async (sessionId: string) => {
    if (!sessionId) {
      setRecords({});
      return;
    }

    const sessionRecords = await listAttendanceRecords(sessionId);
    const index = Object.fromEntries(
      sessionRecords.map((record) => [record.studentId, record]),
    );
    setRecords(index);
  }, []);

  useEffect(() => {
    void loadSelectedSessionRecords(selectedSessionId);
  }, [loadSelectedSessionRecords, selectedSessionId]);

  async function handleCreateSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) {
      return;
    }

    setSaving(true);
    setError(null);

    const scope = teachingAccess.find((entry) => entry.id === form.scopeId);
    if (!scope) {
      setError('Select one of your assigned class and subject scopes.');
      setSaving(false);
      return;
    }

    const payload = {
      campusId: scope.campusId,
      academicYearId: scope.academicYearId,
      classId: scope.classId,
      sectionId: scope.sectionId,
      sectionName: scope.sectionName ?? scope.sectionId,
      subjectId: scope.subjectId,
      createdBy: user.id,
      teacherId: user.id,
      date: form.date,
      periodLabel: form.periodLabel,
      status: 'draft' as const,
    };

    const validation = attendanceSchemas.sessions.safeParse(payload);
    if (!validation.success) {
      setError(
        validation.error.issues[0]?.message ??
          'Please review the attendance form.',
      );
      setSaving(false);
      return;
    }

    try {
      const createdId = await createAttendanceSession(validation.data);
      await appendAuditLog({
        campusId: validation.data.campusId,
        actorUserId: user.id,
        action: 'create',
        entityType: 'attendanceSession',
        entityId: createdId,
        summary: `Created attendance session for ${validation.data.classId} / ${validation.data.sectionName}.`,
      });
      setSelectedSessionId(createdId);
      setForm(defaultForm());
      await loadData();
    } catch {
      setError(
        'Could not create the attendance session. Check the required class and subject links.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(
    studentId: string,
    status: AttendanceStatus,
  ) {
    if (!selectedSession || !user) {
      return;
    }

    const nextRecord = {
      sessionId: selectedSession.id,
      campusId: selectedSession.campusId,
      studentId,
      status,
      note: `Recorded by ${user.displayName}`,
      updatedBy: user.id,
      updatedAt: new Date().toISOString(),
    };

    const existing = records[studentId];
    const shouldAudit =
      selectedSession.status === 'submitted' &&
      existing &&
      existing.status !== status;

    try {
      await saveAttendanceRecord(selectedSession.id, studentId, {
        ...nextRecord,
      });

      if (shouldAudit) {
        await appendAuditLog({
          campusId: selectedSession.campusId,
          actorUserId: user.id,
          action: 'correction',
          entityType: 'attendanceRecord',
          entityId: selectedSession.id,
          summary: `Corrected attendance for student ${studentId} from ${existing.status} to ${status}.`,
        });
        await updateAttendanceSession(selectedSession.id, {
          status: 'corrected',
          correctedAt: new Date().toISOString(),
        });
      }

      await loadSelectedSessionRecords(selectedSession.id);
      await loadData();
    } catch {
      setError('Could not save the attendance status.');
    }
  }

  async function handleSubmitSession() {
    if (!selectedSession || !user) {
      return;
    }

    const nextStatus =
      selectedSession.status === 'draft' ? 'submitted' : 'corrected';

    try {
      await updateAttendanceSession(selectedSession.id, {
        status: nextStatus,
        submittedAt:
          nextStatus === 'submitted'
            ? new Date().toISOString()
            : selectedSession.submittedAt,
        submittedBy:
          nextStatus === 'submitted' ? user.id : selectedSession.submittedBy,
        correctedAt:
          nextStatus === 'corrected'
            ? new Date().toISOString()
            : selectedSession.correctedAt,
      });

      await appendAuditLog({
        campusId: selectedSession.campusId,
        actorUserId: user.id,
        action: nextStatus === 'submitted' ? 'submit' : 'correction',
        entityType: 'attendanceSession',
        entityId: selectedSession.id,
        summary: `Attendance session marked as ${nextStatus}.`,
      });

      await loadData();
    } catch {
      setError('Could not update the attendance session status.');
    }
  }

  if (!user) {
    return (
      <section className="page-content">
        <h1>Attendance</h1>
        <p>Please sign in to continue.</p>
      </section>
    );
  }

  if (!isTeacher && user.role !== 'student' && user.role !== 'parent') {
    return (
      <section className="page-content">
        <h1>Attendance</h1>
        <p>Access is restricted to classroom users.</p>
      </section>
    );
  }

  return (
    <section className="page-content">
      <p className="eyebrow">ATTENDANCE</p>
      <h1>Attendance</h1>
      <p className="page-lede">
        {user.role === 'teacher' || user.role === 'admin'
          ? 'Create sessions, mark attendance, and submit class rolls.'
          : 'View the attendance history for your permitted records.'}
      </p>

      {isTeacher ? (
        <>
          <form
            className="academic-form"
            onSubmit={handleCreateSession}
            noValidate
          >
            <div className="academic-form-heading">
              <div>
                <h2>Create attendance session</h2>
                <p>Daily roll is recorded for one class and subject.</p>
              </div>
            </div>
            <div className="academic-fields">
              <div className="academic-field">
                <label htmlFor="attendance-scope">
                  Assigned class and subject
                </label>
                <select
                  id="attendance-scope"
                  value={form.scopeId}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      scopeId: event.target.value,
                    }))
                  }
                  required
                >
                  <option value="">Select assigned scope</option>
                  {teachingAccess.map((scope) => (
                    <option value={scope.id} key={scope.id}>
                      {scope.classId} · {scope.sectionName ?? scope.sectionId} ·{' '}
                      {scope.subjectId}
                    </option>
                  ))}
                </select>
              </div>
              <div className="academic-field">
                <label htmlFor="attendance-date">Date</label>
                <input
                  id="attendance-date"
                  type="date"
                  value={form.date}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      date: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="academic-field">
                <label htmlFor="attendance-period">Period</label>
                <input
                  id="attendance-period"
                  value={form.periodLabel}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      periodLabel: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
            {error && (
              <p className="academic-error" role="alert">
                {error}
              </p>
            )}
            <div className="academic-form-actions">
              <button
                className="primary-button academic-submit"
                type="submit"
                disabled={saving || !selectedScope}
              >
                {saving ? (
                  <RefreshCw size={16} className="spin" />
                ) : (
                  <CalendarDays size={16} />
                )}
                {saving ? 'Saving...' : 'Create session'}
              </button>
            </div>
          </form>

          {teachingAccess.length === 0 && !loading && (
            <p className="academic-state">
              No active teaching assignments are linked to this account.
            </p>
          )}

          {visibleSessions.length > 0 && selectedSession && (
            <div
              className="academic-list-heading"
              style={{ marginTop: '2rem' }}
            >
              <div>
                <h2>Session roll</h2>
                <span>
                  {selectedSession.classId} · {selectedSession.sectionName}
                </span>
              </div>
              <button
                className="text-command"
                type="button"
                onClick={handleSubmitSession}
              >
                <Save size={15} />{' '}
                {selectedSession.status === 'submitted'
                  ? 'Mark corrected'
                  : 'Submit session'}
              </button>
            </div>
          )}

          {visibleSessions.length > 0 && (
            <div className="academic-list" style={{ marginTop: '1rem' }}>
              {visibleSessions.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  className="text-command"
                  onClick={() => setSelectedSessionId(session.id)}
                >
                  {session.date} · {session.classId} · {session.sectionName} ·{' '}
                  {session.status}
                </button>
              ))}
            </div>
          )}

          {selectedSession && (
            <div className="table-wrap" style={{ marginTop: '1.5rem' }}>
              <table>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sessionStudents.map((student) => {
                    const record = records[student.studentId];
                    const value = record?.status ?? 'present';
                    return (
                      <tr key={student.studentId}>
                        <td>{student.studentName || student.studentId}</td>
                        <td>
                          <select
                            value={value}
                            aria-label={`Attendance status for ${student.studentName || student.studentId}`}
                            onChange={(event) =>
                              void handleStatusChange(
                                student.studentId,
                                event.target.value as AttendanceStatus,
                              )
                            }
                          >
                            {attendanceStatuses.map((status) => (
                              <option value={status} key={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <div className="academic-list" style={{ marginTop: '1rem' }}>
          <div className="academic-form-heading">
            <div>
              <h2>Attendance history</h2>
              <p>Only records linked to your account are shown.</p>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Recorded</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={3}>
                    <span className="muted">
                      No attendance history is available for this account yet.
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {loading && <p className="page-lede">Loading attendance data...</p>}
    </section>
  );
}
