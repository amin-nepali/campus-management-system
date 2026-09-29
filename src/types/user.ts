export const userRoles = ['student', 'teacher', 'parent', 'admin'] as const;

export type UserRole = (typeof userRoles)[number];
export type UserStatus = 'invited' | 'active' | 'disabled';

export interface User {
  id: string;
  authUid: string;
  role: UserRole;
  campusIds: string[];
  displayName: string;
  email: string;
  phone?: string;
  photoUrl?: string;
  status: UserStatus;
}

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && userRoles.includes(value as UserRole);
}