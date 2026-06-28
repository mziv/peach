# Comment Profile Photos — Design

## Goal
Show comment authors' real profile photos in `CommentModal`, instead of always rendering initials.

## Current state
- `Comment` (`src/types/index.ts`) stores only `commentId`, `authorUid`, `authorUsername`, `text`, `createdAt`. No photo URL.
- `CommentModal.tsx` (~line 191) renders `<Avatar size={32} displayName={item.authorUsername} />` — initials only.
- `getUserByUid()` (`src/services/users.ts`) returns the user doc including `photoURL` and `displayName`.

## Approach: hydrate on read
No Firestore schema change. Works retroactively for existing comments and always shows the current photo.

1. After comments load, collect the distinct `authorUid`s.
2. Look up each once via `getUserByUid()` (deduped; cache results in a `Map` keyed by uid for the lifetime of the open modal so repeated authors aren't re-fetched).
3. Render `<Avatar photoURL={info?.photoURL} displayName={info?.displayName ?? item.authorUsername} />`.
4. Optionally show the display name line above `@username`, matching the activity feed.

## Edge cases
- Author has no photo → `Avatar` falls back to initials (existing behavior).
- Lookup fails / author deleted → fall back to `authorUsername` initials; do not block rendering the comment text.
- Hydration is async: render comments immediately, fill in photos as lookups resolve (avatar updates when its author's info arrives).

## Out of scope
- Storing photos on the comment doc.
- Comment editing.

## Files
- `src/components/CommentModal.tsx` — hydration + Avatar props.
- (Possibly) a small helper to batch/dedupe user lookups.
