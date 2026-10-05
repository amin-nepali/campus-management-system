import { z } from 'zod';

const requiredText = z.string().trim().min(1, 'This field is required.');
const text = z.string().trim();
const timeString = z.string().refine((value) => {
  if (value === '') return true;
  return /^([01]?\d|2[0-3]):[0-5]\d$/.test(value);
}, 'Enter a valid time (HH:MM).');
const requiredTime = timeString.refine(
  (value) => value !== '',
  'This time is required.',
);
const enabled = z.boolean();

export const weekdays = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export const routineSchemas = {
  routineEntries: z
    .object({
      campusId: requiredText,
      academicYearId: requiredText,
      classId: requiredText,
      sectionId: requiredText,
      subjectId: requiredText,
      teacherId: requiredText,
      weekday: z.enum(weekdays),
      startsAt: requiredTime,
      endsAt: requiredTime,
      room: text.max(40),
      active: enabled,
    })
    .strict(),
} as const;

export const validatedRoutineEntrySchema = routineSchemas.routineEntries.refine(
  (value) => value.endsAt >= value.startsAt,
  {
    message: 'End time must be after start time.',
    path: ['endsAt'],
  },
);

export type RoutineCollection = keyof typeof routineSchemas;
export type RoutineEntry = z.infer<typeof routineSchemas.routineEntries> & {
  id: string;
};
export type RoutineEntryInput = z.input<
  typeof routineSchemas.routineEntries
>;

export const routineCollections = Object.keys(
  routineSchemas,
) as RoutineCollection[];