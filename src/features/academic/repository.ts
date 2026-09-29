import {
  addDoc,
  writeBatch,
  collection,
  deleteDoc,
  doc,
  getDoc,
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

function accessIndexId(parts: string[]): string {
  return parts.join('--');
}

async function saveIndexedAcademicRecord(
  name: 'enrollments' | 'teachingAssignments',
  id: string | null,
  input: Record<string, unknown>,
): Promise<string> {
  const db = database();
  const entries = await getDocs(collection(db, name));
  const existing = id
    ? entries.docs.find((entry) => entry.id === id)
    : undefined;
  const recordRef = id ? doc(db, name, id) : doc(collection(db, name));
  const candidates = entries.docs
    .filter((entry) => entry.id !== id)
    .map((entry) => ({ id: entry.id, data: entry.data() }));
  candidates.push({ id: recordRef.id, data: input });

  const previousData = existing?.data();
  const affectedKeys = new Set<string>();
  const groupKey = (data: Record<string, unknown> | undefined) => {
    if (!data) return null;
    if (name === 'enrollments') {
      return [
        data['studentId'],
        data['academicYearId'],
        data['classId'],
        data['sectionId'],
      ].join('|');
    }
    return [
      data['teacherId'],
      data['academicYearId'],
      data['classId'],
      data['sectionId'],
      data['subjectId'],
    ].join('|');
  };
  const previousKey = groupKey(previousData);
  const nextKey = groupKey(input);
  if (previousKey) affectedKeys.add(previousKey);
  if (nextKey) affectedKeys.add(nextKey);

  const indexEntries = new Map<string, Record<string, unknown>>();
  for (const key of affectedKeys) {
    const group = candidates.filter((entry) => groupKey(entry.data) === key);
    const representative =
      group[0]?.data ?? (key === previousKey ? previousData : input);
    if (!representative) continue;

    if (name === 'enrollments') {
      const studentId = String(representative['studentId']);
      const studentSnapshot = await getDoc(doc(db, 'students', studentId));
      const studentUserId = studentSnapshot.data()?.['userId'];
      if (typeof studentUserId !== 'string' || !studentUserId) continue;
      const sectionSnapshot = await getDoc(
        doc(db, 'sections', String(representative['sectionId'])),
      );
      const active = group.some((entry) => entry.data['status'] === 'active');
      const fields = {
        campusId: String(representative['campusId']),
        academicYearId: String(representative['academicYearId']),
        classId: String(representative['classId']),
        sectionId: String(representative['sectionId']),
        sectionName: String(
          sectionSnapshot.data()?.['name'] ?? representative['sectionId'],
        ),
        studentId,
        studentName: String(studentSnapshot.data()?.['fullName'] ?? ''),
        studentUserId,
        active,
      };
      indexEntries.set(
        `studentClassAccess/${accessIndexId([studentUserId, fields.academicYearId, fields.classId, fields.sectionId])}`,
        fields,
      );
    } else {
      const teacherId = String(representative['teacherId']);
      const teacherSnapshot = await getDoc(doc(db, 'teachers', teacherId));
      const teacherUid = teacherSnapshot.data()?.['userId'];
      if (typeof teacherUid !== 'string' || !teacherUid) continue;
      const sectionId = String(representative['sectionId']);
      const sectionSnapshot = await getDoc(doc(db, 'sections', sectionId));
      const active = group.some((entry) => entry.data['active'] === true);
      const fields = {
        campusId: String(representative['campusId']),
        academicYearId: String(representative['academicYearId']),
        classId: String(representative['classId']),
        sectionId,
        sectionName: String(sectionSnapshot.data()?.['name'] ?? sectionId),
        subjectId: String(representative['subjectId']),
        teacherUid,
        active,
      };
      indexEntries.set(
        `teachingAssignmentAccess/${accessIndexId([teacherUid, fields.academicYearId, fields.classId, fields.sectionId, fields.subjectId])}`,
        fields,
      );

      const classGroup = candidates.filter(
        ({ data }) =>
          data['teacherId'] === teacherId &&
          data['academicYearId'] === fields.academicYearId &&
          data['classId'] === fields.classId &&
          data['sectionId'] === fields.sectionId,
      );
      const classFields = {
        campusId: fields.campusId,
        academicYearId: fields.academicYearId,
        classId: fields.classId,
        sectionId: fields.sectionId,
        sectionName: fields.sectionName,
        teacherUid,
        active: classGroup.some(({ data }) => data['active'] === true),
      };
      indexEntries.set(
        `teacherClassAccess/${accessIndexId([teacherUid, fields.academicYearId, fields.classId, fields.sectionId])}`,
        classFields,
      );
    }
  }

  const batch = writeBatch(db);
  batch.set(
    recordRef,
    {
      ...input,
      ...(existing ? {} : { createdAt: serverTimestamp() }),
      updatedAt: serverTimestamp(),
    },
    { merge: Boolean(existing) },
  );
  for (const [path, data] of indexEntries) {
    const [collectionName, indexId] = path.split('/');
    if (collectionName && indexId) {
      batch.set(doc(db, collectionName, indexId), data);
    }
  }
  await batch.commit();
  return recordRef.id;
}

async function deleteIndexedAcademicRecord(
  name: 'enrollments' | 'teachingAssignments',
  id: string,
): Promise<void> {
  const db = database();
  const entries = await getDocs(collection(db, name));
  const existing = entries.docs.find((entry) => entry.id === id);
  if (!existing) return;

  const candidates = entries.docs
    .filter((entry) => entry.id !== id)
    .map((entry) => ({ id: entry.id, data: entry.data() }));
  const oldData = existing.data();
  const batch = writeBatch(db);
  const updatedIndexes = await getIndexesForGroup(name, oldData, candidates);
  batch.delete(existing.ref);
  for (const updatedIndex of updatedIndexes) {
    batch.set(
      doc(db, updatedIndex.collection, updatedIndex.id),
      updatedIndex.data,
    );
  }
  await batch.commit();
}

async function getIndexesForGroup(
  name: 'enrollments' | 'teachingAssignments',
  previous: Record<string, unknown>,
  candidates: Array<{ id: string; data: Record<string, unknown> }>,
): Promise<
  Array<{
    collection: string;
    id: string;
    data: Record<string, unknown>;
  }>
> {
  if (name === 'enrollments') {
    const studentId = String(previous['studentId']);
    const student = await getDoc(doc(database(), 'students', studentId));
    const studentUserId = student.data()?.['userId'];
    if (typeof studentUserId !== 'string' || !studentUserId) return [];
    const academicYearId = String(previous['academicYearId']);
    const classId = String(previous['classId']);
    const sectionId = String(previous['sectionId']);
    const sectionSnapshot = await getDoc(
      doc(database(), 'sections', sectionId),
    );
    const studentName = String(student.data()?.['fullName'] ?? '');
    const active = candidates.some(
      ({ data }) =>
        data['studentId'] === studentId &&
        data['academicYearId'] === academicYearId &&
        data['classId'] === classId &&
        data['sectionId'] === sectionId &&
        data['status'] === 'active',
    );
    return [
      {
        collection: 'studentClassAccess',
        id: accessIndexId([studentUserId, academicYearId, classId, sectionId]),
        data: {
          campusId: String(previous['campusId']),
          academicYearId,
          classId,
          sectionId,
          sectionName: String(sectionSnapshot.data()?.['name'] ?? sectionId),
          studentId,
          studentName,
          studentUserId,
          active,
        },
      },
    ];
  }

  const teacherId = String(previous['teacherId']);
  const teacher = await getDoc(doc(database(), 'teachers', teacherId));
  const teacherUid = teacher.data()?.['userId'];
  if (typeof teacherUid !== 'string' || !teacherUid) return [];
  const academicYearId = String(previous['academicYearId']);
  const classId = String(previous['classId']);
  const sectionId = String(previous['sectionId']);
  const subjectId = String(previous['subjectId']);
  const sectionSnapshot = await getDoc(doc(database(), 'sections', sectionId));
  const active = candidates.some(
    ({ data }) =>
      data['teacherId'] === teacherId &&
      data['academicYearId'] === academicYearId &&
      data['classId'] === classId &&
      data['sectionId'] === sectionId &&
      data['subjectId'] === subjectId &&
      data['active'] === true,
  );
  const sectionName = String(sectionSnapshot.data()?.['name'] ?? sectionId);
  const commonData = {
    campusId: String(previous['campusId']),
    academicYearId,
    classId,
    sectionId,
    sectionName,
    teacherUid,
  };
  const classActive = candidates.some(
    ({ data }) =>
      data['teacherId'] === teacherId &&
      data['academicYearId'] === academicYearId &&
      data['classId'] === classId &&
      data['sectionId'] === sectionId &&
      data['active'] === true,
  );
  return [
    {
      collection: 'teachingAssignmentAccess',
      id: accessIndexId([
        teacherUid,
        academicYearId,
        classId,
        sectionId,
        subjectId,
      ]),
      data: {
        ...commonData,
        subjectId,
        active,
      },
    },
    {
      collection: 'teacherClassAccess',
      id: accessIndexId([teacherUid, academicYearId, classId, sectionId]),
      data: {
        ...commonData,
        active: classActive,
      },
    },
  ];
}

export async function rebuildAcademicAccessIndexes(): Promise<void> {
  const db = database();
  const [
    enrollments,
    teachingAssignments,
    students,
    teachers,
    sections,
    oldStudentIndexes,
    oldTeacherIndexes,
    oldTeacherClassIndexes,
  ] = await Promise.all([
    getDocs(collection(db, 'enrollments')),
    getDocs(collection(db, 'teachingAssignments')),
    getDocs(collection(db, 'students')),
    getDocs(collection(db, 'teachers')),
    getDocs(collection(db, 'sections')),
    getDocs(collection(db, 'studentClassAccess')),
    getDocs(collection(db, 'teachingAssignmentAccess')),
    getDocs(collection(db, 'teacherClassAccess')),
  ]);
  const studentProfiles = new Map(
    students.docs.map((entry) => [entry.id, entry.data()]),
  );
  const studentUsers = new Map(
    students.docs.map((entry) => [entry.id, entry.data()['userId']]),
  );
  const teacherUsers = new Map(
    teachers.docs.map((entry) => [entry.id, entry.data()['userId']]),
  );
  const sectionNames = new Map(
    sections.docs.map((entry) => [entry.id, entry.data()['name']]),
  );
  const studentIndexes = new Map<string, Record<string, unknown>>();
  const teacherIndexes = new Map<string, Record<string, unknown>>();
  const teacherClassIndexes = new Map<string, Record<string, unknown>>();

  for (const enrollment of enrollments.docs) {
    const value = enrollment.data();
    const studentId = String(value['studentId'] ?? '');
    const studentUserId = studentUsers.get(studentId);
    if (typeof studentUserId !== 'string' || !studentUserId) continue;
    const academicYearId = String(value['academicYearId'] ?? '');
    const classId = String(value['classId'] ?? '');
    const sectionId = String(value['sectionId'] ?? '');
    const id = accessIndexId([
      studentUserId,
      academicYearId,
      classId,
      sectionId,
    ]);
    const previous = studentIndexes.get(id);
    studentIndexes.set(id, {
      campusId: String(value['campusId'] ?? ''),
      academicYearId,
      classId,
      sectionId,
      sectionName: String(sectionNames.get(sectionId) ?? sectionId),
      studentId,
      studentName: String(studentProfiles.get(studentId)?.['fullName'] ?? ''),
      studentUserId,
      active: value['status'] === 'active' || previous?.['active'] === true,
    });
  }

  for (const assignment of teachingAssignments.docs) {
    const value = assignment.data();
    const teacherId = String(value['teacherId'] ?? '');
    const teacherUid = teacherUsers.get(teacherId);
    if (typeof teacherUid !== 'string' || !teacherUid) continue;
    const academicYearId = String(value['academicYearId'] ?? '');
    const classId = String(value['classId'] ?? '');
    const sectionId = String(value['sectionId'] ?? '');
    const subjectId = String(value['subjectId'] ?? '');
    const id = accessIndexId([
      teacherUid,
      academicYearId,
      classId,
      sectionId,
      subjectId,
    ]);
    const previous = teacherIndexes.get(id);
    teacherIndexes.set(id, {
      campusId: String(value['campusId'] ?? ''),
      academicYearId,
      classId,
      sectionId,
      sectionName: String(sectionNames.get(sectionId) ?? sectionId),
      subjectId,
      teacherUid,
      active: value['active'] === true || previous?.['active'] === true,
    });
    const classIdKey = accessIndexId([
      teacherUid,
      academicYearId,
      classId,
      sectionId,
    ]);
    const priorClass = teacherClassIndexes.get(classIdKey);
    teacherClassIndexes.set(classIdKey, {
      campusId: String(value['campusId'] ?? ''),
      academicYearId,
      classId,
      sectionId,
      sectionName: String(sectionNames.get(sectionId) ?? sectionId),
      teacherUid,
      active: value['active'] === true || priorClass?.['active'] === true,
    });
  }

  for (const entry of oldStudentIndexes.docs) {
    if (!studentIndexes.has(entry.id)) {
      studentIndexes.set(entry.id, { ...entry.data(), active: false });
    }
  }
  for (const entry of oldTeacherIndexes.docs) {
    if (!teacherIndexes.has(entry.id)) {
      teacherIndexes.set(entry.id, { ...entry.data(), active: false });
    }
  }
  for (const entry of oldTeacherClassIndexes.docs) {
    if (!teacherClassIndexes.has(entry.id)) {
      teacherClassIndexes.set(entry.id, { ...entry.data(), active: false });
    }
  }

  let batch = writeBatch(db);
  let pending = 0;
  async function flush() {
    if (!pending) return;
    await batch.commit();
    batch = writeBatch(db);
    pending = 0;
  }
  for (const [id, value] of studentIndexes) {
    batch.set(doc(db, 'studentClassAccess', id), value);
    pending += 1;
    if (pending === 450) await flush();
  }
  for (const [id, value] of teacherIndexes) {
    batch.set(doc(db, 'teachingAssignmentAccess', id), value);
    pending += 1;
    if (pending === 450) await flush();
  }
  for (const [id, value] of teacherClassIndexes) {
    batch.set(doc(db, 'teacherClassAccess', id), value);
    pending += 1;
    if (pending === 450) await flush();
  }
  await flush();
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
  if (name === 'enrollments' || name === 'teachingAssignments') {
    return saveIndexedAcademicRecord(
      name,
      null,
      validated as Record<string, unknown>,
    );
  }
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
  if (name === 'enrollments' || name === 'teachingAssignments') {
    await saveIndexedAcademicRecord(
      name,
      id,
      validated as Record<string, unknown>,
    );
    return;
  }
  await updateDoc(doc(database(), name, id), {
    ...validated,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteAcademicRecord(
  name: AcademicCollection,
  id: string,
): Promise<void> {
  if (name === 'enrollments' || name === 'teachingAssignments') {
    await deleteIndexedAcademicRecord(name, id);
    return;
  }
  await deleteDoc(doc(database(), name, id));
}
