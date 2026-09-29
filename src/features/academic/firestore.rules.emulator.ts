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
    await setDoc(doc(db, 'users', 'disabled-admin'), {
      role: 'admin',
      status: 'disabled',
      displayName: 'Disabled',
      email: 'disabled@example.invalid',
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

  it('denies unauthenticated reads and writes', async () => {
    const db = testEnvironment.unauthenticatedContext().firestore();
    await assertFails(getDocs(collection(db, 'campuses')));
    await assertFails(
      setDoc(doc(db, 'subjects', 'subject-1'), { label: 'seed' }),
    );
  });
});
