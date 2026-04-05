import {
  doc,
  getDoc,
  deleteDoc,
  writeBatch,
  increment,
} from "firebase/firestore";
import { db } from "../config/firebase";

export async function likePost(
  postOwnerUid: string,
  postId: string,
  likerUid: string
): Promise<void> {
  const batch = writeBatch(db);

  const likeRef = doc(db, "users", postOwnerUid, "posts", postId, "likes", likerUid);
  batch.set(likeRef, { likedAt: new Date() });

  const postRef = doc(db, "users", postOwnerUid, "posts", postId);
  batch.update(postRef, { likeCount: increment(1) });

  await batch.commit();
}

export async function unlikePost(
  postOwnerUid: string,
  postId: string,
  likerUid: string
): Promise<void> {
  const batch = writeBatch(db);

  const likeRef = doc(db, "users", postOwnerUid, "posts", postId, "likes", likerUid);
  batch.delete(likeRef);

  const postRef = doc(db, "users", postOwnerUid, "posts", postId);
  batch.update(postRef, { likeCount: increment(-1) });

  await batch.commit();
}

export async function hasLiked(
  postOwnerUid: string,
  postId: string,
  likerUid: string
): Promise<boolean> {
  const likeRef = doc(db, "users", postOwnerUid, "posts", postId, "likes", likerUid);
  const snap = await getDoc(likeRef);
  return snap.exists();
}
