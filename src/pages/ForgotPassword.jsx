import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { resetPassword } from '../firebase/auth';
import '../styles/auth.css';

// 60-minute countdown, starts when activate=true
function useCountdown(activate) {
  const TOTAL = 60 * 60; // 60 minutes in seconds
  const [secs, setSecs] = useState(TOTAL);

  useEffect(() => {
    if (!activate) { setSecs(TOTAL); return; }
    if (secs <= 0) return;
    const id = setInterval(() => setSecs((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [activate, secs]);

  const m = String(Math.floor(secs / 60)).padStart(2, '0');
  const s = String(secs % 60).padStart(2, '0');
  return { display: `${m}:${s}`, expired: activate && secs <= 0 };
}

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const countdown = useCountdown(sent);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await resetPassword(email.trim());
      setSent(true);
    } catch (err) {
      const errors = {
        'auth/user-not-found':    'No existe una cuenta con ese correo.',
        'auth/invalid-email':     'El correo no tiene un formato válido.',
        'auth/network-request-failed': 'Error de red. Verifica tu conexión.',
      };
      setError(errors[err.code] || 'Ocurrió un error. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card card">
        <div className="auth-logo">
          <div className="auth-logo__icon">🔑</div>
          <h1 className="auth-logo__title text-gradient">ARCADEPAY</h1>
          <p className="auth-logo__subtitle">Recupera tu contraseña</p>
        </div>

        {sent ? (
          <div style={{ textAlign: 'center' }}>
            <div className="alert alert--success" style={{ textAlign: 'left' }}>
              ✅ Te enviamos un correo a <strong>{email}</strong> con el enlace para restablecer tu contraseña.
              Revisa también tu carpeta de spam.
            </div>

            {/* Expiry countdown */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: '0.75rem', margin: '1.25rem 0',
              padding: '0.875rem 1rem',
              background: 'var(--color-bg-elevated)',
              border: `1px solid ${countdown.expired ? 'var(--color-danger)' : 'var(--color-border)'}`,
              borderRadius: 'var(--radius-md)',
            }}>
              <span style={{ fontSize: '1.4rem' }}>{countdown.expired ? '❌' : '⏱️'}</span>
              <div style={{ textAlign: 'left' }}>
                <p style={{
                  fontWeight: 700, fontSize: '1.1rem', lineHeight: 1,
                  color: countdown.expired ? 'var(--color-danger)' : 'var(--color-text)',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {countdown.expired ? 'Enlace expirado' : countdown.display}
                </p>
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>
                  {countdown.expired
                    ? 'Solicita un nuevo enlace'
                    : 'El enlace expira en este tiempo'}
                </p>
              </div>
            </div>

            {countdown.expired ? (
              <button
                className="btn btn--primary btn--full"
                onClick={() => { setSent(false); setError(''); }}
              >
                Enviar nuevo enlace
              </button>
            ) : (
              <p className="text-muted text-sm mt-2">
                ¿No llegó el correo?{' '}
                <button
                  style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: 'inherit' }}
                  onClick={() => { setSent(false); }}
                >
                  Intenta de nuevo
                </button>
              </p>
            )}

            <div className="mt-3">
              <Link to="/login" className="btn btn--ghost btn--full">
                ← Volver al inicio de sesión
              </Link>
            </div>
          </div>
        ) : (
          <>
            <p className="text-muted text-sm" style={{ marginBottom: '1.5rem', lineHeight: '1.6' }}>
              Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.
            </p>

            {error && <div className="alert alert--error">{error}</div>}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="reset-email">Correo electrónico</label>
                <input
                  id="reset-email"
                  type="email"
                  className="form-input"
                  placeholder="tu@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>

              <button
                id="btn-reset-password"
                type="submit"
                className="btn btn--primary btn--full"
                disabled={loading}
              >
                {loading ? <span className="spinner" /> : 'Enviar enlace de recuperación'}
              </button>
            </form>

            <div className="auth-footer">
              <Link to="/login">← Volver al inicio de sesión</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
