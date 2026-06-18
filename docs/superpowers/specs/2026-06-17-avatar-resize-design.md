# Design: cap avatar image size on upload

## Problem

Profile photo uploads are not size-bounded on the web. The picker's
`quality`/`aspect`/`allowsEditing` options apply only on native; on web they are
ignored, so the full-resolution, uncompressed file is uploaded. The only current
guard is the 5 MB cap in `storage.rules`, which is a coarse backstop, not a real
size policy.

## Goal

Bound every uploaded avatar to a small, predictable size on both native and web,
without changing how avatars display.

## Approach

Resize and re-encode the image client-side before upload, inside the single
upload choke point (`uploadProfilePhoto` in `src/services/users.ts`) so the cap
holds regardless of caller.

### Dependency

Add `expo-image-manipulator` (Expo-managed; supported on native and on web via
canvas — this is what closes the web full-res gap).

### Behavior

`uploadProfilePhoto` performs, in order:

1. **Resize**: scale the source so its **longer edge ≤ 512px**, preserving
   aspect ratio and never upscaling a smaller image.
2. **Re-encode**: JPEG, quality 0.7.
3. **Upload**: fetch the *resized* file → blob → `uploadBytes` with
   `contentType: "image/jpeg"` (unchanged from today otherwise).

To choose which edge to constrain (portrait vs landscape), the function uses the
`width`/`height` the picker already returns on the selected asset. `SettingsScreen`
passes those through. Signature change:

```
uploadProfilePhoto(uid, localUri)
→ uploadProfilePhoto(uid, localUri, { width?, height? })
```

When dimensions are absent (some web cases), fall back to constraining width to
512 (`resize: { width: 512 }`), which preserves aspect ratio proportionally.

### Backstop

The 5 MB rule in `storage.rules` stays as a server-side safety net.

## Non-goals

- No change to the `Avatar` display component (it already crops to a circle).
- No change to the picker's native crop/quality options.
- No server-side resizing (Cloud Functions) — client resize is sufficient.

## Testing

Extend `tests/services/users.test.ts`:

- Mock `expo-image-manipulator`.
- Assert it is invoked with the 512 resize action and JPEG/0.7 save options.
- Assert `uploadBytes` receives the blob from the *manipulated* result URI, not
  the original `localUri`.
- Existing `fetch` / `uploadBytes` / `updateDoc` mocks remain.

## Expected outcome

Avatars land ~50–150 KB; web compresses like native; display is unaffected.
