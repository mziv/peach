# Links in Posts — Design

## Goal
Render raw URLs in post captions as tappable links that open in the system browser. Posts only.

## Current state
- `PostItem.tsx` (~line 64) renders the caption as plain `<Text>{text}</Text>`.
- Post text is stored as-is in Firestore; no preprocessing.

## Approach
- Add a `LinkifiedText` component (e.g. `src/components/LinkifiedText.tsx`):
  - Split the input text on a URL regex matching `https?://...` (and optionally bare `www.` prefixed, normalized to `https://`).
  - Render non-URL segments as normal `<Text>`; render URL segments as a styled (e.g. blue/underline) `<Text>` with `onPress={() => Linking.openURL(url)}`.
  - Preserve surrounding text and whitespace exactly; handle multiple URLs in one caption.
  - Trim trailing punctuation that is unlikely to be part of the URL (e.g. a sentence-final `.`, `,`, `)`).
- Use it in `PostItem` where the caption renders. Keep the same `className="text-base mb-2"` on the container text.

## Edge cases
- No URL → renders identically to today.
- Malformed/partial URLs → leave as plain text (only linkify regex matches).
- `Linking.openURL` failure → fail silently (wrap in try/catch or `.catch`).

## Out of scope
- Links in comments.
- Markdown `[text](url)` syntax.
- Link previews / unfurling.

## Files
- `src/components/LinkifiedText.tsx` (new).
- `src/components/PostItem.tsx` — use `LinkifiedText` for the caption.
