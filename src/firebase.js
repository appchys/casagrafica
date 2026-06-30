import { initializeApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getAuth } from "firebase/auth";

export const firebaseConfig = {
  apiKey: "AIzaSyD4UycOgtyvdV3JGq3k0oiQ2HTR8rs-X4s",
  authDomain: "casa-grafica.firebaseapp.com",
  projectId: "casa-grafica",
  storageBucket: "casa-grafica.firebasestorage.app",
  messagingSenderId: "271014582350",
  appId: "1:271014582350:web:80243320b021baf36d8b1f"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Enable offline persistence
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn('Persistence failed: Multiple tabs open');
  } else if (err.code === 'unimplemented') {
    console.warn('Persistence not available in this browser');
  }
});
