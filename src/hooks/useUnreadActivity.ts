import { useEffect, useState } from "react";
import { collection, doc, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../config/firebase";

/**
 * True when the user has notifications newer than the last time they opened the
 * Activity screen (or has never opened it). Drives the header unread dot.
 */
export function useUnreadActivity(uid: string | undefined): boolean {
  const [newestAt, setNewestAt] = useState<number | null>(null);
  const [lastReadAt, setLastReadAt] = useState<number | null>(null);

  useEffect(() => {
    if (!uid) return;
    const q = query(
      collection(db, "users", uid, "notifications"),
      orderBy("createdAt", "desc"),
      limit(1)
    );
    const unsub = onSnapshot(q, (snap) => {
      const ts = snap.docs[0]?.data()?.createdAt?.toMillis?.() ?? null;
      setNewestAt(ts);
    });
    return unsub;
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(doc(db, "users", uid), (snap) => {
      const ts = snap.data()?.activityLastReadAt?.toMillis?.() ?? null;
      setLastReadAt(ts);
    });
    return unsub;
  }, [uid]);

  if (newestAt == null) return false;
  if (lastReadAt == null) return true;
  return newestAt > lastReadAt;
}
