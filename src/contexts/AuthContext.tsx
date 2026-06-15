import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../config/firebase";
import { User } from "../types";

interface AuthState {
  firebaseUser: FirebaseUser | null;
  user: User | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  firebaseUser: null,
  user: null,
  loading: true,
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadUser(fbUser: FirebaseUser | null) {
    if (!fbUser) {
      setUser(null);
      return;
    }
    const snap = await getDoc(doc(db, "users", fbUser.uid));
    if (snap.exists()) {
      const data = snap.data();
      setUser({
        uid: data.uid,
        username: data.username,
        displayName: data.displayName,
        createdAt: data.createdAt?.toDate() ?? new Date(),
      });
    }
  }

  async function refreshUser() {
    await loadUser(auth.currentUser);
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      try {
        await loadUser(fbUser);
      } catch (err) {
        // Never leave the app stuck on the loading spinner if the user
        // document fails to load — surface the error and continue.
        console.error("Failed to load user profile:", err);
      } finally {
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ firebaseUser, user, loading, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
