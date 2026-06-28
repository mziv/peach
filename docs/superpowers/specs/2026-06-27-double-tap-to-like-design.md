# Double-Tap to Like — Design

## Goal
Double-tapping a post likes it (Instagram-style), in addition to the existing heart button.

## Behavior
- Double-tap anywhere on the post card **likes** it. It is idempotent: if already liked, double-tap does nothing (never unlikes).
- The heart button keeps its existing single-tap toggle (like/unlike).
- **No animation overlay.**

## Current state
- `PostItem.tsx` renders the post; like button at ~lines 73–83 calls `onLikePress`.
- Like state is tracked by the parent screen (e.g. `FriendPageScreen` `likedMap` + `handleLikeToggle`) with optimistic updates.
- Likes stored at `users/{ownerUid}/posts/{postId}/likes/{likerUid}`.

## Approach
- Add an `onDoubleTapLike` callback to `PostItem` (or reuse `onLikePress` semantics with a "like-only" variant). The parent passes a handler that calls the existing `likePost()` path only when not currently liked.
- Detect the double-tap:
  - Preferred: `react-native-gesture-handler` `Gesture.Tap().numberOfTaps(2)` **if the lib is already a dependency**.
  - Fallback (no new dependency): a timestamp-based detector — track last tap time on the card; if two taps land within ~300ms, fire the like.
  - Confirm during implementation which path applies (check `package.json`).
- Ensure the double-tap handler does not interfere with the single-tap heart button or other tappable controls (comment button, photos). Wrap the card body, not the action row, or guard so a tap on a button doesn't also count toward the double-tap.

## Out of scope
- Animations.
- Double-tap on comments.

## Files
- `src/components/PostItem.tsx` — gesture/handler.
- Parent screens passing the like handler (`FriendPageScreen`, `MyPageScreen`, home feed) — wire `onDoubleTapLike`.
