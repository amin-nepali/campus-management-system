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
  noticeSchemas,
  publishedNoticeSchema,
  type Notice,
  type NoticeInput,
} from './schema';

function database() {
  if (!firestoreDb) {
    throw new Error(
      'Firebase is not configured. Add the required VITE_FIREBASE_* values.',
    );
  }
  return firestoreDb;
}

export async function listNotices(filters?: {
  campusId?: string;
  audienceId?: string;
  limit?: number;
}): Promise<Notice[]> {
  const notices = collection(database(), 'notices');
  let q = query(notices, where('status', '==', 'published'));

  if (filters?.campusId) {
    q = query(q, where('campusId', '==', filters.campusId));
  }

  const snapshot = await getDocs(q);
  return snapshot.docs.map((entry) => ({
    ...(entry.data() as Omit<Notice, 'id'>),
    id: entry.id,
  })).slice(0, filters?.limit ?? 20);
}

export async function createNotice(input: NoticeInput): Promise<string> {
  const validated = publishedNoticeSchema.parse(input);
  const reference = await addDoc(collection(database(), 'notices'), {
    ...validated,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return reference.id;
}

export async function updateNotice(
  id: string,
  input: Partial<NoticeInput>,
): Promise<void> {
  const validated = noticeSchemas.notices.partial().parse(input);
  await updateDoc(doc(database(), 'notices', id), {
    ...validated,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteNotice(id: string): Promise<void> {
  await deleteDoc(doc(database(), 'notices', id));
}

export async function publishNotice(id: string): Promise<void> {
  const now = new Date().toISOString();
  await updateNotice(id, { status: 'published', publishedAt: now });
}

export async function archiveNotice(id: string): Promise<void> {
  await updateNotice(id, { status: 'archived' });
}