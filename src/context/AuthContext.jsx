import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { onSnapshot, doc } from 'firebase/firestore';
import { auth } from '../firebase/config';
import { db } from '../firebase/config';
import { updateUserDocument } from '../firebase/firestore';
import { logout } from '../firebase/auth';

const AuthContext = createContext(null);

const SESSION_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const SESSION_KEY = 'arcadepay_session_start';

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser]   = useState(null);
  const [userProfile, setUserProfile]   = useState(null);
  // loading only blocks the UI once on the very first auth check
  const [loading, setLoading]           = useState(true);
  const sessionTimerRef                 = useRef(null);

  // ── Session timeout helpers ────────────────────────────────────────────────
  const clearSessionTimer = () => {
    if (sessionTimerRef.current) {
      clearTimeout(sessionTimerRef.current);
      sessionTimerRef.current = null;
    }
  };

  const startSessionTimer = (remainingMs) => {
    clearSessionTimer();
    sessionTimerRef.current = setTimeout(async () => {
      sessionStorage.removeItem(SESSION_KEY);
      await logout();
    }, remainingMs);
  };

  const initSession = () => {
    const now = Date.now();
    const stored = sessionStorage.getItem(SESSION_KEY);

    if (stored) {
      // Existing session — check if still valid
      const elapsed = now - parseInt(stored, 10);
      if (elapsed >= SESSION_DURATION_MS) {
        // Already expired — force logout
        sessionStorage.removeItem(SESSION_KEY);
        logout();
        return false; // caller should not proceed
      }
      // Resume with remaining time
      startSessionTimer(SESSION_DURATION_MS - elapsed);
    } else {
      // New session
      sessionStorage.setItem(SESSION_KEY, String(now));
      startSessionTimer(SESSION_DURATION_MS);
    }
    return true;
  };

  const endSession = () => {
    clearSessionTimer();
    sessionStorage.removeItem(SESSION_KEY);
  };

  // ── Auth listener ──────────────────────────────────────────────────────────
  useEffect(() => {
    let unsubProfile = null;

    const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (unsubProfile) { unsubProfile(); unsubProfile = null; }

      if (firebaseUser) {
        // Check / start 30-min session
        const sessionOk = initSession();
        if (!sessionOk) return; // logout already triggered

        setCurrentUser(firebaseUser);
        updateUserDocument(firebaseUser.uid, { last_login: new Date() }).catch(() => {});

        // Real-time profile listener
        unsubProfile = onSnapshot(
          doc(db, 'users', firebaseUser.uid),
          (snap) => {
            setUserProfile(snap.exists() ? { id: snap.id, ...snap.data() } : null);
            setLoading(false);
          },
          (err) => {
            console.error('[AuthContext] profile listener error:', err);
            setLoading(false);
          }
        );
      } else {
        endSession();
        setCurrentUser(null);
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubAuth();
      if (unsubProfile) unsubProfile();
      clearSessionTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = { currentUser, userProfile, setUserProfile, loading };

  return (
    <AuthContext.Provider value={value}>
      {/*
        Always render children — never unmount them during loading.
        This prevents form fields from being cleared when the auth
        state resolves. Instead, show a full-screen splash overlay.
      */}
      {children}
      {loading && <LoadingSplash />}
    </AuthContext.Provider>
  );
}

function LoadingSplash() {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'var(--color-bg)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: '1.25rem',
    }}>
      <div style={{ fontSize: '2.5rem' }}>🕹️</div>
      <p style={{
        background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        fontWeight: 800, fontSize: '1.5rem', letterSpacing: '0.1em',
      }}>
        ARCADEPAY
      </p>
      <span className="spinner" style={{ width: 28, height: 28 }} />
    </div>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
