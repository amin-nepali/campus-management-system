import {
  BarChart3,
  Filter,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { listAttendanceSessions } from '../attendance/repository';
import { listAttendanceRoster } from '../attendance/repository';
import { listAttendanceRecords } from '../attendance/repository';
import type {
  AttendanceRecord,
  AttendanceSession,
} from '../attendance/schema';
import { listTeacherAccess } from '../learning-materials/repository';
import type { TeachingAccess } from '../learning-materials/schema';
import { listStudentAccess } from '../learning-materials/repository';
import type { StudentClassAccess } from '../learning-materials/schema';
import { listAcademicRecords } from '../academic/repository';
import type { AcademicRecord } from '../academic/schema';

interface AttendanceStats {
  totalSessions: number;
  totalStudents: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  excusedCount: number;
  overallPercentage: number;
}

interface StudentStats {
  studentId: string;
  studentName: string;
  totalDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  excusedDays: number;
  percentage: number;
}

export function AttendanceReportsPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [accessScopes, setAccessScopes] = useState<(TeachingAccess | StudentClassAccess)[]>([]);
  const [recordsBySession, setRecordsBySession] = useState<Record<string, Record<string, AttendanceRecord>>>({});
  const [students, setStudents] = useState<StudentClassAccess[]>([]);
  const [classes, setClasses] = useState<AcademicRecord<'classes'>[]>([]);
  const [teachers, setTeachers] = useState<AcademicRecord<'teachers'>[]>([]);

  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedTeacher, setSelectedTeacher] = useState<string>('');
  const [selectedDateFrom, setSelectedDateFrom] = useState<string>('');
  const [selectedDateTo, setSelectedDateTo] = useState<string>('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = user?.role === 'admin';
  const isTeacher = user?.role === 'teacher';
  const isStudent = user?.role === 'student';

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      const [classList, teacherList] = await Promise.all([
        listAcademicRecords('classes'),
        listAcademicRecords('teachers'),
      ]);

      setClasses(classList);
      setTeachers(teacherList);

      let access: (TeachingAccess | StudentClassAccess)[] = [];
      if (isTeacher) {
        access = await listTeacherAccess(user.id);
      } else if (isStudent) {
        access = await listStudentAccess(user.id);
      } else if (isAdmin) {
        // Admin sees all
        const allTeacherAccesses = await listTeacherAccess('');
        access = [...allTeacherAccesses];
      }
      setAccessScopes(access);

      const sessionList = await listAttendanceSessions(isTeacher ? user.id : undefined);
      setSessions(sessionList);

      // Load students for selected class
      if (selectedClass && access.length > 0) {
        const studentList = await listAttendanceRoster(access as any);
        setStudents(studentList);
      }

      // Load records for each session
      const recordsMap: Record<string, Record<string, AttendanceRecord>> = {};
      for (const session of sessionList) {
        const records = await listAttendanceRecords(session.id);
        recordsMap[session.id] = Object.fromEntries(
          records.map((r) => [r.studentId, r])
        );
      }
      setRecordsBySession(recordsMap);
    } catch {
      setError('Could not load attendance reports.');
    } finally {
      setLoading(false);
    }
  }, [isStudent, isTeacher, isAdmin, user, selectedClass]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const getFilteredSessions = () => {
    return sessions.filter((session) => {
      if (selectedClass && !accessScopes.some(s => s.classId === selectedClass)) return false;
      if (selectedDateFrom && session.date < selectedDateFrom) return false;
      if (selectedDateTo && session.date > selectedDateTo) return false;
      return true;
    });
  };

  const calculateStats = (): AttendanceStats => {
    const filteredSessions = getFilteredSessions();
    let presentCount = 0;
    let absentCount = 0;
    let lateCount = 0;
    let excusedCount = 0;

    for (const session of filteredSessions) {
      const records = recordsBySession[session.id] || {};
      for (const record of Object.values(records)) {
        switch (record.status) {
          case 'present': presentCount++; break;
          case 'absent': absentCount++; break;
          case 'late': lateCount++; break;
          case 'excused': excusedCount++; break;
        }
      }
    }

    const totalCount = presentCount + absentCount + lateCount + excusedCount;
    const attendancePercentage = totalCount > 0
      ? ((presentCount + lateCount) / totalCount) * 100
      : 0;

    return {
      totalSessions: filteredSessions.length,
      totalStudents: students.length || new Set(Object.keys(recordsBySession[filteredSessions[0]?.id ?? ''] || {})).size,
      presentCount,
      absentCount,
      lateCount,
      excusedCount,
      overallPercentage: attendancePercentage,
    };
  };

  const calculateStudentStats = (): StudentStats[] => {
    const filteredSessions = getFilteredSessions();
    const stats: StudentStats[] = [];

    for (const student of students) {
      let presentDays = 0;
      let absentDays = 0;
      let lateDays = 0;
      let excusedDays = 0;

      for (const session of filteredSessions) {
        const record = recordsBySession[session.id]?.[student.studentId];
        if (!record) continue;

        switch (record.status) {
          case 'present': presentDays++; break;
          case 'absent': absentDays++; break;
          case 'late': lateDays++; break;
          case 'excused': excusedDays++; break;
        }
      }

      const totalDays = presentDays + absentDays + lateDays + excusedDays;
      const percentage = totalDays > 0
        ? ((presentDays + lateDays) / totalDays) * 100
        : 0;

      stats.push({
        studentId: student.studentId,
        studentName: student.studentName || student.studentId,
        totalDays,
        presentDays,
        absentDays,
        lateDays,
        excusedDays,
        percentage,
      });
    }

    return stats;
  };

  const stats = calculateStats();
  const studentStats = calculateStudentStats();

  const getClassName = (id: string) => classes.find(c => c.id === id)?.name ?? id;

  return (
    <section className="page-content">
      <div className="section-header">
        <div>
          <p className="eyebrow">ANALYTICS</p>
          <h1>Attendance Reports</h1>
          <p className="page-lede">
            View attendance statistics and summaries.
          </p>
        </div>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}

      {/* Filters */}
      <div className="card-panel" style={{ marginBottom: '2rem', padding: '1.5rem', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Filter size={18} /> Filter Reports
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
          <div>
            <label>Class</label>
            <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
              <option value="">All Classes</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label>Teacher</label>
            <select value={selectedTeacher} onChange={(e) => setSelectedTeacher(e.target.value)}>
              <option value="">All Teachers</option>
              {teachers.map(t => (
                <option key={t.userId} value={t.userId}>{t.fullName}</option>
              ))}
            </select>
          </div>
          <div>
            <label>From Date</label>
            <input
              type="date"
              value={selectedDateFrom}
              onChange={(e) => setSelectedDateFrom(e.target.value)}
            />
          </div>
          <div>
            <label>To Date</label>
            <input
              type="date"
              value={selectedDateTo}
              onChange={(e) => setSelectedDateTo(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div className="card-panel" style={{ textAlign: 'center', padding: '1.5rem' }}>
          <p style={{ color: 'var(--muted-fg, #64748b)', margin: 0 }}>Total Sessions</p>
          <p style={{ fontSize: '2rem', fontWeight: 700, margin: '0.5rem 0', color: 'var(--primary, #3b82f6)' }}>{stats.totalSessions}</p>
        </div>
        <div className="card-panel" style={{ textAlign: 'center', padding: '1.5rem' }}>
          <p style={{ color: 'var(--muted-fg, #64748b)', margin: 0 }}>Overall Attendance</p>
          <p style={{ fontSize: '2rem', fontWeight: 700, margin: '0.5rem 0', color: 'green' }}>{stats.overallPercentage.toFixed(1)}%</p>
        </div>
        <div className="card-panel" style={{ textAlign: 'center', padding: '1.5rem' }}>
          <p style={{ color: 'var(--muted-fg, #64748b)', margin: 0 }}>Present</p>
          <p style={{ fontSize: '2rem', fontWeight: 700, margin: '0.5rem 0', color: 'green' }}>{stats.presentCount}</p>
        </div>
        <div className="card-panel" style={{ textAlign: 'center', padding: '1.5rem' }}>
          <p style={{ color: 'var(--muted-fg, #64748b)', margin: 0 }}>Absent</p>
          <p style={{ fontSize: '2rem', fontWeight: 700, margin: '0.5rem 0', color: 'red' }}>{stats.absentCount}</p>
        </div>
        <div className="card-panel" style={{ textAlign: 'center', padding: '1.5rem' }}>
          <p style={{ color: 'var(--muted-fg, #64748b)', margin: 0 }}>Late</p>
          <p style={{ fontSize: '2rem', fontWeight: 700, margin: '0.5rem 0', color: 'orange' }}>{stats.lateCount}</p>
        </div>
        <div className="card-panel" style={{ textAlign: 'center', padding: '1.5rem' }}>
          <p style={{ color: 'var(--muted-fg, #64748b)', margin: 0 }}>Excused</p>
          <p style={{ fontSize: '2rem', fontWeight: 700, margin: '0.5rem 0', color: '#8b5cf6' }}>{stats.excusedCount}</p>
        </div>
      </div>

      {/* Student Attendance Table */}
      <div className="table-responsive">
        <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <BarChart3 size={18} /> Student Attendance Summary
        </h3>
        {loading ? (
          <p>Loading...</p>
        ) : studentStats.length === 0 ? (
          <p>No attendance data available for the selected filters.</p>
        ) : (
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                <th style={{ padding: '0.75rem' }}>Student</th>
                <th style={{ padding: '0.75rem' }}>Total Days</th>
                <th style={{ padding: '0.75rem' }}>Present</th>
                <th style={{ padding: '0.75rem' }}>Absent</th>
                <th style={{ padding: '0.75rem' }}>Late</th>
                <th style={{ padding: '0.75rem' }}>Excused</th>
                <th style={{ padding: '0.75rem' }}>Percentage</th>
              </tr>
            </thead>
            <tbody>
              {studentStats.map((stat) => (
                <tr key={stat.studentId} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '0.75rem', fontWeight: 600 }}>{stat.studentName}</td>
                  <td style={{ padding: '0.75rem' }}>{stat.totalDays}</td>
                  <td style={{ padding: '0.75rem', color: 'green' }}>{stat.presentDays}</td>
                  <td style={{ padding: '0.75rem', color: 'red' }}>{stat.absentDays}</td>
                  <td style={{ padding: '0.75rem', color: 'orange' }}>{stat.lateDays}</td>
                  <td style={{ padding: '0.75rem', color: '#8b5cf6' }}>{stat.excusedDays}</td>
                  <td style={{ padding: '0.75rem' }}>
                    <span style={{
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      fontWeight: 600,
                      backgroundColor: stat.percentage >= 80 ? '#dcfce7' : stat.percentage >= 60 ? '#fef9c3' : '#fee2e2',
                      color: stat.percentage >= 80 ? '#166534' : stat.percentage >= 60 ? '#854d0e' : '#991b1b',
                    }}>
                      {stat.percentage.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Session Details */}
      <div className="table-responsive" style={{ marginTop: '2rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Session Details</h3>
        {sessions.length === 0 ? (
          <p>No attendance sessions found.</p>
        ) : (
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                <th style={{ padding: '0.75rem' }}>Date</th>
                <th style={{ padding: '0.75rem' }}>Class</th>
                <th style={{ padding: '0.75rem' }}>Subject</th>
                <th style={{ padding: '0.75rem' }}>Period</th>
                <th style={{ padding: '0.75rem' }}>Status</th>
                <th style={{ padding: '0.75rem' }}>Records</th>
              </tr>
            </thead>
            <tbody>
              {getFilteredSessions().map((session) => (
                <tr key={session.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '0.75rem' }}>{session.date}</td>
                  <td style={{ padding: '0.75rem' }}>{getClassName(session.classId)}</td>
                  <td style={{ padding: '0.75rem' }}>{session.subjectId}</td>
                  <td style={{ padding: '0.75rem' }}>{session.periodLabel}</td>
                  <td style={{ padding: '0.75rem' }}>
                    <span style={{
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      backgroundColor: session.status === 'submitted' ? '#dcfce7' : '#fef9c3',
                      color: session.status === 'submitted' ? '#166534' : '#854d0e',
                    }}>
                      {session.status}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    {Object.keys(recordsBySession[session.id] || {}).length} students
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}