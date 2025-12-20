import { create } from 'zustand';
import { User } from 'firebase/auth';
import { auth } from '../services/firebaseService';
import { onAuthStateChanged } from 'firebase/auth';
import { getUserProfile, UserProfile } from '../services/authService';

interface AuthStore {
  user: User | null;
  userProfile: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  isInitialized: boolean;
  setUser: (user: User | null) => void;
  setUserProfile: (profile: UserProfile | null) => void;
  setError: (error: string | null) => void;
  initializeAuth: () => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  userProfile: null,
  isLoading: true,
  error: null,
  isInitialized: false,

  setUser: (user) => set({ user }),
  setUserProfile: (profile) => set({ userProfile: profile }),
  setError: (error) => set({ error }),

  initializeAuth: () => {
    if (get().isInitialized) return;

    set({ isLoading: true });

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (user) {
          set({ user });
          const profile = await getUserProfile(user.uid);
          set({ userProfile: profile });
        } else {
          set({ user: null, userProfile: null });
        }
      } catch (error: any) {
        set({ error: error.message });
      } finally {
        set({ isLoading: false, isInitialized: true });
      }
    });

    return unsubscribe;
  },

  clearAuth: () => {
    set({ user: null, userProfile: null, error: null });
  },
}));
