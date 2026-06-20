import { initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  getAuth,
  GithubAuthProvider,
  GoogleAuthProvider,
  OAuthProvider,
  setPersistence,
} from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";
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
// ignoreUndefinedProperties: profiles built via normalizeUserProfile carry
// undefined org fields (organizationId/Name/Role) for users with no org.
// Without this, any setDoc embedding such a profile (e.g. friend requests'
// fromProfile/toProfile) throws on the undefined value, silently dropping
// the write — which made friend requests never reach the recipient.
export const db = initializeFirestore(app, { ignoreUndefinedProperties: true });
export const functions = getFunctions(app, "us-central1");
export const googleProvider = new GoogleAuthProvider();
export const githubProvider = new GithubAuthProvider();

// Sign in with Apple. Required by App Store Review Guideline 4.8 whenever
// the app offers a third-party social login (Google) on iOS. Apple only
// returns name/email on the *first* authorization, so request both scopes
// up front. Works on web/Electron once Apple is enabled as a Firebase
// sign-in provider; on the native iOS shell it routes through the
// Capacitor Firebase Authentication plugin (added separately).
export const appleProvider = new OAuthProvider("apple.com");
appleProvider.addScope("email");
appleProvider.addScope("name");

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

