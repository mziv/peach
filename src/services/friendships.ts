import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
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

/**
 * Deterministic friendship document id: the two uids sorted and joined. Because
 * the id is a pure function of the pair, the security rules can check whether
 * two users are friends with a single get() (rules cannot run queries). The
 * client and firestore.rules must compute this identically.
 */
export function pairId(uid1: string, uid2: string): string {
  return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
}

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
  await setDoc(doc(db, "friendships", pairId(requesterId, receiverId)), {
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

export async function removeFriend(friendshipId: string): Promise<void> {
  await deleteDoc(doc(db, "friendships", friendshipId));
}

export async function getFriendshipBetween(
  uid1: string,
  uid2: string
): Promise<Friendship | null> {
  const snap = await getDoc(doc(db, "friendships", pairId(uid1, uid2)));
  if (!snap.exists()) return null;
  return docToFriendship(snap);
}

export type FriendshipStatus = "none" | "pending" | "accepted";

/**
 * The signed-in user's relationship to `otherUid`, for UI such as search rows.
 * Resilient by design: a failed lookup (transient error, permission hiccup)
 * resolves to "none" so one bad probe can't reject a Promise.all and blank an
 * entire result list — the row simply shows as addable.
 */
export async function getFriendshipStatus(
  selfUid: string,
  otherUid: string
): Promise<FriendshipStatus> {
  try {
    const friendship = await getFriendshipBetween(selfUid, otherUid);
    return friendship ? friendship.status : "none";
  } catch {
    return "none";
  }
}
