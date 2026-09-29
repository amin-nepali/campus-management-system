import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from 'react';
import {
  firebaseAuth,
  firebaseConfigError,
  firestoreDb,
} from '../../lib/firebase';
import { isUserRole, type User } from '../../types/user';

interface AuthContextValue {
  authUser: FirebaseUser | null;
  user: User | null;
  loading: boolean;
  profileError: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

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

export function AuthProvider({ children }: PropsWithChildren) {
  const [authUser, setAuthUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    const auth = firebaseAuth;
    const db = firestoreDb;
    if (!auth || !db) {
      setLoading(false);
      return;
    }

    return onAuthStateChanged(auth, async (firebaseUser) => {
      setAuthUser(firebaseUser);
      setUser(null);
      setProfileError(null);

      if (!firebaseUser) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const profileRef = doc(db, 'users', firebaseUser.uid);
        const profileSnapshot = await getDoc(profileRef);

        if (!profileSnapshot.exists()) {
          setProfileError(
            'Your account profile is not set up. Contact a campus administrator.',
          );
          return;
        }

        const profile = profileFromData(firebaseUser.uid, profileSnapshot.data());
        if (!profile) {
          setProfileError(
            'Your account profile is incomplete. Contact a campus administrator.',
          );
        } else if (profile.status !== 'active') {
          setProfileError(
            'Your account is not active. Contact a campus administrator.',
          );
        } else {
          setUser(profile);
        }
      } catch {
        setProfileError(
          'Your account profile could not be loaded. Please try again.',
        );
      } finally {
        setLoading(false);
      }
    });
  }, []);

  async function signIn(email: string, password: string) {
    if (!firebaseAuth) {
      throw new Error(
        firebaseConfigError ?? 'Firebase Authentication is unavailable.',
      );
    }
    await signInWithEmailAndPassword(firebaseAuth, email, password);
  }

  async function signOutUser() {
    if (!firebaseAuth) {
      return;
    }
    await signOut(firebaseAuth);
  }

  return (
    <AuthContext.Provider
      value={{ authUser, user, loading, profileError, signIn, signOutUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }
  return context;
}
