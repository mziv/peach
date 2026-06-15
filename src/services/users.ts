import {
  doc,
  getDoc,
  getDocs,
  query,
  collection,
  where,
  orderBy,
  limit,
  updateDoc,
  writeBatch,
  or,
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

export async function updateDisplayName(
  uid: string,
  displayName: string
): Promise<void> {
  await updateDoc(doc(db, "users", uid), { displayName });
}

export async function deleteAccountData(uid: string): Promise<void> {
  const batch = writeBatch(db);

  // Posts, plus each post's comments and likes subcollections.
  const postsSnap = await getDocs(collection(db, "users", uid, "posts"));
  for (const postDoc of postsSnap.docs) {
    const commentsSnap = await getDocs(
      collection(db, "users", uid, "posts", postDoc.id, "comments")
    );
    commentsSnap.docs.forEach((c) => batch.delete(c.ref));

    const likesSnap = await getDocs(
      collection(db, "users", uid, "posts", postDoc.id, "likes")
    );
    likesSnap.docs.forEach((l) => batch.delete(l.ref));

    batch.delete(postDoc.ref);
  }

  // Per-user meta document.
  batch.delete(doc(db, "users", uid, "meta", "meta"));

  // Friendships the user is part of (requester or receiver).
  const friendshipsSnap = await getDocs(
    query(
      collection(db, "friendships"),
      or(where("requesterId", "==", uid), where("receiverId", "==", uid))
    )
  );
  friendshipsSnap.docs.forEach((f) => batch.delete(f.ref));

  // Finally, the user document itself.
  batch.delete(doc(db, "users", uid));

  await batch.commit();
}
