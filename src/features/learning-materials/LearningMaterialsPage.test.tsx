import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { LearningMaterialsPage } from './LearningMaterialsPage';
import type {
  LearningNote,
  StudentClassAccess,
  TeachingAccess,
} from './schema';

const mocks = vi.hoisted(() => ({
  user: { id: 'teacher-1', role: 'teacher', displayName: 'Taylor Teacher' },
  listTeacherAccess: vi.fn(),
  listTeacherNotes: vi.fn(),
  listTeacherAssignments: vi.fn(),
  listStudentAccess: vi.fn(),
  listStudentNotes: vi.fn(),
  listStudentAssignments: vi.fn(),
  listStudentSubmissions: vi.fn(),
}));

vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({ user: mocks.user }),
}));

vi.mock('./repository', () => ({
  listTeacherAccess: mocks.listTeacherAccess,
  listTeacherNotes: mocks.listTeacherNotes,
  listTeacherAssignments: mocks.listTeacherAssignments,
  listStudentAccess: mocks.listStudentAccess,
  listStudentNotes: mocks.listStudentNotes,
  listStudentAssignments: mocks.listStudentAssignments,
  listStudentSubmissions: mocks.listStudentSubmissions,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const teacherScope: TeachingAccess = {
  id: 'teacher-1--year-1--class-1--section-1--subject-1',
  campusId: 'campus-1',
  academicYearId: 'year-1',
  classId: 'class-1',
  sectionId: 'section-1',
  subjectId: 'subject-1',
  teacherUid: 'teacher-1',
  active: true,
};

const studentScope: StudentClassAccess = {
  id: 'student-1--year-1--class-1--section-1',
  campusId: 'campus-1',
  academicYearId: 'year-1',
  classId: 'class-1',
  sectionId: 'section-1',
  studentId: 'student-record-1',
  studentUserId: 'student-1',
  active: true,
};

const publishedNote: LearningNote = {
  id: 'note-1',
  campusId: 'campus-1',
  academicYearId: 'year-1',
  classId: 'class-1',
  sectionId: 'section-1',
  subjectId: 'subject-1',
  teacherId: 'teacher-1',
  authorId: 'teacher-1',
  title: 'Cell structure',
  body: 'Review the diagram before class.',
  attachmentPaths: [],
  status: 'published',
  publishedAt: '2026-09-29T10:00:00.000Z',
};

describe('learning materials role views', () => {
  it('offers teachers an editor limited to assigned class scopes', async () => {
    mocks.user = {
      id: 'teacher-1',
      role: 'teacher',
      displayName: 'Taylor Teacher',
    };
    mocks.listTeacherAccess.mockResolvedValue([teacherScope]);
    mocks.listTeacherNotes.mockResolvedValue([]);

    render(
      <MemoryRouter initialEntries={['/notes']}>
        <LearningMaterialsPage />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole('heading', { name: 'Create note' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'class-1 / section-1 · subject-1' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publish' })).toBeInTheDocument();
  });

  it('shows students published notes without teacher editing controls', async () => {
    mocks.user = {
      id: 'student-1',
      role: 'student',
      displayName: 'Sam Student',
    };
    mocks.listStudentAccess.mockResolvedValue([studentScope]);
    mocks.listStudentNotes.mockResolvedValue([publishedNote]);

    render(
      <MemoryRouter initialEntries={['/notes']}>
        <LearningMaterialsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Cell structure')).toBeInTheDocument();
    expect(
      screen.getByText('Review the diagram before class.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Publish' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
  });
});
