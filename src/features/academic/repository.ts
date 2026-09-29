import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { firestoreDb } from '../../lib/firebase';
import {
  academicSchemas,
  type AcademicCollection,
  type AcademicRecord,
  type AcademicRecordInput,
} from './schema';

function database() {
  if (!firestoreDb) {
    throw new Error(
      'Firebase is not configured. Add the required VITE_FIREBASE_* values.',
    );
  }
  return firestoreDb;
}

export async function listAcademicRecords<C extends AcademicCollection>(
  name: C,
): Promise<AcademicRecord<C>[]> {
  const snapshot = await getDocs(collection(database(), name));
  return snapshot.docs.map(
    (record) =>
      ({
        ...record.data(),
        id: record.id,
      }) as AcademicRecord<C>,
  );
}

export async function createAcademicRecord<C extends AcademicCollection>(
  name: C,
  input: AcademicRecordInput<C>,
): Promise<string> {
  const validated = academicSchemas[name].parse(input);
  const reference = await addDoc(collection(database(), name), {
    ...validated,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return reference.id;
}

export async function updateAcademicRecord<C extends AcademicCollection>(
  name: C,
  id: string,
  input: AcademicRecordInput<C>,
): Promise<void> {
  const validated = academicSchemas[name].parse(input);
  await updateDoc(doc(database(), name, id), {
    ...validated,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteAcademicRecord(
  name: AcademicCollection,
  id: string,
): Promise<void> {
  await deleteDoc(doc(database(), name, id));
}
