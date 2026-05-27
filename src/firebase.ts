import { initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  getAuth,
  GithubAuthProvider,
  GoogleAuthProvider,
  setPersistence,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

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
export const functions = getFunctions(app, "us-central1");
export const googleProvider = new GoogleAuthProvider();
export const githubProvider = new GithubAuthProvider();

// Force Google's account picker so the user can verify which account
// they're signing into — prevents accidentally using a different
// Google account on a second device (the cause of "PC and phone show
// different data" reports — same email but the silent re-auth
// re-used a stale Google session in the mobile browser).
googleProvider.setCustomParameters({ prompt: "select_account" });

// Pin auth state to browserLocalPersistence (IndexedDB). Firebase
// defaults to this on web, but iOS Safari's Intelligent Tracking
// Prevention can quietly downgrade unset persistence to in-memory
// only — making the user appear logged out (or worse, prompting a
// re-auth that lands on a different Google account). Setting it
// explicitly keeps mobile sessions stable.
void setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.warn("Auth persistence setup failed; falling back to default.", error);
});

