import { db, auth, googleProvider } from "./firebase";
import { collection, doc, setDoc, deleteDoc, onSnapshot, getDoc, updateDoc, query, where } from "firebase/firestore";
import { signInWithPopup, signOut, onAuthStateChanged, User } from "firebase/auth";

export interface EventTab {
  id: string;
  name: string; 
  driveLink: string; 
}

export interface Gallery {
  id: string;
  userId: string; // NEW FIELD for Multi-Tenant Auth
  name: string; 
  coverImage?: string; 
  createdAt: number;
  tabs: EventTab[];
}

export const store = {
  // Firebase Authentication
  onAuthChange: (callback: (user: User | null) => void) => {
    return onAuthStateChanged(auth, callback);
  },
  login: async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  },
  logout: async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  },

  // Firebase Realtime Subscriptions (Scoped to User)
  subscribeToGalleries: (userId: string, callback: (galleries: Gallery[]) => void) => {
    const q = query(collection(db, "galleries"), where("userId", "==", userId));
    return onSnapshot(q, (snapshot) => {
      const galleries: Gallery[] = [];
      snapshot.forEach((doc) => {
        galleries.push({ id: doc.id, ...doc.data() } as Gallery);
      });
      // Sort by createdAt descending
      galleries.sort((a, b) => b.createdAt - a.createdAt);
      callback(galleries);
    });
  },

  subscribeToGallery: (id: string, callback: (gallery: Gallery | null) => void) => {
    const docRef = doc(db, "galleries", id);
    return onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        callback({ id: docSnap.id, ...docSnap.data() } as Gallery);
      } else {
        callback(null);
      }
    });
  },

  // Firebase Mutations
  createGallery: async (userId: string, name: string) => {
    const newGallery: Gallery = {
      id: crypto.randomUUID(),
      userId,
      name,
      createdAt: Date.now(),
      tabs: []
    };
    await setDoc(doc(db, "galleries", newGallery.id), newGallery);
    return newGallery;
  },

  deleteGallery: async (id: string) => {
    await deleteDoc(doc(db, "galleries", id));
  },

  addTab: async (galleryId: string, tabName: string, driveLink: string = "") => {
    const docRef = doc(db, "galleries", galleryId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const gallery = docSnap.data() as Gallery;
      const newTab: EventTab = {
        id: crypto.randomUUID(),
        name: tabName,
        driveLink
      };
      gallery.tabs.push(newTab);
      await updateDoc(docRef, { tabs: gallery.tabs });
      return newTab;
    }
    return null;
  },

  updateTabLink: async (galleryId: string, tabId: string, driveLink: string) => {
    const docRef = doc(db, "galleries", galleryId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const gallery = docSnap.data() as Gallery;
      const tabIndex = gallery.tabs.findIndex(t => t.id === tabId);
      if (tabIndex > -1) {
        gallery.tabs[tabIndex].driveLink = driveLink;
        await updateDoc(docRef, { tabs: gallery.tabs });
      }
    }
  },
  
  deleteTab: async (galleryId: string, tabId: string) => {
    const docRef = doc(db, "galleries", galleryId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const gallery = docSnap.data() as Gallery;
      gallery.tabs = gallery.tabs.filter(t => t.id !== tabId);
      await updateDoc(docRef, { tabs: gallery.tabs });
    }
  }
};
