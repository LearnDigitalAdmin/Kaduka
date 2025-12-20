import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  ConfirmationResult,
  User,
  updateProfile,
  Auth,
} from 'firebase/auth';
import { auth, db } from './firebaseService';
import { doc, setDoc, getDoc } from 'firebase/firestore';

export interface UserProfile {
  uid: string;
  email?: string;
  phone?: string;
  name: string;
  createdAt: number;
  lastLogin: number;
}

/**
 * Create a new user account with email and password
 */
export const signUpWithEmail = async (
  email: string,
  password: string,
  name: string
): Promise<User> => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Update profile
    await updateProfile(user, { displayName: name });

    // Create user profile in Firestore
    const userProfile: UserProfile = {
      uid: user.uid,
      email: user.email || '',
      name,
      createdAt: Math.floor(Date.now() / 1000),
      lastLogin: Math.floor(Date.now() / 1000),
    };

    await setDoc(doc(db, 'users', user.uid), userProfile);

    return user;
  } catch (error: any) {
    console.error('Error signing up:', error);
    throw new Error(error.message || 'Failed to create account');
  }
};

/**
 * Sign in with email and password
 */
export const signInWithEmail = async (
  email: string,
  password: string
): Promise<User> => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Update last login
    await setDoc(
      doc(db, 'users', user.uid),
      {
        lastLogin: Math.floor(Date.now() / 1000),
      },
      { merge: true }
    );

    return user;
  } catch (error: any) {
    console.error('Error signing in:', error);
    throw new Error(error.message || 'Failed to sign in');
  }
};

/**
 * Sign out the current user
 */
export const signOutUser = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch (error: any) {
    console.error('Error signing out:', error);
    throw new Error(error.message || 'Failed to sign out');
  }
};

/**
 * Get user profile from Firestore
 */
export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  try {
    const docSnap = await getDoc(doc(db, 'users', uid));
    if (docSnap.exists()) {
      return docSnap.data() as UserProfile;
    }
    return null;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    throw error;
  }
};

/**
 * Initialize phone authentication (setup recaptcha)
 */
export const initializePhoneAuth = (
  elementId: string = 'recaptcha-container'
): RecaptchaVerifier => {
  try {
    const verifier = new RecaptchaVerifier(auth, elementId, {
      size: 'invisible',
      callback: (response) => {
        console.log('ReCAPTCHA verified');
      },
    });

    return verifier;
  } catch (error) {
    console.error('Error initializing ReCAPTCHA:', error);
    throw error;
  }
};

/**
 * Sign in or sign up with phone number
 */
export const signInWithPhone = async (
  phoneNumber: string,
  verifier: RecaptchaVerifier
): Promise<ConfirmationResult> => {
  try {
    const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, verifier);
    return confirmationResult;
  } catch (error: any) {
    console.error('Error signing in with phone:', error);
    throw new Error(error.message || 'Failed to send verification code');
  }
};

/**
 * Confirm phone verification code
 */
export const confirmPhoneCode = async (
  confirmationResult: ConfirmationResult,
  code: string
): Promise<User> => {
  try {
    const userCredential = await confirmationResult.confirm(code);
    const user = userCredential.user;

    // Check if user profile exists, if not create it
    const existingProfile = await getUserProfile(user.uid);
    if (!existingProfile) {
      const userProfile: UserProfile = {
        uid: user.uid,
        phone: user.phoneNumber || '',
        name: user.displayName || 'User',
        createdAt: Math.floor(Date.now() / 1000),
        lastLogin: Math.floor(Date.now() / 1000),
      };
      await setDoc(doc(db, 'users', user.uid), userProfile);
    } else {
      // Update last login
      await setDoc(
        doc(db, 'users', user.uid),
        {
          lastLogin: Math.floor(Date.now() / 1000),
        },
        { merge: true }
      );
    }

    return user;
  } catch (error: any) {
    console.error('Error confirming phone code:', error);
    throw new Error(error.message || 'Failed to verify code');
  }
};

/**
 * Get current authenticated user
 */
export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};
