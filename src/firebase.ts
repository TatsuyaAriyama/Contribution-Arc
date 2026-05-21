import { initializeApp } from "firebase/app";
import {
  getAuth,
  GithubAuthProvider,
  GoogleAuthProvider,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAwF2fJNoIWnUWPuayN8NCgGiUKSsIUW7w",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "github-contribution-rpg.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "github-contribution-rpg",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "github-contribution-rpg.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "176078329026",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:176078329026:web:4dd424d016f721113a175b",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-08MWKHBYSZ",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
export const githubProvider = new GithubAuthProvider();
