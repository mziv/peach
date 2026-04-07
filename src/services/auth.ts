import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
} from "firebase/auth";
import {
  doc,
  setDoc,
  getDocs,
  query,
  collection,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "../config/firebase";

export async function signUp(
  email: string,
  password: string,
  username: string,
  displayName: string
): Promise<void> {
  const usernameLC = username.toLowerCase();

  const usernameQuery = query(
    collection(db, "users"),
    where("username", "==", usernameLC)
  );
  const existing = await getDocs(usernameQuery);
  if (!existing.empty) {
    throw new Error("Username is already taken");
  }

  const { user } = await createUserWithEmailAndPassword(auth, email, password);

  await setDoc(doc(db, "users", user.uid), {
    uid: user.uid,
    username: usernameLC,
    displayName,
    createdAt: serverTimestamp(),
  });
}

export async function logIn(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(auth, email, password);
}

export async function logOut(): Promise<void> {
  await signOut(auth);
}

export async function resetPassword(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (err: any) {
    if (
      err.code === "auth/user-not-found" ||
      err.code === "auth/invalid-email"
    ) {
      return; // Suppress for privacy — caller always shows generic success
    }
    throw err; // Re-throw network errors etc.
  }
}
