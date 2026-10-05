import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { firestoreDb } from '../../lib/firebase';
import {
  routineSchemas,
  validatedRoutineEntrySchema,
  type RoutineEntry,
  type RoutineEntryInput,
} from './schema';

function database() {
  if (!firestoreDb) {
    throw new Error(
      'Firebase is not configured. Add the required VITE_FIREBASE_* values.',
    );
  }
  return firestoreDb;
}

export async function listRoutineEntries(
  filters?: Partial<{
    campusId: string;
    academicYearId: string;
    classId: string;
    sectionId: string;
    teacherId: string;
  }>,
): Promise<RoutineEntry[]> {
  const entries = collection(database(), 'routineEntries');
  let q = query(entries);
  const conditions: ReturnType<typeof where>[] = [];
  if (filters?.academicYearId) {
    conditions.push(where('academicYearId', '==', filters.academicYearId));
  }
  if (filters?.classId) {
    conditions.push(where('classId', '==', filters.classId));
  }
  if (filters?.sectionId) {
    conditions.push(where('sectionId', '==', filters.sectionId));
  }
  if (filters?.teacherId) {
    conditions.push(where('teacherId', '==', filters.teacherId));
  }
  if (conditions.length > 0) {
    q = query(entries, ...conditions);
  }
  const snapshot = await getDocs(q);
  return snapshot.docs.map((entry) => ({
    ...(entry.data() as Omit<RoutineEntry, 'id'>),
    id: entry.id,
  }));
}

export async function createRoutineEntry(
  input: RoutineEntryInput,
): Promise<string> {
  const validated = validatedRoutineEntrySchema.parse(input);
  const reference = await addDoc(collection(database(), 'routineEntries'), {
    ...validated,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return reference.id;
}

export async function updateRoutineEntry(
  id: string,
  input: Partial<RoutineEntryInput>,
): Promise<void> {
  const validated = routineSchemas.routineEntries.partial().parse(input);
  await updateDoc(doc(database(), 'routineEntries', id), {
    ...validated,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteRoutineEntry(id: string): Promise<void> {
  await deleteDoc(doc(database(), 'routineEntries', id));
}

export async function getRoutineForClass(
  academicYearId: string,
  classId: string,
  sectionId: string,
): Promise<RoutineEntry[]> {
  return listRoutineEntries({ academicYearId, classId, sectionId });
}

export async function getRoutineForTeacher(
  teacherId: string,
  academicYearId?: string,
): Promise<RoutineEntry[]> {
  return listRoutineEntries({
    teacherId,
    ...(academicYearId ? { academicYearId } : {}),
  });
}

export async function getRoutineForStudent(
  studentScopes: Array<{
    academicYearId: string;
    classId: string;
    sectionId: string;
  }>,
): Promise<RoutineEntry[]> {
  const allEntries: RoutineEntry[] = [];
  await Promise.all(
    studentScopes.map(async (scope) => {
      const entries = await listRoutineEntries({
        academicYearId: scope.academicYearId,
        classId: scope.classId,
        sectionId: scope.sectionId,
      });
      allEntries.push(...entries);
    }),
  );
  return allEntries;
}