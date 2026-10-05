import { isUserRole, type User } from '../../types/user';

export function profileFromData(
  id: string,
  data: Record<string, unknown>,
): User | null {
  const role = data['role'];
  const displayName = data['displayName'];
  const email = data['email'];
  const status = data['status'];
  const campusIds = data['campusIds'];

  if (
    !isUserRole(role) ||
    typeof displayName !== 'string' ||
    typeof email !== 'string'
  ) {
    return null;
  }

  if (status !== 'active' && status !== 'invited' && status !== 'disabled') {
    return null;
  }

  return {
    id,
    authUid: id,
    role,
    campusIds: Array.isArray(campusIds)
      ? campusIds.filter(
          (campusId): campusId is string => typeof campusId === 'string',
        )
      : [],
    displayName,
    email,
    phone: typeof data['phone'] === 'string' ? data['phone'] : undefined,
    photoUrl:
      typeof data['photoUrl'] === 'string' ? data['photoUrl'] : undefined,
    status,
  };
}