import { z } from 'zod';

const requiredText = z.string().trim().min(1, 'This field is required.');
const text = z.string().trim();
const email = z.union([z.literal(''), z.string().trim().email()]);
const date = z.string().refine((value) => {
  if (value === '') return true;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(parsed.valueOf()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}, 'Enter a valid date.');
const requiredDate = date.refine(
  (value) => value !== '',
  'This date is required.',
);
const enabled = z.boolean();

export const academicSchemas = {
  campuses: z
    .object({
      name: requiredText.max(120),
      address: text.max(300),
      timezone: requiredText.max(80),
      contactEmail: email,
      active: enabled,
    })
    .strict(),
  academicYears: z
    .object({
      campusId: requiredText,
      name: requiredText.max(80),
      startsOn: requiredDate,
      endsOn: requiredDate,
      active: enabled,
    })
    .strict()
    .refine(
      (value) =>
        value.startsOn === '' ||
        value.endsOn === '' ||
        value.endsOn >= value.startsOn,
      {
        message: 'End date must be on or after the start date.',
        path: ['endsOn'],
      },
    ),
  terms: z
    .object({
      campusId: requiredText,
      academicYearId: requiredText,
      name: requiredText.max(80),
      startsOn: requiredDate,
      endsOn: requiredDate,
      active: enabled,
    })
    .strict()
    .refine(
      (value) =>
        value.startsOn === '' ||
        value.endsOn === '' ||
        value.endsOn >= value.startsOn,
      {
        message: 'End date must be on or after the start date.',
        path: ['endsOn'],
      },
    ),
  classes: z
    .object({
      campusId: requiredText,
      academicYearId: requiredText,
      name: requiredText.max(80),
      gradeLevel: z.number().int().min(0).max(20),
      active: enabled,
    })
    .strict(),
  sections: z
    .object({
      campusId: requiredText,
      classId: requiredText,
      name: requiredText.max(40),
      active: enabled,
    })
    .strict(),
  subjects: z
    .object({
      campusId: requiredText,
      name: requiredText.max(100),
      code: requiredText.max(24),
      active: enabled,
    })
    .strict(),
  students: z
    .object({
      campusId: requiredText,
      userId: requiredText,
      admissionNumber: requiredText.max(40),
      fullName: requiredText.max(120),
      dateOfBirth: date,
      address: text.max(300),
      guardianSummary: text.max(300),
      active: enabled,
    })
    .strict(),
  teachers: z
    .object({
      campusId: requiredText,
      userId: requiredText,
      employeeNumber: requiredText.max(40),
      fullName: requiredText.max(120),
      active: enabled,
    })
    .strict(),
  enrollments: z
    .object({
      campusId: requiredText,
      academicYearId: requiredText,
      termId: requiredText,
      studentId: requiredText,
      classId: requiredText,
      sectionId: requiredText,
      status: z.enum(['active', 'withdrawn', 'completed']),
    })
    .strict(),
  teachingAssignments: z
    .object({
      campusId: requiredText,
      academicYearId: requiredText,
      teacherId: requiredText,
      classId: requiredText,
      sectionId: requiredText,
      subjectId: requiredText,
      active: enabled,
    })
    .strict(),
} as const;

export type AcademicCollection = keyof typeof academicSchemas;
export type AcademicRecord<C extends AcademicCollection> = z.infer<
  (typeof academicSchemas)[C]
> & {
  id: string;
};
export type AcademicRecordInput<C extends AcademicCollection> = z.input<
  (typeof academicSchemas)[C]
>;

export const academicCollections = Object.keys(
  academicSchemas,
) as AcademicCollection[];
