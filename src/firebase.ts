import { initializeApp } from "firebase/app";
import {
  getAuth,
  GithubAuthProvider,
  GoogleAuthProvider,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAwF2fJNoIWnUWPuayN8NCgGiUKSsIUW7w",
  authDomain: "github-contribution-rpg.firebaseapp.com",
  projectId: "github-contribution-rpg",
  storageBucket: "github-contribution-rpg.firebasestorage.app",
  messagingSenderId: "176078329026",
  appId: "1:176078329026:web:4dd424d016f721113a175b",
  measurementId: "G-08MWKHBYSZ",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const githubProvider = new GithubAuthProvider();
