import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
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
import { type User } from '../../types/user';
import { profileFromData } from './profileUtils';

interface AuthContextValue {
  authUser: FirebaseUser | null;
  user: User | null;
  loading: boolean;
  profileError: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOutUser: () => Promise<void>;
  updateUserProfile: (updates: Partial<Omit<User, 'id' | 'authUid' | 'campusIds' | 'role' | 'status'>>) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

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

        const profile = profileFromData(
          firebaseUser.uid,
          profileSnapshot.data(),
        );
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

  async function updateUserProfile(updates: Partial<Omit<User, 'id' | 'authUid' | 'campusIds' | 'role' | 'status'>>) {
    if (!firebaseAuth || !firestoreDb) {
      throw new Error('Firestore is not available.');
    }
    const uid = authUser?.uid ?? user?.authUid;
    if (!uid) {
      throw new Error('No authenticated user.');
    }
    const userRef = doc(firestoreDb, 'users', uid);
    await updateDoc(userRef, updates);
    // Update local state
    setUser(prev => prev ? { ...prev, ...updates } : null);
  }

  return (
    <AuthContext.Provider
      value={{ authUser, user, loading, profileError, signIn, signOutUser, updateUserProfile }}
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