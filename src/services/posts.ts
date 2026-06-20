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
import { db, storage } from "../config/firebase";
import { Post } from "../types";

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
  localUris: string[]
): Promise<string[]> {
  const urls: string[] = [];
  for (let i = 0; i < localUris.length; i++) {
    const response = await fetch(localUris[i]);
    const blob = await response.blob();
    const storageRef = ref(storage, `posts/${uid}/${postId}/${i}`);
    // Expo file:// blobs often have an empty `type`; default to JPEG so the
    // stored content type is meaningful for CDN headers and Storage rules.
    await uploadBytes(storageRef, blob, {
      contentType: blob.type || "image/jpeg",
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
