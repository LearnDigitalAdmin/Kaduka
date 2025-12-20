import { create } from 'zustand';
import { auth } from '../services/firebaseService';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  User,
  onAuthStateChanged,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult
} from 'firebase/auth';
import { Shop, getUserShops, updateShopProfile } from '../services/shopService';

interface AuthState {
  user: User | null;
  shops: Shop[];
  currentShop: Shop | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  recaptchaVerifier: RecaptchaVerifier | null;
  confirmationResult: ConfirmationResult | null;

  // Actions
  setUser: (user: User | null) => void;
  setShops: (shops: Shop[]) => void;
  setCurrentShop: (shop: Shop | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  loadUserShops: () => Promise<void>;
  initializeAuth: () => Promise<void>;
  setupRecaptcha: (containerId: string) => void;
  signInWithPhone: (phoneNumber: string) => Promise<void>;
  verifyPhoneCode: (code: string) => Promise<void>;
  updateShop: (shopId: string, updates: Partial<Shop>) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  shops: [],
  currentShop: null,
  loading: true,
  error: null,
  isAuthenticated: false,
  recaptchaVerifier: null,
  confirmationResult: null,

  setUser: (user) => set({ user, isAuthenticated: !!user }),

  setShops: (shops) => {
    const currentShop = shops.length > 0 ? shops[0] : null;
    set({ shops, currentShop });
  },

  setCurrentShop: (shop) => set({ currentShop: shop }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error }),

  signIn: async (email: string, password: string) => {
    try {
      set({ loading: true, error: null });
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      set({ user: userCredential.user, isAuthenticated: true });
      await get().loadUserShops();
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to sign in';
      set({ error: errorMessage });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  signUp: async (email: string, password: string) => {
    try {
      set({ loading: true, error: null });
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      set({ user: userCredential.user, isAuthenticated: true });
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to sign up';
      set({ error: errorMessage });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  signOut: async () => {
    try {
      set({ loading: true, error: null });
      await firebaseSignOut(auth);
      set({ user: null, shops: [], currentShop: null, isAuthenticated: false });
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to sign out';
      set({ error: errorMessage });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  loadUserShops: async () => {
    const { user } = get();
    if (!user) return;

    try {
      set({ loading: true, error: null });
      const shops = await getUserShops(user.uid);
      get().setShops(shops);
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to load shops';
      set({ error: errorMessage });
      console.error('Error loading user shops:', error);
    } finally {
      set({ loading: false });
    }
  },

  initializeAuth: async () => {
    return new Promise((resolve) => {
      set({ loading: true });
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        set({ user, isAuthenticated: !!user });
        if (user) {
          await get().loadUserShops();
        }
        set({ loading: false });
        unsubscribe();
        resolve();
      });
    });
  },

  setupRecaptcha: (containerId: string) => {
    const recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
      size: 'invisible',
      callback: () => {
        console.log('reCAPTCHA resolved');
      }
    });
    set({ recaptchaVerifier });
  },

  signInWithPhone: async (phoneNumber: string) => {
    try {
      set({ loading: true, error: null });
      const { recaptchaVerifier } = get();

      if (!recaptchaVerifier) {
        throw new Error('Recaptcha not initialized');
      }

      const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
      set({ confirmationResult });
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to send verification code';
      set({ error: errorMessage });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  verifyPhoneCode: async (code: string) => {
    try {
      set({ loading: true, error: null });
      const { confirmationResult } = get();

      if (!confirmationResult) {
        throw new Error('No confirmation result available');
      }

      const userCredential = await confirmationResult.confirm(code);
      set({ user: userCredential.user, isAuthenticated: true, confirmationResult: null });
      await get().loadUserShops();
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to verify code';
      set({ error: errorMessage });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  updateShop: async (shopId: string, updates: Partial<Shop>) => {
    try {
      set({ loading: true, error: null });
      await updateShopProfile(shopId, updates);

      // Update local state
      const { shops, currentShop } = get();
      const updatedShops = shops.map(shop =>
        shop.id === shopId ? { ...shop, ...updates } : shop
      );
      set({ shops: updatedShops });

      // Update current shop if it's the one being edited
      if (currentShop?.id === shopId) {
        set({ currentShop: { ...currentShop, ...updates } });
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to update shop';
      set({ error: errorMessage });
      throw error;
    } finally {
      set({ loading: false });
    }
  },
}));
