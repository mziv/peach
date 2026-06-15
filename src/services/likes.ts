import {
  doc,
  getDoc,
  writeBatch,
  increment,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { addLikeNotification, removeLikeNotification } from "./notifications";

export async function likePost(
  postOwnerUid: string,
  postId: string,
  likerUid: string,
  likerUsername: string,
  likerDisplayName: string,
  postText: string
): Promise<void> {
  const batch = writeBatch(db);

  const likeRef = doc(db, "users", postOwnerUid, "posts", postId, "likes", likerUid);
  batch.set(likeRef, { likedAt: new Date() });

  const postRef = doc(db, "users", postOwnerUid, "posts", postId);
  batch.update(postRef, { likeCount: increment(1) });

  if (likerUid !== postOwnerUid) {
    addLikeNotification(batch, postOwnerUid, {
      actorUid: likerUid,
      actorUsername: likerUsername,
      actorDisplayName: likerDisplayName,
      postId,
      postOwnerUid,
      postTextPreview: postText.slice(0, 100),
    });
  }

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

  if (likerUid !== postOwnerUid) {
    removeLikeNotification(batch, postOwnerUid, postId, likerUid);
  }

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
