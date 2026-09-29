import {
  addDoc,
  collection,
  deleteDoc,
  type DocumentData,
  doc,
  getDocs,
  type QuerySnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  getBytes,
  ref,
  uploadBytes,
  type FirebaseStorage,
} from 'firebase/storage';
import { firebaseStorage, firestoreDb } from '../../lib/firebase';
import {
  isAllowedUpload,
  learningSchemas,
  maxUploadBytes,
  validateAssignmentForPublish,
  type AssignmentSubmission,
  type LearningAssignment,
  type LearningNote,
  type StudentClassAccess,
  type TeachingAccess,
} from './schema';

function database() {
  if (!firestoreDb) {
    throw new Error(
      'Firebase is not configured. Add the required VITE_FIREBASE_* values.',
    );
  }
  return firestoreDb;
}

function storage(): FirebaseStorage {
  if (!firebaseStorage) {
    throw new Error(
      'Firebase Storage is not configured. Add VITE_FIREBASE_STORAGE_BUCKET.',
    );
  }
  return firebaseStorage;
}

function toIso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === 'string') return value;
  return '';
}

function normalizeNote(
  id: string,
  value: Record<string, unknown>,
): LearningNote {
  return {
    ...value,
    id,
    publishedAt:
      value['publishedAt'] == null ? null : toIso(value['publishedAt']),
  } as LearningNote;
}

function normalizeAssignment(
  id: string,
  value: Record<string, unknown>,
): LearningAssignment {
  return {
    ...value,
    id,
    dueAt: toIso(value['dueAt']),
    publishedAt:
      value['publishedAt'] == null ? null : toIso(value['publishedAt']),
  } as LearningAssignment;
}

function normalizeSubmission(
  id: string,
  value: Record<string, unknown>,
): AssignmentSubmission {
  return {
    ...value,
    id,
    submittedAt: toIso(value['submittedAt']),
  } as AssignmentSubmission;
}

function mapAccess<T extends TeachingAccess | StudentClassAccess>(
  snapshot: QuerySnapshot<DocumentData>,
): T[] {
  return snapshot.docs.map(
    (entry) =>
      ({
        ...entry.data(),
        id: entry.id,
      }) as T,
  );
}

export async function listTeacherAccess(
  userId: string,
): Promise<TeachingAccess[]> {
  const snapshot = await getDocs(
    query(
      collection(database(), 'teachingAssignmentAccess'),
      where('teacherUid', '==', userId),
      where('active', '==', true),
    ),
  );
  return mapAccess<TeachingAccess>(snapshot);
}

export async function listStudentAccess(
  userId: string,
): Promise<StudentClassAccess[]> {
  const snapshot = await getDocs(
    query(
      collection(database(), 'studentClassAccess'),
      where('studentUserId', '==', userId),
      where('active', '==', true),
    ),
  );
  return mapAccess<StudentClassAccess>(snapshot);
}

export async function listTeacherNotes(
  userId: string,
  access: TeachingAccess[],
): Promise<LearningNote[]> {
  const byId = new Map<string, LearningNote>();
  await Promise.all(
    access.map(async (scope) => {
      const snapshot = await getDocs(
        query(
          collection(database(), 'notes'),
          where('authorId', '==', userId),
          where('academicYearId', '==', scope.academicYearId),
          where('classId', '==', scope.classId),
          where('sectionId', '==', scope.sectionId),
          where('subjectId', '==', scope.subjectId),
        ),
      );
      for (const entry of snapshot.docs) {
        byId.set(
          entry.id,
          normalizeNote(entry.id, entry.data() as Record<string, unknown>),
        );
      }
    }),
  );
  return [...byId.values()];
}

export async function listTeacherAssignments(
  userId: string,
  access: TeachingAccess[],
): Promise<LearningAssignment[]> {
  const byId = new Map<string, LearningAssignment>();
  await Promise.all(
    access.map(async (scope) => {
      const snapshot = await getDocs(
        query(
          collection(database(), 'assignments'),
          where('teacherId', '==', userId),
          where('academicYearId', '==', scope.academicYearId),
          where('classId', '==', scope.classId),
          where('sectionId', '==', scope.sectionId),
          where('subjectId', '==', scope.subjectId),
        ),
      );
      for (const entry of snapshot.docs) {
        byId.set(
          entry.id,
          normalizeAssignment(
            entry.id,
            entry.data() as Record<string, unknown>,
          ),
        );
      }
    }),
  );
  return [...byId.values()];
}

async function listStudentContent<T>(
  collectionName: 'notes' | 'assignments',
  access: StudentClassAccess[],
): Promise<T[]> {
  const byId = new Map<string, T>();
  await Promise.all(
    access.map(async (membership) => {
      const snapshot = await getDocs(
        query(
          collection(database(), collectionName),
          where('academicYearId', '==', membership.academicYearId),
          where('classId', '==', membership.classId),
          where('sectionId', '==', membership.sectionId),
          ...(collectionName === 'assignments'
            ? [where('status', 'in', ['published', 'closed'])]
            : [where('status', '==', 'published')]),
        ),
      );
      for (const entry of snapshot.docs) {
        const value = entry.data() as Record<string, unknown>;
        const normalized =
          collectionName === 'notes'
            ? normalizeNote(entry.id, value)
            : normalizeAssignment(entry.id, value);
        byId.set(entry.id, normalized as T);
      }
    }),
  );
  return [...byId.values()];
}

export function listStudentNotes(
  access: StudentClassAccess[],
): Promise<LearningNote[]> {
  return listStudentContent<LearningNote>('notes', access);
}

export function listStudentAssignments(
  access: StudentClassAccess[],
): Promise<LearningAssignment[]> {
  return listStudentContent<LearningAssignment>('assignments', access);
}

export async function saveNote(
  input: Omit<LearningNote, 'id'>,
  id?: string,
): Promise<string> {
  const validated = learningSchemas.notes.parse(input);
  const data = {
    ...validated,
    publishedAt:
      validated.status === 'published'
        ? Timestamp.fromDate(
            new Date(validated.publishedAt ?? new Date().toISOString()),
          )
        : null,
    updatedAt: serverTimestamp(),
  };
  if (id) {
    await updateDoc(doc(database(), 'notes', id), data);
    return id;
  }
  const created = await addDoc(collection(database(), 'notes'), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return created.id;
}

export async function saveAssignment(
  input: Omit<LearningAssignment, 'id'>,
  id?: string,
): Promise<string> {
  const validation = validateAssignmentForPublish(input);
  if (!validation.success) throw validation.error;
  const validated = validation.data;
  const data = {
    ...validated,
    dueAt: Timestamp.fromDate(new Date(validated.dueAt)),
    publishedAt:
      validated.status === 'published'
        ? Timestamp.fromDate(
            new Date(validated.publishedAt ?? new Date().toISOString()),
          )
        : null,
    updatedAt: serverTimestamp(),
  };
  if (id) {
    await updateDoc(doc(database(), 'assignments', id), data);
    return id;
  }
  const created = await addDoc(collection(database(), 'assignments'), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return created.id;
}

export async function archiveNote(id: string): Promise<void> {
  await updateDoc(doc(database(), 'notes', id), {
    status: 'archived',
    updatedAt: serverTimestamp(),
  });
}

export async function closeAssignment(id: string): Promise<void> {
  await updateDoc(doc(database(), 'assignments', id), {
    status: 'closed',
    updatedAt: serverTimestamp(),
  });
}

export async function deleteDraft(
  collectionName: 'notes' | 'assignments',
  id: string,
): Promise<void> {
  await deleteDoc(doc(database(), collectionName, id));
}

export async function uploadLearningAttachment(
  kind: 'notes' | 'assignments',
  userId: string,
  contentId: string,
  file: File,
): Promise<string> {
  if (!isAllowedUpload(file)) {
    throw new Error(
      'Choose a PDF, image, Word document, or text file up to 10 MB.',
    );
  }
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100);
  const path = `learning/${kind}/${userId}/${contentId}/${crypto.randomUUID()}-${safeName}`;
  await uploadBytes(ref(storage(), path), file, { contentType: file.type });
  return path;
}

export async function uploadSubmissionAttachment(
  userId: string,
  assignmentId: string,
  file: File,
): Promise<string> {
  if (!isAllowedUpload(file)) {
    throw new Error(
      'Choose a PDF, image, Word document, or text file up to 10 MB.',
    );
  }
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100);
  const path = `submissions/${userId}/${assignmentId}/${crypto.randomUUID()}-${safeName}`;
  await uploadBytes(ref(storage(), path), file, { contentType: file.type });
  return path;
}

export async function downloadAttachment(
  path: string,
  fileName: string,
): Promise<void> {
  const bytes = await getBytes(ref(storage(), path), maxUploadBytes * 2);
  const blob = new Blob([new Uint8Array(bytes).buffer as ArrayBuffer]);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function listStudentSubmissions(
  userId: string,
): Promise<AssignmentSubmission[]> {
  const snapshot = await getDocs(
    query(
      collection(database(), 'assignmentSubmissions'),
      where('studentUserId', '==', userId),
    ),
  );
  return snapshot.docs.map((entry) =>
    normalizeSubmission(entry.id, entry.data() as Record<string, unknown>),
  );
}

export async function listAssignmentSubmissions(
  assignmentId: string,
): Promise<AssignmentSubmission[]> {
  const snapshot = await getDocs(
    query(
      collection(database(), 'assignmentSubmissions'),
      where('assignmentId', '==', assignmentId),
    ),
  );
  return snapshot.docs.map((entry) =>
    normalizeSubmission(entry.id, entry.data() as Record<string, unknown>),
  );
}

export async function saveAssignmentSubmission(
  input: Omit<AssignmentSubmission, 'id'>,
): Promise<void> {
  const validated = learningSchemas.submissions.parse(input);
  const id = `${validated.assignmentId}--${validated.studentId}`;
  await setDoc(
    doc(database(), 'assignmentSubmissions', id),
    {
      ...validated,
      submittedAt: Timestamp.fromDate(new Date(validated.submittedAt)),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}
