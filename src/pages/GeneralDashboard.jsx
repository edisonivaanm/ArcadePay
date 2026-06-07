import { useEffect, useState, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import Header from '../components/Header';
import TransactionList from '../components/TransactionList';
import {
  getAllTransactions,
  getMachineState,
  setMachineReserved,
  setMachineFree,
  updateUserDocument,
  addTransaction,
} from '../firebase/firestore';
import { doc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useToast } from '../context/ToastContext';
import gamepadImg from '../assets/gamepad.png';
import QRCardModal from '../components/QRCardModal';
import '../styles/dashboard.css';

// Tiempo máximo para que Python confirme la conexión
const CONFIRM_TIMEOUT_MS = 30 * 1000; // 30 segundos

// Tiempo máximo que una sesión puede durar antes de considerarse abandonada
const STALE_SESSION_MS = 10 * 60 * 1000; // 10 minutos

export default function GeneralDashboard() {
  const { currentUser, userProfile, setUserProfile } = useAuth();
  const { showToast } = useToast();
  const [allTxs, setAllTxs] = useState([]);
  const [machine, setMachine] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [showQR, setShowQR] = useState(false);

  // Ref para rastrear si estamos esperando confirmación de Python
  const waitingConfirm = useRef(false);
  const confirmTimer = useRef(null);

  const userRef = doc(db, 'users', currentUser.uid);

  useEffect(() => {
    const unsub1 = getAllTransactions(setAllTxs);
    const unsub2 = getMachineState(setMachine);
    return () => { unsub1(); unsub2(); };
  }, [currentUser.uid]);

  // ── Detectar confirmación de Python (reservado → ocupado) ─────────────────
  useEffect(() => {
    if (!machine || !waitingConfirm.current) return;

    if (machine.estado === 'ocupado') {
      // ¡Python confirmó! Ahora sí cobrar el crédito
      waitingConfirm.current = false;
      clearTimeout(confirmTimer.current);
      deductCredit();
    }
  }, [machine]);

  // ── Detectar sesiones abandonadas y auto-liberar ──────────────────────────
  useEffect(() => {
    if (!machine) return;
    if (machine.estado !== 'ocupado' && machine.estado !== 'reservado') return;
    const inicio = machine.inicio_sesion?.toMillis?.();
    if (!inicio) return;

    const elapsed = Date.now() - inicio;
    if (elapsed >= STALE_SESSION_MS) {
      setMachineFree().then(() => {
        showToast('Sesión anterior expirada — máquina liberada', 'info');
      }).catch((err) => console.error('Auto-release error:', err));
    } else {
      const remaining = STALE_SESSION_MS - elapsed;
      const timer = setTimeout(() => {
        setMachineFree().then(() => {
          showToast('Sesión expirada — máquina liberada', 'info');
        }).catch((err) => console.error('Scheduled release error:', err));
      }, remaining);
      return () => clearTimeout(timer);
    }
  }, [machine]);

  const transactions = useMemo(() =>
    allTxs.filter((tx) => tx.user_ref?.id === currentUser.uid),
    [allTxs, currentUser.uid]
  );

  const credits = userProfile?.creditos ?? 0;
  const machineIsFree = machine?.estado === 'libre';
  const hasCredits = credits > 0;
  const canConnect = machineIsFree && hasCredits;

  // ── Descontar crédito (solo cuando Python confirma) ───────────────────────
  const deductCredit = async () => {
    try {
      const newCredits = credits - 1;
      await updateUserDocument(currentUser.uid, { creditos: newCredits });
      setUserProfile((prev) => ({ ...prev, creditos: newCredits }));
      await addTransaction({
        userRef, adminRef: null,
        monto: -1,
        titulo: 'Sesión arcade — 1 crédito',
        tipo: 'consumo',
      });
      showToast('🎮 ¡Conectado! Se descontó 1 crédito.', 'success');
    } catch (err) {
      console.error('Error deducting credit:', err);
      showToast('Error al procesar el crédito', 'error');
    } finally {
      setConnecting(false);
    }
  };

  // ── Paso 1: Reservar la máquina (sin cobrar) ─────────────────────────────
  const handleConnect = async () => {
    if (!canConnect || connecting) return;
    setConnecting(true);

    try {
      // Solo reserva — NO descuenta crédito aún
      await setMachineReserved(userRef);
      waitingConfirm.current = true;

      showToast('⏳ Conectando con la máquina...', 'info');

      // Timeout: si Python no confirma en 30 segundos, cancelar
      confirmTimer.current = setTimeout(async () => {
        if (waitingConfirm.current) {
          waitingConfirm.current = false;
          setConnecting(false);
          try {
            await setMachineFree();
          } catch (e) {
            console.error('Error releasing on timeout:', e);
          }
          showToast('❌ La máquina no respondió. No se cobró el crédito.', 'error');
        }
      }, CONFIRM_TIMEOUT_MS);

    } catch (err) {
      console.error(err);
      setConnecting(false);
      showToast('❌ Error al conectar. Intenta de nuevo.', 'error');
    }
  };

  // Limpiar timer al desmontar
  useEffect(() => {
    return () => clearTimeout(confirmTimer.current);
  }, []);

  // ── Texto de estado ───────────────────────────────────────────────────────
  const getStatusText = () => {
    if (!machine) return '';
    switch (machine.estado) {
      case 'libre':     return 'Máquina disponible';
      case 'reservado': return 'Conectando...';
      case 'ocupado':   return 'Máquina en uso';
      default:          return 'Máquina en uso';
    }
  };

  const getStatusClass = () => {
    if (!machine) return '';
    return machine.estado === 'libre' ? 'libre' : 'ocupado';
  };

  return (
    <div className="gen-page">
      <Header />

      <main className="gen-main">
        <div className="gen-container">

          {/* Greeting */}
          <h1 className="gen-greeting">HOLA {(userProfile?.nombre || 'JUGADOR').toUpperCase()}</h1>

          {/* Credits card */}
          <div className="gen-card gen-card--credits">
            <span className="gen-card__label">CRÉDITOS DISPONIBLES</span>
            <span className="gen-card__value">{credits}</span>
          </div>

          {/* Connect card */}
          <div className="gen-card gen-card--connect">
            <img src={gamepadImg} alt="Gamepad" className="gen-gamepad" />

            {/* Status */}
            {machine && (
              <div className={`gen-status gen-status--${getStatusClass()}`}>
                <span className="status-dot" />
                {getStatusText()}
              </div>
            )}

            <p className="gen-connect-label">Conectar a Reino Hercules</p>

            {/* Hint text */}
            {!hasCredits && (
              <p className="gen-hint">Sin créditos. Contacta a un administrador.</p>
            )}
            {!machineIsFree && hasCredits && !connecting && (
              <p className="gen-hint">La máquina está ocupada en este momento.</p>
            )}
            {connecting && (
              <p className="gen-hint" style={{ color: 'var(--color-accent)' }}>
                Esperando confirmación de la máquina...
              </p>
            )}

            <button
              id="btn-connect"
              className="gen-connect-btn"
              onClick={handleConnect}
              disabled={!canConnect || connecting}
            >
              {connecting
                ? <span className="spinner" style={{ width: 20, height: 20 }} />
                : 'CONECTAR'
              }
            </button>
          </div>

          {/* Transactions */}
          <div className="gen-section">
            <p className="section-title">📋 Mis transacciones</p>
            <TransactionList
              transactions={transactions}
              emptyText="Aún no tienes transacciones."
            />
          </div>

        </div>
      </main>

      {/* Floating QR button */}
      <button
        id="btn-show-qr"
        onClick={() => setShowQR(true)}
        title="Ver mi código QR"
        style={{
          position: 'fixed', bottom: '1.75rem', right: '1.75rem',
          width: 56, height: 56, borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))',
          border: 'none', color: '#fff', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.4rem', zIndex: 40,
          boxShadow: '0 4px 20px rgba(99,102,241,0.5)',
          transition: 'transform 0.2s, box-shadow 0.2s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.1)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
      >
        <QRIcon />
      </button>

      {showQR && <QRCardModal onClose={() => setShowQR(false)} />}
    </div>
  );
}

function QRIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
      <rect x="5" y="5" width="3" height="3" fill="currentColor" stroke="none"/>
      <rect x="16" y="5" width="3" height="3" fill="currentColor" stroke="none"/>
      <rect x="5" y="16" width="3" height="3" fill="currentColor" stroke="none"/>
      <path d="M14 14h3v3M17 17v3h3M14 17h.01"/>
    </svg>
  );
}
