import { z } from 'zod';

const requiredText = z.string().trim().min(1, 'This field is required.');
const optionalText = z.string().trim();
const date = z.string().refine((value) => {
  if (value === '') return true;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(parsed.valueOf()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}, 'Enter a valid date.');
const requiredDate = date.refine(
  (value) => value !== '',
  'This date is required.',
);

export const attendanceStatuses = [
  'present',
  'absent',
  'late',
  'excused',
] as const;
export const attendanceSessionStatuses = [
  'draft',
  'submitted',
  'corrected',
] as const;
export const auditActions = [
  'create',
  'submit',
  'correction',
  'reopen',
] as const;

export const attendanceSchemas = {
  sessions: z
    .object({
      campusId: requiredText,
      academicYearId: requiredText,
      classId: requiredText,
      sectionId: requiredText,
      sectionName: requiredText.max(40),
      subjectId: requiredText,
      teacherId: requiredText,
      date: requiredDate,
      periodLabel: requiredText.max(40),
      status: z.enum(attendanceSessionStatuses),
      createdBy: requiredText,
      submittedBy: requiredText.optional(),
      submittedAt: z.string().optional(),
      correctedAt: z.string().optional(),
      notes: optionalText.max(300).optional(),
    })
    .strict(),
  records: z
    .object({
      sessionId: requiredText,
      campusId: requiredText,
      studentId: requiredText,
      status: z.enum(attendanceStatuses),
      note: optionalText.max(300).optional(),
      updatedBy: requiredText.optional(),
      updatedAt: z.string().optional(),
    })
    .strict(),
  auditLogs: z
    .object({
      campusId: requiredText,
      actorUserId: requiredText,
      action: z.enum(auditActions),
      entityType: z.enum(['attendanceSession', 'attendanceRecord']),
      entityId: requiredText,
      summary: requiredText.max(500),
      createdAt: z.string().optional(),
    })
    .strict(),
} as const;

export type AttendanceStatus = (typeof attendanceStatuses)[number];
export type AttendanceSessionStatus =
  (typeof attendanceSessionStatuses)[number];
export type AttendanceAuditAction = (typeof auditActions)[number];

export type AttendanceSession = z.infer<typeof attendanceSchemas.sessions> & {
  id: string;
};
export type AttendanceRecord = z.infer<typeof attendanceSchemas.records> & {
  id: string;
};
export type AttendanceAuditLog = z.infer<typeof attendanceSchemas.auditLogs> & {
  id: string;
};
