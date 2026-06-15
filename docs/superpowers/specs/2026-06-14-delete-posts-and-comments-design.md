# Delete Posts & Comments — Design

**Date:** 2026-06-14
**Branch:** `worktree-feature+delete-posts-and-comments`

## Goal

Let users delete their own posts and their own comments, with a confirmation
step, and keep derived data (comment counts, the friends-list "last post"
preview) consistent after deletion.

## Scope & Permissions

- **Posts:** the author can delete their own posts. Posts live at
  `users/{uid}/posts/{postId}` and only ever render on the author's own page
  (`MyPageScreen`), so "author only" needs no cross-user logic.
- **Comments:** only the comment author can delete their own comment. The post
  owner does **not** get moderation power over others' comments. (Deleting a
  whole post still removes all of its comments via cascade — that is a separate
  path.)

Out of scope: editing posts/comments, reporting, post-owner moderation of
comments.

## UI

- Trigger: a small **trash icon** (`Ionicons` "trash-outline"), shown **only**
  on items the current user is allowed to delete. Tapping it opens an
  `Alert.alert` confirmation with a destructive "Delete" button, mirroring the
  existing friend-removal pattern in `FriendRequestsScreen`.

- **`src/components/PostItem.tsx`** — add an optional `onDeletePress?: () => void`
  prop. Render the trash icon only when the prop is provided.
  - `MyPageScreen` passes `onDeletePress` (own posts → deletable).
  - `FriendPageScreen` does **not** pass it (you never own posts on a friend's
    page).

- **`src/components/CommentModal.tsx`** — render the trash icon on a comment row
  only when `comment.authorUid === user.uid`. Tapping confirms, then calls
  `deleteComment`.

- Lists update automatically: both screens and the comment modal already use
  `onSnapshot` real-time listeners, so a successful delete removes the row
  without manual refetch.

## Data Layer

### `src/services/posts.ts` → `deletePost(uid, postId)`

A single `writeBatch` that:

1. Queries and deletes every doc in `users/{uid}/posts/{postId}/comments`.
2. Queries and deletes every doc in `users/{uid}/posts/{postId}/likes`.
3. Deletes the post doc `users/{uid}/posts/{postId}`.
4. **Recomputes the meta preview:** queries the user's next-most-recent post
   (`posts` ordered by `createdAt` desc, limit 1, excluding the one being
   deleted). If one exists, set `meta.lastPostText` / `meta.lastPostAt` to it;
   if no posts remain, clear both fields (e.g. set to empty string / null).

Firestore does not cascade subcollection deletes, so steps 1–2 are explicit.
At this app's scale (friends-only, small posts) the comment/like counts sit
well within a batch's 500-op limit; we are not paginating. If a post ever
exceeded that, the batch would fail loudly rather than silently truncate — an
acceptable trade-off for now, noted here so it is not mistaken for full
coverage.

### `src/services/comments.ts` → `deleteComment(postOwnerUid, postId, commentId)`

A `writeBatch` that:

1. Deletes the comment doc
   `users/{postOwnerUid}/posts/{postId}/comments/{commentId}`.
2. Decrements the parent post's `commentCount` by 1 (`increment(-1)`), the
   inverse of `addComment`.

## Security Rules (`firestore.rules`)

- **Posts:** already `allow create, delete: if isOwner(uid)` — no change.
- **Comments:** currently `allow write: if isSignedIn()`, which lets any signed-in
  user delete any comment. Tighten so that:
  - `create` stays as-is (any signed-in friend can comment),
  - `delete` is allowed only when
    `resource.data.authorUid == request.auth.uid`.

  ⚠️ Per project memory, the repo `firestore.rules` is a best-effort
  reconstruction. The rule change will be made in the file, but **must be
  verified against the live Firebase console before deploy**. This change is
  **not** deployed as part of this branch.

## Testing

Add to the existing Jest service suites (Firebase is already mocked there):

- `tests/services/posts.test.ts`
  - `deletePost` deletes the post doc.
  - `deletePost` deletes all comment and like docs in the subcollections.
  - `deletePost` updates meta to the next-most-recent post.
  - `deletePost` clears meta when no posts remain.
- `tests/services/comments.test.ts`
  - `deleteComment` deletes the comment doc and decrements `commentCount`.

UI wiring (trash icon visibility, confirm dialog) is verified manually in the
running app; the service tests cover the logic that can actually go wrong.

## Out-of-scope / Non-goals

- No edit functionality.
- No post-owner moderation of others' comments.
- No reporting/flagging.
- No paginated deletion for very large posts (see batch note above).
