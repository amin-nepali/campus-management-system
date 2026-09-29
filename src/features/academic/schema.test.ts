import { describe, expect, it } from 'vitest';
import { academicSchemas } from './schema';

describe('academic record validation', () => {
  it('requires a campus and a valid timezone label', () => {
    expect(
      academicSchemas.campuses.safeParse({
        name: '',
        address: '',
        timezone: '',
        contactEmail: '',
        active: true,
      }).success,
    ).toBe(false);
  });

  it('rejects academic years with an end date before the start date', () => {
    expect(
      academicSchemas.academicYears.safeParse({
        campusId: 'campus-1',
        name: '2026-2027',
        startsOn: '2026-09-01',
        endsOn: '2026-08-31',
        active: true,
      }).success,
    ).toBe(false);
  });

  it('rejects impossible calendar dates and invalid grade levels', () => {
    expect(
      academicSchemas.terms.safeParse({
        campusId: 'campus-1',
        academicYearId: 'year-1',
        name: 'Term 1',
        startsOn: '2026-02-30',
        endsOn: '2026-04-30',
        active: true,
      }).success,
    ).toBe(false);
    expect(
      academicSchemas.classes.safeParse({
        campusId: 'campus-1',
        academicYearId: 'year-1',
        name: 'Grade 21',
        gradeLevel: 21,
        active: true,
      }).success,
    ).toBe(false);
  });
});
