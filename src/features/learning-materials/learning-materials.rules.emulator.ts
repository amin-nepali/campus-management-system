import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes } from 'firebase/storage';

const projectId = 'demo-campus-management';
let testEnvironment: RulesTestEnvironment;
const currentTime = Date.now();
const future = Timestamp.fromDate(new Date(currentTime + 60 * 60 * 1000));
const old = Timestamp.fromDate(new Date(currentTime - 60 * 60 * 1000));

function note(status: 'draft' | 'published' = 'published') {
  return {
    campusId: 'campus-1',
    academicYearId: 'year-1',
    classId: 'class-1',
    sectionId: 'section-1',
    subjectId: 'subject-1',
    teacherId: 'teacher-user',
    authorId: 'teacher-user',
    title: 'Chapter notes',
    body: 'Read chapter one.',
    attachmentPaths: [],
    status,
    publishedAt: status === 'published' ? Timestamp.now() : null,
  };
}

function assignment(
  status: 'draft' | 'published' = 'published',
  dueAt = future,
) {
  return {
    campusId: 'campus-1',
    academicYearId: 'year-1',
    classId: 'class-1',
    sectionId: 'section-1',
    subjectId: 'subject-1',
    teacherId: 'teacher-user',
    title: 'Problem set',
    instructions: 'Submit your answers.',
    attachmentPaths: [],
    dueAt,
    allowSubmissions: true,
    status,
    publishedAt: status === 'published' ? Timestamp.now() : null,
  };
}

beforeAll(async () => {
  testEnvironment = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules: await readFile(
        'd:/projects/campus-management-system/firestore.rules',
        'utf8',
      ),
    },
    storage: {
      host: '127.0.0.1',
      port: 9199,
      rules: await readFile(
        'd:/projects/campus-management-system/storage.rules',
        'utf8',
      ),
    },
  });
});

afterAll(async () => {
  await testEnvironment.cleanup();
});

beforeEach(async () => {
  await testEnvironment.clearFirestore();
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'users', 'teacher-user'), {
      role: 'teacher',
      status: 'active',
      displayName: 'Teacher',
    });
    await setDoc(doc(db, 'users', 'student-user'), {
      role: 'student',
      status: 'active',
      displayName: 'Student',
    });
    await setDoc(doc(db, 'users', 'other-teacher'), {
      role: 'teacher',
      status: 'active',
      displayName: 'Other Teacher',
    });
    await setDoc(
      doc(
        db,
        'teachingAssignmentAccess',
        'teacher-user--year-1--class-1--section-1--subject-1',
      ),
      {
        campusId: 'campus-1',
        academicYearId: 'year-1',
        classId: 'class-1',
        sectionId: 'section-1',
        subjectId: 'subject-1',
        teacherUid: 'teacher-user',
        active: true,
      },
    );
    await setDoc(
      doc(db, 'studentClassAccess', 'student-user--year-1--class-1--section-1'),
      {
        campusId: 'campus-1',
        academicYearId: 'year-1',
        classId: 'class-1',
        sectionId: 'section-1',
        studentId: 'student-1',
        studentUserId: 'student-user',
        active: true,
      },
    );
    await setDoc(doc(db, 'notes', 'published-note'), note());
    await setDoc(doc(db, 'notes', 'draft-note'), note('draft'));
    await setDoc(doc(db, 'assignments', 'open-assignment'), assignment());
    await setDoc(
      doc(db, 'assignments', 'late-assignment'),
      assignment('published', old),
    );
  });
});

describe('notes and assignment Firestore rules', () => {
  it('allows teachers to create content only for active assigned scopes', async () => {
    const db = testEnvironment.authenticatedContext('teacher-user').firestore();
    await assertSucceeds(
      getDoc(
        doc(
          db,
          'teachingAssignmentAccess',
          'teacher-user--year-1--class-1--section-1--subject-1',
        ),
      ),
    );
    await assertSucceeds(
      setDoc(doc(db, 'notes', 'teacher-note'), note('draft')),
    );
    await assertFails(
      setDoc(doc(db, 'notes', 'other-class-note'), {
        ...note('draft'),
        classId: 'class-2',
      }),
    );
    await assertSucceeds(
      setDoc(doc(db, 'assignments', 'teacher-assignment'), assignment('draft')),
    );
  });

  it('limits student reads to published content for active enrollment', async () => {
    const db = testEnvironment.authenticatedContext('student-user').firestore();
    await assertSucceeds(getDoc(doc(db, 'notes', 'published-note')));
    await assertFails(getDoc(doc(db, 'notes', 'draft-note')));
    await assertFails(getDoc(doc(db, 'notes', 'unseeded-other-class-note')));
  });

  it('allows submissions before the due date and denies late submissions', async () => {
    const db = testEnvironment.authenticatedContext('student-user').firestore();
    const validSubmission = {
      assignmentId: 'open-assignment',
      campusId: 'campus-1',
      studentId: 'student-1',
      studentUserId: 'student-user',
      attachmentPaths: [],
      textResponse: 'My work',
      submittedAt: Timestamp.now(),
      status: 'submitted',
    };
    await assertSucceeds(
      setDoc(
        doc(db, 'assignmentSubmissions', 'open-assignment--student-1'),
        validSubmission,
      ),
    );
    await assertFails(
      setDoc(doc(db, 'assignmentSubmissions', 'late-assignment--student-1'), {
        ...validSubmission,
        assignmentId: 'late-assignment',
      }),
    );
  });
});

describe('Firebase Storage learning-material rules', () => {
  it('allows assigned teachers and enrolled students to access valid material files', async () => {
    const teacherStorage = testEnvironment
      .authenticatedContext('teacher-user')
      .storage();
    const studentStorage = testEnvironment
      .authenticatedContext('student-user')
      .storage();
    const attachment = new Blob(['class notes'], { type: 'application/pdf' });
    await assertSucceeds(
      uploadBytes(
        ref(
          teacherStorage,
          `learning/notes/teacher-user/published-note/${crypto.randomUUID()}-notes.pdf`,
        ),
        attachment,
      ),
    );
    await assertSucceeds(
      uploadBytes(
        ref(
          studentStorage,
          `submissions/student-user/open-assignment/${crypto.randomUUID()}-work.pdf`,
        ),
        attachment,
      ),
    );
  });

  it('rejects unsupported file types, oversized files, and unassigned teacher uploads', async () => {
    const teacherStorage = testEnvironment
      .authenticatedContext('teacher-user')
      .storage();
    const exeFile = new Blob(['not allowed'], {
      type: 'application/x-msdownload',
    });
    const oversizedPdf = new Blob([new Uint8Array(10 * 1024 * 1024 + 1)], {
      type: 'application/pdf',
    });
    await assertFails(
      uploadBytes(
        ref(
          teacherStorage,
          'learning/notes/teacher-user/published-note/program.exe',
        ),
        exeFile,
      ),
    );
    await assertFails(
      uploadBytes(
        ref(
          teacherStorage,
          'learning/notes/teacher-user/published-note/large.pdf',
        ),
        oversizedPdf,
      ),
    );
    await assertFails(
      uploadBytes(
        ref(
          teacherStorage,
          'learning/notes/other-teacher/published-note/notes.pdf',
        ),
        new Blob(['x'], { type: 'application/pdf' }),
      ),
    );
  });
});
