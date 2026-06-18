# Profile Photo Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a signed-in user set, replace, and remove a profile photo from Settings; store it in Firebase Storage; persist `photoURL` on the user doc; and render it in `Avatar` everywhere, falling back to initials.

**Architecture:** Firebase Storage holds the image at `avatars/{uid}`; its download URL is saved to `users/{uid}.photoURL`. The service layer (`users.ts`) owns upload/remove; `AuthContext` and the user-mapping reads surface `photoURL`; `Avatar` renders an `<Image>` when a URL is present. The Settings screen drives picking (library-only, square crop) via `expo-image-picker`.

**Tech Stack:** React Native + Expo, TypeScript, Firebase (Auth/Firestore/Storage), NativeWind, Jest + @testing-library/react-native.

**Spec:** `docs/superpowers/specs/2026-06-14-profile-photo-upload-design.md`

**Notes for the implementer:**
- Run tests with `npm test`. Type-check with `npx tsc --noEmit`.
- Existing service tests mock `firebase/firestore` and `../../src/config/firebase`. Follow that exact style.
- There is **no** typecheck npm script; use `npx tsc --noEmit` directly.

---

## File Structure

- `src/types/index.ts` — add `photoURL?` to `User`.
- `src/config/firebase.ts` — initialize + export `storage`.
- `src/services/users.ts` — `uploadProfilePhoto`, `removeProfilePhoto`, map `photoURL` in reads, `deleteObject` in `deleteAccountData`.
- `src/contexts/AuthContext.tsx` — map `photoURL` in `loadUser`.
- `src/components/Avatar.tsx` — render `<Image>` when `photoURL` set.
- `src/screens/settings/SettingsScreen.tsx` — picker UI + handlers.
- `src/components/UserPreview.tsx` — accept + pass `photoURL`.
- `src/screens/home/HomeScreen.tsx` — carry `photoURL` through `FriendWithMeta`, pass to `UserPreview` + nav params.
- `src/navigation/HomeStack.tsx` — add `friendPhotoURL?` to the `FriendPage` route params.
- `src/screens/home/FriendPageScreen.tsx` — read `friendPhotoURL`, pass to `Avatar`.
- `src/screens/mypage/MyPageScreen.tsx` — pass `user?.photoURL`.
- `src/screens/friends/SearchUsersScreen.tsx` — pass `item.photoURL`.
- Tests: `tests/services/users.test.ts`, `tests/components/Avatar.test.tsx`.

---

## Task 1: Add `photoURL` to the data layer

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/services/users.ts`
- Modify: `src/contexts/AuthContext.tsx`
- Test: `tests/services/users.test.ts`

- [ ] **Step 1: Write failing tests for `photoURL` mapping**

In `tests/services/users.test.ts`, add `photoURL` to the `getUserByUid` "exists" mock data and expectation, and add a new case. Replace the existing `getUserByUid` "returns user data" test body and add a search test:

```ts
    it("returns user data including photoURL when user exists", async () => {
      const mockData = {
        uid: "uid-1",
        username: "alice",
        displayName: "Alice",
        photoURL: "https://example.com/alice.jpg",
        createdAt: { toDate: () => new Date("2026-01-01") },
      };
      (getDoc as jest.Mock).mockResolvedValue({
        exists: () => true,
        data: () => mockData,
      });

      const user = await getUserByUid("uid-1");

      expect(user).toEqual({
        uid: "uid-1",
        username: "alice",
        displayName: "Alice",
        photoURL: "https://example.com/alice.jpg",
        createdAt: new Date("2026-01-01"),
      });
    });
```

In the `searchUsersByUsername` "returns matching users" test, add `photoURL: "https://example.com/bob.jpg"` to the mock `data()` and assert `expect(users[0].photoURL).toBe("https://example.com/bob.jpg");`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- users.test.ts`
Expected: FAIL — returned objects lack `photoURL`.

- [ ] **Step 3: Add `photoURL` to the `User` type**

In `src/types/index.ts`, inside `interface User`:

```ts
export interface User {
  uid: string;
  username: string;
  displayName: string;
  photoURL?: string;
  createdAt: Date;
}
```

- [ ] **Step 4: Map `photoURL` in the user reads**

In `src/services/users.ts`, add `photoURL: data.photoURL,` to the returned object in **both** `getUserByUid` and `searchUsersByUsername` (the `snap.docs.map` callback), e.g.:

```ts
  return {
    uid: data.uid,
    username: data.username,
    displayName: data.displayName,
    photoURL: data.photoURL,
    createdAt: data.createdAt?.toDate() ?? new Date(),
  };
```

- [ ] **Step 5: Map `photoURL` in AuthContext**

In `src/contexts/AuthContext.tsx`, inside `loadUser`'s `setUser({...})`:

```ts
      setUser({
        uid: data.uid,
        username: data.username,
        displayName: data.displayName,
        photoURL: data.photoURL,
        createdAt: data.createdAt?.toDate() ?? new Date(),
      });
```

- [ ] **Step 6: Run tests + typecheck**

Run: `npm test -- users.test.ts` → Expected: PASS
Run: `npx tsc --noEmit` → Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add src/types/index.ts src/services/users.ts src/contexts/AuthContext.tsx tests/services/users.test.ts
git commit -m "feat: surface photoURL through the user data layer"
```

---

## Task 2: Render `photoURL` in `Avatar`

**Files:**
- Modify: `src/components/Avatar.tsx`
- Test: `tests/components/Avatar.test.tsx`

- [ ] **Step 1: Replace the obsolete deferred-photo test**

In `tests/components/Avatar.test.tsx`, the last test (`"still shows initials when photoURL is provided (photos deferred to Tier 3)"`) is now wrong. Replace it with two tests. Add `import { Image } from "react-native";` is **not** needed — query by role instead via `UNSAFE_getByType`. Use:

```ts
  it("renders the photo image when photoURL is provided", () => {
    const photoURL = "https://example.com/p.jpg";
    const { UNSAFE_getByType, queryByText } = render(
      <Avatar displayName="Maya Ziv" photoURL={photoURL} />
    );
    const { Image } = require("react-native");
    const img = UNSAFE_getByType(Image);
    expect(img.props.source).toEqual({ uri: photoURL });
    // Initials must NOT render once a photo is present.
    expect(queryByText("MZ")).toBeNull();
  });

  it("renders initials when no photoURL is provided", () => {
    const { getByText } = render(<Avatar displayName="Maya Ziv" />);
    expect(getByText("MZ")).toBeTruthy();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- Avatar.test.tsx`
Expected: FAIL — no `Image` is rendered (`UNSAFE_getByType` throws).

- [ ] **Step 3: Render the image in `Avatar`**

In `src/components/Avatar.tsx`, add `Image` to the react-native import, accept `photoURL` in the destructure, and return early when it's set:

```tsx
import React from "react";
import { View, Text, Image } from "react-native";
import { getInitials, avatarColor } from "../utils/avatar";

// ...AvatarProps unchanged (photoURL already declared)...

export default function Avatar({ displayName, size = 40, photoURL }: AvatarProps) {
  if (photoURL) {
    return (
      <Image
        source={{ uri: photoURL }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }

  const initials = getInitials(displayName ?? "");

  return (
    <View
      className="rounded-full items-center justify-center"
      style={{
        width: size,
        height: size,
        backgroundColor: avatarColor(displayName ?? ""),
      }}
    >
      <Text
        className="text-white font-semibold"
        style={{ fontSize: size * 0.4 }}
      >
        {initials}
      </Text>
    </View>
  );
}
```

- [ ] **Step 4: Run test + typecheck**

Run: `npm test -- Avatar.test.tsx` → Expected: PASS
Run: `npx tsc --noEmit` → Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/components/Avatar.tsx tests/components/Avatar.test.tsx
git commit -m "feat: render profile photo in Avatar with initials fallback"
```

---

## Task 3: Firebase Storage init + upload/remove/delete service functions

**Files:**
- Modify: `src/config/firebase.ts`
- Modify: `src/services/users.ts`
- Test: `tests/services/users.test.ts`

- [ ] **Step 1: Write failing tests for the storage functions**

In `tests/services/users.test.ts`:

Add storage to the firestore mock import line and add `deleteField`:
```ts
import { doc, getDoc, getDocs, updateDoc, where, writeBatch, or, deleteField } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import {
  getUserByUid,
  searchUsersByUsername,
  updateDisplayName,
  deleteAccountData,
  uploadProfilePhoto,
  removeProfilePhoto,
} from "../../src/services/users";
```

Add `deleteField: jest.fn(() => "mock-delete-field"),` to the existing `jest.mock("firebase/firestore", ...)` factory.

Add a new mock for storage and extend the firebase config mock:
```ts
jest.mock("firebase/storage", () => ({
  ref: jest.fn(() => ({ fullPath: "mock-storage-ref" })),
  uploadBytes: jest.fn(),
  getDownloadURL: jest.fn(),
  deleteObject: jest.fn(),
}));

jest.mock("../../src/config/firebase", () => ({
  db: {},
  storage: {},
}));
```

`uploadProfilePhoto` fetches the local URI into a blob, so stub global `fetch` in this describe block:
```ts
  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).fetch = jest.fn().mockResolvedValue({
      blob: jest.fn().mockResolvedValue("mock-blob"),
    });
  });
```
(Replace the existing `beforeEach(() => jest.clearAllMocks());` with the block above.)

Add the test cases:
```ts
  describe("uploadProfilePhoto", () => {
    it("uploads the blob to avatars/{uid}, sets photoURL, and returns the URL", async () => {
      (getDownloadURL as jest.Mock).mockResolvedValue("https://cdn/avatar.jpg");
      (uploadBytes as jest.Mock).mockResolvedValue(undefined);
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      const url = await uploadProfilePhoto("uid-1", "file:///tmp/pic.jpg");

      expect(global.fetch).toHaveBeenCalledWith("file:///tmp/pic.jpg");
      expect(ref).toHaveBeenCalledWith(expect.anything(), "avatars/uid-1");
      expect(uploadBytes).toHaveBeenCalledWith(expect.anything(), "mock-blob");
      expect(updateDoc).toHaveBeenCalledWith(expect.anything(), {
        photoURL: "https://cdn/avatar.jpg",
      });
      expect(url).toBe("https://cdn/avatar.jpg");
    });
  });

  describe("removeProfilePhoto", () => {
    it("deletes the storage object and clears photoURL", async () => {
      (deleteObject as jest.Mock).mockResolvedValue(undefined);
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      await removeProfilePhoto("uid-1");

      expect(ref).toHaveBeenCalledWith(expect.anything(), "avatars/uid-1");
      expect(deleteObject).toHaveBeenCalled();
      expect(updateDoc).toHaveBeenCalledWith(expect.anything(), {
        photoURL: "mock-delete-field",
      });
    });

    it("clears photoURL even when the object does not exist", async () => {
      (deleteObject as jest.Mock).mockRejectedValue({ code: "storage/object-not-found" });
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      await expect(removeProfilePhoto("uid-1")).resolves.toBeUndefined();
      expect(updateDoc).toHaveBeenCalledWith(expect.anything(), {
        photoURL: "mock-delete-field",
      });
    });
  });
```

For `deleteAccountData`, add a storage assertion to its first test. After `await deleteAccountData("uid-1");` add:
```ts
      expect(deleteObject).toHaveBeenCalled();
```
And ensure `deleteObject` resolves (it defaults to a `jest.fn()` returning undefined, which is fine).

Add a dedicated not-found test:
```ts
    it("does not throw if the avatar object is missing", async () => {
      const batch = { delete: jest.fn(), commit: jest.fn().mockResolvedValue(undefined) };
      (writeBatch as jest.Mock).mockReturnValue(batch);
      (getDocs as jest.Mock).mockResolvedValue({ docs: [] });
      (deleteObject as jest.Mock).mockRejectedValue({ code: "storage/object-not-found" });

      await expect(deleteAccountData("uid-1")).resolves.toBeUndefined();
    });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- users.test.ts`
Expected: FAIL — `uploadProfilePhoto`/`removeProfilePhoto` are not exported; `deleteObject` not called.

- [ ] **Step 3: Initialize and export Storage**

In `src/config/firebase.ts`, add the import near the other firebase imports and export `storage` after `db`:

```ts
import { getStorage } from "firebase/storage";
```
```ts
export const storage = getStorage(app);
```

- [ ] **Step 4: Implement the service functions**

In `src/services/users.ts`, extend the firestore import with `deleteField`, add a storage import, and import `storage`:

```ts
import {
  doc,
  getDoc,
  getDocs,
  query,
  collection,
  where,
  orderBy,
  limit,
  updateDoc,
  writeBatch,
  or,
  deleteField,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "../config/firebase";
```

Add the two functions (place them after `updateDisplayName`):

```ts
export async function uploadProfilePhoto(
  uid: string,
  localUri: string
): Promise<string> {
  const response = await fetch(localUri);
  const blob = await response.blob();
  const storageRef = ref(storage, `avatars/${uid}`);
  await uploadBytes(storageRef, blob);
  const photoURL = await getDownloadURL(storageRef);
  await updateDoc(doc(db, "users", uid), { photoURL });
  return photoURL;
}

export async function removeProfilePhoto(uid: string): Promise<void> {
  try {
    await deleteObject(ref(storage, `avatars/${uid}`));
  } catch (err: any) {
    // A user may have set no photo yet; only re-throw unexpected errors.
    if (err?.code !== "storage/object-not-found") throw err;
  }
  await updateDoc(doc(db, "users", uid), { photoURL: deleteField() });
}
```

In `deleteAccountData`, before `await batch.commit();` (the friendship/user deletes are batched, but Storage is not part of the Firestore batch, so delete it separately). Add right after the `friendshipsSnap` loop and before/around the final user delete — simplest is just before `await batch.commit();`:

```ts
  // Remove the profile photo from Storage (not part of the Firestore batch).
  try {
    await deleteObject(ref(storage, `avatars/${uid}`));
  } catch (err: any) {
    if (err?.code !== "storage/object-not-found") throw err;
  }

  await batch.commit();
```

- [ ] **Step 5: Run tests + typecheck**

Run: `npm test -- users.test.ts` → Expected: PASS
Run: `npx tsc --noEmit` → Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/config/firebase.ts src/services/users.ts tests/services/users.test.ts
git commit -m "feat: add Storage-backed uploadProfilePhoto/removeProfilePhoto"
```

---

## Task 4: Settings photo picker UI

**Files:**
- Modify: `src/screens/settings/SettingsScreen.tsx`
- Dependency: `expo-image-picker`

- [ ] **Step 1: Install expo-image-picker**

Run: `npx expo install expo-image-picker`
Expected: adds `expo-image-picker` to `package.json` at an SDK-compatible version.
Commit this immediately so the dependency is isolated:
```bash
git add package.json package-lock.json
git commit -m "build: add expo-image-picker"
```

- [ ] **Step 2: Wire imports and handlers into SettingsScreen**

In `src/screens/settings/SettingsScreen.tsx`:

Add imports:
```tsx
import { Image } from "react-native";
import * as ImagePicker from "expo-image-picker";
import {
  updateDisplayName,
  deleteAccountData,
  uploadProfilePhoto,
  removeProfilePhoto,
} from "../../services/users";
```

Add state next to the other `useState` calls:
```tsx
  const [photoBusy, setPhotoBusy] = useState(false);
```

Add the handlers (place above `return`):
```tsx
  async function pickAndUpload() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Permission needed",
        "Enable photo library access in Settings to choose a profile photo."
      );
      return;
    }
    // mediaTypes defaults to images; omitted to avoid version-specific
    // MediaTypeOptions/MediaType API churn across expo-image-picker releases.
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !user) return;
    setPhotoBusy(true);
    try {
      await uploadProfilePhoto(user.uid, result.assets[0].uri);
      await refreshUser();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setPhotoBusy(false);
    }
  }

  async function handleRemovePhoto() {
    if (!user) return;
    setPhotoBusy(true);
    try {
      await removeProfilePhoto(user.uid);
      await refreshUser();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setPhotoBusy(false);
    }
  }

  function openPhotoOptions() {
    if (photoBusy) return;
    const options = user?.photoURL
      ? [
          { text: "Change photo", onPress: pickAndUpload },
          { text: "Remove photo", style: "destructive" as const, onPress: handleRemovePhoto },
          { text: "Cancel", style: "cancel" as const },
        ]
      : [
          { text: "Change photo", onPress: pickAndUpload },
          { text: "Cancel", style: "cancel" as const },
        ];
    Alert.alert("Profile photo", undefined, options);
  }
```

- [ ] **Step 3: Add the avatar UI at the top of the Profile section**

In the JSX, immediately after the `Profile` section label (`<Text ...>Profile</Text>`) and before the display-name `View`, insert a centered tappable avatar:

```tsx
        <View className="items-center pb-4">
          <TouchableOpacity onPress={openPhotoOptions} disabled={photoBusy}>
            {user?.photoURL ? (
              <Image
                source={{ uri: user.photoURL }}
                style={{ width: 80, height: 80, borderRadius: 40 }}
              />
            ) : (
              <View
                className="rounded-full items-center justify-center bg-gray-200"
                style={{ width: 80, height: 80 }}
              >
                <Ionicons name="camera-outline" size={28} color="gray" />
              </View>
            )}
          </TouchableOpacity>
          <Text className="text-sm text-peach mt-2">
            {photoBusy ? "Uploading…" : "Change photo"}
          </Text>
        </View>
```

> Note: rendering `Image` directly (not `Avatar`) here is deliberate — the empty state shows a camera affordance rather than initials, signalling the tap action.

- [ ] **Step 4: Type-check and run the full suite**

Run: `npx tsc --noEmit` → Expected: no errors
Run: `npm test` → Expected: all pass (no new unit tests for the screen; it is verified manually)

- [ ] **Step 5: Manual verification note**

This screen is verified manually (picker requires a device/simulator). Confirm during review: tapping the avatar opens the action sheet; choosing a library photo crops square, uploads, and the avatar updates; "Remove photo" reverts to the camera placeholder; permission-denied shows the alert.

- [ ] **Step 6: Commit**

```bash
git add src/screens/settings/SettingsScreen.tsx
git commit -m "feat: profile photo picker UI in Settings"
```

---

## Task 5: Thread `photoURL` into Avatar consumers

**Files:**
- Modify: `src/screens/mypage/MyPageScreen.tsx`
- Modify: `src/screens/friends/SearchUsersScreen.tsx`
- Modify: `src/components/UserPreview.tsx`
- Modify: `src/screens/home/HomeScreen.tsx`
- Modify: `src/navigation/HomeStack.tsx`
- Modify: `src/screens/home/FriendPageScreen.tsx`

- [ ] **Step 1: MyPage and SearchUsers (data already present)**

In `src/screens/mypage/MyPageScreen.tsx`, change the avatar usage:
```tsx
            <Avatar size={32} displayName={user?.displayName} photoURL={user?.photoURL} />
```

In `src/screens/friends/SearchUsersScreen.tsx`:
```tsx
              <Avatar size={40} displayName={item.displayName} photoURL={item.photoURL} />
```

- [ ] **Step 2: UserPreview — accept and pass a photoURL prop**

In `src/components/UserPreview.tsx`, add `photoURL?: string;` to `UserPreviewProps`, destructure it, and pass it to `Avatar`:
```tsx
interface UserPreviewProps {
  displayName: string;
  username: string;
  photoURL?: string;
  previewText: string;
  timestamp?: Date | null;
  onPress: () => void;
}

export default function UserPreview({
  displayName,
  username,
  photoURL,
  previewText,
  timestamp,
  onPress,
}: UserPreviewProps) {
```
```tsx
      <Avatar size={40} displayName={displayName} photoURL={photoURL} />
```

- [ ] **Step 3: HomeScreen — carry photoURL through the friend list**

In `src/screens/home/HomeScreen.tsx`:

Add to the `FriendWithMeta` interface:
```ts
interface FriendWithMeta {
	uid: string;
	displayName: string;
	username: string;
	photoURL?: string;
	lastPostText: string;
	lastPostAt: Date | null;
}
```

When building `friendsWithMeta.push({...})`, add `photoURL: userData.photoURL,`:
```ts
						friendsWithMeta.push({
							uid: friendUid,
							displayName: userData.displayName,
							username: userData.username,
							photoURL: userData.photoURL,
							lastPostText: metaData?.lastPostText ?? "",
							lastPostAt: metaData?.lastPostAt?.toDate() ?? null,
						});
```

Pass `photoURL` to `UserPreview` and into the `FriendPage` nav params:
```tsx
						photoURL={item.photoURL}
```
```tsx
							navigation.navigate("FriendPage", {
								friendUid: item.uid,
								friendDisplayName: item.displayName,
								friendUsername: item.username,
								friendPhotoURL: item.photoURL,
							})
```

- [ ] **Step 4: HomeStack — add the route param**

In `src/navigation/HomeStack.tsx`, extend the `FriendPage` param type:
```ts
  FriendPage: {
    friendUid: string;
    friendDisplayName: string;
    friendUsername: string;
    friendPhotoURL?: string;
  };
```

- [ ] **Step 5: FriendPageScreen — read and render it**

In `src/screens/home/FriendPageScreen.tsx`, add `friendPhotoURL` to the destructured route params and pass it to the avatar:
```tsx
  const { friendUid, friendDisplayName, friendUsername, friendPhotoURL } = route.params;
```
```tsx
            <Avatar size={32} displayName={friendDisplayName} photoURL={friendPhotoURL} />
```

- [ ] **Step 6: Type-check and run the suite**

Run: `npx tsc --noEmit` → Expected: no errors
Run: `npm test` → Expected: all pass

- [ ] **Step 7: Commit**

```bash
git add src/screens/mypage/MyPageScreen.tsx src/screens/friends/SearchUsersScreen.tsx src/components/UserPreview.tsx src/screens/home/HomeScreen.tsx src/navigation/HomeStack.tsx src/screens/home/FriendPageScreen.tsx
git commit -m "feat: thread photoURL into Avatar consumers"
```

---

## Task 6: Update README roadmap

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Tick the four Profile photo upload checkboxes**

In `README.md`, under "Profile photo upload _(the deferred half of Settings)_", change each `- [ ]` to `- [x]`:
```markdown
- [x] Add Firebase Storage + `expo-image-picker`
- [x] Pick a photo → upload → store `photoURL` on the user doc
- [x] `Avatar` renders `photoURL` (initials fallback)
- [x] Photo picker UI in Settings
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: tick Profile photo upload roadmap checkboxes"
```

---

## Final Verification

- [ ] Run `npm test` — all suites pass.
- [ ] Run `npx tsc --noEmit` — no type errors.
- [ ] Manual check on device/simulator (Task 4, Step 5): pick → crop → upload → avatar updates across MyPage / Home / Friend pages; remove reverts to initials/placeholder; permission-denied alert appears.
