# Green Dots for New Activity — Design

**Date:** 2026-06-14
**Status:** Approved
**Roadmap:** Tier 2 (Pre-MVP) in `2026-06-14-functionality-roadmap-design.md`

## Goal

On the homepage friend lines, show a small green dot beside a friend who has
posted something the viewer hasn't seen yet — matching the reference Peach app,
where the dot sits inline at the start of the friend's last-post preview line.
Opening that friend's page clears the dot.

## Context

Today the home screen (`src/screens/home/HomeScreen.tsx`) loads the viewer's
accepted friendships, fetches each friend's `users/{uid}/meta/meta`
(`lastPostText`, `lastPostAt`), sorts by most recent post, and renders one
`UserPreview` row per friend plus a self row at the top. It reloads on focus via
`useFocusEffect`.

Read state for this app is stored **server-side in Firestore** (decided in the
roadmap) so it syncs across devices and survives reinstall.

The repo currently has **no Firestore rules file** — rules are managed in the
Firebase console. As part of this work we introduce a `firestore.rules` (and
`firebase.json`) reconstructed from the current data model, so the new
`viewedFriends` rule has a home. The reconstructed rules for existing
collections are best-effort and must be reviewed against the live console rules
before deploying.

## Data Model

New subcollection:

- `users/{uid}/viewedFriends/{friendUid}` — `{ lastViewedAt: <serverTimestamp> }`

`{uid}` is the viewer; `{friendUid}` is the friend they viewed. One doc per
friend the viewer has opened. `lastViewedAt` is written with
`serverTimestamp()`.

## Components

### 1. Service — `src/services/viewedFriends.ts` (new)

```ts
markFriendViewed(uid: string, friendUid: string): Promise<void>
```
`setDoc(doc(db, "users", uid, "viewedFriends", friendUid), { lastViewedAt: serverTimestamp() })`.
Uses `setDoc` (not `addDoc`) so the friend's uid is the doc id and repeat views
overwrite cleanly.

```ts
getViewedMap(uid: string): Promise<Record<string, Date | null>>
```
`getDocs` of the `viewedFriends` subcollection → map of `friendUid` →
`lastViewedAt.toDate()`. A doc whose `serverTimestamp` has not yet resolved
reads back as `null`; that key is still present in the map (see helper below).

```ts
hasNewActivity(lastPostAt: Date | null, lastViewedAt: Date | null | undefined): boolean
```
Pure function, no Firestore dependency, so it is unit-testable directly. Returns:
- `false` if `lastPostAt` is null/absent (friend has never posted).
- `false` if a `viewedFriends` record exists but `lastViewedAt` is `null` — the
  doc exists, meaning the viewer just opened the page and the server timestamp is
  still resolving. Treating this as "just viewed" avoids a dot flickering back on
  immediately after viewing.
- `true` if there is no record for the friend at all (`lastViewedAt === undefined`).
- otherwise `lastPostAt > lastViewedAt`.

The distinction between `undefined` (no record → key absent from map) and `null`
(record exists, timestamp pending) is load-bearing, so callers pass
`viewedMap[friendUid]` directly (yields `undefined` when absent).

### 2. `UserPreview` — `src/components/UserPreview.tsx`

Add optional prop `hasNewActivity?: boolean`. When `true`, render a small green
dot (`bg-green`, the existing `#4CD964` Tailwind token) inline, immediately
before the preview-text line — not next to the avatar or name. Wrap the dot +
preview `Text` in a `flex-row items-center` container so the dot is vertically
centered with the text and the existing `numberOfLines={1}` truncation still
applies to the text. When the prop is absent/false, the row renders exactly as
today.

### 3. `HomeScreen` — `src/screens/home/HomeScreen.tsx`

In the existing `useFocusEffect` `loadData`:
- After loading friendships, also call `getViewedMap(user.uid)`.
- For each friend, compute `hasNewActivity(friend.lastPostAt, viewedMap[friend.uid])`
  and store it on the friend row (e.g. extend `FriendWithMeta` with
  `hasNewActivity: boolean`).
- Pass `hasNewActivity={item.hasNewActivity}` into the friend `UserPreview`.

The self row never receives the prop (it has no dot, per the reference app).

Because `useFocusEffect` already re-runs every time Home regains focus,
returning from a friend's page re-reads `viewedMap` and the dot clears with no
extra wiring or realtime listener.

### 4. `FriendPageScreen` — `src/screens/home/FriendPageScreen.tsx`

On focus, call `markFriendViewed(user.uid, friendUid)` (fire-and-forget; a failed
write just means the dot lingers until the next successful view — acceptable).
Stamping on view (rather than on scroll or on read of a specific post) matches
the agreed behavior: opening the page clears the dot.

### 5. `firestore.rules` + `firebase.json` (new)

- `firebase.json` points Firestore at `firestore.rules`.
- `firestore.rules` (reconstructed): authenticated users can read user docs,
  meta, posts, comments, and likes; owners write their own user doc / meta /
  posts; likers write their own like doc; friendship participants manage their
  friendships.
- New rule: `users/{uid}/viewedFriends/{friendUid}` is readable and writable
  **only** by the owner (`request.auth.uid == uid`). A viewer's view history is
  private to them.

> ⚠️ The rules for pre-existing collections are reconstructed from the data model
> and must be diffed against the live console rules before any deploy. This work
> does not itself deploy rules.

## Data Flow

1. Home gains focus → load friendships + each friend's meta + `getViewedMap`.
2. Per friend: `hasNewActivity(lastPostAt, viewedMap[uid])` → green dot or not.
3. Tap a friend → FriendPage focus → `markFriendViewed(uid, friendUid)` writes
   `lastViewedAt = now`.
4. Back to Home → `useFocusEffect` re-runs → that friend's `lastViewedAt` is now
   ≥ `lastPostAt` → dot gone.

## Edge Cases

- **Friend never posted** (`lastPostAt` null): no dot.
- **Never viewed a friend who has posted**: dot shows (no record → `undefined`).
- **Server timestamp pending** right after viewing: record exists with `null`
  timestamp → treated as just-viewed → no dot (no flicker).
- **Self row**: never shows a dot.
- **`markFriendViewed` write fails**: dot persists until a later successful view;
  no crash, no blocking of the friend page.

## Testing

Following the existing `tests/` patterns (Firestore mocked in service tests):

- `tests/services/viewedFriends.test.ts`
  - `markFriendViewed` calls `setDoc` on the correct doc path with a timestamp.
  - `getViewedMap` maps friend uids → dates and includes pending (`null`) docs.
  - `hasNewActivity` truth table: no post; no record; pending timestamp; post
    newer than view; post older than view.
- `tests/components/UserPreview.test.tsx`
  - Renders the green dot when `hasNewActivity` is true; absent otherwise.

## Out of Scope

- Realtime dot updates (focus-refresh is sufficient).
- Dots anywhere other than the home friend lines.
- Deploying Firestore rules (the file is added; deployment is manual).

## README

Tick the four Tier-2 "Green dots for new activity" checkboxes in `README.md` in
the same PR.
