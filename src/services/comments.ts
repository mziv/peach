import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
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
  await addDoc(
    collection(db, "users", postOwnerUid, "posts", postId, "comments"),
    {
      authorUid,
      authorUsername,
      text,
      createdAt: serverTimestamp(),
    }
  );
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
