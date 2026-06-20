import {
  collection,
  doc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  writeBatch,
  increment,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { Comment } from "../types";
import { addCommentNotification } from "./notifications";

export async function addComment(
  postOwnerUid: string,
  postId: string,
  authorUid: string,
  authorUsername: string,
  authorDisplayName: string,
  authorPhotoURL: string | undefined,
  text: string,
  postText: string
): Promise<void> {
  const batch = writeBatch(db);

  const commentRef = doc(
    collection(db, "users", postOwnerUid, "posts", postId, "comments")
  );
  batch.set(commentRef, {
    authorUid,
    authorUsername,
    text,
    createdAt: serverTimestamp(),
  });

  const postRef = doc(db, "users", postOwnerUid, "posts", postId);
  batch.update(postRef, { commentCount: increment(1) });

  if (authorUid !== postOwnerUid) {
    addCommentNotification(batch, postOwnerUid, {
      actorUid: authorUid,
      actorUsername: authorUsername,
      actorDisplayName: authorDisplayName,
      actorPhotoURL: authorPhotoURL,
      postId,
      postOwnerUid,
      postTextPreview: postText.slice(0, 100),
      commentText: text,
    });
  }

  await batch.commit();
}

export async function getComments(
  postOwnerUid: string,
  postId: string
): Promise<Comment[]> {
  const q = query(
    collection(db, "users", postOwnerUid, "posts", postId, "comments"),
    orderBy("createdAt", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    commentId: d.id,
    authorUid: d.data().authorUid,
    authorUsername: d.data().authorUsername,
    text: d.data().text,
    createdAt: d.data().createdAt?.toDate() ?? new Date(),
  }));
}

export async function deleteComment(
  postOwnerUid: string,
  postId: string,
  commentId: string
): Promise<void> {
  const batch = writeBatch(db);

  batch.delete(
    doc(db, "users", postOwnerUid, "posts", postId, "comments", commentId)
  );

  const postRef = doc(db, "users", postOwnerUid, "posts", postId);
  batch.update(postRef, { commentCount: increment(-1) });

  await batch.commit();
}
