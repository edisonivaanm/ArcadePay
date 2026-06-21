import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loginWithEmail, loginWithGoogle } from '../firebase/auth';
import { getUserDocument, createUserDocument, isUsernameAvailable } from '../firebase/firestore';
import '../styles/auth.css';

const ROLE_ROUTES = { root: '/root', admin: '/admin', general: '/dashboard' };

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const cred = await loginWithEmail(email, password);
      const profile = await getUserDocument(cred.user.uid);
      navigate(ROLE_ROUTES[profile?.rol] || '/login');
    } catch (err) {
      setError(getFirebaseError(err.code));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoadingGoogle(true);
    try {
      const cred = await loginWithGoogle();
      let profile = await getUserDocument(cred.user.uid);
      // If Google user has no Firestore doc yet, create one
      if (!profile) {
        const names = (cred.user.displayName || '').split(' ');
        // Build base username from email, ensure it's unique
        let baseUser = cred.user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9._]/g, '');
        const available = await isUsernameAvailable(baseUser);
        if (!available) baseUser = `${baseUser}${Date.now().toString().slice(-4)}`;
        await createUserDocument(cred.user.uid, {
          nombre: names[0] || '',
          apellido: names.slice(1).join(' ') || '',
          usuario: baseUser,
          email: cred.user.email,
          phone_number: cred.user.phoneNumber || '',
        });
        profile = await getUserDocument(cred.user.uid);
      }
      navigate(ROLE_ROUTES[profile?.rol] || '/login');
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setError(getFirebaseError(err.code));
      }
    } finally {
      setLoadingGoogle(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card card">
        {/* Logo */}
        <div className="auth-logo">
          <div className="auth-logo__icon">🕹️</div>
          <h1 className="auth-logo__title text-gradient">ARCADEPAY</h1>
          <p className="auth-logo__subtitle">Inicia sesión para continuar</p>
        </div>

        {/* Error */}
        {error && <div className="alert alert--error">{error}</div>}

        {/* Form */}
        <form onSubmit={handleEmailLogin}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">Correo electrónico</label>
            <div className="input-icon-wrapper">
              <span className="input-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </span>
              <input
                id="email"
                type="email"
                className="form-input form-input--with-icon"
                placeholder="Ingresa tu correo"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Contraseña</label>
            <div className="password-wrapper">
              <span className="input-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </span>
              <input
                id="password"
                type={showPass ? 'text' : 'password'}
                className="form-input form-input--with-icon"
                placeholder="Ingresa tu contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                style={{ paddingRight: '2.75rem' }}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPass(!showPass)}
                aria-label={showPass ? 'Ocultar contraseña' : 'Ver contraseña'}
              >
                {showPass ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <div className="forgot-link">
            <Link to="/forgot-password">¿Olvidaste tu contraseña?</Link>
          </div>

          <button
            id="btn-login-email"
            type="submit"
            className="btn btn--primary btn--full"
            disabled={loading}
          >
            {loading ? <span className="spinner" /> : 'Iniciar sesión'}
          </button>
        </form>

        <div className="divider">o continúa con</div>

        <button
          id="btn-login-google"
          type="button"
          className="btn btn--google btn--full"
          onClick={handleGoogleLogin}
          disabled={loadingGoogle}
        >
          {loadingGoogle ? (
            <span className="spinner" />
          ) : (
            <>
              <GoogleIcon />
              Iniciar sesión con Google
            </>
          )}
        </button>

        <div className="auth-footer">
          ¿No tienes cuenta?{' '}
          <Link to="/register">Regístrate aquí</Link>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.859-3.048.859-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
      <path d="M3.964 10.706A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

function getFirebaseError(code) {
  const errors = {
    'auth/user-not-found':      'No existe una cuenta con ese correo.',
    'auth/wrong-password':      'Contraseña incorrecta.',
    'auth/invalid-email':       'El correo no tiene un formato válido.',
    'auth/too-many-requests':   'Demasiados intentos. Espera un momento.',
    'auth/user-disabled':       'Esta cuenta ha sido desactivada.',
    'auth/invalid-credential':  'Correo o contraseña incorrectos.',
    'auth/network-request-failed': 'Error de red. Verifica tu conexión.',
  };
  return errors[code] || 'Ocurrió un error. Intenta de nuevo.';
}
