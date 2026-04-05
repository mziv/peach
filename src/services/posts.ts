import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  orderBy,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { Post } from "../types";

export async function createPost(uid: string, text: string): Promise<void> {
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
  };
}
