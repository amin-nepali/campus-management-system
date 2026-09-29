import { describe, expect, it } from 'vitest';
import {
  isAllowedUpload,
  learningSchemas,
  maxUploadBytes,
  validateAssignmentForPublish,
} from './schema';

const audience = {
  campusId: 'campus-1',
  academicYearId: 'year-1',
  classId: 'class-1',
  sectionId: 'section-1',
  subjectId: 'subject-1',
  teacherId: 'teacher-1',
};

describe('notes and assignments validation', () => {
  it('accepts notes and assignment drafts with valid fields', () => {
    expect(
      learningSchemas.notes.safeParse({
        ...audience,
        authorId: 'teacher-1',
        title: 'Chapter notes',
        body: 'Review the first chapter.',
        status: 'draft',
      }).success,
    ).toBe(true);

    expect(
      learningSchemas.assignments.safeParse({
        ...audience,
        title: 'Problem set',
        instructions: 'Complete questions one through five.',
        dueAt: '2026-10-01T12:00:00.000Z',
        allowSubmissions: true,
        status: 'draft',
      }).success,
    ).toBe(true);
  });

  it('requires published content to carry its publication timestamp', () => {
    expect(
      learningSchemas.notes.safeParse({
        ...audience,
        authorId: 'teacher-1',
        title: 'Chapter notes',
        body: 'Review the first chapter.',
        status: 'published',
      }).success,
    ).toBe(false);
  });

  it('rejects invalid or overdue assignment publication dates', () => {
    const overdueAssignment = {
      ...audience,
      title: 'Problem set',
      instructions: 'Complete questions one through five.',
      dueAt: '2026-09-28T12:00:00.000Z',
      allowSubmissions: true,
      status: 'published' as const,
      publishedAt: '2026-09-20T12:00:00.000Z',
    };

    expect(
      validateAssignmentForPublish(
        overdueAssignment,
        new Date('2026-09-29T12:00:00.000Z'),
      ).success,
    ).toBe(false);
    expect(
      learningSchemas.assignments.safeParse({
        ...overdueAssignment,
        dueAt: 'not-a-date',
      }).success,
    ).toBe(false);
  });

  it('rejects unsupported, empty, and oversized uploads', () => {
    expect(isAllowedUpload({ size: 100, type: 'application/pdf' })).toBe(true);
    expect(
      isAllowedUpload({ size: 100, type: 'application/x-msdownload' }),
    ).toBe(false);
    expect(isAllowedUpload({ size: 0, type: 'application/pdf' })).toBe(false);
    expect(
      isAllowedUpload({ size: maxUploadBytes + 1, type: 'application/pdf' }),
    ).toBe(false);
  });
});
