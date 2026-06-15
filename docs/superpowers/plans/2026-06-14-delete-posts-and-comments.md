# Delete Posts & Comments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users delete their own posts (with cascade cleanup of comments/likes and "last post" preview recompute) and their own comments (with comment-count decrement), each behind a confirmation dialog.

**Architecture:** Two new service functions (`deletePost`, `deleteComment`) do all Firestore work inside a single `writeBatch`, mirroring the existing `createPost`/`addComment` patterns. UI adds a trash icon shown only on items the current user owns; the existing `onSnapshot` listeners refresh the lists automatically. A Firestore rule change restricts comment deletion to the comment's author.

**Tech Stack:** React Native (Expo), TypeScript, Firebase Firestore (v9 modular SDK), Jest with mocked `firebase/firestore`.

---

## File Structure

- **Modify** `src/services/posts.ts` — add `deletePost(uid, postId)`.
- **Modify** `src/services/comments.ts` — add `deleteComment(postOwnerUid, postId, commentId)`.
- **Modify** `tests/services/posts.test.ts` — tests for `deletePost`.
- **Modify** `tests/services/comments.test.ts` — tests for `deleteComment`.
- **Modify** `src/components/PostItem.tsx` — optional `onDeletePress` prop + trash icon.
- **Modify** `src/screens/mypage/MyPageScreen.tsx` — confirm dialog + wire `onDeletePress`.
- **Modify** `src/components/CommentModal.tsx` — trash icon on own comments + confirm dialog.
- **Modify** `firestore.rules` — restrict comment `delete` to the author.

---

## Task 1: `deletePost` service function

**Files:**
- Modify: `src/services/posts.ts`
- Test: `tests/services/posts.test.ts`

- [ ] **Step 1: Add `limit` to the test mock**

In `tests/services/posts.test.ts`, the `jest.mock("firebase/firestore", ...)` factory (lines 4-13) does not mock `limit`. Add it. Replace the existing factory with:

```ts
jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  doc: jest.fn(() => ({})),
  getDocs: jest.fn(),
  getDoc: jest.fn(),
  query: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  serverTimestamp: jest.fn(() => "mock-timestamp"),
  writeBatch: jest.fn(),
}));
```

- [ ] **Step 2: Write the failing tests**

In `tests/services/posts.test.ts`, update the import line at the top to include `deletePost`:

```ts
import {
  createPost,
  getPostsByUser,
  getPost,
  deletePost,
} from "../../src/services/posts";
```

Then add this `describe` block inside the top-level `describe("posts service", ...)`, after the `getPost` block (before the closing `});` of the file):

```ts
  describe("deletePost", () => {
    function makeBatch() {
      return {
        set: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined),
      };
    }

    it("deletes the post and all of its comments and likes in a batch", async () => {
      const mockBatch = makeBatch();
      (writeBatch as jest.Mock).mockReturnValue(mockBatch);
      (getDocs as jest.Mock)
        // comments subcollection
        .mockResolvedValueOnce({ docs: [{ ref: "c-1" }, { ref: "c-2" }] })
        // likes subcollection
        .mockResolvedValueOnce({ docs: [{ ref: "l-1" }] })
        // recent-posts recompute query (only the deleted post remains)
        .mockResolvedValueOnce({ docs: [{ id: "post-1", data: () => ({}) }] });

      await deletePost("uid-1", "post-1");

      // 2 comments + 1 like + 1 post = 4 deletes
      expect(mockBatch.delete).toHaveBeenCalledTimes(4);
      expect(mockBatch.commit).toHaveBeenCalled();
    });

    it("recomputes meta to the next-most-recent post", async () => {
      const mockBatch = makeBatch();
      (writeBatch as jest.Mock).mockReturnValue(mockBatch);
      (getDocs as jest.Mock)
        .mockResolvedValueOnce({ docs: [] }) // comments
        .mockResolvedValueOnce({ docs: [] }) // likes
        .mockResolvedValueOnce({
          docs: [
            { id: "post-1", data: () => ({ text: "deleted" }) },
            {
              id: "post-0",
              data: () => ({ text: "older post", createdAt: "ts-older" }),
            },
          ],
        });

      await deletePost("uid-1", "post-1");

      expect(mockBatch.set).toHaveBeenCalledWith(
        expect.anything(),
        { lastPostText: "older post", lastPostAt: "ts-older" },
        { merge: true }
      );
    });

    it("clears meta when no posts remain", async () => {
      const mockBatch = makeBatch();
      (writeBatch as jest.Mock).mockReturnValue(mockBatch);
      (getDocs as jest.Mock)
        .mockResolvedValueOnce({ docs: [] }) // comments
        .mockResolvedValueOnce({ docs: [] }) // likes
        .mockResolvedValueOnce({
          docs: [{ id: "post-1", data: () => ({ text: "deleted" }) }],
        });

      await deletePost("uid-1", "post-1");

      expect(mockBatch.set).toHaveBeenCalledWith(
        expect.anything(),
        { lastPostText: "", lastPostAt: null },
        { merge: true }
      );
    });
  });
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx jest tests/services/posts.test.ts -t deletePost`
Expected: FAIL — `deletePost is not a function` (not yet exported).

- [ ] **Step 4: Implement `deletePost`**

In `src/services/posts.ts`, add `limit` to the `firebase/firestore` import (lines 1-10). The import block becomes:

```ts
import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  orderBy,
  limit,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
```

Then add this function at the end of the file (after `getPost`):

```ts
export async function deletePost(uid: string, postId: string): Promise<void> {
  const batch = writeBatch(db);

  // Firestore does not cascade subcollection deletes, so remove the post's
  // comments and likes explicitly. At this app's scale these stay well within
  // a batch's 500-op limit.
  const commentsSnap = await getDocs(
    collection(db, "users", uid, "posts", postId, "comments")
  );
  commentsSnap.docs.forEach((d) => batch.delete(d.ref));

  const likesSnap = await getDocs(
    collection(db, "users", uid, "posts", postId, "likes")
  );
  likesSnap.docs.forEach((d) => batch.delete(d.ref));

  batch.delete(doc(db, "users", uid, "posts", postId));

  // Recompute the "last post" preview in meta. Fetch the two most-recent posts
  // so we can pick the latest one that isn't the post being deleted.
  const recentSnap = await getDocs(
    query(
      collection(db, "users", uid, "posts"),
      orderBy("createdAt", "desc"),
      limit(2)
    )
  );
  const nextLatest = recentSnap.docs.find((d) => d.id !== postId);

  const metaRef = doc(db, "users", uid, "meta", "meta");
  if (nextLatest) {
    batch.set(
      metaRef,
      {
        lastPostText: (nextLatest.data().text ?? "").slice(0, 100),
        lastPostAt: nextLatest.data().createdAt ?? null,
      },
      { merge: true }
    );
  } else {
    batch.set(metaRef, { lastPostText: "", lastPostAt: null }, { merge: true });
  }

  await batch.commit();
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx jest tests/services/posts.test.ts`
Expected: PASS — all `posts service` tests including the three `deletePost` cases.

- [ ] **Step 6: Commit**

```bash
git add src/services/posts.ts tests/services/posts.test.ts
git commit -m "feat: add deletePost service with cascade and meta recompute"
```

---

## Task 2: `deleteComment` service function

**Files:**
- Modify: `src/services/comments.ts`
- Test: `tests/services/comments.test.ts`

- [ ] **Step 1: Write the failing test**

In `tests/services/comments.test.ts`, update the import to include `deleteComment`:

```ts
import {
  addComment,
  getComments,
  deleteComment,
} from "../../src/services/comments";
```

Then add this `describe` block inside the top-level `describe("comments service", ...)`, after the `addComment` block:

```ts
  describe("deleteComment", () => {
    it("deletes the comment and decrements commentCount in a batch", async () => {
      const mockBatch = {
        delete: jest.fn(),
        update: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined),
      };
      (writeBatch as jest.Mock).mockReturnValue(mockBatch);

      await deleteComment("uid-1", "post-1", "c-1");

      expect(mockBatch.delete).toHaveBeenCalled();
      expect(mockBatch.update).toHaveBeenCalledWith(expect.anything(), {
        commentCount: "increment(-1)",
      });
      expect(mockBatch.commit).toHaveBeenCalled();
    });
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest tests/services/comments.test.ts -t deleteComment`
Expected: FAIL — `deleteComment is not a function`.

- [ ] **Step 3: Implement `deleteComment`**

In `src/services/comments.ts`, add this function at the end of the file (after `getComments`). No new imports are needed — `doc`, `writeBatch`, and `increment` are already imported.

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest tests/services/comments.test.ts`
Expected: PASS — all `comments service` tests including `deleteComment`.

- [ ] **Step 5: Commit**

```bash
git add src/services/comments.ts tests/services/comments.test.ts
git commit -m "feat: add deleteComment service with commentCount decrement"
```

---

## Task 3: Trash icon on PostItem + wire MyPageScreen

**Files:**
- Modify: `src/components/PostItem.tsx`
- Modify: `src/screens/mypage/MyPageScreen.tsx`

This task is UI wiring; there is no component-test harness for these screens, so it is verified by running the app (Step 4).

- [ ] **Step 1: Add the `onDeletePress` prop and trash icon to `PostItem`**

In `src/components/PostItem.tsx`, add `onDeletePress?: () => void;` to the props interface and destructuring, and render a trash button pushed to the right end of the action row. The full updated file:

```tsx
import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { relativeTime } from "../utils/relativeTime";

interface PostItemProps {
  text: string;
  createdAt: Date;
  commentCount: number;
  likeCount: number;
  isLiked: boolean;
  onLikePress: () => void;
  onCommentPress: () => void;
  onDeletePress?: () => void;
}

export default function PostItem({
  text,
  createdAt,
  commentCount,
  likeCount,
  isLiked,
  onLikePress,
  onCommentPress,
  onDeletePress,
}: PostItemProps) {
  return (
    <View className="p-4 border-b border-gray-100">
      <Text className="text-base mb-2">{text}</Text>
      <View className="flex-row items-center gap-4">
        <TouchableOpacity
          className="flex-row items-center gap-1"
          onPress={onLikePress}
        >
          <Ionicons
            name={isLiked ? "heart" : "heart-outline"}
            size={18}
            color={isLiked ? "#ef4444" : "gray"}
          />
          <Text className="text-xs text-gray-500">{likeCount}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-row items-center gap-1"
          onPress={onCommentPress}
        >
          <Ionicons name="chatbubble-outline" size={18} color="gray" />
          <Text className="text-xs text-gray-500">{commentCount}</Text>
        </TouchableOpacity>
        <Text className="text-xs text-gray-300">—</Text>
        <Text className="text-xs text-gray-400">
          {relativeTime(createdAt)}
        </Text>
        {onDeletePress && (
          <TouchableOpacity className="ml-auto" onPress={onDeletePress}>
            <Ionicons name="trash-outline" size={18} color="gray" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Add the delete handler and wire it in `MyPageScreen`**

In `src/screens/mypage/MyPageScreen.tsx`:

a) Update the posts-service import (line 19) to include `deletePost`:

```ts
import { createPost, deletePost } from "../../services/posts";
```

b) Add this handler right after the existing `handleLikeToggle` function (after line 118, before the `if (loading)` block):

```tsx
  function handleDeletePost(postId: string) {
    if (!user) return;
    Alert.alert(
      "Delete post",
      "Are you sure you want to delete this post? This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deletePost(user.uid, postId);
            } catch (err: any) {
              Alert.alert("Error", err.message);
            }
          },
        },
      ]
    );
  }
```

c) In the `renderItem` for the `FlatList` (lines 171-186), add the `onDeletePress` prop to `<PostItem>`. The element becomes:

```tsx
          <PostItem
            text={item.text}
            createdAt={item.createdAt}
            commentCount={item.commentCount}
            likeCount={item.likeCount}
            isLiked={likedMap[item.postId] ?? false}
            onLikePress={() => handleLikeToggle(item.postId)}
            onCommentPress={() =>
              setCommentModal({
                visible: true,
                postOwnerUid: user!.uid,
                postId: item.postId,
              })
            }
            onDeletePress={() => handleDeletePost(item.postId)}
          />
```

- [ ] **Step 3: Type-check passes**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual verification**

Run the app (`npm run web` or `npm start`). On your own page (MyPage), confirm:
- Each of your posts shows a trash icon on the right of the action row.
- Tapping it shows a "Delete post" confirmation with Cancel / Delete (destructive).
- Confirming removes the post from the list immediately (snapshot listener).
- Deleting your most-recent post updates the friends/home "last post" preview to the previous post (or "No posts yet" if it was your only post).
- A friend's page (FriendPageScreen) shows **no** trash icon on posts.

- [ ] **Step 5: Commit**

```bash
git add src/components/PostItem.tsx src/screens/mypage/MyPageScreen.tsx
git commit -m "feat: add delete button to own posts on MyPage"
```

---

## Task 4: Trash icon on own comments in CommentModal

**Files:**
- Modify: `src/components/CommentModal.tsx`

UI wiring; verified by running the app (Step 3).

- [ ] **Step 1: Add Alert import, deleteComment import, handler, and trash icon**

In `src/components/CommentModal.tsx`:

a) Add `Alert` to the `react-native` import block (lines 2-14) — insert `Alert,` alongside the other named imports.

b) Add the service import after the `addComment` import (line 24):

```ts
import { addComment, deleteComment } from "../services/comments";
```

c) Add this handler right after the `handleSend` function (after line 125):

```tsx
  function handleDeleteComment(commentId: string) {
    Alert.alert(
      "Delete comment",
      "Are you sure you want to delete this comment?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteComment(postOwnerUid, postId, commentId);
            } catch (err: any) {
              Alert.alert("Error", err.message);
            }
          },
        },
      ]
    );
  }
```

d) Update the comment-list `renderItem` (lines 180-189) to show a trash icon when the signed-in user is the comment's author. The element becomes:

```tsx
            renderItem={({ item }) => (
              <View className="flex-row px-4 py-2">
                <Avatar size={32} displayName={item.authorUsername} />
                <View className="ml-3 flex-1">
                  <Text className="text-sm font-semibold text-gray-500">
                    @{item.authorUsername}
                  </Text>
                  <Text className="text-sm text-gray-700">{item.text}</Text>
                </View>
                {user?.uid === item.authorUid && (
                  <TouchableOpacity
                    className="pl-2 self-start"
                    onPress={() => handleDeleteComment(item.commentId)}
                  >
                    <Ionicons name="trash-outline" size={16} color="gray" />
                  </TouchableOpacity>
                )}
              </View>
            )}
```

- [ ] **Step 2: Type-check passes**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual verification**

Run the app. Open the comment modal on any post:
- Your own comments show a trash icon; others' comments do not.
- Tapping it shows a "Delete comment" confirmation.
- Confirming removes the comment and the post's comment count decrements.

- [ ] **Step 4: Commit**

```bash
git add src/components/CommentModal.tsx
git commit -m "feat: allow deleting your own comments in the comment modal"
```

---

## Task 5: Restrict comment deletion in Firestore rules

**Files:**
- Modify: `firestore.rules`

- [ ] **Step 1: Split the comments `write` rule into `create` + `delete`**

In `firestore.rules`, replace the comments match block (lines 40-44):

```
        // Comments: any signed-in user may read and add comments.
        match /comments/{commentId} {
          allow read: if isSignedIn();
          allow write: if isSignedIn();
        }
```

with:

```
        // Comments: any signed-in user may read and add comments. Only the
        // comment's author may delete it (checked against the stored authorUid).
        match /comments/{commentId} {
          allow read: if isSignedIn();
          allow create: if isSignedIn();
          allow delete: if isSignedIn() &&
            resource.data.authorUid == request.auth.uid;
        }
```

Note: dropping the broad `write` also removes comment *update* permission, which no code path uses — comments are create/delete only.

- [ ] **Step 2: Verify before relying on it**

⚠️ Per project memory, the repo `firestore.rules` is a best-effort reconstruction and may drift from the live console. **Do not deploy as part of this branch.** Flag to the user that this rule change must be diffed against the live Firebase console rules before any deploy. The app's delete features still function against current rules; this change only tightens who may delete a comment.

- [ ] **Step 3: Commit**

```bash
git add firestore.rules
git commit -m "feat: restrict comment deletion to the comment author"
```

---

## Final verification

- [ ] Run the full suite: `npx jest` — expected: all suites pass (was 58 tests at baseline; now includes the new `deletePost` and `deleteComment` cases).
- [ ] Run `npx tsc --noEmit` — expected: no type errors.
- [ ] Confirm the manual checks in Tasks 3 and 4 all pass in the running app.

## Spec coverage check

- Post deletion by author → Task 1 (service) + Task 3 (UI).
- Comment deletion by author only → Task 2 (service) + Task 4 (UI, `user.uid === authorUid` gate) + Task 5 (rules).
- Trash-icon trigger + confirm dialog → Tasks 3 & 4.
- Cascade cleanup of comments/likes on post delete → Task 1.
- "Last post" preview recompute / clear → Task 1.
- commentCount decrement on comment delete → Task 2.
- Rules tightening for comments → Task 5.
