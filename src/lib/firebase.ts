import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyB4waGq8-5GVvWV6mMiniw512T8Q3Amw54",
  authDomain: "galax-pro-web.firebaseapp.com",
  projectId: "galax-pro-web",
  storageBucket: "galax-pro-web.firebasestorage.app",
  messagingSenderId: "605822212961",
  appId: "1:605822212961:web:fa65886d3af8bebab04320"
};

// Initialize Firebase securely
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export { db, auth, googleProvider };
