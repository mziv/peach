import {
  collection,
  doc,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  or,
  and,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { Friendship } from "../types";

function docToFriendship(d: any): Friendship {
  const data = d.data();
  return {
    friendshipId: d.id,
    requesterId: data.requesterId,
    receiverId: data.receiverId,
    status: data.status,
    createdAt: data.createdAt?.toDate() ?? new Date(),
  };
}

export async function sendFriendRequest(
  requesterId: string,
  receiverId: string
): Promise<void> {
  await addDoc(collection(db, "friendships"), {
    requesterId,
    receiverId,
    status: "pending",
    createdAt: serverTimestamp(),
  });
}

export async function acceptFriendRequest(
  friendshipId: string
): Promise<void> {
  await updateDoc(doc(db, "friendships", friendshipId), {
    status: "accepted",
  });
}

export async function declineFriendRequest(
  friendshipId: string
): Promise<void> {
  await deleteDoc(doc(db, "friendships", friendshipId));
}

export async function getFriendships(uid: string): Promise<Friendship[]> {
  const q = query(
    collection(db, "friendships"),
    and(
      where("status", "==", "accepted"),
      or(
        where("requesterId", "==", uid),
        where("receiverId", "==", uid)
      )
    )
  );
  const snap = await getDocs(q);
  return snap.docs.map(docToFriendship);
}

export async function getPendingRequests(uid: string): Promise<Friendship[]> {
  const q = query(
    collection(db, "friendships"),
    where("receiverId", "==", uid),
    where("status", "==", "pending")
  );
  const snap = await getDocs(q);
  return snap.docs.map(docToFriendship);
}

export async function getOutgoingRequests(uid: string): Promise<Friendship[]> {
  const q = query(
    collection(db, "friendships"),
    where("requesterId", "==", uid),
    where("status", "==", "pending")
  );
  const snap = await getDocs(q);
  return snap.docs.map(docToFriendship);
}

export async function getFriendshipBetween(
  uid1: string,
  uid2: string
): Promise<Friendship | null> {
  const q = query(
    collection(db, "friendships"),
    or(
      and(where("requesterId", "==", uid1), where("receiverId", "==", uid2)),
      and(where("requesterId", "==", uid2), where("receiverId", "==", uid1))
    )
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return docToFriendship(snap.docs[0]);
}
