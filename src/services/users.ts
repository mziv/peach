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
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { db, storage } from "../config/firebase";
import { User } from "../types";

// Avatars never display larger than a ~40px list row / profile header, so even
// on a 3x-density screen ~128px is plenty (40 × 3 = 120 physical px). Capping the
// longer edge here keeps stored files tiny (~10–30 KB) — so feeds download far
// less — and compresses on web too, where the picker's quality options are ignored.
const MAX_AVATAR_EDGE = 128;

// Picks the resize action that constrains the image's longer edge to
// MAX_AVATAR_EDGE while preserving aspect ratio. Returns null when the image is
// already within bounds (don't upscale) or its dimensions are equal. When
// dimensions are unknown (some web picks), fall back to constraining width.
function avatarResize(
  dimensions?: { width?: number; height?: number }
): { width: number } | { height: number } | null {
  const { width, height } = dimensions ?? {};
  if (!width || !height) return { width: MAX_AVATAR_EDGE };
  if (width <= MAX_AVATAR_EDGE && height <= MAX_AVATAR_EDGE) return null;
  return width >= height
    ? { width: MAX_AVATAR_EDGE }
    : { height: MAX_AVATAR_EDGE };
}

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
  localUri: string,
  dimensions?: { width?: number; height?: number }
): Promise<string> {
  // Downscale + re-encode before upload so avatars stay small on every
  // platform (the picker's compression is native-only). expo-image-manipulator
  // works on web via canvas, which closes that gap.
  const context = ImageManipulator.manipulate(localUri);
  const resize = avatarResize(dimensions);
  if (resize) context.resize(resize);
  const rendered = await context.renderAsync();
  const resized = await rendered.saveAsync({
    compress: 0.7,
    format: SaveFormat.JPEG,
  });

  const response = await fetch(resized.uri);
  const blob = await response.blob();
  const storageRef = ref(storage, `avatars/${uid}`);
  // We always re-encode to JPEG above, so record that content type explicitly
  // (the manipulated blob's `type` may be empty) — meaningful for CDN headers
  // and Storage rules.
  await uploadBytes(storageRef, blob, {
    contentType: "image/jpeg",
  });
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
  // Storage and Firestore can't share a transaction, so we delete the image
  // first and commit the Firestore batch last: if the commit fails, we've at
  // worst removed an avatar we can no longer reference, never the reverse.
  try {
    await deleteObject(ref(storage, `avatars/${uid}`));
  } catch (err: any) {
    if (err?.code !== "storage/object-not-found") throw err;
  }

  await batch.commit();
}
