import { describe, expect, it } from 'vitest';
import { getNavigationForRole } from './navigation';
import { userRoles } from '../types/user';

describe('role-aware navigation', () => {
  it.each(userRoles)('provides a dashboard for %s', (role) => {
    expect(getNavigationForRole(role)[0]).toEqual({
      label: 'Dashboard',
      path: '/dashboard',
    });
  });

  it('does not expose administrator sections to students', () => {
    const studentPaths = getNavigationForRole('student').map((item) => item.path);
    expect(studentPaths).not.toContain('/users');
    expect(studentPaths).not.toContain('/settings');
  });

  it('keeps teacher navigation distinct from parent navigation', () => {
    const teacherPaths = getNavigationForRole('teacher').map((item) => item.path);
    const parentPaths = getNavigationForRole('parent').map((item) => item.path);
    expect(teacherPaths).toContain('/my-classes');
    expect(parentPaths).toContain('/my-children');
    expect(teacherPaths).not.toContain('/my-children');
  });
});