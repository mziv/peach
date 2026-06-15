# Peach — Activity Feed / Notifications Design

**Date:** 2026-06-14
**Status:** Approved design. Implements the Tier 1 "Activity feed / notifications"
feature from the [functionality roadmap](2026-06-14-functionality-roadmap-design.md).

## Context

Peach is an Expo / React Native + Firebase (Firestore) Peach clone. Likes and
comments are fully implemented but are not surfaced anywhere as activity. The My
Page header already has a placeholder bell icon (beside the gear) that currently
shows a "coming soon" alert.

This feature adds an in-app activity feed: when someone comments on or likes the
user's post, a notification is written to the user's `notifications`
subcollection and rendered in a new Activity screen. **Push notifications are out
of scope** — the reference app's "Push Notifications off" banner is intentionally
not built.

Relevant existing code:

- `src/services/comments.ts` — `addComment(postOwnerUid, postId, authorUid, authorUsername, text)`, writes a comment + bumps `commentCount` in a `writeBatch`.
- `src/services/likes.ts` — `likePost` / `unlikePost(postOwnerUid, postId, likerUid)`, each a `writeBatch` that sets/deletes the like doc and bumps `likeCount`.
- `src/components/CommentModal.tsx` — calls `addComment`; has `postOwnerUid` + `postId` but **not** the post text or the author's display name.
- `src/screens/mypage/MyPageScreen.tsx` — own feed; header has the bell + gear; has each post's text in state.
- `src/screens/home/FriendPageScreen.tsx` — a friend's feed; calls `likePost`/`unlikePost`; has post text in state.
- `src/contexts/AuthContext.tsx` — `useAuth()` exposes `user` with `uid`, `username`, `displayName`.
- `src/navigation/HomeStack.tsx` — native stack: `Home`, `MyPage`, `FriendPage`, `SearchUsers`.
- Tests use Jest with mocked `firebase/firestore`; every service has a sibling test in `tests/services/`.
- **There is no `firestore.rules` or `firebase.json` in the repo today** — rules are currently managed outside it.

## Decisions

Settled during brainstorming:

1. **Tap target:** tapping an activity row navigates to **My Page** (every
   notification is about the user's own post), scrolls to that post, and — for
   `comment` notifications — opens the existing `CommentModal`. No new
   post-detail screen.
2. **Security rules:** add a `firestore.rules` file capturing the intended model
   (and the existing collections, so it is complete and accurate). It is **not
   auto-deployed** — there is no `firebase.json` — and must be applied separately
   in the Firebase console. Noted in the README.
3. **Read state** is server-side (`activityLastReadAt` on the user doc), matching
   the roadmap's cross-device decision.
4. **MVP scope:** `comment` + `like` notifications only. `tag` is reserved for
   Tier 3 and is not built here.

## Data model

New subcollection `users/{uid}/notifications/{notifId}`:

| field | type | notes |
|---|---|---|
| `type` | `"comment" \| "like"` | `"tag"` reserved for Tier 3 |
| `actorUid` | string | who performed the action |
| `actorUsername` | string | denormalized for rendering |
| `actorDisplayName` | string | denormalized for rendering |
| `postId` | string | the post acted on |
| `postOwnerUid` | string | equals the recipient `uid` |
| `postTextPreview` | string | post text sliced to 100 chars |
| `commentText` | string? | present only on `type === "comment"` |
| `createdAt` | serverTimestamp | sort key (newest first) |

**Document IDs:**

- **Like:** deterministic `like_{postId}_{actorUid}`. Lets `unlikePost` delete the
  exact notification and makes a re-like idempotent (no duplicates).
- **Comment:** auto-id (`addDoc`-style ref) — a user may comment many times.

**User doc:** new field `activityLastReadAt` (Firestore `Timestamp`).

## Components and responsibilities

### `src/services/notifications.ts` (new)

Single source of truth for the notification shape. Because fan-out must be atomic
with the like/comment write, it exposes **batch helpers** that mutate a caller's
`writeBatch` rather than committing themselves:

- `likeNotifId(postId, actorUid): string` — pure id builder.
- `addCommentNotification(batch, recipientUid, data)` — adds a `comment` notif doc to the batch.
- `addLikeNotification(batch, recipientUid, data)` — adds a `like` notif doc (deterministic id) to the batch.
- `removeLikeNotification(batch, recipientUid, postId, actorUid)` — deletes the like notif doc in the batch.

Read side:

- `subscribeNotifications(uid, cb): Unsubscribe` — `onSnapshot` over the
  subcollection ordered by `createdAt` desc; maps docs to a typed `Notification[]`.
- `markActivityRead(uid): Promise<void>` — sets `activityLastReadAt = serverTimestamp()` on the user doc.

A `Notification` type is added to `src/types/index.ts`.

### Extended services

- `addComment(postOwnerUid, postId, authorUid, authorUsername, authorDisplayName, text, postText)`
  — within its existing batch, when `authorUid !== postOwnerUid`, calls
  `addCommentNotification`.
- `likePost(postOwnerUid, postId, likerUid, likerUsername, likerDisplayName, postText)`
  — within its batch, when `likerUid !== postOwnerUid`, calls `addLikeNotification`.
- `unlikePost(postOwnerUid, postId, likerUid)` — within its batch, when
  `likerUid !== postOwnerUid`, calls `removeLikeNotification`.

The **self-notification guard** (`actorUid !== postOwnerUid`) lives in the
extended service functions.

### Call-site threading

- `CommentModal` is the only `addComment` caller. It has `postOwnerUid` + `postId`
  but needs the post text and the author's display name. Add `postText` to
  `CommentModalProps` (the parent screens already hold each post's text) and pass
  `user.displayName` from `useAuth()`.
- `MyPageScreen` and `FriendPageScreen` pass `user.displayName` and the post's
  `text` into `likePost`. (On My Page the actor is the owner, so the guard
  suppresses the notification — correct.) Both already render posts from state, so
  the text is in hand.

### `src/hooks/useUnreadActivity.ts` (new)

`useUnreadActivity(uid): boolean`. Subscribes to (a) the newest notification
(`orderBy createdAt desc, limit 1`) and (b) the user doc's `activityLastReadAt`.
Returns `true` when a notification exists and either there is no read timestamp
yet or the newest notification's `createdAt` is greater than `activityLastReadAt`.
Both subscriptions are torn down on unmount.

### `src/screens/activity/ActivityScreen.tsx` (new)

- Header matching the reference: back chevron + centered "Activity" title. **No**
  push-notification banner.
- `FlatList` driven by `subscribeNotifications`, newest first.
- Row layout:
  ```
  [avatar]  <displayName>  <verb>            <relativeTime>
            <gray post preview>
  ```
  - `like` verb: "liked your post"; preview line = `postTextPreview`.
  - `comment` verb: "commented on your post"; preview line = `commentText`.
  - Avatar uses `displayName` (initials); `relativeTime` reuses `src/utils/relativeTime.ts`.
- On focus, calls `markActivityRead(uid)`.
- Empty state: a short "No activity yet" message, consistent with existing
  empty states.
- Tapping a row → `navigation.navigate("MyPage", { focusPostId, openComments })`
  where `openComments` is `true` only for `comment` rows.

### Navigation

- `HomeStack` gains an `Activity` route (`Activity: undefined`).
- `MyPage` route params become
  `{ focusPostId?: string; openComments?: boolean } | undefined`.
- `MyPageScreen`:
  - The bell `TouchableOpacity` navigates to `Activity` instead of alerting, and
    renders a peach unread dot when `useUnreadActivity(user.uid)` is true.
  - Reads `focusPostId` / `openComments` params: best-effort `scrollToIndex` to
    the post (with an `onScrollToIndexFailed` fallback), and when `openComments`
    is set, opens `CommentModal` for that post.

## Security rules

New `firestore.rules` at repo root. For `users/{uid}/notifications/{notifId}`:

- `read`: `request.auth.uid == uid` (only the owner reads their own notifications).
- `create`: `request.auth != null && request.resource.data.actorUid == request.auth.uid`
  (an actor may create a notification on someone else's post; the comment/like
  rules already gate whether they can act on the post).
- `delete`: `request.auth.uid == resource.data.actorUid` (the original liker
  removes their own like notification on unlike).
- `update`: disallowed.

The file also encodes the existing collections (`users`, `posts`, `comments`,
`likes`, `friendships`) with authenticated access so it is a complete, accurate
snapshot — it would otherwise lock out everything if ever deployed wholesale. A
README note records that it is **reference/manual** (no `firebase.json`, not
auto-deployed).

## Testing strategy

TDD, following the existing Jest + mocked-`firebase/firestore` style:

- **`tests/services/notifications.test.ts` (new):**
  - `likeNotifId` formats `like_{postId}_{actorUid}`.
  - `addCommentNotification` / `addLikeNotification` add a `set` to the batch with
    the expected fields and id.
  - `removeLikeNotification` adds a `delete` to the batch for the deterministic id.
  - `markActivityRead` updates the user doc with a server timestamp.
- **`tests/services/comments.test.ts` (updated):** new signature; a notification
  is fanned out when commenter ≠ owner, and **suppressed** when commenter == owner.
- **`tests/services/likes.test.ts` (updated):** new `likePost` signature adds a
  like notification (and suppresses on self-like); `unlikePost` removes it.
- Screen/hook tests stay light, matching the current suite's coverage level.

## README

Tick all six "Activity feed / notifications" checkboxes in the same PR, and add the
note that `firestore.rules` is applied manually (no deploy config in-repo).

## Out of scope

- Real push notifications (reference app's banner).
- `tag` notifications (arrive with tagging in Tier 3).
- A standalone post-detail screen (tap reuses My Page + `CommentModal`).
