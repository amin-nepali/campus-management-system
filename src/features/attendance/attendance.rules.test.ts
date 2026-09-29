import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const projectId = 'demo-campus-management-attendance';
let testEnvironment: RulesTestEnvironment;
const shouldRunRulesTests = Boolean(
  process.env['FIRESTORE_EMULATOR_HOST'] ||
    process.env['VITEST_FIRESTORE_EMULATOR'],
);
const describeRules = shouldRunRulesTests ? describe : describe.skip;

beforeAll(async () => {
  testEnvironment = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules: await readFile('d:/projects/campus-management-system/firestore.rules', 'utf8'),
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
      displayName: 'Admin User',
      email: 'admin@example.invalid',
    });
    await setDoc(doc(db, 'users', 'teacher-user'), {
      role: 'teacher',
      status: 'active',
      displayName: 'Teacher User',
      email: 'teacher@example.invalid',
    });
    await setDoc(doc(db, 'users', 'student-user'), {
      role: 'student',
      status: 'active',
      displayName: 'Student User',
      email: 'student@example.invalid',
    });
    await setDoc(doc(db, 'students', 'student-1'), {
      fullName: 'Student User',
      userId: 'student-user',
    });
    await setDoc(doc(db, 'students', 'student-2'), {
      fullName: 'Other Student',
      userId: 'other-student',
    });
  });
});

describeRules('attendance Firestore rules', () => {
  it('allows teachers to create their own attendance sessions and records', async () => {
    const db = testEnvironment.authenticatedContext('teacher-user').firestore();

    await assertSucceeds(
      setDoc(doc(db, 'attendanceSessions', 'teacher-session'), {
        campusId: 'campus-1',
        academicYearId: 'year-1',
        classId: 'class-1',
        section: 'A',
        subjectId: 'subject-1',
        teacherId: 'teacher-user',
        date: '2026-08-02',
        periodLabel: 'Period 1',
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

  it('blocks session writes when a teacher is trying to manage another teacher\'s class', async () => {
    const db = testEnvironment.authenticatedContext('teacher-user').firestore();

    await assertFails(
      setDoc(doc(db, 'attendanceSessions', 'other-teacher-session'), {
        campusId: 'campus-1',
        academicYearId: 'year-1',
        classId: 'class-2',
        section: 'B',
        subjectId: 'subject-2',
        teacherId: 'other-teacher',
        date: '2026-08-02',
        periodLabel: 'Period 2',
        status: 'draft',
        createdBy: 'teacher-user',
      }),
    );
  });

  it('allows students to read only their own attendance records', async () => {
    const studentDb = testEnvironment.authenticatedContext('student-user').firestore();
    const adminDb = testEnvironment.authenticatedContext('admin-user').firestore();

    await assertSucceeds(
      setDoc(doc(adminDb, 'attendanceSessions', 'session-1'), {
        campusId: 'campus-1',
        academicYearId: 'year-1',
        classId: 'class-1',
        section: 'A',
        subjectId: 'subject-1',
        teacherId: 'teacher-user',
        date: '2026-08-02',
        periodLabel: 'Period 1',
        status: 'submitted',
        createdBy: 'teacher-user',
      }),
    );

    await assertSucceeds(
      setDoc(doc(adminDb, 'attendanceRecords', 'student-record'), {
        sessionId: 'session-1',
        campusId: 'campus-1',
        studentId: 'student-1',
        status: 'late',
        note: 'Late arrival',
        updatedBy: 'teacher-user',
      }),
    );

    await assertSucceeds(getDoc(doc(studentDb, 'attendanceRecords', 'student-record')));

    await assertFails(
      getDoc(doc(studentDb, 'attendanceRecords', 'other-student-record')),
    );
  });
});
