import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { updateUserDocument, isUsernameAvailable } from '../firebase/firestore';
import { changePassword, loginWithEmail } from '../firebase/auth';

// ─── Password strength validator ─────────────────────────────────────────────
function validatePassword(pwd) {
  const errors = [];
  if (pwd.length < 8)            errors.push('Mínimo 8 caracteres');
  if (!/[a-z]/.test(pwd))        errors.push('Al menos una letra minúscula');
  if (!/[A-Z]/.test(pwd))        errors.push('Al menos una letra mayúscula');
  if (!/[0-9]/.test(pwd))        errors.push('Al menos un número');
  return errors;
}

function PasswordStrength({ password }) {
  if (!password) return null;
  const errors = validatePassword(password);
  const strength = 4 - errors.length; // 0–4

  const colors = ['#ef4444', '#f59e0b', '#f59e0b', '#10b981', '#10b981'];
  const labels = ['', 'Débil', 'Regular', 'Buena', 'Fuerte'];

  return (
    <div style={{ marginTop: '0.5rem' }}>
      <div style={{ display: 'flex', gap: '4px', marginBottom: '0.35rem' }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{
            flex: 1, height: 4, borderRadius: 2,
            background: i < strength ? colors[strength] : 'var(--color-border)',
            transition: 'background 0.3s',
          }} />
        ))}
      </div>
      {strength < 4 && (
        <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
          {errors.map((e) => <li key={e}>{e}</li>)}
        </ul>
      )}
      {strength === 4 && (
        <p style={{ fontSize: '0.75rem', color: '#10b981' }}>✓ Contraseña segura</p>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function EditProfileModal({ onClose }) {
  const { currentUser, userProfile, setUserProfile } = useAuth();
  const { showToast } = useToast();
  const [usuario, setUsuario] = useState(userProfile?.usuario || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [needsReAuth, setNeedsReAuth] = useState(false);
  const [reAuthPassword, setReAuthPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Detect if anything actually changed
  const hasChanges = usuario.trim() !== (userProfile?.usuario || '') || newPassword.length > 0;

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');

    const trimmed = usuario.trim();
    if (!trimmed) { setError('El nombre de usuario no puede estar vacío.'); return; }
    if (trimmed.length < 3) { setError('El usuario debe tener al menos 3 caracteres.'); return; }
    if (!/^[a-z0-9._]+$/.test(trimmed)) {
      setError('Solo letras minúsculas, números, puntos y guiones bajos.');
      return;
    }

    if (newPassword) {
      const pwdErrors = validatePassword(newPassword);
      if (pwdErrors.length > 0) {
        setError(`Contraseña insegura: ${pwdErrors.join(', ')}.`);
        return;
      }
      if (newPassword !== confirmPassword) { setError('Las contraseñas no coinciden.'); return; }
    }

    setLoading(true);
    try {
      if (trimmed !== userProfile?.usuario) {
        const available = await isUsernameAvailable(trimmed);
        if (!available) { setError('Ese nombre de usuario ya está en uso.'); setLoading(false); return; }
        await updateUserDocument(currentUser.uid, { usuario: trimmed });
        setUserProfile((prev) => ({ ...prev, usuario: trimmed }));
      }

      if (newPassword) await changePassword(newPassword);

      showToast('¡Perfil actualizado correctamente!');
      onClose();
    } catch (err) {
      if (err.code === 'auth/requires-recent-login') {
        setNeedsReAuth(true);
        setError('Por seguridad, confirma tu contraseña actual para continuar.');
      } else {
        setError('Error al guardar. Intenta de nuevo.');
        console.error(err);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReAuth = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await loginWithEmail(currentUser.email, reAuthPassword);
      await changePassword(newPassword);

      const trimmed = usuario.trim();
      if (trimmed !== userProfile?.usuario) {
        await updateUserDocument(currentUser.uid, { usuario: trimmed });
        setUserProfile((prev) => ({ ...prev, usuario: trimmed }));
      }

      showToast('¡Perfil actualizado correctamente!');
      onClose();
    } catch (err) {
      setError(
        err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential'
          ? 'Contraseña actual incorrecta.'
          : 'Error al verificar. Intenta de nuevo.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal__handle" />
        <h2 className="modal__title">Editar perfil</h2>
        <p className="modal__subtitle">
          {needsReAuth ? 'Confirma tu identidad para continuar' : 'Cambia tu usuario o contraseña'}
        </p>

        {error && <div className="alert alert--error">{error}</div>}

        {needsReAuth ? (
          <form onSubmit={handleReAuth}>
            <div className="form-group">
              <label className="form-label" htmlFor="reauth-pass">Tu contraseña actual</label>
              <input
                id="reauth-pass" type="password" className="form-input"
                placeholder="Ingresa tu contraseña actual"
                value={reAuthPassword}
                onChange={(e) => setReAuthPassword(e.target.value)}
                required autoFocus
              />
            </div>
            <div className="modal__actions">
              <button type="button" className="btn btn--ghost"
                onClick={() => { setNeedsReAuth(false); setError(''); }}>
                Cancelar
              </button>
              <button type="submit" className="btn btn--primary" disabled={loading}>
                {loading ? <span className="spinner" /> : 'Confirmar y guardar'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSave}>
            {/* Username */}
            <div className="form-group">
              <label className="form-label" htmlFor="edit-usuario">Nombre de usuario</label>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute', left: '1rem', top: '50%',
                  transform: 'translateY(-50%)', color: 'var(--color-text-faint)',
                  pointerEvents: 'none',
                }}>@</span>
                <input
                  id="edit-usuario"
                  type="text"
                  className="form-input"
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value.toLowerCase().replace(/\s/g, ''))}
                  style={{ paddingLeft: '2rem' }}
                  placeholder={userProfile?.usuario || 'usuario'}
                  required
                  minLength={3}
                  autoComplete="off"
                />
              </div>
              {usuario && usuario !== userProfile?.usuario && (
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.3rem' }}>
                  Antes: <span style={{ color: 'var(--color-accent)' }}>@{userProfile?.usuario}</span>
                </p>
              )}
            </div>

            {/* New password */}
            <div className="form-group">
              <label className="form-label" htmlFor="edit-password">
                Nueva contraseña <span style={{ color: 'var(--color-text-faint)', fontWeight: 400, textTransform: 'none' }}>(opcional)</span>
              </label>
              <input
                id="edit-password" type="password" className="form-input"
                placeholder="Dejar vacío para no cambiar"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
              <PasswordStrength password={newPassword} />
            </div>

            {newPassword && (
              <div className="form-group">
                <label className="form-label" htmlFor="edit-confirm">Confirmar nueva contraseña</label>
                <input
                  id="edit-confirm" type="password" className="form-input"
                  placeholder="Repite la nueva contraseña"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  style={{
                    borderColor: confirmPassword && confirmPassword !== newPassword
                      ? 'var(--color-danger)'
                      : confirmPassword && confirmPassword === newPassword
                      ? 'var(--color-success)'
                      : undefined,
                  }}
                />
                {confirmPassword && confirmPassword !== newPassword && (
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-danger)', marginTop: '0.3rem' }}>
                    Las contraseñas no coinciden
                  </p>
                )}
              </div>
            )}

            <div className="modal__actions">
              <button type="button" className="btn btn--ghost" onClick={onClose}>Cancelar</button>
              <button
                type="submit"
                className="btn btn--primary"
                disabled={loading || !hasChanges}
                title={!hasChanges ? 'No hay cambios que guardar' : undefined}
              >
                {loading ? <span className="spinner" /> : 'Guardar cambios'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
