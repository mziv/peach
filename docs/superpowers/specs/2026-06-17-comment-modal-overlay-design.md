# Comment interface: bottom-sheet → centered-card modal

**Date:** 2026-06-17
**Branch:** `worktree-comment-modal-overlay`
**Status:** Approved design

## Problem

`src/components/CommentModal.tsx` is wrapped in React Native's `<Modal>` but
visually behaves as a **bottom sheet**: a panel pinned to the bottom of the
screen (`justify-end`), fixed at 60% screen height, that slides up via an
`Animated` `translateY` from offscreen while a backdrop fades in.

The `translateY` slide animation looks glitchy (notably on mobile Safari, even
with the existing `willChange: "transform"` web hint). We want to replace it
with a centered-card modal overlay that fades in — no slide.

## Goal

Swap the bottom-sheet presentation for a **centered card** that **fades** in and
out over a dimmed backdrop. Eliminate the `translateY` slide entirely.

## Scope

- **Single file edited:** `src/components/CommentModal.tsx`.
- **No public API change.** Props (`visible`, `onClose`, `postOwnerUid`,
  `postId`, `postText`) are unchanged, so `MyPageScreen` and `FriendPageScreen`
  need no edits.
- **No new dependencies.** Continue using React Native's built-in `Animated` API.
- **No data-flow changes.** Firestore comment subscription, `addComment`,
  `deleteComment`, and the in-flight delete guard (`deletingIds`) are untouched.

Out of scope: comment list rendering/markup, send/delete logic, navigation
auto-open behavior.

## Design

### Presentation

- **Container:** change the root overlay `View` from `flex-1 justify-end` to
  `flex-1 justify-center items-center` so the card floats in the screen center.
- **Card:** ~88% width, fixed `height: "75%"`, rounded on all corners
  (`rounded-2xl` instead of `rounded-t-2xl`). Fixed height (not `maxHeight`) so
  the card is a constant size regardless of comment count. Keeps the same three
  internal sections in order: title bar → scrollable `FlatList` of comments →
  bottom input row. The `FlatList` flexes and scrolls inside the fixed-height
  card.

### Animation (fade only)

- Remove `panelTranslateY` and `slideDistance` entirely.
- Keep a single `Animated.Value` for opacity (rename/repurpose the existing
  `backdropOpacity`) that drives **both** the backdrop and the card, so they
  fade together. ~200ms in and out.
- Retain the `rendered` state gate so the modal stays mounted until the fade-out
  completes, then unmounts.
- `useNativeDriver = Platform.OS !== "web"` is preserved (opacity is
  native-driver-safe).

### Keyboard handling

- Keep the `KeyboardAvoidingView` wrapping the card, with
  `behavior={Platform.OS === "ios" ? "padding" : undefined}`. On a centered card
  the keyboard can overlap the input; `padding` behavior lifts the card as the
  keyboard rises. This already works today and is preserved.

### Web

- Keep the `willChange: "opacity"` hint on the backdrop (still a full-screen
  fade).
- Drop the `willChange: "transform"` hint — there is no transform anymore.

## Testing

- Existing Jest suite must stay green (`npm test`, currently 86 passing).
- Manual verification on web (`npm run web`) and a device/simulator: open from a
  post's comment button on both `MyPageScreen` and `FriendPageScreen`, confirm
  the card fades in centered, comments load, send/delete work, the keyboard
  lifts the card, tapping the backdrop closes it, and the close fade completes
  cleanly with no slide/jank.

## Risks

- **Keyboard overlap on small screens:** a centered card plus keyboard could be
  tight. `KeyboardAvoidingView` padding mitigates this; verify manually. If it's
  insufficient, a follow-up could shift the card upward when the keyboard is
  open.
