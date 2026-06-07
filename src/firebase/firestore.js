import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  addDoc,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore';
import { db } from './config';

// ─── USERS ───────────────────────────────────────────────────────────────────

export const createUserDocument = async (uid, data) => {
  await setDoc(doc(db, 'users', uid), {
    nombre: data.nombre || '',
    apellido: data.apellido || '',
    usuario: data.usuario || '',
    email: data.email || '',
    phone_number: data.phone_number || '',
    creditos: 0,
    rol: 'general',
    is_active: true,
    created_time: serverTimestamp(),
    last_login: serverTimestamp(),
  });
};

export const getUserDocument = async (uid) => {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const updateUserDocument = async (uid, data) => {
  await updateDoc(doc(db, 'users', uid), data);
};

export const isUsernameAvailable = async (usuario) => {
  const q = query(collection(db, 'users'), where('usuario', '==', usuario));
  const snap = await getDocs(q);
  return snap.empty;
};

// Gets ALL users, sorted client-side (single orderBy is fine for auto-index)
export const getAllUsers = (callback) => {
  return onSnapshot(
    collection(db, 'users'),
    (snap) => {
      const users = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.created_time?.toMillis?.() || 0) - (a.created_time?.toMillis?.() || 0));
      callback(users);
    },
    (err) => console.error('[getAllUsers] onSnapshot error:', err)
  );
};

// Gets only general users
export const getGeneralUsers = (callback) => {
  return onSnapshot(
    query(collection(db, 'users'), where('rol', '==', 'general')),
    (snap) => {
      const users = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
      callback(users);
    },
    (err) => console.error('[getGeneralUsers] onSnapshot error:', err)
  );
};

export const updateUserRole = async (uid, rol) => {
  await updateDoc(doc(db, 'users', uid), { rol });
};

// ─── TRANSACCIONES ────────────────────────────────────────────────────────────

export const addTransaction = async ({ userRef, adminRef, monto, titulo, tipo }) => {
  await addDoc(collection(db, 'transacciones'), {
    user_ref: userRef,
    admin_ref: adminRef || null,
    monto,
    titulo,
    tipo,
    fecha: serverTimestamp(),
  });
};

/**
 * Subscribes to ALL transactions.
 * Filtering by tipo / user_ref is done client-side to avoid
 * composite index requirements that would otherwise fail silently.
 */
export const getAllTransactions = (callback) => {
  return onSnapshot(
    collection(db, 'transacciones'),
    (snap) => {
      const txs = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.fecha?.toMillis?.() || 0) - (a.fecha?.toMillis?.() || 0));
      callback(txs);
    },
    (err) => console.error('[getAllTransactions] onSnapshot error:', err)
  );
};

// ─── ARCADE MACHINE ──────────────────────────────────────────────────────────

const MACHINE_ID = 'main';

export const getMachineState = (callback) => {
  return onSnapshot(
    doc(db, 'arcade_machine', MACHINE_ID),
    (snap) => callback(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    (err) => console.error('[getMachineState] onSnapshot error:', err)
  );
};

// Paso 1: Usuario pulsa CONECTAR → reserva la máquina (sin cobrar)
export const setMachineReserved = async (userRef) => {
  await setDoc(doc(db, 'arcade_machine', MACHINE_ID), {
    estado: 'reservado',
    usuario_activo_ref: userRef,
    inicio_sesion: serverTimestamp(),
    ultima_actualizacion: serverTimestamp(),
  });
};

// Paso 2: Python confirma → cambia a ocupado (la app cobra aquí)
export const setMachineOccupied = async (userRef) => {
  await setDoc(doc(db, 'arcade_machine', MACHINE_ID), {
    estado: 'ocupado',
    usuario_activo_ref: userRef,
    inicio_sesion: serverTimestamp(),
    ultima_actualizacion: serverTimestamp(),
  });
};

export const setMachineFree = async () => {
  await updateDoc(doc(db, 'arcade_machine', MACHINE_ID), {
    estado: 'libre',
    usuario_activo_ref: null,
    inicio_sesion: null,
    ultima_actualizacion: serverTimestamp(),
  });
};
