import {
  collection,
  doc,
  addDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  writeBatch,
  increment,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { Comment } from "../types";

export async function addComment(
  postOwnerUid: string,
  postId: string,
  authorUid: string,
  authorUsername: string,
  text: string
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
