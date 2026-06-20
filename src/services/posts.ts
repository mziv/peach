import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  orderBy,
  limit,
  serverTimestamp,
  writeBatch,
  updateDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { db, storage } from "../config/firebase";
import { Post } from "../types";

// Post photos render at most one screen-width wide in the feed (and full-screen
// when opened), so ~1600px on the longer edge stays crisp on high-density phones
// while shrinking typical multi-megapixel camera shots ~8–12x. As with avatars
// we re-encode on every platform because the picker's compression is native-only
// (ignored on web), and the raw upload could otherwise hit the 5 MB Storage cap.
const MAX_POST_PHOTO_EDGE = 1600;

// Picks the resize action that constrains the image's longer edge to
// MAX_POST_PHOTO_EDGE while preserving aspect ratio. Returns null when the image
// is already within bounds (don't upscale). When dimensions are unknown (some web
// picks), fall back to constraining width.
function postPhotoResize(
  dimensions?: { width?: number; height?: number }
): { width: number } | { height: number } | null {
  const { width, height } = dimensions ?? {};
  if (!width || !height) return { width: MAX_POST_PHOTO_EDGE };
  if (width <= MAX_POST_PHOTO_EDGE && height <= MAX_POST_PHOTO_EDGE) return null;
  return width >= height
    ? { width: MAX_POST_PHOTO_EDGE }
    : { height: MAX_POST_PHOTO_EDGE };
}

export async function createPost(uid: string, text: string): Promise<string> {
  const batch = writeBatch(db);

  const postRef = doc(collection(db, "users", uid, "posts"));
  batch.set(postRef, {
    text,
    createdAt: serverTimestamp(),
  });

  const metaRef = doc(db, "users", uid, "meta", "meta");
  batch.set(
    metaRef,
    {
      lastPostText: text.slice(0, 100),
      lastPostAt: serverTimestamp(),
    },
    { merge: true }
  );

  await batch.commit();
  return postRef.id;
}

export async function getPostsByUser(uid: string): Promise<Post[]> {
  const q = query(
    collection(db, "users", uid, "posts"),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    postId: d.id,
    text: d.data().text,
    createdAt: d.data().createdAt?.toDate() ?? new Date(),
    commentCount: d.data().commentCount ?? 0,
    likeCount: d.data().likeCount ?? 0,
    photoURLs: d.data().photoURLs ?? [],
  }));
}

export async function getPost(
  uid: string,
  postId: string
): Promise<Post | null> {
  const snap = await getDoc(doc(db, "users", uid, "posts", postId));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    postId: snap.id,
    text: data.text,
    createdAt: data.createdAt?.toDate() ?? new Date(),
    commentCount: data.commentCount ?? 0,
    likeCount: data.likeCount ?? 0,
    photoURLs: data.photoURLs ?? [],
  };
}

export async function deletePost(uid: string, postId: string): Promise<void> {
  // Remove Storage photos first (Firestore batches can't touch Storage).
  const postSnap = await getDoc(doc(db, "users", uid, "posts", postId));
  const photoURLs: string[] = postSnap.data()?.photoURLs ?? [];
  for (let i = 0; i < photoURLs.length; i++) {
    try {
      await deleteObject(ref(storage, `posts/${uid}/${postId}/${i}`));
    } catch (err: any) {
      // Tolerate a missing object (e.g. a partial upload); re-throw the rest.
      if (err?.code !== "storage/object-not-found") throw err;
    }
  }

  const batch = writeBatch(db);

  // Firestore does not cascade subcollection deletes, so remove the post's
  // comments and likes explicitly. At this app's scale these stay well within
  // a batch's 500-op limit.
  const commentsSnap = await getDocs(
    collection(db, "users", uid, "posts", postId, "comments")
  );
  commentsSnap.docs.forEach((d) => batch.delete(d.ref));

  const likesSnap = await getDocs(
    collection(db, "users", uid, "posts", postId, "likes")
  );
  likesSnap.docs.forEach((d) => batch.delete(d.ref));

  batch.delete(doc(db, "users", uid, "posts", postId));

  // Recompute the "last post" preview in meta. Fetch the two most-recent posts
  // so we can pick the latest one that isn't the post being deleted.
  const recentSnap = await getDocs(
    query(
      collection(db, "users", uid, "posts"),
      orderBy("createdAt", "desc"),
      limit(2)
    )
  );
  const nextLatest = recentSnap.docs.find((d) => d.id !== postId);

  const metaRef = doc(db, "users", uid, "meta", "meta");
  if (nextLatest) {
    batch.set(
      metaRef,
      {
        lastPostText: (nextLatest.data().text ?? "").slice(0, 100),
        lastPostAt: nextLatest.data().createdAt ?? null,
      },
      { merge: true }
    );
  } else {
    batch.set(metaRef, { lastPostText: "", lastPostAt: null }, { merge: true });
  }

  await batch.commit();
}

export async function uploadPostPhotos(
  uid: string,
  postId: string,
  photos: Array<{ uri: string; width?: number; height?: number }>
): Promise<string[]> {
  const urls: string[] = [];
  for (let i = 0; i < photos.length; i++) {
    // Downscale + re-encode before upload so feed photos stay small on every
    // platform (the picker's compression is native-only). expo-image-manipulator
    // works on web via canvas, which closes that gap.
    const context = ImageManipulator.manipulate(photos[i].uri);
    const resize = postPhotoResize(photos[i]);
    if (resize) context.resize(resize);
    const rendered = await context.renderAsync();
    const out = await rendered.saveAsync({
      compress: 0.7,
      format: SaveFormat.JPEG,
    });

    const response = await fetch(out.uri);
    const blob = await response.blob();
    const storageRef = ref(storage, `posts/${uid}/${postId}/${i}`);
    // We always re-encode to JPEG above, so record that content type explicitly
    // (the manipulated blob's `type` may be empty) — meaningful for CDN headers
    // and Storage rules.
    await uploadBytes(storageRef, blob, {
      contentType: "image/jpeg",
    });
    urls.push(await getDownloadURL(storageRef));
  }
  return urls;
}

export async function updatePost(
  uid: string,
  postId: string,
  fields: { photoURLs?: string[] }
): Promise<void> {
  await updateDoc(doc(db, "users", uid, "posts", postId), fields);
}
