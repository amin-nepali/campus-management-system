import type { UserRole } from '../types/user';

export interface NavigationItem {
  label: string;
  path: string;
}

const navigationByRole: Record<UserRole, NavigationItem[]> = {
  student: [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Routine', path: '/routine' },
    { label: 'Attendance', path: '/attendance' },
    { label: 'Notes', path: '/notes' },
    { label: 'Assignments', path: '/assignments' },
    { label: 'Notices', path: '/notices' },
    { label: 'Fees', path: '/fees' },
    { label: 'Profile', path: '/profile' },
  ],
  teacher: [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'My Classes', path: '/my-classes' },
    { label: 'Attendance', path: '/attendance' },
    { label: 'Notes', path: '/notes' },
    { label: 'Assignments', path: '/assignments' },
    { label: 'Notices', path: '/notices' },
    { label: 'Students', path: '/students' },
    { label: 'Profile', path: '/profile' },
  ],
  parent: [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'My Children', path: '/my-children' },
    { label: 'Attendance', path: '/attendance' },
    { label: 'Routine', path: '/routine' },
    { label: 'Assignments', path: '/assignments' },
    { label: 'Notices', path: '/notices' },
    { label: 'Fees', path: '/fees' },
    { label: 'Profile', path: '/profile' },
  ],
  admin: [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Users', path: '/users' },
    { label: 'Students', path: '/students' },
    { label: 'Teachers', path: '/teachers' },
    { label: 'Parents', path: '/parents' },
    { label: 'Academic Setup', path: '/academic-setup' },
    { label: 'Classes & Sections', path: '/classes-sections' },
    { label: 'Subjects', path: '/subjects' },
    { label: 'Routine', path: '/routine' },
    { label: 'Attendance Reports', path: '/attendance-reports' },
    { label: 'Notes & Assignments', path: '/notes-assignments' },
    { label: 'Notices', path: '/notices' },
    { label: 'Fees & Payments', path: '/fees-payments' },
    { label: 'Audit Log', path: '/audit-log' },
    { label: 'Settings', path: '/settings' },
  ],
};

export function getNavigationForRole(role: UserRole): NavigationItem[] {
  return navigationByRole[role];
}