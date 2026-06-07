import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Header from '../components/Header';
import RoleDropdown from '../components/RoleDropdown';
import { getAllUsers, updateUserRole } from '../firebase/firestore';
import '../styles/dashboard.css';

const ROLE_LABELS = { admin: 'Admin', general: 'General' };

export default function RootDashboard() {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [updating, setUpdating] = useState(null);
  const [confirm, setConfirm] = useState(null); // { uid, nombre, currentRole, newRole }

  useEffect(() => {
    const unsub = getAllUsers((allUsers) => {
      setUsers(allUsers.filter((u) => u.id !== currentUser.uid));
    });
    return () => unsub();
  }, [currentUser.uid]);

  // Called by RoleDropdown — shows confirmation modal instead of updating directly
  const requestRoleChange = (uid, nombre, currentRole, newRole) => {
    if (currentRole === newRole) return;
    setConfirm({ uid, nombre, currentRole, newRole });
  };

  const confirmRoleChange = async () => {
    if (!confirm) return;
    const { uid, newRole } = confirm;
    setUpdating(uid);
    setConfirm(null);
    try {
      await updateUserRole(uid, newRole);
    } catch (err) {
      console.error('Error updating role:', err);
    } finally {
      setUpdating(null);
    }
  };

  const admins   = users.filter((u) => u.rol === 'admin');
  const generals = users.filter((u) => u.rol === 'general');

  return (
    <div className="dashboard-page">
      <Header />
      <main className="dashboard-content">
        <div className="container">

          {/* Stats */}
          <div className="stats-row">
            <div className="stat-card">
              <div className="stat-card__value">{users.length}</div>
              <div className="stat-card__label">Total usuarios</div>
            </div>
            <div className="stat-card">
              <div className="stat-card__value">{admins.length}</div>
              <div className="stat-card__label">Administradores</div>
            </div>
            <div className="stat-card">
              <div className="stat-card__value">{generals.length}</div>
              <div className="stat-card__label">Usuarios generales</div>
            </div>
          </div>

          {/* User list */}
          <p className="section-title">👑 Gestión de roles</p>

          {users.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon">👥</div>
              <p className="empty-state__text">No hay usuarios registrados aún.</p>
            </div>
          ) : (
            <div className="user-list">
              {users.map((u) => (
                <UserRow
                  key={u.id}
                  user={u}
                  isUpdating={updating === u.id}
                  onRoleChange={(uid, newRole) =>
                    requestRoleChange(uid, `${u.nombre} ${u.apellido}`.trim(), u.rol, newRole)
                  }
                />
              ))}
            </div>
          )}

        </div>
      </main>

      {/* Confirmation modal */}
      {confirm && (
        <RoleConfirmModal
          nombre={confirm.nombre}
          currentRole={confirm.currentRole}
          newRole={confirm.newRole}
          onConfirm={confirmRoleChange}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

// ─── User row ─────────────────────────────────────────────────────────────────
function UserRow({ user, isUpdating, onRoleChange }) {
  const initials = `${user.nombre?.[0] || ''}${user.apellido?.[0] || ''}`.toUpperCase() || '?';

  return (
    <div className="user-row">
      <div className="user-row__avatar">{initials}</div>

      <div className="user-row__info">
        <div className="user-row__name">{user.nombre} {user.apellido}</div>
        <div className="user-row__meta">@{user.usuario} · {user.email}</div>
      </div>

      <div className="user-row__credits" title="Créditos">
        {user.creditos ?? 0} cr
      </div>

      <div className="user-row__actions">
        {isUpdating ? (
          <span className="spinner" style={{ width: 18, height: 18 }} />
        ) : (
          <RoleDropdown
            value={user.rol}
            onChange={(newRole) => onRoleChange(user.id, newRole)}
            disabled={isUpdating}
          />
        )}
      </div>
    </div>
  );
}

// ─── Confirm modal ────────────────────────────────────────────────────────────
function RoleConfirmModal({ nombre, currentRole, newRole, onConfirm, onCancel }) {
  const roleColor = { admin: '#a5b4fc', general: '#67e8f9' };

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal__handle" />

        {/* Icon */}
        <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'rgba(99,102,241,0.15)',
            border: '1px solid rgba(99,102,241,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.6rem', margin: '0 auto',
          }}>
            🔄
          </div>
        </div>

        <h2 className="modal__title" style={{ textAlign: 'center' }}>Confirmar cambio de rol</h2>

        <p style={{
          textAlign: 'center', color: 'var(--color-text-muted)',
          fontSize: '0.92rem', lineHeight: 1.6, margin: '0.75rem 0 1.5rem',
        }}>
          ¿Cambiar el rol de{' '}
          <strong style={{ color: 'var(--color-text)' }}>{nombre}</strong>?
        </p>

        {/* Role change visualization */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: '1rem', marginBottom: '1.75rem',
        }}>
          <span style={{
            padding: '0.35rem 1rem', borderRadius: 999,
            background: 'rgba(99,102,241,0.1)',
            border: `1px solid ${roleColor[currentRole] || 'var(--color-border)'}`,
            color: roleColor[currentRole] || 'var(--color-text-muted)',
            fontWeight: 600, fontSize: '0.9rem',
          }}>
            {ROLE_LABELS[currentRole] || currentRole}
          </span>

          <span style={{ color: 'var(--color-text-faint)', fontSize: '1.1rem' }}>→</span>

          <span style={{
            padding: '0.35rem 1rem', borderRadius: 999,
            background: 'rgba(99,102,241,0.18)',
            border: `1px solid ${roleColor[newRole] || 'var(--color-border)'}`,
            color: roleColor[newRole] || 'var(--color-text)',
            fontWeight: 700, fontSize: '0.9rem',
            boxShadow: `0 0 12px ${roleColor[newRole] || 'transparent'}40`,
          }}>
            {ROLE_LABELS[newRole] || newRole}
          </span>
        </div>

        <div className="modal__actions">
          <button className="btn btn--ghost" onClick={onCancel}>
            Cancelar
          </button>
          <button className="btn btn--primary" onClick={onConfirm}>
            Confirmar cambio
          </button>
        </div>
      </div>
    </div>
  );
}
