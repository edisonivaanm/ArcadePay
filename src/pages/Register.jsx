import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerWithEmail, loginWithGoogle } from '../firebase/auth';
import {
  createUserDocument,
  getUserDocument,
  isUsernameAvailable,
} from '../firebase/firestore';
import '../styles/auth.css';

// ─── Shared password validator ────────────────────────────────────────────────
function validatePassword(pwd) {
  const errors = [];
  if (pwd.length < 8)      errors.push('Mínimo 8 caracteres');
  if (!/[a-z]/.test(pwd)) errors.push('Al menos una minúscula');
  if (!/[A-Z]/.test(pwd)) errors.push('Al menos una mayúscula');
  if (!/[0-9]/.test(pwd)) errors.push('Al menos un número');
  return errors;
}

function PasswordStrength({ password }) {
  if (!password) return null;
  const errors = validatePassword(password);
  const strength = 4 - errors.length;
  const colors = ['#ef4444', '#f59e0b', '#f59e0b', '#10b981', '#10b981'];
  return (
    <div style={{ marginTop: '0.5rem' }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: '0.35rem' }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{
            flex: 1, height: 4, borderRadius: 2,
            background: i < strength ? colors[strength] : 'var(--color-border)',
            transition: 'background 0.3s',
          }} />
        ))}
      </div>
      {strength < 4
        ? <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            {errors.map((e) => <li key={e}>{e}</li>)}
          </ul>
        : <p style={{ fontSize: '0.75rem', color: '#10b981' }}>✓ Contraseña segura</p>
      }
    </div>
  );
}

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    nombre: '', apellido: '', usuario: '', email: '', password: '', confirm: '',
  });
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    // username: lowercase, no spaces
    setForm((prev) => ({
      ...prev,
      [name]: name === 'usuario' ? value.toLowerCase().replace(/\s/g, '') : value,
    }));
  };

  const validate = () => {
    if (!form.nombre.trim())    return 'El nombre es obligatorio.';
    if (!form.apellido.trim())  return 'El apellido es obligatorio.';
    if (form.usuario.length < 3) return 'El usuario debe tener al menos 3 caracteres.';
    if (!/^[a-z0-9._]+$/.test(form.usuario))
      return 'El usuario solo puede tener letras minúsculas, números, puntos y guiones bajos.';
    if (!form.email.trim())     return 'El correo es obligatorio.';
    const pwdErrors = validatePassword(form.password);
    if (pwdErrors.length > 0)   return `Contraseña insegura: ${pwdErrors.join(', ')}.`;
    if (form.password !== form.confirm) return 'Las contraseñas no coinciden.';
    return null;
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    setLoading(true);
    try {
      // Check username uniqueness
      const available = await isUsernameAvailable(form.usuario);
      if (!available) {
        setError('Ese nombre de usuario ya está en uso. Elige otro.');
        setLoading(false);
        return;
      }

      const cred = await registerWithEmail(form.email.trim(), form.password);
      await createUserDocument(cred.user.uid, {
        nombre: form.nombre.trim(),
        apellido: form.apellido.trim(),
        usuario: form.usuario,
        email: form.email.trim(),
      });
      navigate('/dashboard');
    } catch (err) {
      setError(getFirebaseError(err.code));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    setError('');
    setLoadingGoogle(true);
    try {
      const cred = await loginWithGoogle();
      let profile = await getUserDocument(cred.user.uid);
      if (!profile) {
        const names = (cred.user.displayName || '').split(' ');
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
      }
      navigate('/dashboard');
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
        <div className="auth-logo">
          <div className="auth-logo__icon">🕹️</div>
          <h1 className="auth-logo__title text-gradient">ARCADEPAY</h1>
          <p className="auth-logo__subtitle">Crea tu cuenta</p>
        </div>

        {error && <div className="alert alert--error">{error}</div>}

        <form onSubmit={handleRegister}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1rem' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="nombre">Nombre</label>
              <input
                id="nombre" name="nombre" type="text" className="form-input"
                placeholder="Juan" value={form.nombre} onChange={handleChange} required
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="apellido">Apellido</label>
              <input
                id="apellido" name="apellido" type="text" className="form-input"
                placeholder="Pérez" value={form.apellido} onChange={handleChange} required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="usuario">
              Nombre de usuario
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)',
                color: 'var(--color-text-faint)', pointerEvents: 'none',
              }}>@</span>
              <input
                id="usuario" name="usuario" type="text" className="form-input"
                placeholder="juanperez" value={form.usuario} onChange={handleChange}
                required minLength={3} style={{ paddingLeft: '2rem' }}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="reg-email">Correo electrónico</label>
            <input
              id="reg-email" name="email" type="email" className="form-input"
              placeholder="correo@example.com" value={form.email} onChange={handleChange}
              required autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="reg-password">Contraseña</label>
            <div className="password-wrapper">
              <input
                id="reg-password" name="password"
                type={showPass ? 'text' : 'password'} className="form-input"
                placeholder="Mín. 8 car., mayús., minús. y número"
                value={form.password}
                onChange={handleChange} required
                style={{ paddingRight: '2.75rem' }}
                autoComplete="new-password"
              />
              <button type="button" className="password-toggle"
                onClick={() => setShowPass(!showPass)}>
                {showPass ? '🙈' : '👁️'}
              </button>
            </div>
            <PasswordStrength password={form.password} />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="confirm">Confirmar contraseña</label>
            <input
              id="confirm" name="confirm"
              type={showPass ? 'text' : 'password'} className="form-input"
              placeholder="Repite tu contraseña" value={form.confirm}
              onChange={handleChange} required
              autoComplete="new-password"
              style={{
                borderColor: form.confirm && form.confirm !== form.password
                  ? 'var(--color-danger)'
                  : form.confirm && form.confirm === form.password
                  ? 'var(--color-success)'
                  : undefined,
              }}
            />
            {form.confirm && form.confirm !== form.password && (
              <p style={{ fontSize: '0.75rem', color: 'var(--color-danger)', marginTop: '0.3rem' }}>
                Las contraseñas no coinciden
              </p>
            )}
          </div>

          <button
            id="btn-register-email"
            type="submit"
            className="btn btn--primary btn--full"
            disabled={loading}
          >
            {loading ? <span className="spinner" /> : 'Crear cuenta'}
          </button>
        </form>

        <div className="divider">o regístrate con</div>

        <button
          id="btn-register-google"
          type="button"
          className="btn btn--google btn--full"
          onClick={handleGoogleRegister}
          disabled={loadingGoogle}
        >
          {loadingGoogle ? (
            <span className="spinner" />
          ) : (
            <>
              <GoogleIcon />
              Registrarse con Google
            </>
          )}
        </button>

        <div className="auth-footer">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login">Inicia sesión</Link>
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
    'auth/email-already-in-use':   'Ya existe una cuenta con ese correo.',
    'auth/invalid-email':          'El correo no tiene un formato válido.',
    'auth/weak-password':          'La contraseña no cumple los requisitos mínimos.',
    'auth/network-request-failed': 'Error de red. Verifica tu conexión.',
  };
  return errors[code] || 'Ocurrió un error. Intenta de nuevo.';
}
