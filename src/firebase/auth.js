import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  confirmPasswordReset,
  verifyPasswordResetCode,
  GoogleAuthProvider,
  signInWithPopup,
  updatePassword,
} from 'firebase/auth';
import { auth } from './config';

const googleProvider = new GoogleAuthProvider();

export const registerWithEmail = (email, password) =>
  createUserWithEmailAndPassword(auth, email, password);

export const loginWithEmail = (email, password) =>
  signInWithEmailAndPassword(auth, email, password);

export const loginWithGoogle = () =>
  signInWithPopup(auth, googleProvider);

export const logout = () => signOut(auth);

// Sends reset email. When APP_URL is set (production), the link redirects
// to our custom /reset-password page so we can enforce our password rules.
export const resetPassword = (email) => {
  const appUrl = import.meta.env.VITE_APP_URL;
  const actionCodeSettings = appUrl
    ? { url: `${appUrl}/reset-password`, handleCodeInApp: true }
    : undefined;
  return sendPasswordResetEmail(auth, email, actionCodeSettings);
};

// Used by the custom /reset-password page
export const verifyResetCode  = (oobCode) => verifyPasswordResetCode(auth, oobCode);
export const confirmNewPassword = (oobCode, newPassword) => confirmPasswordReset(auth, oobCode, newPassword);

export const changePassword = (newPassword) =>
  updatePassword(auth.currentUser, newPassword);
