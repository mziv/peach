# Peach — Settings Page Design

**Date:** 2026-06-14
**Status:** Approved. Ready for implementation plan.
**Roadmap source:** [`2026-06-14-functionality-roadmap-design.md`](2026-06-14-functionality-roadmap-design.md) — Tier 1, "Settings page".

## Goal

Add a Settings screen reachable from the gear icon in the My Page header. It lets
the user edit their display name, view their account info, sign out, and delete
their account. Profile-photo upload is explicitly out of scope (deferred to P1).

## Context

- Stack: Expo / React Native + Firebase (Auth + Firestore), NativeWind for styling.
- Data model (relevant parts):
  - `users/{uid}` — `uid`, `username`, `displayName`, `createdAt`
  - `users/{uid}/meta/meta` — `lastPostText`, `lastPostAt`
  - `users/{uid}/posts/{postId}` — `text`, `createdAt`, `commentCount`, `likeCount`
  - `users/{uid}/posts/{postId}/comments/{id}`
  - `users/{uid}/posts/{postId}/likes/{likerUid}`
  - `friendships/{id}` — `requesterId`, `receiverId`, `status`, `createdAt`
- `AuthContext` exposes `firebaseUser` (has `.email`), `user` (the Firestore user
  doc), and `loading`. **It loads the user doc once on auth-state-change and has
  no refresh mechanism** — this design adds one.
- The My Page header gear icon currently opens an `Alert` with a Log Out action
  (`handleLogout` in `MyPageScreen`). That moves into Settings.

## Decisions (from brainstorming)

1. **Screen scope:** the three roadmap items **plus** read-only profile info
   (`@username` and account email).
2. **Display-name editing:** inline `TextInput` + **Save** button on the screen
   (no separate modal).
3. **Delete re-auth:** prompt for the password **only if** Firebase throws
   `auth/requires-recent-login`; fresh logins delete without a prompt.

## Design

### 1. Navigation & entry

- Add `Settings: undefined` to `HomeStackParamList` in `src/navigation/HomeStack.tsx`
  and register `<Stack.Screen name="Settings" component={SettingsScreen} />`.
- In `MyPageScreen`, the gear `TouchableOpacity` navigates to `Settings` instead
  of calling `handleLogout`. Remove `handleLogout` and the now-unused `logOut`
  import from `MyPageScreen`.

### 2. Screen layout — `src/screens/settings/SettingsScreen.tsx`

- Custom header matching the existing style: back chevron (`navigation.goBack()`)
  + "Settings" title.
- **Profile section:**
  - Inline display-name `TextInput`, pre-filled with `user.displayName`.
  - **Save** button enabled only when the trimmed value is non-empty **and**
    differs from the current name. Shows a saving/disabled state while in flight.
  - Read-only rows: `@{user.username}` and the account email
    (`firebaseUser.email`).
- **Account section:**
  - **Sign Out** button → `logOut()`.
  - **Delete Account** button (destructive styling) → confirmation flow below.

### 3. Display-name save

- New service in `src/services/users.ts`:
  ```ts
  export async function updateDisplayName(uid: string, displayName: string): Promise<void>
  ```
  → `updateDoc(doc(db, "users", uid), { displayName })`.
- `AuthContext` gains `refreshUser(): Promise<void>` that re-fetches the user doc
  and updates `user` state. Add it to the context value and the `AuthState`
  interface. Refactor the existing one-time load into a reusable
  `loadUser(fbUser)` helper so `refreshUser` reuses it.
- Save handler: validate → `updateDisplayName(uid, trimmed)` → `await refreshUser()`
  → surface success/errors via `Alert`. The header name updates immediately.

### 4. Delete account

New services (in `src/services/auth.ts`, since they touch Firebase Auth):

```ts
export async function reauthenticate(password: string): Promise<void>
export async function deleteAuthAccount(): Promise<void>
```

New service in `src/services/users.ts` (Firestore-only):

```ts
export async function deleteAccountData(uid: string): Promise<void>
```

`deleteAccountData` deletes, in order:
1. Each post under `users/{uid}/posts` — for each post, delete its `comments` and
   `likes` subcollection docs, then the post doc. (Client SDK can't recurse, so we
   query and delete explicitly. Batch the writes.)
2. The `users/{uid}/meta/meta` doc.
3. Every `friendships` doc where `requesterId == uid` **or** `receiverId == uid`
   (two `where` queries merged, since Firestore can't OR across different fields
   in a single simple query).
4. The `users/{uid}` doc itself.

`reauthenticate(password)` builds an `EmailAuthProvider.credential(email, password)`
from `auth.currentUser.email` and calls `reauthenticateWithCredential`.

`deleteAuthAccount()` calls `deleteUser(auth.currentUser)`.

**UI flow** in `SettingsScreen`:
1. Tap **Delete Account** → confirmation `Alert` (Cancel / destructive Delete).
2. On confirm: `await deleteAccountData(uid)` then `await deleteAuthAccount()`.
3. If `deleteAuthAccount` throws `auth/requires-recent-login`: show a password
   prompt, call `reauthenticate(password)`, then retry `deleteAuthAccount()`.
4. On success, the `onAuthStateChanged` listener clears the user and the app
   navigates to the auth stack automatically — no manual navigation needed.

**Known limitation (documented, accepted):** comments and likes the user left on
*other* users' posts are not deleted and will render as a deleted user. If
`deleteAccountData` succeeds but `deleteAuthAccount` keeps failing, the Firestore
data is gone while the Auth account lingers; acceptable for this clone.

**Cross-platform note:** `Alert.prompt` is iOS-only. To keep web/Android working,
the re-auth password prompt should be a small in-screen modal with a `TextInput`
(`secureTextEntry`) rather than `Alert.prompt`.

### 5. Testing

Service unit tests following the existing `tests/services/*` pattern (mocked
`firebase/firestore` and `firebase/auth`):

- `updateDisplayName` calls `updateDoc` with the right ref and payload.
- `deleteAccountData` deletes posts (+ nested comments/likes), meta, the matching
  friendships, and the user doc — and skips friendships the user isn't part of.
- `reauthenticate` / `deleteAuthAccount` call the right Firebase APIs; the
  re-auth-then-retry path is exercised (first `deleteUser` rejects with
  `auth/requires-recent-login`, reauth succeeds, retry succeeds).

Screen-level UI tests are optional and lower priority given the existing suite is
service-focused.

## Out of scope

- Profile-photo upload (P1).
- Changing email or password.
- Soft delete / data export.

## Files touched

- `src/navigation/HomeStack.tsx` — add route.
- `src/screens/mypage/MyPageScreen.tsx` — gear navigates to Settings; remove
  `handleLogout` + `logOut` import.
- `src/screens/settings/SettingsScreen.tsx` — **new**.
- `src/services/users.ts` — add `updateDisplayName`, `deleteAccountData`.
- `src/services/auth.ts` — add `reauthenticate`, `deleteAuthAccount`.
- `src/contexts/AuthContext.tsx` — add `refreshUser`, refactor `loadUser`.
- `tests/services/users.test.ts`, `tests/services/auth.test.ts` — add cases.
