# Activity Feed / Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an in-app activity feed so users see when others comment on or like their posts, with an unread dot on the My Page bell.

**Architecture:** A new `users/{uid}/notifications` subcollection is written transactionally inside the existing `addComment` / `likePost` / `unlikePost` batches (fan-out to the post owner, never to self). A `notifications` service owns the notification shape and read-side helpers. A new Activity screen subscribes to the feed; a `useUnreadActivity` hook drives the header dot. Read state lives in `activityLastReadAt` on the user doc.

**Tech Stack:** Expo / React Native, TypeScript, Firebase Firestore (web SDK), React Navigation (native stack), Jest + `@testing-library/react-native`.

**Design spec:** `docs/superpowers/specs/2026-06-14-activity-feed-design.md`

---

## File Structure

**Create:**
- `src/services/notifications.ts` — notification shape (batch helpers) + read-side (`subscribeNotifications`, `markActivityRead`, `likeNotifId`).
- `src/hooks/useUnreadActivity.ts` — boolean hook for the unread dot.
- `src/components/ActivityRow.tsx` — presentational single-row component.
- `src/screens/activity/ActivityScreen.tsx` — the Activity feed screen.
- `firestore.rules` — security rules (reference/manual; no deploy config in-repo).
- `tests/services/notifications.test.ts`
- `tests/components/ActivityRow.test.tsx`

**Modify:**
- `src/types/index.ts` — add `Notification` type.
- `src/services/comments.ts` — `addComment` new signature + comment fan-out.
- `src/services/likes.ts` — `likePost`/`unlikePost` new signatures + like fan-out.
- `src/components/CommentModal.tsx` — accept `postText`, pass `displayName` + `postText` to `addComment`.
- `src/screens/mypage/MyPageScreen.tsx` — pass new args to `likePost`/modal; navigate bell to Activity; unread dot; handle `focusPostId`/`openComments` params.
- `src/screens/home/FriendPageScreen.tsx` — pass new args to `likePost`/modal.
- `src/navigation/HomeStack.tsx` — add `Activity` route; extend `MyPage` params.
- `tests/services/comments.test.ts`, `tests/services/likes.test.ts` — updated for new signatures + fan-out.
- `README.md` — tick the six Activity-feed checkboxes + rules note.

---

## Task 1: Notification type + notifications service

**Files:**
- Modify: `src/types/index.ts`
- Create: `src/services/notifications.ts`
- Test: `tests/services/notifications.test.ts`

- [ ] **Step 1: Add the `Notification` type**

Append to `src/types/index.ts`:

```ts
export interface Notification {
  notifId: string;
  type: "comment" | "like";
  actorUid: string;
  actorUsername: string;
  actorDisplayName: string;
  postId: string;
  postOwnerUid: string;
  postTextPreview: string;
  commentText?: string;
  createdAt: Date;
}
```

- [ ] **Step 2: Write the failing test**

Create `tests/services/notifications.test.ts`:

```ts
import { onSnapshot, updateDoc } from "firebase/firestore";
import {
  likeNotifId,
  addCommentNotification,
  addLikeNotification,
  removeLikeNotification,
  markActivityRead,
  subscribeNotifications,
} from "../../src/services/notifications";

jest.mock("firebase/firestore", () => ({
  collection: jest.fn(() => "mock-collection-ref"),
  doc: jest.fn(() => "mock-doc-ref"),
  query: jest.fn(() => "mock-query"),
  orderBy: jest.fn(),
  onSnapshot: jest.fn(),
  updateDoc: jest.fn(),
  serverTimestamp: jest.fn(() => "mock-timestamp"),
}));

jest.mock("../../src/config/firebase", () => ({ db: {} }));

describe("notifications service", () => {
  beforeEach(() => jest.clearAllMocks());

  it("likeNotifId is deterministic", () => {
    expect(likeNotifId("post-1", "actor-1")).toBe("like_post-1_actor-1");
  });

  it("addCommentNotification sets a comment notif on the batch", () => {
    const batch = { set: jest.fn(), delete: jest.fn() };
    addCommentNotification(batch as any, "owner-1", {
      actorUid: "actor-1",
      actorUsername: "bob",
      actorDisplayName: "Bob",
      postId: "post-1",
      postOwnerUid: "owner-1",
      postTextPreview: "hello",
      commentText: "nice!",
    });
    expect(batch.set).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: "comment",
        actorUid: "actor-1",
        commentText: "nice!",
        createdAt: "mock-timestamp",
      })
    );
  });

  it("addLikeNotification sets a like notif on the batch", () => {
    const batch = { set: jest.fn(), delete: jest.fn() };
    addLikeNotification(batch as any, "owner-1", {
      actorUid: "actor-1",
      actorUsername: "bob",
      actorDisplayName: "Bob",
      postId: "post-1",
      postOwnerUid: "owner-1",
      postTextPreview: "hello",
    });
    expect(batch.set).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: "like", actorUid: "actor-1" })
    );
  });

  it("removeLikeNotification deletes from the batch", () => {
    const batch = { set: jest.fn(), delete: jest.fn() };
    removeLikeNotification(batch as any, "owner-1", "post-1", "actor-1");
    expect(batch.delete).toHaveBeenCalled();
  });

  it("markActivityRead updates the user doc with a server timestamp", async () => {
    (updateDoc as jest.Mock).mockResolvedValue(undefined);
    await markActivityRead("uid-1");
    expect(updateDoc).toHaveBeenCalledWith(expect.anything(), {
      activityLastReadAt: "mock-timestamp",
    });
  });

  it("subscribeNotifications maps snapshot docs newest-first", () => {
    const cb = jest.fn();
    (onSnapshot as jest.Mock).mockImplementation((_q, handler) => {
      handler({
        docs: [
          {
            id: "n-1",
            data: () => ({
              type: "like",
              actorUid: "a",
              actorUsername: "u",
              actorDisplayName: "U",
              postId: "p",
              postOwnerUid: "o",
              postTextPreview: "x",
              createdAt: { toDate: () => new Date("2026-06-01") },
            }),
          },
        ],
      });
      return () => undefined;
    });
    const unsub = subscribeNotifications("uid-1", cb);
    expect(cb).toHaveBeenCalledWith([
      expect.objectContaining({ notifId: "n-1", type: "like" }),
    ]);
    expect(typeof unsub).toBe("function");
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx jest tests/services/notifications.test.ts`
Expected: FAIL — `Cannot find module '../../src/services/notifications'`.

- [ ] **Step 4: Implement the service**

Create `src/services/notifications.ts`:

```ts
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
  postId: string;
  postOwnerUid: string;
  postTextPreview: string;
  commentText: string;
}

type LikeNotificationData = Omit<CommentNotificationData, "commentText">;

export function addCommentNotification(
  batch: WriteBatch,
  recipientUid: string,
  data: CommentNotificationData
): void {
  const ref = doc(collection(db, "users", recipientUid, "notifications"));
  batch.set(ref, { type: "comment", ...data, createdAt: serverTimestamp() });
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
  batch.set(ref, { type: "like", ...data, createdAt: serverTimestamp() });
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
        postId: d.data().postId,
        postOwnerUid: d.data().postOwnerUid,
        postTextPreview: d.data().postTextPreview,
        commentText: d.data().commentText,
        createdAt: d.data().createdAt?.toDate() ?? new Date(),
      }))
    );
  });
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx jest tests/services/notifications.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add src/types/index.ts src/services/notifications.ts tests/services/notifications.test.ts
git commit -m "feat: notifications service + Notification type"
```

---

## Task 2: Firestore security rules

**Files:**
- Create: `firestore.rules`

- [ ] **Step 1: Write the rules file**

Create `firestore.rules`:

```
rules_version = '2';

// NOTE: This repo has no firebase.json / deploy config. These rules are the
// intended security model and must be applied manually in the Firebase console.
service cloud.firestore {
  match /databases/{database}/documents {

    // A signed-in user can read any profile and write only their own.
    match /users/{uid} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == uid;

      // Posts and their subcollections.
      match /posts/{postId} {
        allow read: if request.auth != null;
        // Owner manages their own posts.
        allow create, update, delete: if request.auth.uid == uid;
        // Comment/like counters are bumped by actors, so allow signed-in updates.
        allow update: if request.auth != null;

        match /comments/{commentId} {
          allow read: if request.auth != null;
          allow create: if request.auth.uid == request.resource.data.authorUid;
        }

        match /likes/{likerUid} {
          allow read: if request.auth != null;
          allow create, delete: if request.auth.uid == likerUid;
        }
      }

      // Activity feed: only the owner reads their notifications. An actor may
      // create one on the owner's post, and remove their own like notification.
      match /notifications/{notifId} {
        allow read: if request.auth.uid == uid;
        allow create: if request.auth != null
          && request.resource.data.actorUid == request.auth.uid;
        allow delete: if request.auth.uid == resource.data.actorUid;
      }

      match /meta/{docId} {
        allow read: if request.auth != null;
        allow write: if request.auth.uid == uid;
      }
    }

    // Friendships are top-level docs between two users.
    match /friendships/{id} {
      allow read: if request.auth != null;
      allow create, update, delete: if request.auth != null;
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add firestore.rules
git commit -m "feat: firestore.rules with notifications model (manual deploy)"
```

---

## Task 3: Comment fan-out

**Files:**
- Modify: `src/services/comments.ts`
- Modify: `src/components/CommentModal.tsx`
- Modify: `src/screens/mypage/MyPageScreen.tsx` (pass `postText` into the modal)
- Modify: `src/screens/home/FriendPageScreen.tsx` (pass `postText` into the modal)
- Test: `tests/services/comments.test.ts`

- [ ] **Step 1: Update the failing tests**

Replace the `addComment` test in `tests/services/comments.test.ts` and add a self-guard test. Add `addCommentNotification` to the firestore mock is **not** needed (we mock the notifications service instead). Update the top of the file:

```ts
import { getDocs, writeBatch } from "firebase/firestore";
import { addComment, getComments } from "../../src/services/comments";

jest.mock("firebase/firestore", () => ({
  collection: jest.fn(() => "mock-collection-ref"),
  doc: jest.fn(() => "mock-doc-ref"),
  getDocs: jest.fn(),
  query: jest.fn(),
  orderBy: jest.fn(),
  serverTimestamp: jest.fn(() => "mock-timestamp"),
  writeBatch: jest.fn(),
  increment: jest.fn((n) => `increment(${n})`),
}));

jest.mock("../../src/config/firebase", () => ({ db: {} }));
```

Replace the `describe("addComment", ...)` block with:

```ts
  describe("addComment", () => {
    function mockBatchSetup() {
      const mockBatch = {
        set: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined),
      };
      (writeBatch as jest.Mock).mockReturnValue(mockBatch);
      return mockBatch;
    }

    it("creates a comment and increments commentCount in a batch", async () => {
      const mockBatch = mockBatchSetup();

      await addComment(
        "owner-1",
        "post-1",
        "uid-2",
        "commenter",
        "Commenter Name",
        "Nice post!",
        "the original post text"
      );

      expect(mockBatch.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          authorUid: "uid-2",
          authorUsername: "commenter",
          text: "Nice post!",
        })
      );
      expect(mockBatch.update).toHaveBeenCalledWith(expect.anything(), {
        commentCount: "increment(1)",
      });
      expect(mockBatch.commit).toHaveBeenCalled();
    });

    it("fans out a comment notification to the post owner", async () => {
      const mockBatch = mockBatchSetup();

      await addComment(
        "owner-1",
        "post-1",
        "uid-2",
        "commenter",
        "Commenter Name",
        "Nice post!",
        "the original post text"
      );

      // comment doc + notification doc = two set() calls
      expect(mockBatch.set).toHaveBeenCalledTimes(2);
      expect(mockBatch.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ type: "comment", actorUid: "uid-2" })
      );
    });

    it("does not notify when commenting on your own post", async () => {
      const mockBatch = mockBatchSetup();

      await addComment(
        "owner-1",
        "post-1",
        "owner-1",
        "owner",
        "Owner Name",
        "self comment",
        "my own post"
      );

      // only the comment doc, no notification
      expect(mockBatch.set).toHaveBeenCalledTimes(1);
    });
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest tests/services/comments.test.ts`
Expected: FAIL — `addComment` called with too many args / no notification `set`.

- [ ] **Step 3: Update `addComment`**

In `src/services/comments.ts`, add the import and replace `addComment`:

```ts
import { addCommentNotification } from "./notifications";
```

```ts
export async function addComment(
  postOwnerUid: string,
  postId: string,
  authorUid: string,
  authorUsername: string,
  authorDisplayName: string,
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
      postId,
      postOwnerUid,
      postTextPreview: postText.slice(0, 100),
      commentText: text,
    });
  }

  await batch.commit();
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest tests/services/comments.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Thread `postText` through `CommentModal`**

In `src/components/CommentModal.tsx`, add `postText` to the props interface:

```ts
interface CommentModalProps {
  visible: boolean;
  onClose: () => void;
  postOwnerUid: string;
  postId: string;
  postText: string;
}
```

Destructure it:

```ts
export default function CommentModal({
  visible,
  onClose,
  postOwnerUid,
  postId,
  postText,
}: CommentModalProps) {
```

Update the `addComment` call inside `handleSend`:

```ts
      await addComment(
        postOwnerUid,
        postId,
        user.uid,
        user.username,
        user.displayName,
        commentText.trim(),
        postText
      );
```

- [ ] **Step 6: Pass `postText` from the screens**

In `src/screens/mypage/MyPageScreen.tsx`, extend the `commentModal` state and its setters:

```ts
  const [commentModal, setCommentModal] = useState<{
    visible: boolean;
    postOwnerUid: string;
    postId: string;
    postText: string;
  }>({ visible: false, postOwnerUid: "", postId: "", postText: "" });
```

In the `PostItem` `onCommentPress`:

```ts
            onCommentPress={() =>
              setCommentModal({
                visible: true,
                postOwnerUid: user!.uid,
                postId: item.postId,
                postText: item.text,
              })
            }
```

And the `CommentModal` element:

```tsx
      <CommentModal
        visible={commentModal.visible}
        onClose={() => setCommentModal({ ...commentModal, visible: false })}
        postOwnerUid={commentModal.postOwnerUid}
        postId={commentModal.postId}
        postText={commentModal.postText}
      />
```

Apply the same three changes in `src/screens/home/FriendPageScreen.tsx` (its `onCommentPress` uses `friendUid` for `postOwnerUid` — keep that, just add `postText: item.text`).

- [ ] **Step 7: Verify the suite still passes**

Run: `npx jest`
Expected: PASS (all suites).

- [ ] **Step 8: Commit**

```bash
git add src/services/comments.ts src/components/CommentModal.tsx src/screens/mypage/MyPageScreen.tsx src/screens/home/FriendPageScreen.tsx tests/services/comments.test.ts
git commit -m "feat: fan out comment notifications to the post owner"
```

---

## Task 4: Like fan-out

**Files:**
- Modify: `src/services/likes.ts`
- Modify: `src/screens/mypage/MyPageScreen.tsx` (pass new args to `likePost`)
- Modify: `src/screens/home/FriendPageScreen.tsx` (pass new args to `likePost`)
- Test: `tests/services/likes.test.ts`

- [ ] **Step 1: Update the failing tests**

In `tests/services/likes.test.ts`, give each mock batch a `delete`/`set` as needed and update calls. Replace the `likePost` and `unlikePost` describe blocks:

```ts
  describe("likePost", () => {
    it("creates a like doc, increments likeCount, and notifies the owner", async () => {
      const mockBatch = {
        set: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined),
      };
      (writeBatch as jest.Mock).mockReturnValue(mockBatch);

      await likePost("owner-1", "post-1", "liker-1", "liker", "Liker", "post text");

      // like doc + notification doc
      expect(mockBatch.set).toHaveBeenCalledTimes(2);
      expect(mockBatch.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ type: "like", actorUid: "liker-1" })
      );
      expect(mockBatch.update).toHaveBeenCalledWith(expect.anything(), {
        likeCount: "increment(1)",
      });
      expect(mockBatch.commit).toHaveBeenCalled();
    });

    it("does not notify when liking your own post", async () => {
      const mockBatch = {
        set: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined),
      };
      (writeBatch as jest.Mock).mockReturnValue(mockBatch);

      await likePost("owner-1", "post-1", "owner-1", "owner", "Owner", "post text");

      expect(mockBatch.set).toHaveBeenCalledTimes(1);
    });
  });

  describe("unlikePost", () => {
    it("deletes the like doc, decrements likeCount, and removes the notification", async () => {
      const mockBatch = {
        set: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined),
      };
      (writeBatch as jest.Mock).mockReturnValue(mockBatch);

      await unlikePost("owner-1", "post-1", "liker-1");

      // like doc + notification doc
      expect(mockBatch.delete).toHaveBeenCalledTimes(2);
      expect(mockBatch.update).toHaveBeenCalledWith(expect.anything(), {
        likeCount: "increment(-1)",
      });
      expect(mockBatch.commit).toHaveBeenCalled();
    });

    it("does not touch notifications when unliking your own post", async () => {
      const mockBatch = {
        set: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined),
      };
      (writeBatch as jest.Mock).mockReturnValue(mockBatch);

      await unlikePost("owner-1", "post-1", "owner-1");

      expect(mockBatch.delete).toHaveBeenCalledTimes(1);
    });
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest tests/services/likes.test.ts`
Expected: FAIL — wrong arg count / notification `set`/`delete` not called.

- [ ] **Step 3: Update `likes.ts`**

In `src/services/likes.ts`, add the import:

```ts
import { addLikeNotification, removeLikeNotification } from "./notifications";
```

Replace `likePost` and `unlikePost`:

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest tests/services/likes.test.ts`
Expected: PASS.

- [ ] **Step 5: Update the `likePost` call sites**

In `src/screens/mypage/MyPageScreen.tsx`, `handleLikeToggle` must pass the actor name + post text. Replace the like branch:

```ts
  async function handleLikeToggle(postId: string) {
    if (!user) return;
    const isLiked = likedMap[postId] ?? false;
    const post = posts.find((p) => p.postId === postId);

    // Optimistic update
    setLikedMap((prev) => ({ ...prev, [postId]: !isLiked }));
    setPosts((prev) =>
      prev.map((p) =>
        p.postId === postId
          ? { ...p, likeCount: p.likeCount + (isLiked ? -1 : 1) }
          : p
      )
    );

    try {
      if (isLiked) {
        await unlikePost(user.uid, postId, user.uid);
      } else {
        await likePost(
          user.uid,
          postId,
          user.uid,
          user.username,
          user.displayName,
          post?.text ?? ""
        );
      }
    } catch {
      // Revert on error
      setLikedMap((prev) => ({ ...prev, [postId]: isLiked }));
      setPosts((prev) =>
        prev.map((p) =>
          p.postId === postId
            ? { ...p, likeCount: p.likeCount + (isLiked ? 1 : -1) }
            : p
        )
      );
    }
  }
```

In `src/screens/home/FriendPageScreen.tsx`, the like is on the friend's post (`postOwnerUid = friendUid`). Update its `likePost` call the same way:

```ts
        await likePost(
          friendUid,
          postId,
          user.uid,
          user.username,
          user.displayName,
          post?.text ?? ""
        );
```

Add `const post = posts.find((p) => p.postId === postId);` near the top of FriendPageScreen's `handleLikeToggle`, mirroring MyPage. (Keep its existing `unlikePost(friendUid, postId, user.uid)` call unchanged.)

- [ ] **Step 6: Verify the suite still passes**

Run: `npx jest`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/services/likes.ts src/screens/mypage/MyPageScreen.tsx src/screens/home/FriendPageScreen.tsx tests/services/likes.test.ts
git commit -m "feat: fan out like notifications and remove on unlike"
```

---

## Task 5: ActivityRow component

**Files:**
- Create: `src/components/ActivityRow.tsx`
- Test: `tests/components/ActivityRow.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/components/ActivityRow.test.tsx`:

```tsx
import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import ActivityRow from "../../src/components/ActivityRow";
import { Notification } from "../../src/types";

const baseNotif: Notification = {
  notifId: "n-1",
  type: "like",
  actorUid: "a-1",
  actorUsername: "bob",
  actorDisplayName: "Bob Jones",
  postId: "p-1",
  postOwnerUid: "o-1",
  postTextPreview: "my great post",
  createdAt: new Date(),
};

describe("ActivityRow", () => {
  it("renders the actor name and 'liked your post' for a like", () => {
    const { getByText } = render(
      <ActivityRow notification={baseNotif} onPress={() => {}} />
    );
    expect(getByText("Bob Jones")).toBeTruthy();
    expect(getByText("liked your post")).toBeTruthy();
    expect(getByText("my great post")).toBeTruthy();
  });

  it("renders the comment text for a comment", () => {
    const { getByText } = render(
      <ActivityRow
        notification={{ ...baseNotif, type: "comment", commentText: "love this" }}
        onPress={() => {}}
      />
    );
    expect(getByText("commented on your post")).toBeTruthy();
    expect(getByText("love this")).toBeTruthy();
  });

  it("calls onPress when tapped", () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <ActivityRow notification={baseNotif} onPress={onPress} />
    );
    fireEvent.press(getByText("Bob Jones"));
    expect(onPress).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest tests/components/ActivityRow.test.tsx`
Expected: FAIL — cannot find `ActivityRow`.

- [ ] **Step 3: Implement `ActivityRow`**

Create `src/components/ActivityRow.tsx`:

```tsx
import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Notification } from "../types";
import { relativeTime } from "../utils/relativeTime";
import Avatar from "./Avatar";

interface ActivityRowProps {
  notification: Notification;
  onPress: () => void;
}

export default function ActivityRow({ notification, onPress }: ActivityRowProps) {
  const verb =
    notification.type === "comment"
      ? "commented on your post"
      : "liked your post";
  const preview =
    notification.type === "comment"
      ? notification.commentText ?? ""
      : notification.postTextPreview;

  return (
    <TouchableOpacity
      className="flex-row px-4 py-3 border-b border-gray-100"
      onPress={onPress}
    >
      <Avatar size={40} displayName={notification.actorDisplayName} />
      <View className="ml-3 flex-1">
        <View className="flex-row items-center justify-between">
          <Text className="text-sm">
            <Text className="font-semibold">{notification.actorDisplayName}</Text>{" "}
            {verb}
          </Text>
          <Text className="text-xs text-gray-400 ml-2">
            {relativeTime(notification.createdAt)}
          </Text>
        </View>
        {preview ? (
          <Text className="text-sm text-gray-400 mt-1" numberOfLines={1}>
            {preview}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest tests/components/ActivityRow.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/ActivityRow.tsx tests/components/ActivityRow.test.tsx
git commit -m "feat: ActivityRow presentational component"
```

---

## Task 6: Activity screen + route + navigation wiring

**Files:**
- Create: `src/screens/activity/ActivityScreen.tsx`
- Modify: `src/navigation/HomeStack.tsx`

- [ ] **Step 1: Extend the navigator**

In `src/navigation/HomeStack.tsx`, import the screen, extend the param list, and register the route:

```tsx
import { ActivityScreen } from "../screens/activity/ActivityScreen";
```

```ts
export type HomeStackParamList = {
  Home: undefined;
  MyPage: { focusPostId?: string; openComments?: boolean } | undefined;
  FriendPage: { friendUid: string; friendDisplayName: string; friendUsername: string };
  SearchUsers: undefined;
  Activity: undefined;
};
```

```tsx
      <Stack.Screen name="Activity" component={ActivityScreen} />
```

- [ ] **Step 2: Implement the Activity screen**

Create `src/screens/activity/ActivityScreen.tsx`:

```tsx
import React, { useEffect, useState } from "react";
import { View, Text, FlatList, TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../contexts/AuthContext";
import {
  subscribeNotifications,
  markActivityRead,
} from "../../services/notifications";
import { HomeStackParamList } from "../../navigation/HomeStack";
import { Notification } from "../../types";
import ActivityRow from "../../components/ActivityRow";

type ActivityNav = NativeStackNavigationProp<HomeStackParamList, "Activity">;

export function ActivityScreen() {
  const navigation = useNavigation<ActivityNav>();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeNotifications(user.uid, setNotifications);
    markActivityRead(user.uid).catch(() => {});
    return unsub;
  }, [user]);

  return (
    <View className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-gray-100">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="black" />
        </TouchableOpacity>
        <Text className="text-lg font-semibold ml-2">Activity</Text>
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.notifId}
        renderItem={({ item }) => (
          <ActivityRow
            notification={item}
            onPress={() =>
              navigation.navigate("MyPage", {
                focusPostId: item.postId,
                openComments: item.type === "comment",
              })
            }
          />
        )}
        ListEmptyComponent={
          <View className="flex-1 justify-center items-center p-6">
            <Text className="text-sm text-gray-400">No activity yet.</Text>
          </View>
        }
      />
    </View>
  );
}
```

- [ ] **Step 3: Verify the suite + typecheck**

Run: `npx jest && npx tsc --noEmit`
Expected: tests PASS; no type errors.

- [ ] **Step 4: Commit**

```bash
git add src/screens/activity/ActivityScreen.tsx src/navigation/HomeStack.tsx
git commit -m "feat: Activity screen and route"
```

---

## Task 7: Unread dot hook + My Page wiring

**Files:**
- Create: `src/hooks/useUnreadActivity.ts`
- Modify: `src/screens/mypage/MyPageScreen.tsx`

- [ ] **Step 1: Implement the hook**

Create `src/hooks/useUnreadActivity.ts`:

```ts
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
```

- [ ] **Step 2: Wire the bell, dot, and tap params in My Page**

In `src/screens/mypage/MyPageScreen.tsx`:

Add imports:

```ts
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { useUnreadActivity } from "../../hooks/useUnreadActivity";
```

Add the route + unread hook near the top of the component:

```ts
  const route = useRoute<RouteProp<HomeStackParamList, "MyPage">>();
  const hasUnread = useUnreadActivity(user?.uid);
```

Replace the bell `TouchableOpacity` (currently the "Coming soon" alert) with navigation + dot:

```tsx
          <TouchableOpacity onPress={() => navigation.navigate("Activity")}>
            <View>
              <Ionicons name="notifications-outline" size={22} color="black" />
              {hasUnread ? (
                <View className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-peach" />
              ) : null}
            </View>
          </TouchableOpacity>
```

Add an effect that reacts to the `focusPostId` / `openComments` params (place after the existing posts `useEffect`):

```ts
  useEffect(() => {
    const focusPostId = route.params?.focusPostId;
    if (!focusPostId || posts.length === 0) return;
    const index = posts.findIndex((p) => p.postId === focusPostId);
    if (index < 0) return;
    flatListRef.current?.scrollToIndex({ index, animated: true });
    if (route.params?.openComments) {
      const post = posts[index];
      setCommentModal({
        visible: true,
        postOwnerUid: user!.uid,
        postId: post.postId,
        postText: post.text,
      });
    }
    navigation.setParams({ focusPostId: undefined, openComments: undefined });
  }, [route.params?.focusPostId, route.params?.openComments, posts]);
```

Add an `onScrollToIndexFailed` handler to the posts `FlatList` so a not-yet-measured row doesn't crash:

```tsx
        onScrollToIndexFailed={() => {}}
```

- [ ] **Step 3: Verify the suite + typecheck**

Run: `npx jest && npx tsc --noEmit`
Expected: tests PASS; no type errors.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useUnreadActivity.ts src/screens/mypage/MyPageScreen.tsx
git commit -m "feat: unread activity dot and tap-to-open wiring on My Page"
```

---

## Task 8: README + final verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Tick the Activity-feed checkboxes**

In `README.md`, change the six "Activity feed / notifications" items from `- [ ]` to `- [x]`, and append a note under that block:

```markdown
- [x] `users/{uid}/notifications` subcollection + service (create / list / mark read)
- [x] `addComment` fans out a `comment` notification to the post owner (never self)
- [x] `likePost` / `unlikePost` create / remove a `like` notification
- [x] Activity screen UI: avatar + display name + verb + time + post preview; tapping a row opens the post
- [x] `activityLastReadAt` on the user doc; unread dot on the header icon; opening Activity marks read
- [x] Firestore security rules for `notifications`

> Firestore rules live in `firestore.rules`. There is no `firebase.json` in this repo, so apply them manually in the Firebase console.
```

- [ ] **Step 2: Full verification**

Run: `npx jest && npx tsc --noEmit`
Expected: all tests PASS; zero type errors.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: tick Activity feed roadmap items"
```

- [ ] **Step 4: Manual smoke test (optional but recommended)**

Run: `npm run web`, sign in as two users in separate sessions; have user B comment on and like user A's post; confirm user A sees the bell dot, opens Activity, sees both rows, tapping the comment row opens the post's comment modal, and the dot clears. Unlike removes the like row.

---

## Self-Review Notes

- **Spec coverage:** notifications subcollection + service (T1), fan-out comment/like + self-guard (T3/T4), unlike removal (T4), Activity UI with avatar/name/verb/time/preview (T5/T6), tap → My Page + comment modal (T6/T7), `activityLastReadAt` + unread dot + mark-read (T1/T7), security rules (T2), README (T8). All covered.
- **Type consistency:** `Notification` fields and the service helper signatures (`addCommentNotification`, `addLikeNotification`, `removeLikeNotification`, `subscribeNotifications`, `markActivityRead`, `likeNotifId`) are used identically across tasks. `addComment`/`likePost` arg order matches every call site.
- **No placeholders:** every code step shows complete code.
