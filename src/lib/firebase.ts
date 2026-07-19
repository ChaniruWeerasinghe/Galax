import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB4waGq8-5GVvWV6mMiniw512T8Q3Amw54",
  authDomain: "galax-pro-web.firebaseapp.com",
  projectId: "galax-pro-web",
  storageBucket: "galax-pro-web.firebasestorage.app",
  messagingSenderId: "605822212961",
  appId: "1:605822212961:web:fa65886d3af8bebab04320"
};

// Initialize Firebase securely (avoiding re-initialization errors in Next.js)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

export { db };
