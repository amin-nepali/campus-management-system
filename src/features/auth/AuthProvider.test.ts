import { describe, expect, it } from 'vitest';
import { profileFromData } from './profileUtils';

describe('Firestore profile parsing', () => {
  it('accepts a provisioned active administrator profile', () => {
    const profile = profileFromData('admin-seeded-user', {
      role: 'admin',
      displayName: 'Campus Administrator',
      email: 'admin@example.invalid',
      status: 'active',
      campusIds: [],
    });

    expect(profile).toMatchObject({
      id: 'admin-seeded-user',
      authUid: 'admin-seeded-user',
      role: 'admin',
      email: 'admin@example.invalid',
      status: 'active',
      campusIds: [],
      displayName: 'Campus Administrator',
    });
  });

  it('rejects incomplete profiles instead of inferring roles from email', () => {
    expect(
      profileFromData('unprovisioned-user', {
        email: 'admin@example.invalid',
        displayName: 'Administrator',
      }),
    ).toBeNull();
  });
});
