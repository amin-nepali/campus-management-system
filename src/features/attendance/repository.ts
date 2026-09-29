import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { firestoreDb } from '../../lib/firebase';
import type {
  StudentClassAccess,
  TeachingAccess,
} from '../learning-materials/schema';
import {
  attendanceSchemas,
  type AttendanceAuditAction,
  type AttendanceRecord,
  type AttendanceSession,
} from './schema';

function database() {
  if (!firestoreDb) {
    throw new Error(
      'Firebase is not configured. Add the required VITE_FIREBASE_* values.',
    );
  }
  return firestoreDb;
}

export async function listAttendanceSessions(
  teacherId?: string,
): Promise<AttendanceSession[]> {
  const sessions = collection(database(), 'attendanceSessions');
  const snapshot = teacherId
    ? await getDocs(query(sessions, where('teacherId', '==', teacherId)))
    : await getDocs(sessions);
  return snapshot.docs.map((entry) => ({
    ...(entry.data() as Omit<AttendanceSession, 'id'>),
    id: entry.id,
  }));
}

export async function listAttendanceRoster(
  scopes: TeachingAccess[],
): Promise<StudentClassAccess[]> {
  const roster = new Map<string, StudentClassAccess>();
  await Promise.all(
    scopes.map(async (scope) => {
      const snapshot = await getDocs(
        query(
          collection(database(), 'studentClassAccess'),
          where('academicYearId', '==', scope.academicYearId),
          where('classId', '==', scope.classId),
          where('sectionId', '==', scope.sectionId),
          where('active', '==', true),
        ),
      );
      for (const entry of snapshot.docs) {
        roster.set(entry.id, {
          ...entry.data(),
          id: entry.id,
        } as StudentClassAccess);
      }
    }),
  );
  return [...roster.values()];
}

export async function createAttendanceSession(
  input: Omit<AttendanceSession, 'id'>,
): Promise<string> {
  const validated = attendanceSchemas.sessions.parse(input);
  const reference = await addDoc(collection(database(), 'attendanceSessions'), {
    ...validated,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return reference.id;
}

export async function updateAttendanceSession(
  id: string,
  input: Partial<Omit<AttendanceSession, 'id'>>,
): Promise<void> {
  const validated = attendanceSchemas.sessions.partial().parse(input);
  await updateDoc(doc(database(), 'attendanceSessions', id), {
    ...validated,
    updatedAt: serverTimestamp(),
  });
}

export async function listAttendanceRecords(
  sessionId?: string,
): Promise<AttendanceRecord[]> {
  const recordsRef = collection(database(), 'attendanceRecords');
  const snapshot = sessionId
    ? await getDocs(query(recordsRef, where('sessionId', '==', sessionId)))
    : await getDocs(recordsRef);

  return snapshot.docs.map((entry) => ({
    ...(entry.data() as Omit<AttendanceRecord, 'id'>),
    id: entry.id,
  }));
}

export async function saveAttendanceRecord(
  sessionId: string,
  studentId: string,
  input: Omit<AttendanceRecord, 'id'>,
): Promise<string> {
  const validated = attendanceSchemas.records.parse({
    ...input,
    sessionId,
    studentId,
  });
  const collectionRef = collection(database(), 'attendanceRecords');
  const records = await getDocs(
    query(
      collectionRef,
      where('sessionId', '==', sessionId),
      where('studentId', '==', studentId),
    ),
  );

  if (records.empty) {
    const reference = await addDoc(collectionRef, {
      ...validated,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return reference.id;
  }

  const existingRecord = records.docs[0];
  if (!existingRecord) {
    throw new Error('Could not find the attendance record to update.');
  }

  await updateDoc(existingRecord.ref, {
    ...validated,
    updatedAt: serverTimestamp(),
  });
  return existingRecord.id;
}

export async function listAuditLogs(entityId?: string): Promise<
  Array<{
    id: string;
    campusId: string;
    actorUserId: string;
    action: AttendanceAuditAction;
    entityType: 'attendanceSession' | 'attendanceRecord';
    entityId: string;
    summary: string;
  }>
> {
  const logsRef = collection(database(), 'auditLogs');
  const snapshot = entityId
    ? await getDocs(query(logsRef, where('entityId', '==', entityId)))
    : await getDocs(logsRef);

  return snapshot.docs.map((entry) => ({
    id: entry.id,
    ...(entry.data() as {
      campusId: string;
      actorUserId: string;
      action: AttendanceAuditAction;
      entityType: 'attendanceSession' | 'attendanceRecord';
      entityId: string;
      summary: string;
    }),
  }));
}

export async function appendAuditLog(input: {
  campusId: string;
  actorUserId: string;
  action: AttendanceAuditAction;
  entityType: 'attendanceSession' | 'attendanceRecord';
  entityId: string;
  summary: string;
}): Promise<string> {
  const validated = attendanceSchemas.auditLogs.parse(input);
  const reference = await addDoc(collection(database(), 'auditLogs'), {
    ...validated,
    createdAt: serverTimestamp(),
  });
  return reference.id;
}
