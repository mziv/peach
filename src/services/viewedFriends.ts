import {
  collection,
  doc,
  getDocs,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";

/**
 * Stamp that `uid` has just viewed `friendUid`'s page. The friend's uid is the
 * doc id so repeat views overwrite cleanly. `lastViewedAt` is a server
 * timestamp so the read state syncs across devices.
 */
export async function markFriendViewed(
  uid: string,
  friendUid: string
): Promise<void> {
  await setDoc(doc(db, "users", uid, "viewedFriends", friendUid), {
    lastViewedAt: serverTimestamp(),
  });
}

/**
 * Read `uid`'s viewedFriends subcollection into a map of friendUid ->
 * lastViewedAt. A doc whose server timestamp has not resolved yet reads back as
 * `null`; that key is still present in the map. Friends with no record are
 * simply absent (so `map[friendUid]` is `undefined`).
 */
export async function getViewedMap(
  uid: string
): Promise<Record<string, Date | null>> {
  const snap = await getDocs(collection(db, "users", uid, "viewedFriends"));
  const map: Record<string, Date | null> = {};
  for (const d of snap.docs) {
    map[d.id] = d.data().lastViewedAt?.toDate() ?? null;
  }
  return map;
}

/**
 * Whether to show a "new activity" dot for a friend.
 * - No post yet -> false.
 * - Record exists but timestamp still pending (null) -> false (just viewed).
 * - No record at all (undefined) -> true.
 * - Otherwise the post is newer than the last view.
 */
export function hasNewActivity(
  lastPostAt: Date | null,
  lastViewedAt: Date | null | undefined
): boolean {
  if (!lastPostAt) return false;
  if (lastViewedAt === undefined) return true;
  if (lastViewedAt === null) return false;
  return lastPostAt.getTime() > lastViewedAt.getTime();
}
