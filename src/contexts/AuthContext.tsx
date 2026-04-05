import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../config/firebase";
import { User } from "../types";

interface AuthState {
  firebaseUser: FirebaseUser | null;
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthState>({
  firebaseUser: null,
  user: null,
  loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
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
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ firebaseUser, user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
