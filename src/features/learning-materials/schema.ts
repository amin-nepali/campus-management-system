import { z } from 'zod';

const requiredText = z.string().trim().min(1, 'This field is required.');
const optionalText = z.string().trim();
const isoDateTime = z.string().datetime({ offset: true });
const attachmentPath = z
  .string()
  .regex(
    /^(learning\/(notes|assignments)\/[^/]+\/[^/]+\/[^/]+|submissions\/[^/]+\/[^/]+\/[^/]+)$/,
    'Attachment path is invalid.',
  );
const idList = z
  .array(attachmentPath)
  .max(5, 'You can attach at most five files.');

const audienceFields = {
  campusId: requiredText,
  academicYearId: requiredText,
  classId: requiredText,
  sectionId: requiredText,
  subjectId: requiredText,
  teacherId: requiredText,
};

export const noteStatuses = ['draft', 'published', 'archived'] as const;
export const assignmentStatuses = ['draft', 'published', 'closed'] as const;
export const submissionStatuses = ['submitted', 'returned', 'graded'] as const;
export const maxUploadBytes = 10 * 1024 * 1024;
export const allowedUploadTypes = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

export const learningSchemas = {
  notes: z
    .object({
      ...audienceFields,
      authorId: requiredText,
      title: requiredText.max(160),
      body: requiredText.max(20_000),
      attachmentPaths: idList.default([]),
      status: z.enum(noteStatuses),
      publishedAt: isoDateTime.nullable().default(null),
    })
    .strict()
    .refine(
      (note) => note.status !== 'published' || note.publishedAt !== null,
      {
        message: 'Published notes need a publication date.',
        path: ['publishedAt'],
      },
    ),
  assignments: z
    .object({
      ...audienceFields,
      title: requiredText.max(160),
      instructions: requiredText.max(20_000),
      dueAt: isoDateTime,
      attachmentPaths: idList.default([]),
      allowSubmissions: z.boolean(),
      status: z.enum(assignmentStatuses),
      publishedAt: isoDateTime.nullable().default(null),
    })
    .strict()
    .refine(
      (assignment) =>
        assignment.status !== 'published' || assignment.publishedAt !== null,
      {
        message: 'Published assignments need a publication date.',
        path: ['publishedAt'],
      },
    ),
  submissions: z
    .object({
      assignmentId: requiredText,
      campusId: requiredText,
      studentId: requiredText,
      studentUserId: requiredText,
      attachmentPaths: idList.default([]),
      textResponse: optionalText.max(10_000).default(''),
      submittedAt: isoDateTime,
      status: z.enum(submissionStatuses).default('submitted'),
    })
    .strict()
    .refine(
      (submission) =>
        submission.attachmentPaths.length > 0 ||
        submission.textResponse.length > 0,
      { message: 'Add a written response or at least one attachment.' },
    ),
} as const;

export type LearningNote = z.infer<typeof learningSchemas.notes> & {
  id: string;
};
export type LearningAssignment = z.infer<typeof learningSchemas.assignments> & {
  id: string;
};
export type AssignmentSubmission = z.infer<
  typeof learningSchemas.submissions
> & {
  id: string;
};
export type TeachingAccess = {
  id: string;
  campusId: string;
  academicYearId: string;
  classId: string;
  sectionId: string;
  subjectId: string;
  teacherUid: string;
  active: boolean;
};
export type StudentClassAccess = {
  id: string;
  campusId: string;
  academicYearId: string;
  classId: string;
  sectionId: string;
  studentId: string;
  studentUserId: string;
  active: boolean;
};

export function validateAssignmentForPublish(
  assignment: z.input<typeof learningSchemas.assignments>,
  now = new Date(),
) {
  const parsed = learningSchemas.assignments.safeParse(assignment);
  if (!parsed.success) return parsed;
  if (
    parsed.data.status === 'published' &&
    new Date(parsed.data.dueAt).getTime() <= now.getTime()
  ) {
    return {
      success: false as const,
      error: new z.ZodError([
        {
          code: 'custom',
          path: ['dueAt'],
          message: 'Due date must be in the future when publishing.',
        },
      ]),
    };
  }
  return parsed;
}

export function isAllowedUpload(file: Pick<File, 'size' | 'type'>): boolean {
  return (
    file.size > 0 &&
    file.size <= maxUploadBytes &&
    allowedUploadTypes.includes(
      file.type as (typeof allowedUploadTypes)[number],
    )
  );
}
