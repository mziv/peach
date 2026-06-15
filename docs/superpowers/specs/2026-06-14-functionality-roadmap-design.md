# Peach — Functionality Roadmap to MVP and Beyond

**Date:** 2026-06-14
**Status:** Approved roadmap. Each feature becomes its own spec + plan when we start building it.

## Context

Peach is a Peach clone built on Expo / React Native + Firebase (Firestore). The
data model today:

- `users/{uid}` — `uid`, `username`, `displayName`, `createdAt`
- `users/{uid}/meta/meta` — `lastPostText`, `lastPostAt`
- `users/{uid}/posts/{postId}` — `text`, `createdAt`, `commentCount`, `likeCount`
- `users/{uid}/posts/{postId}/comments/{id}` — `authorUid`, `authorUsername`, `text`, `createdAt`
- `users/{uid}/posts/{postId}/likes/{likerUid}` — `likedAt`
- `friendships/{id}` (top level) — `requesterId`, `receiverId`, `status` (`pending` | `accepted`), `createdAt`

Screens: Home (friend lines), FriendPage, MyPage, SearchUsers, FriendRequests,
auth stack. Services: auth, posts, comments, likes, friendships, users.

Notable gaps confirmed against the code: `Avatar` is a blank gray circle (no
photo, no initials); there is no `photoURL` field and no Firebase Storage
dependency; likes are fully implemented but not surfaced as activity.

## Decisions

These were settled during brainstorming and drive the tiering below:

1. **Profile photos:** initials-based avatars for MVP; real photo upload deferred
   to P1. Settings ships with display-name editing only.
2. **Activity feed scope:** comments **+ likes** (likes are already implemented)
   for MVP; tag notifications added when tagging ships in P1.
3. **Delete account:** full hard delete. Comments the user left elsewhere may
   remain and render as "deleted user."
4. **Read state** (blue dots + activity unread): stored **server-side** in
   Firestore so it syncs across devices and survives reinstall.

## Tier 1 — MVP-required

### Settings page

Entered via the gear icon in the My Page header (matches the reference app).

- **Edit display name** — writes `displayName` on the user doc. New service:
  `updateDisplayName(uid, name)`.
- **Delete account (hard delete)** — confirmation dialog, then batch-delete the
  user's `posts` subcollection, `friendships` they're part of, their
  `notifications`, the user doc, and finally the Firebase Auth account. Firebase
  requires a *recent login* to delete an auth account; if the credential is
  stale, prompt for re-authentication (password) first.
- **Sign out** lives here (move it if it isn't already a dedicated control).

### Avatar with initials (enabler)

Upgrade `Avatar` to render colored initials derived from `displayName`, with a
deterministic background color per user. Add an optional `photoURL` prop that is
wired through now but unused until Tier 3. Thread `displayName` into all current
`Avatar` usages.

### Activity feed / notifications

Entered via the icon beside the gear in the My Page header.

- **Data:** new `users/{uid}/notifications/{id}` subcollection. Fields: `type`
  (`comment` | `like` | `tag`), `actorUid`, `actorUsername`, `actorDisplayName`,
  `postId`, `postOwnerUid`, `postTextPreview`, optional `commentText`,
  `createdAt`.
- **Fan-out on write:** `addComment` writes a `comment` notification to the post
  owner; `likePost` writes a `like` notification and `unlikePost` removes it.
  Never notify the actor about their own post.
- **Read state:** an `activityLastReadAt` field on the user doc. Opening the
  Activity screen sets it to now; an unread dot shows on the header icon while
  newer notifications exist.
- **UI:** list of rows `[avatar] [displayName] [verb] · [time]` plus a post
  preview; tapping a row opens the relevant post.
- **MVP covers comments + likes.** `tag` notifications are added with tagging in
  Tier 3.
- Update Firestore security rules for `notifications`.

## Tier 2 — Pre-MVP

### Blue dots for new activity

On the homepage friend lines, show a blue dot when a friend has posted something
the viewer hasn't seen.

- **Data:** `users/{uid}/viewedFriends/{friendUid}` docs storing `lastViewedAt`
  (server-side). New service: `markFriendViewed`, `getViewedMap`.
- **Logic:** show a dot when the friend's `meta.lastPostAt` is newer than my
  `lastViewedAt` for them, or I have no record for them.
- Opening a friend's page stamps `lastViewedAt = now`, clearing the dot.
- Update Firestore security rules for `viewedFriends`.

## Tier 3 — P1 (post-MVP)

### Tagging / @mentions

- Parse `@username` in post and comment text and render it as a tappable link.
- Tapping a mention opens that user's page. **If not friends:** a gated view
  (no posts) with a **Request Friend** button that becomes "Requested" when a
  request is pending. If friends, the normal Friend Page.
- Mentioning a user generates a `tag` notification (extends the Tier 1 feed).
- Requires an exact `getUserByUsername` lookup (today only prefix search exists)
  and a non-friend state on the Friend Page.
- *Optional enhancement:* `@` autocomplete while composing.

### Profile photo upload (deferred half of Settings)

- Add Firebase Storage + `expo-image-picker`.
- Pick a photo → upload to storage → store `photoURL` on the user doc.
- `Avatar` already renders `photoURL` with the initials fallback (from Tier 1).
- Photo picker UI added to Settings.

## Out of scope (for now)

- **Real push notifications.** The reference app's "Push Notifications off"
  banner is not part of this work; the activity feed is in-app only. Push is a
  possible future addition.

## Cross-cutting

- Firestore security rules need updating as `notifications` and `viewedFriends`
  are introduced; called out per feature.
- Account deletion's re-auth requirement is the main non-obvious gotcha.
