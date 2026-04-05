import {
  doc,
  getDoc,
  getDocs,
  query,
  collection,
  where,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { User } from "../types";

export async function getUserByUid(uid: string): Promise<User | null> {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    uid: data.uid,
    username: data.username,
    displayName: data.displayName,
    createdAt: data.createdAt?.toDate() ?? new Date(),
  };
}

export async function searchUsersByUsername(
  searchTerm: string
): Promise<User[]> {
  const term = searchTerm.toLowerCase();
  const q = query(
    collection(db, "users"),
    where("username", ">=", term),
    where("username", "<=", term + "\uf8ff"),
    orderBy("username"),
    limit(20)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      uid: data.uid,
      username: data.username,
      displayName: data.displayName,
      createdAt: data.createdAt?.toDate() ?? new Date(),
    };
  });
}
