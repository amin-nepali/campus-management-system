import { describe, expect, it } from 'vitest';
import { getBootstrapProfile } from './AuthProvider';

describe('admin profile bootstrapping', () => {
  it('creates an active admin profile for the provided administrator login', () => {
    const profile = getBootstrapProfile({
      uid: 'admin-seeded-user',
      email: 'aminnepali987@gmail.com',
      displayName: 'Campus Administrator',
      phoneNumber: '+977-9800000000',
      photoURL: 'https://example.com/avatar.png',
    } as any);

    expect(profile).toMatchObject({
      id: 'admin-seeded-user',
      authUid: 'admin-seeded-user',
      role: 'admin',
      email: 'aminnepali987@gmail.com',
      status: 'active',
      campusIds: [],
      displayName: 'Campus Administrator',
    });
  });
});
