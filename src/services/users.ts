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
  deleteField,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "../config/firebase";
import { User } from "../types";

export async function getUserByUid(uid: string): Promise<User | null> {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    uid: data.uid,
    username: data.username,
    displayName: data.displayName,
    photoURL: data.photoURL,
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
      photoURL: data.photoURL,
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

export async function uploadProfilePhoto(
  uid: string,
  localUri: string
): Promise<string> {
  const response = await fetch(localUri);
  const blob = await response.blob();
  const storageRef = ref(storage, `avatars/${uid}`);
  await uploadBytes(storageRef, blob);
  const photoURL = await getDownloadURL(storageRef);
  await updateDoc(doc(db, "users", uid), { photoURL });
  return photoURL;
}

export async function removeProfilePhoto(uid: string): Promise<void> {
  try {
    await deleteObject(ref(storage, `avatars/${uid}`));
  } catch (err: any) {
    // A user may have set no photo yet; only re-throw unexpected errors.
    if (err?.code !== "storage/object-not-found") throw err;
  }
  await updateDoc(doc(db, "users", uid), { photoURL: deleteField() });
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

  // Remove the profile photo from Storage (not part of the Firestore batch).
  try {
    await deleteObject(ref(storage, `avatars/${uid}`));
  } catch (err: any) {
    if (err?.code !== "storage/object-not-found") throw err;
  }

  await batch.commit();
}
