import { describe, expect, it } from 'vitest';
import { attendanceSchemas } from './schema';

describe('attendance validation', () => {
  it('accepts a valid attendance session and record payload', () => {
    const session = attendanceSchemas.sessions.safeParse({
      campusId: 'campus-1',
      academicYearId: 'year-1',
      classId: 'class-1',
      sectionId: 'section-1',
      sectionName: 'A',
      subjectId: 'subject-1',
      teacherId: 'teacher-1',
      date: '2026-10-01',
      periodLabel: 'Period 1',
      status: 'draft',
      createdBy: 'teacher-1',
    });

    const record = attendanceSchemas.records.safeParse({
      sessionId: 'session-1',
      campusId: 'campus-1',
      studentId: 'student-1',
      status: 'present',
      note: 'Present on time',
    });

    expect(session.success).toBe(true);
    expect(record.success).toBe(true);
  });

  it('rejects invalid attendance and correction values', () => {
    expect(
      attendanceSchemas.records.safeParse({
        sessionId: 'session-1',
        campusId: 'campus-1',
        studentId: 'student-1',
        status: 'other',
      }).success,
    ).toBe(false);

    expect(
      attendanceSchemas.auditLogs.safeParse({
        campusId: 'campus-1',
        actorUserId: 'teacher-1',
        action: 'correction',
        entityType: 'attendanceRecord',
        entityId: 'record-1',
        summary: '',
      }).success,
    ).toBe(false);
  });
});
