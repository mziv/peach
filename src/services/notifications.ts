import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type WriteBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { Notification } from "../types";

export function likeNotifId(postId: string, actorUid: string): string {
  return `like_${postId}_${actorUid}`;
}

interface CommentNotificationData {
  actorUid: string;
  actorUsername: string;
  actorDisplayName: string;
  actorPhotoURL?: string;
  postId: string;
  postOwnerUid: string;
  postTextPreview: string;
  commentText: string;
}

type LikeNotificationData = Omit<CommentNotificationData, "commentText">;

// Firestore rejects undefined field values (we don't set ignoreUndefinedProperties),
// so drop actorPhotoURL entirely when the actor has no profile photo.
function stripUndefinedPhoto<T extends { actorPhotoURL?: string }>(data: T): T {
  if (data.actorPhotoURL !== undefined) return data;
  const { actorPhotoURL: _omit, ...rest } = data;
  return rest as T;
}

export function addCommentNotification(
  batch: WriteBatch,
  recipientUid: string,
  data: CommentNotificationData
): void {
  const ref = doc(collection(db, "users", recipientUid, "notifications"));
  batch.set(ref, {
    type: "comment",
    ...stripUndefinedPhoto(data),
    createdAt: serverTimestamp(),
  });
}

export function addLikeNotification(
  batch: WriteBatch,
  recipientUid: string,
  data: LikeNotificationData
): void {
  const ref = doc(
    db,
    "users",
    recipientUid,
    "notifications",
    likeNotifId(data.postId, data.actorUid)
  );
  batch.set(ref, {
    type: "like",
    ...stripUndefinedPhoto(data),
    createdAt: serverTimestamp(),
  });
}

export function removeLikeNotification(
  batch: WriteBatch,
  recipientUid: string,
  postId: string,
  actorUid: string
): void {
  const ref = doc(
    db,
    "users",
    recipientUid,
    "notifications",
    likeNotifId(postId, actorUid)
  );
  batch.delete(ref);
}

export async function markActivityRead(uid: string): Promise<void> {
  await updateDoc(doc(db, "users", uid), {
    activityLastReadAt: serverTimestamp(),
  });
}

export function subscribeNotifications(
  uid: string,
  cb: (notifications: Notification[]) => void
): Unsubscribe {
  const q = query(
    collection(db, "users", uid, "notifications"),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, (snap) => {
    cb(
      snap.docs.map((d) => ({
        notifId: d.id,
        type: d.data().type,
        actorUid: d.data().actorUid,
        actorUsername: d.data().actorUsername,
        actorDisplayName: d.data().actorDisplayName,
        actorPhotoURL: d.data().actorPhotoURL,
        postId: d.data().postId,
        postOwnerUid: d.data().postOwnerUid,
        postTextPreview: d.data().postTextPreview,
        commentText: d.data().commentText,
        createdAt: d.data().createdAt?.toDate() ?? new Date(),
      }))
    );
  });
}
