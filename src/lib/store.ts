import { db } from "./firebase";
import { collection, doc, setDoc, deleteDoc, onSnapshot, getDoc, updateDoc } from "firebase/firestore";

export interface EventTab {
  id: string;
  name: string; 
  driveLink: string; 
}

export interface Gallery {
  id: string;
  name: string; 
  coverImage?: string; 
  createdAt: number;
  tabs: EventTab[];
}

export const store = {
  // Auth Helpers (Local Storage PIN lock)
  isAdmin: () => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("galax_admin") === "true";
  },
  login: (pin: string) => {
    if (pin === "1234") {
      localStorage.setItem("galax_admin", "true");
      return true;
    }
    return false;
  },
  logout: () => {
    localStorage.removeItem("galax_admin");
  },

  // Firebase Realtime Subscriptions
  subscribeToGalleries: (callback: (galleries: Gallery[]) => void) => {
    const q = collection(db, "galleries");
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
  createGallery: async (name: string) => {
    const newGallery: Gallery = {
      id: crypto.randomUUID(),
      name,
      createdAt: Date.now(),
      tabs: [
        { id: crypto.randomUUID(), name: "View All", driveLink: "" },
        { id: crypto.randomUUID(), name: "Workshops", driveLink: "" },
        { id: crypto.randomUUID(), name: "Trips", driveLink: "" }
      ]
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
    }
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
