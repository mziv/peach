# Profile Photo Upload — Design

**Date:** 2026-06-14
**Status:** Approved (brainstorm), pending implementation
**README task:** Tier 3 — "Profile photo upload _(the deferred half of Settings)_"

## Goal

Let a signed-in user set, replace, and remove a profile photo from the Settings
screen. The photo is stored in Firebase Storage, its download URL is persisted
on the user document, and the `Avatar` component renders it everywhere a user's
avatar appears — falling back to the existing initials avatar when no photo is
set.

## Decisions (from brainstorming)

- **Image source:** Photo library only (no camera). One permission, fewer code
  paths; camera can be added later.
- **Cropping:** Force a 1:1 square crop in the picker's editor before upload.
- **Remove photo:** Yes — Settings offers a "Remove photo" action that deletes
  the Storage object and clears `photoURL`.

## Architecture & Data Flow

```
Settings UI: tap avatar
  → action sheet: "Change photo" / "Remove photo" (if a photo exists) / "Cancel"

Change photo:
  requestMediaLibraryPermissionsAsync()  → if denied, Alert + stop
  launchImageLibraryAsync({ allowsEditing: true, aspect: [1,1], quality: 0.7 })
  → local file URI
  → users.uploadProfilePhoto(uid, uri):
       fetch(uri) → blob
       uploadBytes(ref(storage, `avatars/${uid}`), blob)
       getDownloadURL(...)
       updateDoc(users/{uid}, { photoURL })
       returns photoURL
  → refreshUser()  → AuthContext.user.photoURL updates
  → Avatar re-renders with <Image>

Remove photo:
  → users.removeProfilePhoto(uid):
       deleteObject(ref(storage, `avatars/${uid}`))  // ignore object-not-found
       updateDoc(users/{uid}, { photoURL: deleteField() })
  → refreshUser()
```

### Dependencies

- **`expo-image-picker`** — new dependency (installed via `npx expo install`
  so the version matches the Expo SDK).
- **Firebase Storage** — already bundled in the `firebase` package; only needs
  initialization. The `storageBucket` is already set in `firebaseConfig`.

## Components & Changes

### `src/types/index.ts`
Add an optional field to `User`:
```ts
photoURL?: string;
```

### `src/config/firebase.ts`
Initialize and export Storage alongside `auth` and `db`:
```ts
import { getStorage } from "firebase/storage";
export const storage = getStorage(app);
```

### `src/services/users.ts`
- **`uploadProfilePhoto(uid: string, localUri: string): Promise<string>`** —
  fetch the local URI into a blob, `uploadBytes` to `avatars/{uid}`,
  `getDownloadURL`, `updateDoc(users/{uid}, { photoURL })`, return the URL.
- **`removeProfilePhoto(uid: string): Promise<void>`** — `deleteObject` for
  `avatars/{uid}` (swallow `storage/object-not-found`), then
  `updateDoc(users/{uid}, { photoURL: deleteField() })`.
- **`getUserByUid`** and **`searchUsersByUsername`** — include
  `photoURL: data.photoURL` in the returned objects.
- **`deleteAccountData`** — also `deleteObject(avatars/{uid})`, swallowing
  `storage/object-not-found` so account deletion never fails on a missing photo.

### `src/contexts/AuthContext.tsx`
In `loadUser`, map `photoURL: data.photoURL` into the `setUser({...})` object so
the in-memory session user carries the photo.

### `src/components/Avatar.tsx`
Render the photo when present, else the current initials avatar:
```tsx
if (photoURL) {
  return (
    <Image
      source={{ uri: photoURL }}
      style={{ width: size, height: size, borderRadius: size / 2 }}
    />
  );
}
// ...existing initials View
```
`photoURL` is already declared in `AvatarProps` and is wired through but unused
today — this is the change that finally renders it.

### `src/screens/settings/SettingsScreen.tsx`
At the top of the **Profile** section, add a centered tappable `Avatar`
(size ~80) showing the current photo/initials, with a "Change photo" caption
below it. Tapping opens an `Alert` action sheet:
- **Change photo** → permission check → picker → `uploadProfilePhoto` →
  `refreshUser`.
- **Remove photo** (only shown when `user?.photoURL` is set) →
  `removeProfilePhoto` → `refreshUser`.
- **Cancel.**

An `uploading` state flag disables the avatar and shows a brief indicator
("Uploading…") while in flight. Errors surface via `Alert.alert("Error", …)`,
matching the existing display-name save flow; the flag resets in `finally`.

### Avatar consumers — thread `photoURL` where available
Pass `photoURL` to `Avatar` wherever the source object already carries it:
- `src/screens/mypage/MyPageScreen.tsx` — `user?.photoURL`.
- `src/screens/friends/SearchUsersScreen.tsx` — `item.photoURL` (search returns `User`).
- `src/screens/home/FriendPageScreen.tsx` — the loaded friend's `photoURL`.

`src/components/CommentModal.tsx` only has an author *username* (not a full user
record or photo), so it stays initials-only. Out of scope.

## Error Handling & Permissions

- **Permission denied:** `Alert` explaining the user can enable photo access in
  device settings; no upload attempted.
- **Upload / remove failure:** caught and shown via `Alert.alert("Error", err.message)`.
- **Object-not-found on delete:** swallowed (a user may have no photo yet).
- **In-flight guard:** `uploading` flag prevents double-taps and resets in `finally`.

## Testing

Jest, mocking `firebase/storage` and `firebase/firestore` the same way existing
service tests mock Firebase:

- `uploadProfilePhoto` calls `uploadBytes` / `getDownloadURL` with `avatars/{uid}`
  and `updateDoc` with the returned URL; returns the URL.
- `removeProfilePhoto` calls `deleteObject` and `updateDoc` with a cleared field;
  swallows `storage/object-not-found`.
- `getUserByUid` / `searchUsersByUsername` map `photoURL`.
- `deleteAccountData` attempts `deleteObject` and does not throw when the object
  is missing.
- `Avatar` renders an `Image` when `photoURL` is set and initials text otherwise.

## Out of Scope

- Camera capture.
- Client-side resizing/compression beyond the picker's editor + `quality: 0.7`.
- Firebase Storage security rules — a follow-up, mirroring the README's
  deferred Firestore-rules items.

## README Roadmap

Tick these in the same PR (Tier 3 — Profile photo upload):
- [ ] Add Firebase Storage + `expo-image-picker`
- [ ] Pick a photo → upload → store `photoURL` on the user doc
- [ ] `Avatar` renders `photoURL` (initials fallback)
- [ ] Photo picker UI in Settings
