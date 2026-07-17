# Enter-to-Submit for Posts and Comments

**Date:** 2026-07-17
**Status:** Approved

## Goal

Pressing Enter submits an in-progress post or comment instead of doing nothing
useful (comment box) or inserting a newline (post composer). In the multiline
post composer, Shift+Enter still inserts a newline on web.

## Current State

- **Post composer** (`src/screens/mypage/MyPageScreen.tsx`): a `multiline`
  `TextInput`. Enter inserts a newline; the only way to post is the Post button.
- **Comment input** (`src/components/CommentModal.tsx`): a single-line
  `TextInput` with no `onSubmitEditing`; the only way to send is the Send button.

## Design

Use React Native's built-in submit props (approach chosen over raw web-only
`onKeyPress` handlers and over extracting a shared composer component — YAGNI
for two call sites).

### Comment input (CommentModal)

- Add `onSubmitEditing={handleSend}`.
- Add `submitBehavior="submit"` so the input keeps focus after sending,
  allowing several comments in a row without re-tapping the field.

### Post composer (MyPageScreen)

- Keep `multiline`.
- Add `onSubmitEditing={handlePost}` and `submitBehavior="submit"` so the
  native return key submits instead of inserting a newline.
- On web, verify Enter submits and Shift+Enter inserts a newline. If
  react-native-web ignores `submitBehavior` for multiline inputs, add a
  web-only `onKeyPress` handler: plain Enter calls `handlePost` and prevents
  the default newline; Shift+Enter falls through.

### Guards

Enter bypasses the buttons' `disabled` props, so the submit handlers get
early returns mirroring the button conditions:

- `handlePost`: return if `posting`, or if text is empty and no photos selected.
- `handleSend`: return if `submitting` or text is empty.

Pressing Enter with nothing to submit does nothing.

### Error handling

Unchanged — Enter routes through the same `handlePost`/`handleSend` paths the
buttons already use.

## Testing

- Unit tests for the guard behavior (submitting via `onSubmitEditing` when
  empty/busy is a no-op; submits when valid).
- Manual verification in the web app: type + Enter posts/sends, Shift+Enter
  adds a newline in the post composer, Enter on empty input does nothing.
