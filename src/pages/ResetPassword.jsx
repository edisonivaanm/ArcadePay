import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { verifyResetCode, confirmNewPassword } from '../firebase/auth';
import '../styles/auth.css';

// ─── Password validator (same rules as Register & EditProfile) ───────────────
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

// ─── States ───────────────────────────────────────────────────────────────────
const STEP = { VERIFYING: 'verifying', FORM: 'form', SUCCESS: 'success', INVALID: 'invalid' };

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const oobCode = searchParams.get('oobCode');

  const [step, setStep] = useState(STEP.VERIFYING);
  const [email, setEmail] = useState('');       // recovered from oobCode
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // On mount: verify that the oobCode is valid and not expired
  useEffect(() => {
    if (!oobCode) {
      setStep(STEP.INVALID);
      return;
    }
    verifyResetCode(oobCode)
      .then((recoveredEmail) => {
        setEmail(recoveredEmail);
        setStep(STEP.FORM);
      })
      .catch(() => setStep(STEP.INVALID));
  }, [oobCode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const pwdErrors = validatePassword(password);
    if (pwdErrors.length > 0) {
      setError(`Contraseña insegura: ${pwdErrors.join(', ')}.`);
      return;
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    try {
      await confirmNewPassword(oobCode, password);
      setStep(STEP.SUCCESS);
    } catch (err) {
      if (err.code === 'auth/expired-action-code') {
        setError('El enlace ha expirado. Solicita uno nuevo desde "¿Olvidaste tu contraseña?".');
      } else if (err.code === 'auth/invalid-action-code') {
        setError('El enlace ya fue usado o es inválido. Solicita uno nuevo.');
      } else {
        setError('Error al restablecer la contraseña. Intenta de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Verifying ──────────────────────────────────────────────────────────────
  if (step === STEP.VERIFYING) {
    return (
      <div className="auth-page">
        <div className="auth-card card" style={{ textAlign: 'center' }}>
          <div className="auth-logo">
            <div className="auth-logo__icon">🔑</div>
            <h1 className="auth-logo__title text-gradient">ARCADEPAY</h1>
          </div>
          <span className="spinner" style={{ width: 28, height: 28, margin: '1rem auto' }} />
          <p style={{ color: 'var(--color-text-muted)', marginTop: '0.75rem' }}>
            Verificando enlace…
          </p>
        </div>
      </div>
    );
  }

  // ── Invalid / Expired ──────────────────────────────────────────────────────
  if (step === STEP.INVALID) {
    return (
      <div className="auth-page">
        <div className="auth-card card">
          <div className="auth-logo">
            <div className="auth-logo__icon">⚠️</div>
            <h1 className="auth-logo__title text-gradient">ARCADEPAY</h1>
            <p className="auth-logo__subtitle">Enlace inválido o expirado</p>
          </div>
          <div className="alert alert--error">
            Este enlace de recuperación no es válido o ya expiró. Los enlaces tienen una duración de 1 hora.
          </div>
          <div style={{ marginTop: '1.5rem' }}>
            <Link to="/forgot-password" className="btn btn--primary btn--full">
              Solicitar nuevo enlace
            </Link>
          </div>
          <div className="auth-footer">
            <Link to="/login">← Volver al inicio de sesión</Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Success ────────────────────────────────────────────────────────────────
  if (step === STEP.SUCCESS) {
    return (
      <div className="auth-page">
        <div className="auth-card card" style={{ textAlign: 'center' }}>
          <div className="auth-logo">
            <div className="auth-logo__icon">✅</div>
            <h1 className="auth-logo__title text-gradient">ARCADEPAY</h1>
            <p className="auth-logo__subtitle">¡Contraseña restablecida!</p>
          </div>
          <div className="alert alert--success" style={{ textAlign: 'left' }}>
            Tu contraseña se actualizó correctamente. Ya puedes iniciar sesión con tu nueva contraseña.
          </div>
          <div style={{ marginTop: '1.5rem' }}>
            <Link to="/login" className="btn btn--primary btn--full">
              Iniciar sesión
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Form ───────────────────────────────────────────────────────────────────
  return (
    <div className="auth-page">
      <div className="auth-card card">
        <div className="auth-logo">
          <div className="auth-logo__icon">🔑</div>
          <h1 className="auth-logo__title text-gradient">ARCADEPAY</h1>
          <p className="auth-logo__subtitle">Nueva contraseña</p>
        </div>

        {/* Show which account is being reset */}
        <div style={{
          background: 'var(--color-bg-elevated)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          padding: '0.75rem 1rem',
          marginBottom: '1.25rem',
          fontSize: '0.875rem',
          color: 'var(--color-text-muted)',
        }}>
          Restableciendo contraseña para{' '}
          <strong style={{ color: 'var(--color-text)' }}>{email}</strong>
        </div>

        {error && <div className="alert alert--error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="new-password">Nueva contraseña</label>
            <div className="password-wrapper">
              <input
                id="new-password"
                type={showPass ? 'text' : 'password'}
                className="form-input"
                placeholder="Mín. 8 car., mayús., minús. y número"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
                autoComplete="new-password"
                style={{ paddingRight: '2.75rem' }}
              />
              <button type="button" className="password-toggle"
                onClick={() => setShowPass(!showPass)}>
                {showPass ? '🙈' : '👁️'}
              </button>
            </div>
            <PasswordStrength password={password} />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="confirm-password">Confirmar contraseña</label>
            <input
              id="confirm-password"
              type={showPass ? 'text' : 'password'}
              className="form-input"
              placeholder="Repite tu nueva contraseña"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              autoComplete="new-password"
              style={{
                borderColor: confirm && confirm !== password
                  ? 'var(--color-danger)'
                  : confirm && confirm === password
                  ? 'var(--color-success)'
                  : undefined,
              }}
            />
            {confirm && confirm !== password && (
              <p style={{ fontSize: '0.75rem', color: 'var(--color-danger)', marginTop: '0.3rem' }}>
                Las contraseñas no coinciden
              </p>
            )}
          </div>

          <button
            id="btn-confirm-reset"
            type="submit"
            className="btn btn--primary btn--full"
            disabled={loading}
          >
            {loading ? <span className="spinner" /> : 'Establecer nueva contraseña'}
          </button>
        </form>

        <div className="auth-footer">
          <Link to="/login">← Volver al inicio de sesión</Link>
        </div>
      </div>
    </div>
  );
}
