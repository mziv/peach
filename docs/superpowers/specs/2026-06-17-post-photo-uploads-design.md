# Post Photo Uploads — Design

**Date:** 2026-06-17
**Status:** Approved, pending implementation plan

## Goal

Let users attach up to 4 photos to a post. Photos render inline (stacked
vertically) in the post card. Text-only posts continue to work unchanged.

## Background

Posts today are text-only: `users/{uid}/posts/{postId}` holds
`{ text, createdAt, commentCount, likeCount }`, created via `createPost()` in
`src/services/posts.ts` and composed in `MyPageScreen.tsx`. Firebase Storage is
not yet initialized on `main`, and `expo-image-picker` is not installed on
`main`.

A paused profile-photo branch (`worktree-profile-photo-upload`, PR #16) already
implements the full upload toolkit for avatars: `getStorage` init,
`expo-image-picker` integration, a cross-platform picker (web `Modal` instead of
the no-op `Alert.alert`), and `<Image>` rendering in `Avatar.tsx`. This work
reuses those patterns.

## Two-system mental model

Photos are stored in **two** places linked by a URL:

- **Firebase Storage** holds the image bytes at `posts/{uid}/{postId}/{index}`
  and serves them over a CDN download URL.
- **Firestore** holds the post doc, which stores only the array of download URL
  strings (`photoURLs`).

The post card reads `photoURLs` and hands each string to an `<Image>`.

## Prerequisite phase: land profile photos (PR #16) first

Post photos depend on plumbing that currently lives only on the profile-photo
branch: `getStorage` init in `src/config/firebase.ts`, the `expo-image-picker`
dependency, the cross-platform picker fixes, and `<Image>` rendering in
`Avatar.tsx`.

**Decision:** finish and merge PR #16 before building post photos. This lands the
shared plumbing on `main` and ships profile photos as its own feature. Post
photos then build on top in a second PR.

Before resuming PR #16, investigate why it was paused. Memory records a "Storage
CORS blocker," but exploration suggests the real blocker was the
`Alert.alert`-is-a-no-op-on-web bug, which the branch already fixed in commit
`be58d87`. Confirm whether any genuine CORS/Storage-rules issue remains before
merging. (This investigation is part of the implementation plan for the
prerequisite phase, not this spec.)

## Data model

Add one optional field to the `Post` type (`src/types/index.ts`) and the
Firestore document:

```
users/{uid}/posts/{postId}
  text: string
  createdAt: serverTimestamp
  commentCount: number
  likeCount: number
  photoURLs?: string[]      // NEW: 0–4 download URLs, in display order
```

- Files live at `posts/{uid}/{postId}/{index}` where `index` is `0..n-1`.
- No separate "storage path" field: paths are reconstructable by convention from
  `uid`, `postId`, and `photoURLs.length`, which deletion relies on.
- `photoURLs` is absent on text-only posts and on a brand-new post before its
  uploads finish (see flow below).

## Creation flow: write-first

The post doc is written **before** the photos upload. The text post appears in
the feed immediately; photos "pop in" when the patch lands (the existing
`onSnapshot` listener fires again).

1. `createPost(uid, text)` writes the post doc (text only) and returns the new
   `postId`.
2. `uploadPostPhotos(uid, postId, localUris)` uploads each picked image to
   `posts/{uid}/{postId}/{index}` and returns the download URLs.
3. `updatePost(uid, postId, { photoURLs })` patches the doc with the URL array.

**Failure mode (accepted):** if uploads fail after step 1, the post remains a
text-only post that was meant to have photos. Handling for v1: show an error
toast and leave the post as-is. The user can delete it. No auto-retry in v1.

## Service layer (`src/services/posts.ts`)

Adapt the profile-photo branch's upload mechanics (avatars → posts):

- **`createPost(uid, text) → postId`** — extended to return the new doc id.
  Keeps the existing batch that updates `users/{uid}/meta/meta`.
- **`uploadPostPhotos(uid, postId, localUris[]) → string[]`** — loops over the
  picked images; for each: `fetch(localUri) → blob → uploadBytes` with an
  explicit `image/jpeg` content-type (Expo's picker often yields an empty
  `blob.type` — same fix used for avatars) → `getDownloadURL`. Returns the URLs
  in input order.
- **`updatePost(uid, postId, fields)`** — patches the post doc (used to set
  `photoURLs`).
- **`deletePost(...)`** — extended to `deleteObject` each photo
  (`posts/{uid}/{postId}/{0..n-1}`, derived from `photoURLs.length`) before
  removing the doc, so deleting a post does not strand its files. Swallow
  object-not-found, mirroring `removeProfilePhoto`. Account deletion
  (`deleteAccountData`) is extended the same way.

## Composer UI (`src/screens/mypage/MyPageScreen.tsx`)

- An "add photo" control beside the text input opens `expo-image-picker` with
  `allowsMultipleSelection: true` and `selectionLimit: 4`.
- Picked images render as a **thumbnail row, each with an ✕** to remove before
  posting.
- On "Post": write the text post, clear the composer immediately, and run the
  uploads in the background; patch the doc when they finish. Show a lightweight
  uploading indicator; surface an error toast on upload failure.
- Reuse the branch's cross-platform fixes: web `Modal` instead of `Alert.alert`,
  and skip the media-library permission prompt on web (auto-granted) to stay
  inside the user-gesture window.

## Post card (`src/components/PostItem.tsx`)

- `photoURLs?.map(...)` renders one `<Image>` per photo, **stacked vertically
  inline**, full card width, sensible aspect ratio, rounded corners. No
  carousel.
- Text-only posts (and posts whose uploads have not yet landed) render exactly
  as today.

## Storage security rules (new `storage.rules`)

Owner-write, any-authenticated-read:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /posts/{uid}/{postId}/{file} {
      allow read:  if request.auth != null;
      allow write: if request.auth.uid == uid;
    }
    match /avatars/{uid} {
      allow read:  if request.auth != null;
      allow write: if request.auth.uid == uid;
    }
  }
}
```

The `avatars` rule is folded in for consistency (it lands with PR #16; this spec
keeps the two consistent). Deploy via the Firebase CLI.

## Testing (`tests/services/posts.test.ts`)

Follow the branch's pattern — mock Storage and Firestore. Cover:

- write-first ordering (doc created before upload; `photoURLs` patched after),
- the 4-photo cap,
- content-type set to `image/jpeg`,
- `deletePost` removes both the doc and all photo objects,
- text-only posts still create successfully with no `photoURLs`.

## Out of scope (v1)

- Auto-retry of failed uploads.
- Friend-gated *reads* of Storage objects (using any-authed-read for now).
- Editing a post's photos after creation.
- Carousels / image cropping / captions per photo.

## README roadmap

Tick the corresponding roadmap checkbox(es) in the same PR as the feature.
