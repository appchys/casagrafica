import { initializeApp, getApps } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { db, firebaseConfig } from '../firebase.js';
import {
  collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc,
  query, orderBy, Timestamp
} from 'firebase/firestore';

const COLECCION = 'usuarios';

/**
 * Gets or initializes the secondary Firebase Auth instance.
 * This is used to create user credentials on the client side
 * without logging out the currently logged-in administrator.
 */
function getSecondaryAuth() {
  const secondaryAppName = "secondary-auth-manager";
  const apps = getApps();
  const existingApp = apps.find(app => app.name === secondaryAppName);
  
  let secondaryApp;
  if (existingApp) {
    secondaryApp = existingApp;
  } else {
    secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
  }
  return getAuth(secondaryApp);
}

/**
 * Get user profile and roles from Firestore
 */
export async function obtenerUsuario(uid) {
  const docRef = doc(db, COLECCION, uid);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return { _docId: snap.id, ...snap.data() };
}

/**
 * Get all user profiles from Firestore
 */
export async function obtenerTodosUsuarios() {
  const q = query(collection(db, COLECCION), orderBy('creado_en', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ _docId: d.id, ...d.data() }));
}

/**
 * Create a new user credential in Auth and their corresponding Firestore profile doc
 */
export async function crearUsuario({ email, password, nombre, rol, permisos }) {
  const secondaryAuth = getSecondaryAuth();
  
  // 1. Create in Firebase Auth
  const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
  const newUser = userCredential.user;
  const uid = newUser.uid;
  
  // Immediately sign out secondary auth so session isn't saved/polluted
  await signOut(secondaryAuth);

  // 2. Create document in Firestore
  const userDoc = {
    uid,
    email: email.trim().toLowerCase(),
    nombre: nombre.trim(),
    rol,
    permisos,
    creado_en: Timestamp.now()
  };

  await setDoc(doc(db, COLECCION, uid), userDoc);
  return userDoc;
}

/**
 * Update user details and roles in Firestore
 */
export async function actualizarUsuario(uid, { nombre, rol, permisos }) {
  const docRef = doc(db, COLECCION, uid);
  const updateData = {
    nombre: nombre.trim(),
    rol,
    permisos
  };
  await updateDoc(docRef, updateData);
  return { uid, ...updateData };
}

/**
 * Revoke/Delete user profile from Firestore
 * Note: The user credential in Auth remains, but the system denies access
 * if no Firestore profile is found (implemented in route controller).
 */
export async function eliminarUsuario(uid) {
  const docRef = doc(db, COLECCION, uid);
  await deleteDoc(docRef);
}
