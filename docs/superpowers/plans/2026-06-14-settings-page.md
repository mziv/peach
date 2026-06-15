# Settings Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Settings screen (reached from the My Page gear icon) that edits the display name, shows read-only account info, signs out, and hard-deletes the account.

**Architecture:** Three new service functions (`updateDisplayName`, `deleteAccountData` in `users.ts`; `reauthenticate`, `deleteAuthAccount` in `auth.ts`) hold all Firebase logic and are unit-tested. `AuthContext` gains `refreshUser()` so a name change shows immediately. A new `SettingsScreen` composes these; a new stack route wires it to the gear icon. Account deletion deletes Firestore data first, then the Auth account, prompting for the password only if Firebase reports a stale login.

**Tech Stack:** Expo / React Native, Firebase (Auth + Firestore v9 modular SDK), NativeWind, Jest. Tests mock `firebase/auth` and `firebase/firestore`, matching the existing `tests/services/*` style.

**Spec:** [`docs/superpowers/specs/2026-06-14-settings-page-design.md`](../specs/2026-06-14-settings-page-design.md)

---

## File Structure

- `src/services/users.ts` — **modify**: add `updateDisplayName`, `deleteAccountData`. Owns Firestore reads/writes for the user doc and its subtrees.
- `src/services/auth.ts` — **modify**: add `reauthenticate`, `deleteAuthAccount`. Owns Firebase Auth operations.
- `src/contexts/AuthContext.tsx` — **modify**: refactor the one-time load into `loadUser`, add `refreshUser`.
- `src/navigation/HomeStack.tsx` — **modify**: add the `Settings` route.
- `src/screens/settings/SettingsScreen.tsx` — **create**: the screen UI + delete/re-auth orchestration.
- `src/screens/mypage/MyPageScreen.tsx` — **modify**: gear navigates to `Settings`; remove the old `handleLogout` Alert and unused `logOut` import.
- `tests/services/users.test.ts` — **modify**: cases for the two new user services.
- `tests/services/auth.test.ts` — **modify**: cases for the two new auth services + re-auth/retry path.

---

## Task 1: `updateDisplayName` service

**Files:**
- Modify: `src/services/users.ts`
- Test: `tests/services/users.test.ts`

- [ ] **Step 1: Write the failing test**

Add `updateDoc` to the `firebase/firestore` mock factory at the top of `tests/services/users.test.ts` (it currently mocks `doc, getDoc, getDocs, query, collection, where, orderBy, limit`). Add `updateDoc: jest.fn(),`. Then add to the imports `import { getDoc, getDocs, updateDoc } from "firebase/firestore";` and `updateDisplayName` to the service import. Add this describe block inside `describe("users service", ...)`:

```ts
  describe("updateDisplayName", () => {
    it("writes the new display name to the user doc", async () => {
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      await updateDisplayName("uid-1", "New Name");

      expect(updateDoc).toHaveBeenCalledWith(expect.anything(), {
        displayName: "New Name",
      });
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/services/users.test.ts -t "updateDisplayName" -v`
Expected: FAIL — `updateDisplayName is not a function` (not yet exported).

- [ ] **Step 3: Write minimal implementation**

In `src/services/users.ts`, add `updateDoc` to the `firebase/firestore` import, then append:

```ts
export async function updateDisplayName(
  uid: string,
  displayName: string
): Promise<void> {
  await updateDoc(doc(db, "users", uid), { displayName });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/services/users.test.ts -t "updateDisplayName" -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/users.ts tests/services/users.test.ts
git commit -m "feat: add updateDisplayName service"
```

---

## Task 2: `deleteAccountData` service

Deletes the user's posts (with their `comments` and `likes` subcollections), the `meta/meta` doc, all `friendships` they belong to, and finally the user doc — in a single `writeBatch`. Reuses the `writeBatch` pattern from `posts.ts` and the `or(...)` pattern from `friendships.ts`.

**Files:**
- Modify: `src/services/users.ts`
- Test: `tests/services/users.test.ts`

- [ ] **Step 1: Write the failing test**

In the `firebase/firestore` mock factory in `tests/services/users.test.ts`, add these entries: `or: jest.fn(),` and a `writeBatch` mock. Because the test asserts on the batch, define a shared mock batch at module scope (above the `jest.mock` call is not allowed — instead create it inside the factory and re-grab it in the test via the imported `writeBatch`). Use this approach: add `writeBatch: jest.fn(),` to the factory, and in the test build the batch per-test. Add `getDocs, writeBatch, or` to the imports. Add this describe block:

```ts
  describe("deleteAccountData", () => {
    it("batch-deletes posts (+ comments/likes), meta, friendships, and the user doc", async () => {
      const batch = { delete: jest.fn(), commit: jest.fn().mockResolvedValue(undefined) };
      (writeBatch as jest.Mock).mockReturnValue(batch);

      // getDocs is called in this order:
      // 1) posts, 2) comments(post1), 3) likes(post1), 4) friendships
      (getDocs as jest.Mock)
        .mockResolvedValueOnce({ docs: [{ id: "post1", ref: "postRef" }] }) // posts
        .mockResolvedValueOnce({ docs: [{ ref: "commentRef" }] })           // comments
        .mockResolvedValueOnce({ docs: [{ ref: "likeRef" }] })              // likes
        .mockResolvedValueOnce({ docs: [{ ref: "friendshipRef" }] });       // friendships

      await deleteAccountData("uid-1");

      // 1 comment + 1 like + 1 post + 1 meta + 1 friendship + 1 user = 6 deletes
      expect(batch.delete).toHaveBeenCalledTimes(6);
      expect(batch.commit).toHaveBeenCalledTimes(1);
    });

    it("queries friendships where the user is requester or receiver", async () => {
      const batch = { delete: jest.fn(), commit: jest.fn().mockResolvedValue(undefined) };
      (writeBatch as jest.Mock).mockReturnValue(batch);
      (getDocs as jest.Mock).mockResolvedValue({ docs: [] });

      await deleteAccountData("uid-1");

      expect(where).toHaveBeenCalledWith("requesterId", "==", "uid-1");
      expect(where).toHaveBeenCalledWith("receiverId", "==", "uid-1");
    });
  });
```

Note: `where` is already imported in this test file; ensure `getDocs`, `writeBatch`, and `or` are too.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/services/users.test.ts -t "deleteAccountData" -v`
Expected: FAIL — `deleteAccountData is not a function`.

- [ ] **Step 3: Write minimal implementation**

In `src/services/users.ts`, extend the `firebase/firestore` import to include `getDocs` (already there), `writeBatch`, and `or`. Append:

```ts
export async function deleteAccountData(uid: string): Promise<void> {
  const batch = writeBatch(db);

  // Posts, plus each post's comments and likes subcollections.
  const postsSnap = await getDocs(collection(db, "users", uid, "posts"));
  for (const postDoc of postsSnap.docs) {
    const commentsSnap = await getDocs(
      collection(db, "users", uid, "posts", postDoc.id, "comments")
    );
    commentsSnap.docs.forEach((c) => batch.delete(c.ref));

    const likesSnap = await getDocs(
      collection(db, "users", uid, "posts", postDoc.id, "likes")
    );
    likesSnap.docs.forEach((l) => batch.delete(l.ref));

    batch.delete(postDoc.ref);
  }

  // Per-user meta document.
  batch.delete(doc(db, "users", uid, "meta", "meta"));

  // Friendships the user is part of (requester or receiver).
  const friendshipsSnap = await getDocs(
    query(
      collection(db, "friendships"),
      or(where("requesterId", "==", uid), where("receiverId", "==", uid))
    )
  );
  friendshipsSnap.docs.forEach((f) => batch.delete(f.ref));

  // Finally, the user document itself.
  batch.delete(doc(db, "users", uid));

  await batch.commit();
}
```

> Note: a Firestore `writeBatch` caps at 500 ops. For this clone (small accounts) one batch is fine; if accounts ever grow large this should be chunked. Leaving as-is per the spec's accepted scope.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/services/users.test.ts -t "deleteAccountData" -v`
Expected: PASS (both cases).

- [ ] **Step 5: Commit**

```bash
git add src/services/users.ts tests/services/users.test.ts
git commit -m "feat: add deleteAccountData service"
```

---

## Task 3: `reauthenticate` + `deleteAuthAccount` services

**Files:**
- Modify: `src/services/auth.ts`
- Test: `tests/services/auth.test.ts`

- [ ] **Step 1: Write the failing test**

In `tests/services/auth.test.ts`, extend the `firebase/auth` mock factory (currently `createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut`) to add:

```ts
  sendPasswordResetEmail: jest.fn(),
  EmailAuthProvider: { credential: jest.fn(() => "mock-credential") },
  reauthenticateWithCredential: jest.fn(),
  deleteUser: jest.fn(),
```

(`sendPasswordResetEmail` is added because `auth.ts` imports it; without it the mock omits it and the import is `undefined` — harmless today, but keep the mock complete.)

Update imports at the top of the test:

```ts
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  EmailAuthProvider,
  reauthenticateWithCredential,
  deleteUser,
} from "firebase/auth";
import {
  signUp,
  logIn,
  logOut,
  reauthenticate,
  deleteAuthAccount,
} from "../../src/services/auth";
```

Add these describe blocks inside `describe("auth service", ...)`:

```ts
  describe("reauthenticate", () => {
    it("reauthenticates the current user with an email credential", async () => {
      (auth as any).currentUser = { uid: "uid-1", email: "a@b.com" };
      (reauthenticateWithCredential as jest.Mock).mockResolvedValue(undefined);

      await reauthenticate("secret");

      expect(EmailAuthProvider.credential).toHaveBeenCalledWith("a@b.com", "secret");
      expect(reauthenticateWithCredential).toHaveBeenCalledWith(
        auth.currentUser,
        "mock-credential"
      );
    });

    it("throws when there is no current user", async () => {
      (auth as any).currentUser = null;
      await expect(reauthenticate("secret")).rejects.toThrow();
    });
  });

  describe("deleteAuthAccount", () => {
    it("deletes the current Firebase Auth user", async () => {
      (auth as any).currentUser = { uid: "uid-1", email: "a@b.com" };
      (deleteUser as jest.Mock).mockResolvedValue(undefined);

      await deleteAuthAccount();

      expect(deleteUser).toHaveBeenCalledWith(auth.currentUser);
    });

    it("propagates requires-recent-login, then succeeds after reauth + retry", async () => {
      (auth as any).currentUser = { uid: "uid-1", email: "a@b.com" };
      (deleteUser as jest.Mock)
        .mockRejectedValueOnce({ code: "auth/requires-recent-login" })
        .mockResolvedValueOnce(undefined);
      (reauthenticateWithCredential as jest.Mock).mockResolvedValue(undefined);

      // First attempt fails with the recent-login error.
      await expect(deleteAuthAccount()).rejects.toMatchObject({
        code: "auth/requires-recent-login",
      });
      // Caller reauthenticates, then retries — succeeds.
      await reauthenticate("secret");
      await expect(deleteAuthAccount()).resolves.toBeUndefined();
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/services/auth.test.ts -t "reauthenticate" -v`
Expected: FAIL — `reauthenticate is not a function`.

- [ ] **Step 3: Write minimal implementation**

In `src/services/auth.ts`, extend the `firebase/auth` import to add `EmailAuthProvider, reauthenticateWithCredential, deleteUser`. Append:

```ts
export async function reauthenticate(password: string): Promise<void> {
  const current = auth.currentUser;
  if (!current || !current.email) {
    throw new Error("No authenticated user to re-authenticate");
  }
  const credential = EmailAuthProvider.credential(current.email, password);
  await reauthenticateWithCredential(current, credential);
}

export async function deleteAuthAccount(): Promise<void> {
  const current = auth.currentUser;
  if (!current) {
    throw new Error("No authenticated user to delete");
  }
  await deleteUser(current);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/services/auth.test.ts -v`
Expected: PASS (all auth cases, old and new).

- [ ] **Step 5: Commit**

```bash
git add src/services/auth.ts tests/services/auth.test.ts
git commit -m "feat: add reauthenticate and deleteAuthAccount services"
```

---

## Task 4: `AuthContext.refreshUser`

Refactor the one-time user load into a reusable `loadUser`, expose `refreshUser` so the UI can re-pull the user doc after an edit.

**Files:**
- Modify: `src/contexts/AuthContext.tsx`

- [ ] **Step 1: Add `refreshUser` to the interface and default value**

In `src/contexts/AuthContext.tsx`, change the `AuthState` interface and the default context:

```ts
interface AuthState {
  firebaseUser: FirebaseUser | null;
  user: User | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  firebaseUser: null,
  user: null,
  loading: true,
  refreshUser: async () => {},
});
```

- [ ] **Step 2: Refactor the loader and add `refreshUser`**

Replace the `useEffect` body so the fetch logic lives in a reusable `loadUser`, and add `refreshUser`. Inside `AuthProvider`, before the `useEffect`:

```ts
  async function loadUser(fbUser: FirebaseUser | null) {
    if (!fbUser) {
      setUser(null);
      return;
    }
    const snap = await getDoc(doc(db, "users", fbUser.uid));
    if (snap.exists()) {
      const data = snap.data();
      setUser({
        uid: data.uid,
        username: data.username,
        displayName: data.displayName,
        createdAt: data.createdAt?.toDate() ?? new Date(),
      });
    }
  }

  async function refreshUser() {
    await loadUser(auth.currentUser);
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      try {
        await loadUser(fbUser);
      } catch (err) {
        // Never leave the app stuck on the loading spinner if the user
        // document fails to load — surface the error and continue.
        console.error("Failed to load user profile:", err);
      } finally {
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);
```

Then add `refreshUser` to the provider value:

```ts
    <AuthContext.Provider value={{ firebaseUser, user, loading, refreshUser }}>
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (No unit test here — context wiring is exercised by the screen and verified manually in Task 7.)

- [ ] **Step 4: Commit**

```bash
git add src/contexts/AuthContext.tsx
git commit -m "feat: add refreshUser to AuthContext"
```

---

## Task 5: Settings screen + navigation wiring

**Files:**
- Create: `src/screens/settings/SettingsScreen.tsx`
- Modify: `src/navigation/HomeStack.tsx`
- Modify: `src/screens/mypage/MyPageScreen.tsx`

- [ ] **Step 1: Create the screen**

Create `src/screens/settings/SettingsScreen.tsx` with exactly this content:

```tsx
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  Modal,
  ScrollView,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "expo/node_modules/@expo/vector-icons";
import { useAuth } from "../../contexts/AuthContext";
import { logOut, reauthenticate, deleteAuthAccount } from "../../services/auth";
import { updateDisplayName, deleteAccountData } from "../../services/users";
import { HomeStackParamList } from "../../navigation/HomeStack";

type SettingsNav = NativeStackNavigationProp<HomeStackParamList, "Settings">;

export function SettingsScreen() {
  const navigation = useNavigation<SettingsNav>();
  const { user, firebaseUser, refreshUser } = useAuth();
  const [name, setName] = useState(user?.displayName ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pwModalVisible, setPwModalVisible] = useState(false);
  const [password, setPassword] = useState("");

  const trimmed = name.trim();
  const canSave = trimmed.length > 0 && trimmed !== user?.displayName && !saving;

  async function handleSave() {
    if (!user || !canSave) return;
    setSaving(true);
    try {
      await updateDisplayName(user.uid, trimmed);
      await refreshUser();
      Alert.alert("Saved", "Your display name has been updated.");
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    try {
      await logOut();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  }

  function confirmDelete() {
    Alert.alert(
      "Delete account",
      "This permanently deletes your account, posts, and friendships. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (!user) return;
            setDeleting(true);
            try {
              await deleteAccountData(user.uid);
              await deleteAuthAccount();
              // onAuthStateChanged clears the session → routes to auth stack.
            } catch (err: any) {
              if (err.code === "auth/requires-recent-login") {
                setPwModalVisible(true);
              } else {
                Alert.alert("Error", err.message);
              }
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  }

  async function handleReauthAndDelete() {
    setDeleting(true);
    try {
      await reauthenticate(password);
      await deleteAuthAccount();
      setPwModalVisible(false);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setPassword("");
      setDeleting(false);
    }
  }

  return (
    <View className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-gray-100">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="black" />
        </TouchableOpacity>
        <Text className="text-base font-semibold ml-2">Settings</Text>
      </View>

      <ScrollView className="flex-1">
        {/* Profile section */}
        <Text className="text-xs uppercase text-gray-400 px-4 pt-5 pb-2">
          Profile
        </Text>
        <View className="px-4">
          <Text className="text-sm text-gray-500 mb-1">Display name</Text>
          <TextInput
            className="bg-gray-50 rounded-lg px-4 py-3 text-base"
            value={name}
            onChangeText={setName}
            placeholder="Your name"
          />
          <TouchableOpacity
            className={`rounded-full px-5 py-2 mt-3 self-start ${
              canSave ? "bg-peach" : "bg-gray-300"
            }`}
            onPress={handleSave}
            disabled={!canSave}
          >
            <Text className="text-white font-semibold text-sm">
              {saving ? "Saving..." : "Save"}
            </Text>
          </TouchableOpacity>

          <View className="mt-5">
            <Text className="text-sm text-gray-500">Username</Text>
            <Text className="text-base mt-1">@{user?.username}</Text>
          </View>
          <View className="mt-4">
            <Text className="text-sm text-gray-500">Email</Text>
            <Text className="text-base mt-1">{firebaseUser?.email}</Text>
          </View>
        </View>

        {/* Account section */}
        <Text className="text-xs uppercase text-gray-400 px-4 pt-8 pb-2">
          Account
        </Text>
        <View className="px-4">
          <TouchableOpacity
            className="rounded-lg border border-gray-200 px-4 py-3"
            onPress={handleSignOut}
          >
            <Text className="text-base text-center">Sign Out</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="rounded-lg border border-red-200 px-4 py-3 mt-3"
            onPress={confirmDelete}
            disabled={deleting}
          >
            <Text className="text-base text-center text-red-600">
              {deleting ? "Deleting..." : "Delete Account"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Re-auth password modal (Alert.prompt is iOS-only, so use a modal) */}
      <Modal
        visible={pwModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPwModalVisible(false)}
      >
        {/* Backdrop color via inline style — NativeWind className on the
            backdrop has bitten us before (see commit c12e1a6). */}
        <View
          className="flex-1 justify-center items-center px-8"
          style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
        >
          <View className="bg-white rounded-2xl p-5 w-full">
            <Text className="text-base font-semibold mb-2">
              Confirm your password
            </Text>
            <Text className="text-sm text-gray-500 mb-3">
              For security, please re-enter your password to delete your account.
            </Text>
            <TextInput
              className="bg-gray-50 rounded-lg px-4 py-3 text-base"
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              secureTextEntry
              autoFocus
            />
            <View className="flex-row justify-end gap-3 mt-4">
              <TouchableOpacity
                onPress={() => {
                  setPwModalVisible(false);
                  setPassword("");
                }}
              >
                <Text className="text-base text-gray-500 py-2 px-3">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="bg-red-600 rounded-full px-5 py-2"
                onPress={handleReauthAndDelete}
                disabled={deleting || !password}
              >
                <Text className="text-white font-semibold">
                  {deleting ? "..." : "Delete"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
```

- [ ] **Step 2: Register the route**

In `src/navigation/HomeStack.tsx`: add the import and the route, and the param-list entry.

Add to imports:
```tsx
import { SettingsScreen } from "../screens/settings/SettingsScreen";
```
Add to `HomeStackParamList`:
```tsx
  Settings: undefined;
```
Add inside `<Stack.Navigator>`:
```tsx
      <Stack.Screen name="Settings" component={SettingsScreen} />
```

- [ ] **Step 3: Point the gear icon at Settings and remove the old logout Alert**

In `src/screens/mypage/MyPageScreen.tsx`:

Remove the now-unused import:
```tsx
import { logOut } from "../../services/auth";
```
Remove the entire `handleLogout` function (the `function handleLogout() { Alert.alert("Settings", ...) }` block).

Change the gear `TouchableOpacity` from:
```tsx
          <TouchableOpacity onPress={handleLogout}>
            <Ionicons name="settings-outline" size={22} color="black" />
          </TouchableOpacity>
```
to:
```tsx
          <TouchableOpacity onPress={() => navigation.navigate("Settings")}>
            <Ionicons name="settings-outline" size={22} color="black" />
          </TouchableOpacity>
```

(`Alert` is still used elsewhere in `MyPageScreen` — e.g. `handlePost` — so leave its import.)

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/screens/settings/SettingsScreen.tsx src/navigation/HomeStack.tsx src/screens/mypage/MyPageScreen.tsx
git commit -m "feat: add settings screen and wire up the gear icon"
```

---

## Task 6: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all suites pass — the previous 28 tests plus the new `updateDisplayName`, `deleteAccountData` (x2), `reauthenticate` (x2), and `deleteAuthAccount` (x3) cases.

- [ ] **Step 2: Typecheck the whole project**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual smoke test on web**

Run: `npm run web`
Verify, signed in:
1. My Page gear icon → opens Settings (no Alert).
2. Edit the display name → **Save** enables only when changed → tap → success Alert → back on My Page the header name has updated (proves `refreshUser`).
3. **Sign Out** → returns to the auth stack.
4. Sign back in → Settings → **Delete Account** → confirm. For a fresh login it deletes and drops to the auth stack. If prompted for a password (stale login), enter it → deletes. Confirm the account can no longer log in.

- [ ] **Step 4: Final commit (if any manual-fix tweaks were needed)**

```bash
git add -A
git commit -m "chore: settings page manual-test fixups"
```

(Skip if nothing changed.)

---

## Self-Review notes

- **Spec coverage:** edit display name (Task 1, 5) ✓; read-only username + email (Task 5) ✓; sign out in Settings (Task 5) ✓; hard delete posts/comments/likes/meta/friendships/user doc + Auth account (Tasks 2, 3, 5) ✓; lazy re-auth (Task 3 service + Task 5 modal flow) ✓; `refreshUser` (Task 4) ✓; navigation route + gear entry (Task 5) ✓; tests (Tasks 1–3) ✓; cross-platform modal instead of `Alert.prompt` (Task 5) ✓.
- **Type consistency:** `refreshUser: () => Promise<void>` defined in Task 4 and consumed in Task 5; service signatures match between definition and call sites.
- **Out of scope (unchanged):** profile-photo upload, email/password change, soft delete.
