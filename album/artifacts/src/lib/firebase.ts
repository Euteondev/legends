import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "album-figurinhas-92cb6.firebaseapp.com",
  projectId: "album-figurinhas-92cb6",
  storageBucket: "album-figurinhas-92cb6.firebasestorage.app",
  messagingSenderId: "380612251283",
  appId: "1:380612251283:web:7548c600a4ae3743f0c766",
  measurementId: "G-FR4T7W7NE3",
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

export const analyticsPromise = isSupported().then((supported) =>
  supported ? getAnalytics(app) : null
);
