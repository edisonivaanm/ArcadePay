import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Header from '../components/Header';
import TransactionList from '../components/TransactionList';
import RoleDropdown from '../components/RoleDropdown';
import QRScannerModal from '../components/QRScannerModal';
import {
  getGeneralUsers,
  getAllTransactions,
  addTransaction,
  updateUserDocument,
} from '../firebase/firestore';
import { doc } from 'firebase/firestore';
import { db } from '../firebase/config';
import '../styles/dashboard.css';

export default function AdminDashboard() {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [allTxs, setAllTxs] = useState([]);
  const [search, setSearch] = useState('');
  const [rechargeModal, setRechargeModal] = useState(null); // user object
  const [showScanner, setShowScanner] = useState(false);

  useEffect(() => {
    const unsub1 = getGeneralUsers(setUsers);
    const unsub2 = getAllTransactions(setAllTxs);
    return () => { unsub1(); unsub2(); };
  }, []);

  // Build lookup map: uid → user object
  const usersMap = useMemo(() => {
    const map = {};
    users.forEach((u) => { map[u.id] = u; });
    return map;
  }, [users]);

  // Only this admin's recharges (admin_ref.id === currentUser.uid)
  const myRecharges = useMemo(() =>
    allTxs
      .filter((tx) => tx.tipo === 'recarga' && tx.admin_ref?.id === currentUser.uid)
      .map((tx) => ({
        ...tx,
        _userName: usersMap[tx.user_ref?.id]?.usuario || tx.user_ref?.id || '?',
      })),
    [allTxs, usersMap, currentUser.uid]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.nombre?.toLowerCase().includes(q) ||
        u.apellido?.toLowerCase().includes(q) ||
        u.usuario?.toLowerCase().includes(q)
    );
  }, [users, search]);

  const totalCreditosEmitidos = myRecharges.reduce((sum, tx) => sum + (tx.monto || 0), 0);

  // Called when QR scanner detects a valid QR code
  const handleQRScan = (uid) => {
    setShowScanner(false);
    const user = usersMap[uid];
    if (user) {
      setRechargeModal(user);
    } else {
      // User not in general list — could be unknown uid
      alert('Usuario no encontrado. Asegúrate de que el QR pertenece a un usuario activo.');
    }
  };

  return (
    <div className="dashboard-page">
      <Header />
      <main className="dashboard-content">
        <div className="container">

          {/* Stats */}
          <div className="stats-row">
            <div className="stat-card">
              <div className="stat-card__value">{users.length}</div>
              <div className="stat-card__label">Usuarios activos</div>
            </div>
            <div className="stat-card">
              <div className="stat-card__value">{myRecharges.length}</div>
              <div className="stat-card__label">Mis recargas</div>
            </div>
            <div className="stat-card">
              <div className="stat-card__value">{totalCreditosEmitidos}</div>
              <div className="stat-card__label">Créditos emitidos</div>
            </div>
          </div>

          {/* Search + QR scan row */}
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem' }}>
            <p className="section-title" style={{ margin: 0, flex: 1 }}>🛠️ Usuarios — Recargar créditos</p>
            <button
              id="btn-scan-qr"
              className="btn btn--accent btn--sm"
              onClick={() => setShowScanner(true)}
              style={{ flexShrink: 0, gap: '0.4rem' }}
            >
              <QRScanIcon />
              Escanear QR
            </button>
          </div>

          <div className="search-bar">
            <span className="search-bar__icon">🔍</span>
            <input
              id="search-users"
              type="text"
              className="form-input"
              placeholder="Buscar por nombre, apellido o usuario..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon">🔍</div>
              <p className="empty-state__text">
                {search
                  ? 'No se encontraron usuarios con esa búsqueda.'
                  : 'No hay usuarios generales registrados.'}
              </p>
            </div>
          ) : (
            <div className="user-list">
              {filtered.map((u) => (
                <AdminUserRow
                  key={u.id}
                  user={u}
                  onRecharge={() => setRechargeModal(u)}
                />
              ))}
            </div>
          )}

          {/* This admin's recharge history */}
          <p className="section-title" style={{ marginTop: '2.5rem' }}>
            📋 Mi historial de recargas
          </p>
          <TransactionList
            transactions={myRecharges}
            showUser={true}
            emptyText="Aún no has realizado ninguna recarga."
          />

        </div>
      </main>

      {/* QR Scanner modal */}
      {showScanner && (
        <QRScannerModal
          onScan={handleQRScan}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* Recharge modal */}
      {rechargeModal && (
        <RechargeModal
          user={rechargeModal}
          adminRef={doc(db, 'users', currentUser.uid)}
          onClose={() => setRechargeModal(null)}
        />
      )}
    </div>
  );
}

// ─── User row ─────────────────────────────────────────────────────────────────
function AdminUserRow({ user, onRecharge }) {
  const initials = `${user.nombre?.[0] || ''}${user.apellido?.[0] || ''}`.toUpperCase() || '?';
  return (
    <div className="user-row">
      <div className="user-row__avatar">{initials}</div>
      <div className="user-row__info">
        <div className="user-row__name">{user.nombre} {user.apellido}</div>
        <div className="user-row__meta">@{user.usuario} · {user.email}</div>
      </div>
      <div className="user-row__credits">{user.creditos ?? 0} cr</div>
      <div className="user-row__actions">
        <button
          className="btn btn--accent btn--sm"
          onClick={onRecharge}
          id={`btn-recharge-${user.id}`}
        >
          + Recargar
        </button>
      </div>
    </div>
  );
}

// ─── Recharge modal ───────────────────────────────────────────────────────────
function RechargeModal({ user, adminRef, onClose }) {
  const { showToast } = useToast();
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRecharge = async (e) => {
    e.preventDefault();
    const monto = parseInt(amount, 10);
    if (!monto || monto <= 0) { setError('Ingresa un monto válido mayor a 0.'); return; }
    if (monto > 1000) { setError('El monto máximo por recarga es 1000 créditos.'); return; }

    setLoading(true);
    setError('');
    try {
      const userRef = doc(db, 'users', user.id);
      await updateUserDocument(user.id, { creditos: (user.creditos || 0) + monto });
      await addTransaction({
        userRef,
        adminRef,
        monto,
        titulo: `Recarga manual (+${monto} créditos)`,
        tipo: 'recarga',
      });
      showToast(`+${monto} créditos recargados a ${user.nombre}`);
      onClose();
    } catch (err) {
      console.error('Recharge error:', err);
      setError('Error al procesar la recarga. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const initials = `${user.nombre?.[0] || ''}${user.apellido?.[0] || ''}`.toUpperCase() || '?';

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal__handle" />
        <h2 className="modal__title">Recargar créditos</h2>

        {/* User mini-card */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          background: 'var(--color-bg-elevated)', padding: '0.875rem 1rem',
          borderRadius: 'var(--radius-md)', marginBottom: '1.5rem',
          border: '1px solid var(--color-border)',
        }}>
          <div className="user-row__avatar" style={{ width: 40, height: 40 }}>{initials}</div>
          <div>
            <div style={{ fontWeight: 600 }}>{user.nombre} {user.apellido}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
              @{user.usuario} · {user.creditos ?? 0} créditos actuales
            </div>
          </div>
        </div>

        {error && <div className="alert alert--error">{error}</div>}

        <form onSubmit={handleRecharge}>
          <div className="form-group">
            <label className="form-label" htmlFor="recharge-amount">Cantidad de créditos</label>
            <input
              id="recharge-amount"
              type="number"
              className="form-input"
              placeholder="Ej: 10"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="1" max="1000" required autoFocus
            />
          </div>

          {/* Quick amounts */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            {[5, 10, 20, 50].map((n) => (
              <button
                key={n} type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => setAmount(String(n))}
                style={{ flex: 1 }}
              >
                +{n}
              </button>
            ))}
          </div>

          <div className="modal__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn--accent" disabled={loading}>
              {loading
                ? <span className="spinner" />
                : `Recargar${amount ? ` ${amount} cr` : ''}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function QRScanIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/>
      <rect x="7" y="7" width="3" height="3" rx="0.5"/><rect x="14" y="7" width="3" height="3" rx="0.5"/>
      <rect x="7" y="14" width="3" height="3" rx="0.5"/><path d="M14 14h.01M17 14h.01M14 17h.01M17 17h.01"/>
    </svg>
  );
}
