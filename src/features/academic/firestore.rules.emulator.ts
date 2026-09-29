import { readFile } from 'node:fs/promises';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { academicCollections } from './schema';

const projectId = 'demo-campus-management';
let testEnvironment: RulesTestEnvironment;

beforeAll(async () => {
  testEnvironment = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules: await readFile(
        new URL('../../../firestore.rules', import.meta.url),
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
    await setDoc(doc(db, 'users', 'admin-user'), {
      role: 'admin',
      status: 'active',
      displayName: 'Admin',
      email: 'admin@example.invalid',
    });
    await setDoc(doc(db, 'users', 'student-user'), {
      role: 'student',
      status: 'active',
      displayName: 'Student',
      email: 'student@example.invalid',
    });
    await setDoc(doc(db, 'users', 'teacher-user'), {
      role: 'teacher',
      status: 'active',
      displayName: 'Teacher',
      email: 'teacher@example.invalid',
    });
    await setDoc(doc(db, 'users', 'other-teacher'), {
      role: 'teacher',
      status: 'active',
      displayName: 'Other Teacher',
      email: 'other-teacher@example.invalid',
    });
    await setDoc(doc(db, 'users', 'disabled-admin'), {
      role: 'admin',
      status: 'disabled',
      displayName: 'Disabled',
      email: 'disabled@example.invalid',
    });
    await setDoc(doc(db, 'students', 'student-1'), {
      fullName: 'Student User',
      userId: 'student-user',
      active: true,
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
        sectionName: 'A',
        subjectId: 'subject-1',
        teacherUid: 'teacher-user',
        active: true,
      },
    );
    await setDoc(
      doc(
        db,
        'studentClassAccess',
        'student-user--year-1--class-1--section-1',
      ),
      {
        campusId: 'campus-1',
        academicYearId: 'year-1',
        classId: 'class-1',
        sectionId: 'section-1',
        studentId: 'student-1',
        studentName: 'Student User',
        studentUserId: 'student-user',
        active: true,
      },
    );
    await setDoc(doc(db, 'attendanceSessions', 'attendance-session-1'), {
      campusId: 'campus-1',
      academicYearId: 'year-1',
      classId: 'class-1',
      sectionId: 'section-1',
      subjectId: 'subject-1',
      teacherId: 'teacher-user',
      date: '2026-08-01',
      periodLabel: 'Period 1',
      status: 'draft',
      createdBy: 'teacher-user',
    });
    await setDoc(doc(db, 'attendanceSessions', 'submitted-session'), {
      campusId: 'campus-1',
      academicYearId: 'year-1',
      classId: 'class-1',
      sectionId: 'section-1',
      subjectId: 'subject-1',
      teacherId: 'teacher-user',
      date: '2026-08-01',
      periodLabel: 'Period 2',
      status: 'submitted',
      createdBy: 'teacher-user',
      submittedBy: 'teacher-user',
    });
  });
});

describe('academic Firestore rules', () => {
  it.each(academicCollections)(
    'allows active admins to write %s',
    async (name) => {
      const db = testEnvironment.authenticatedContext('admin-user').firestore();
      await assertSucceeds(
        setDoc(doc(db, name, 'record-1'), { label: 'seed' }),
      );
      await assertSucceeds(getDocs(collection(db, name)));
    },
  );

  it.each(academicCollections)('denies students access to %s', async (name) => {
    const db = testEnvironment.authenticatedContext('student-user').firestore();
    await assertFails(setDoc(doc(db, name, 'record-1'), { label: 'seed' }));
    await assertFails(getDocs(collection(db, name)));
  });

  it('denies disabled admins access to academic records', async () => {
    const db = testEnvironment
      .authenticatedContext('disabled-admin')
      .firestore();
    await assertFails(getDocs(collection(db, 'campuses')));
  });

  it('allows users to read their own profile but never change their role', async () => {
    const db = testEnvironment.authenticatedContext('student-user').firestore();
    await assertSucceeds(getDoc(doc(db, 'users', 'student-user')));
    await assertFails(
      setDoc(doc(db, 'users', 'student-user'), { role: 'admin' }),
    );
  });

  it('allows teachers to manage their own attendance sessions', async () => {
    const db = testEnvironment.authenticatedContext('teacher-user').firestore();

    await assertSucceeds(
      setDoc(doc(db, 'attendanceSessions', 'teacher-session'), {
        campusId: 'campus-1',
        academicYearId: 'year-1',
        classId: 'class-1',
        sectionId: 'section-1',
        sectionName: 'A',
        subjectId: 'subject-1',
        teacherId: 'teacher-user',
        date: '2026-08-02',
        periodLabel: 'Period 2',
        status: 'draft',
        createdBy: 'teacher-user',
      }),
    );

    await assertSucceeds(
      setDoc(doc(db, 'attendanceRecords', 'teacher-record'), {
        sessionId: 'teacher-session',
        campusId: 'campus-1',
        studentId: 'student-1',
        status: 'present',
        note: 'On time',
        updatedBy: 'teacher-user',
      }),
    );
  });

  it('denies teacher access when the session belongs to another teacher', async () => {
    const db = testEnvironment.authenticatedContext('teacher-user').firestore();

    await assertFails(
      setDoc(doc(db, 'attendanceSessions', 'other-teacher-session'), {
        campusId: 'campus-1',
        academicYearId: 'year-1',
        classId: 'class-2',
        sectionId: 'section-2',
        sectionName: 'B',
        subjectId: 'subject-1',
        teacherId: 'other-teacher',
        date: '2026-08-02',
        periodLabel: 'Period 3',
        status: 'draft',
        createdBy: 'teacher-user',
      }),
    );
  });

  it('denies a teacher from creating a session outside their assigned scope', async () => {
    const db = testEnvironment.authenticatedContext('teacher-user').firestore();

    await assertFails(
      setDoc(doc(db, 'attendanceSessions', 'unassigned-session'), {
        campusId: 'campus-1',
        academicYearId: 'year-1',
        classId: 'class-2',
        sectionId: 'section-2',
        sectionName: 'B',
        subjectId: 'subject-2',
        teacherId: 'teacher-user',
        date: '2026-08-03',
        periodLabel: 'Period 1',
        status: 'draft',
        createdBy: 'teacher-user',
      }),
    );
  });

  it('denies teachers from writing attendance records into another teacher\'s session', async () => {
    const db = testEnvironment.authenticatedContext('teacher-user').firestore();
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      await setDoc(doc(adminDb, 'attendanceSessions', 'other-teacher-session'), {
        campusId: 'campus-1',
        academicYearId: 'year-1',
        classId: 'class-2',
        sectionId: 'section-2',
        subjectId: 'subject-2',
        teacherId: 'other-teacher',
        date: '2026-08-03',
        periodLabel: 'Period 2',
        status: 'draft',
        createdBy: 'other-teacher',
      });
      await setDoc(doc(adminDb, 'attendanceRecords', 'foreign-record'), {
        sessionId: 'other-teacher-session',
        campusId: 'campus-1',
        studentId: 'student-1',
        status: 'present',
        updatedBy: 'other-teacher',
      });
    });

    await assertFails(
      setDoc(doc(db, 'attendanceRecords', 'new-foreign-record'), {
        sessionId: 'other-teacher-session',
        campusId: 'campus-1',
        studentId: 'student-1',
        status: 'absent',
        updatedBy: 'teacher-user',
      }),
    );
    await assertFails(
      setDoc(doc(db, 'attendanceRecords', 'foreign-record'), {
        sessionId: 'other-teacher-session',
        campusId: 'campus-1',
        studentId: 'student-1',
        status: 'absent',
        updatedBy: 'teacher-user',
      }),
    );
  });

  it('allows students to read only their own attendance records', async () => {
    const studentDb = testEnvironment
      .authenticatedContext('student-user')
      .firestore();
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'attendanceRecords', 'student-record'), {
        sessionId: 'submitted-session',
        campusId: 'campus-1',
        studentId: 'student-1',
        status: 'late',
        note: 'Teacher note',
        updatedBy: 'teacher-user',
      });
      await setDoc(doc(db, 'attendanceRecords', 'other-student-record'), {
        sessionId: 'attendance-session-1',
        campusId: 'campus-1',
        studentId: 'student-2',
        status: 'absent',
        note: 'Another student record',
        updatedBy: 'teacher-user',
      });
    });

    await assertSucceeds(
      getDoc(doc(studentDb, 'attendanceRecords', 'student-record')),
    );
    await assertFails(
      getDoc(doc(studentDb, 'attendanceRecords', 'other-student-record')),
    );
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(), 'attendanceRecords', 'draft-attendance'),
        {
          sessionId: 'attendance-session-1',
          campusId: 'campus-1',
          studentId: 'student-1',
          status: 'present',
        },
      );
    });
    await assertFails(
      getDoc(doc(studentDb, 'attendanceRecords', 'draft-attendance')),
    );
  });

  it('denies unauthenticated reads and writes', async () => {
    const db = testEnvironment.unauthenticatedContext().firestore();
    await assertFails(getDocs(collection(db, 'campuses')));
    await assertFails(
      setDoc(doc(db, 'subjects', 'subject-1'), { label: 'seed' }),
    );
  });
});
