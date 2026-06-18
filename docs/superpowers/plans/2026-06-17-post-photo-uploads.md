# Post Photo Uploads Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users attach up to 4 photos to a post; photos render inline (stacked vertically) in the post card.

**Architecture:** Write-first flow — the text post is written to Firestore first, then photos upload to Firebase Storage at `posts/{uid}/{postId}/{index}`, then the post doc is patched with the resulting `photoURLs` array. Image bytes live in Storage; the post doc holds only the download-URL strings. Reuses the upload mechanics proven on the profile-photo branch (PR #16).

**Tech Stack:** Expo React Native (iOS/Android/web), TypeScript, Firebase 12 (Firestore + Storage), `expo-image-picker`, NativeWind, Jest.

## Global Constraints

- Max **4** photos per post — enforced at the picker (`selectionLimit`) and respected by the composer.
- Photos render **stacked vertically inline** in the post card — no carousel.
- A post is valid with **text only, photos only, or both** (at least one required).
- Upload order is **write-first**: create post doc → upload photos → patch doc. A failed upload leaves a text-only post (accepted; no auto-retry in v1).
- Storage path convention: `posts/{uid}/{postId}/{index}` where `index` is `0..n-1`.
- Storage content-type: `blob.type || "image/jpeg"` (Expo `file://` blobs often have empty type).
- Storage security rules: owner-write, any-authenticated-read.
- Reuse existing helpers: `notify()` from `src/utils/dialog` for error toasts; the picker patterns from `SettingsScreen.tsx` (web skips the permission prompt; `pickerActiveRef` guards re-entry).
- Follow existing test style in `tests/services/posts.test.ts` (mock `firebase/firestore`, `firebase/storage`, and `global.fetch`).

---

## Task 0: Prerequisite — land profile photos (PR #16)

This phase is **not** a TDD build — the code already exists, fully implemented and tested, on the `worktree-profile-photo-upload` branch. The goal is to verify, resolve the pause reason, and merge it to `main`, which brings the shared plumbing (`getStorage` init in `src/config/firebase.ts`, the `expo-image-picker` dependency, the cross-platform picker fixes, and `<Image>` rendering in `Avatar.tsx`) onto `main`. **Tasks 1–7 assume this has merged.**

**Files (on the branch, for reference):**
- `src/config/firebase.ts:44` — `export const storage = getStorage(app);`
- `src/services/users.ts` — `uploadProfilePhoto`, `removeProfilePhoto`, `deleteAccountData`
- `src/screens/settings/SettingsScreen.tsx` — picker + web `Modal`
- `src/components/Avatar.tsx` — `<Image>` render
- `tests/services/users.test.ts` — storage/firestore mocks

- [ ] **Step 1: Investigate the pause reason.** Memory records a "Storage CORS blocker." Confirm whether a genuine issue remains:

```bash
gh pr view 16 --json title,state,body,comments
git log worktree-profile-photo-upload --oneline -10
```

Look specifically at commit `be58d87` ("fix: make photo chooser work on web") — exploration suggests the real blocker was `Alert.alert` being a no-op on web (already fixed on the branch), not CORS. If a true CORS/Storage-rules issue is found, resolve it before merging; otherwise proceed.

- [ ] **Step 2: Bring the branch up to date with main and run its tests.**

```bash
git checkout worktree-profile-photo-upload
git rebase main
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Verify upload works on web and native.** Use the `verify` or `run` skill to launch the app, set a profile photo, and confirm it persists and renders. Confirm no console CORS errors.

- [ ] **Step 4: Open/refresh PR #16 and hand off to the user to merge.** Per the user's workflow, Claude opens PRs; the user merges. Do not merge.

- [ ] **Step 5: After the user merges, return to the post-photo branch and rebase onto the new main.**

```bash
git checkout feature/post-photo-uploads
git rebase main
```

Confirm `src/config/firebase.ts` now exports `storage` and `package.json` lists `expo-image-picker`.

---

## Task 1: Add `photoURLs` to the Post type and read mappers

**Files:**
- Modify: `src/types/index.ts:13-19`
- Modify: `src/services/posts.ts:37-66` (`getPostsByUser`, `getPost`)
- Modify: `src/screens/mypage/MyPageScreen.tsx:54-62` (onSnapshot mapper)
- Test: `tests/services/posts.test.ts`

**Interfaces:**
- Produces: `Post.photoURLs?: string[]`. Read mappers populate it as `data.photoURLs ?? []` (always an array on reads; absent only when constructing literals).

- [ ] **Step 1: Write the failing test** — add to the `getPostsByUser` describe block in `tests/services/posts.test.ts`:

```typescript
it("maps photoURLs when present and defaults to [] when absent", async () => {
  const mockDocs = [
    {
      id: "post-a",
      data: () => ({
        text: "with photos",
        createdAt: { toDate: () => new Date("2026-01-03") },
        photoURLs: ["https://s/0", "https://s/1"],
      }),
    },
    {
      id: "post-b",
      data: () => ({
        text: "no photos",
        createdAt: { toDate: () => new Date("2026-01-02") },
      }),
    },
  ];
  (getDocs as jest.Mock).mockResolvedValue({ docs: mockDocs });

  const posts = await getPostsByUser("uid-1");

  expect(posts[0].photoURLs).toEqual(["https://s/0", "https://s/1"]);
  expect(posts[1].photoURLs).toEqual([]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- posts.test.ts -t "maps photoURLs"`
Expected: FAIL — `posts[0].photoURLs` is `undefined`.

- [ ] **Step 3: Add the field to the type** in `src/types/index.ts`:

```typescript
export interface Post {
  postId: string;
  text: string;
  createdAt: Date;
  commentCount: number;
  likeCount: number;
  photoURLs?: string[];
}
```

- [ ] **Step 4: Populate it in both read mappers** in `src/services/posts.ts`. In `getPostsByUser`'s `.map` (line 43-49) and in `getPost`'s return object (line 59-65), add the line:

```typescript
    photoURLs: d.data().photoURLs ?? [],
```

(In `getPost` the variable is `data`, so use `photoURLs: data.photoURLs ?? [],`.)

- [ ] **Step 5: Populate it in the live listener** in `src/screens/mypage/MyPageScreen.tsx` inside the `onSnapshot` mapper (line 55-61), add:

```typescript
        photoURLs: d.data().photoURLs ?? [],
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test -- posts.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/types/index.ts src/services/posts.ts src/screens/mypage/MyPageScreen.tsx tests/services/posts.test.ts
git commit -m "feat: add photoURLs field to Post model and read paths"
```

---

## Task 2: `createPost` returns the postId

**Files:**
- Modify: `src/services/posts.ts:15-35`
- Test: `tests/services/posts.test.ts`

**Interfaces:**
- Produces: `createPost(uid: string, text: string): Promise<string>` — now returns the new post's id. Consumed by the composer (Task 6) to address the upload path.

- [ ] **Step 1: Update the existing createPost test** in `tests/services/posts.test.ts`. Replace the `createPost` describe block so `doc` yields an id and the return value is asserted:

```typescript
  describe("createPost", () => {
    it("creates a post, updates meta, and returns the new postId", async () => {
      const mockBatch = {
        set: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined),
      };
      (writeBatch as jest.Mock).mockReturnValue(mockBatch);
      (doc as jest.Mock).mockReturnValueOnce({ id: "new-post-id" });

      const postId = await createPost("uid-1", "Hello world!");

      expect(postId).toBe("new-post-id");
      expect(mockBatch.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ text: "Hello world!" })
      );
      expect(mockBatch.commit).toHaveBeenCalled();
    });
  });
```

Add `doc` to the import from `firebase/firestore` at the top of the test file:

```typescript
import { doc, getDocs, getDoc, writeBatch } from "firebase/firestore";
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- posts.test.ts -t "returns the new postId"`
Expected: FAIL — `createPost` returns `undefined`.

- [ ] **Step 3: Change the implementation** in `src/services/posts.ts`. Change the signature and return `postRef.id`:

```typescript
export async function createPost(uid: string, text: string): Promise<string> {
  const batch = writeBatch(db);

  const postRef = doc(collection(db, "users", uid, "posts"));
  batch.set(postRef, {
    text,
    createdAt: serverTimestamp(),
  });

  const metaRef = doc(db, "users", uid, "meta", "meta");
  batch.set(
    metaRef,
    {
      lastPostText: text.slice(0, 100),
      lastPostAt: serverTimestamp(),
    },
    { merge: true }
  );

  await batch.commit();
  return postRef.id;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- posts.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/posts.ts tests/services/posts.test.ts
git commit -m "feat: createPost returns new postId"
```

---

## Task 3: `uploadPostPhotos` and `updatePost` service functions

**Files:**
- Modify: `src/services/posts.ts` (imports + two new exports)
- Test: `tests/services/posts.test.ts`

**Interfaces:**
- Consumes: `storage` from `src/config/firebase` (landed in Task 0); `ref`, `uploadBytes`, `getDownloadURL` from `firebase/storage`; `updateDoc` from `firebase/firestore`.
- Produces:
  - `uploadPostPhotos(uid: string, postId: string, localUris: string[]): Promise<string[]>` — uploads each uri to `posts/{uid}/{postId}/{index}`, returns download URLs in input order.
  - `updatePost(uid: string, postId: string, fields: { photoURLs?: string[] }): Promise<void>`.

- [ ] **Step 1: Extend the test mocks.** At the top of `tests/services/posts.test.ts`, add storage and fetch mocks alongside the existing firestore mock:

```typescript
jest.mock("firebase/storage", () => ({
  ref: jest.fn((_s, path) => ({ path })),
  uploadBytes: jest.fn().mockResolvedValue(undefined),
  getDownloadURL: jest.fn((r) => Promise.resolve(`https://dl/${r.path}`)),
}));

jest.mock("../../src/config/firebase", () => ({
  db: {},
  storage: {},
}));
```

(Replace the existing `jest.mock("../../src/config/firebase", ...)` block — do not duplicate it. Add `updateDoc: jest.fn()` to the existing `firebase/firestore` mock's returned object.)

- [ ] **Step 2: Write the failing tests** — add a new describe block:

```typescript
import {
  createPost,
  getPostsByUser,
  getPost,
  deletePost,
  uploadPostPhotos,
  updatePost,
} from "../../src/services/posts";
import { uploadBytes } from "firebase/storage";
import { updateDoc } from "firebase/firestore";

describe("uploadPostPhotos", () => {
  beforeEach(() => {
    (global as any).fetch = jest
      .fn()
      .mockResolvedValue({ blob: () => Promise.resolve({ type: "image/jpeg" }) });
  });

  it("uploads each uri to posts/{uid}/{postId}/{index} and returns URLs", async () => {
    const urls = await uploadPostPhotos("uid-1", "post-1", [
      "file:///a.jpg",
      "file:///b.jpg",
    ]);

    expect(uploadBytes).toHaveBeenCalledTimes(2);
    expect(urls).toEqual([
      "https://dl/posts/uid-1/post-1/0",
      "https://dl/posts/uid-1/post-1/1",
    ]);
  });
});

describe("updatePost", () => {
  it("patches the post doc with the given fields", async () => {
    await updatePost("uid-1", "post-1", { photoURLs: ["https://dl/x"] });
    expect(updateDoc).toHaveBeenCalledWith(expect.anything(), {
      photoURLs: ["https://dl/x"],
    });
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- posts.test.ts -t "uploadPostPhotos"`
Expected: FAIL — functions not exported.

- [ ] **Step 4: Implement.** Add imports at the top of `src/services/posts.ts`:

```typescript
import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  orderBy,
  limit,
  serverTimestamp,
  writeBatch,
  updateDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../config/firebase";
```

Then add the two functions:

```typescript
export async function uploadPostPhotos(
  uid: string,
  postId: string,
  localUris: string[]
): Promise<string[]> {
  const urls: string[] = [];
  for (let i = 0; i < localUris.length; i++) {
    const response = await fetch(localUris[i]);
    const blob = await response.blob();
    const storageRef = ref(storage, `posts/${uid}/${postId}/${i}`);
    // Expo file:// blobs often have an empty `type`; default to JPEG so the
    // stored content type is meaningful for CDN headers and Storage rules.
    await uploadBytes(storageRef, blob, {
      contentType: blob.type || "image/jpeg",
    });
    urls.push(await getDownloadURL(storageRef));
  }
  return urls;
}

export async function updatePost(
  uid: string,
  postId: string,
  fields: { photoURLs?: string[] }
): Promise<void> {
  await updateDoc(doc(db, "users", uid, "posts", postId), fields);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- posts.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/services/posts.ts tests/services/posts.test.ts
git commit -m "feat: add uploadPostPhotos and updatePost services"
```

---

## Task 4: `deletePost` cleans up Storage photos

**Files:**
- Modify: `src/services/posts.ts:68-112` (`deletePost`)
- Test: `tests/services/posts.test.ts`

**Interfaces:**
- Consumes: `deleteObject` from `firebase/storage`; `getDoc` (already imported).
- Produces: `deletePost` deletes `posts/{uid}/{postId}/{i}` for each of the post's photos before deleting the doc; swallows `storage/object-not-found`.

- [ ] **Step 1: Add `deleteObject` to the storage mock** in `tests/services/posts.test.ts`:

```typescript
jest.mock("firebase/storage", () => ({
  ref: jest.fn((_s, path) => ({ path })),
  uploadBytes: jest.fn().mockResolvedValue(undefined),
  getDownloadURL: jest.fn((r) => Promise.resolve(`https://dl/${r.path}`)),
  deleteObject: jest.fn().mockResolvedValue(undefined),
}));
```

- [ ] **Step 2: Write the failing test** — add to the `deletePost` describe block:

```typescript
import { deleteObject } from "firebase/storage";

it("deletes each Storage photo for a post that has photos", async () => {
  const mockBatch = makeBatch();
  (writeBatch as jest.Mock).mockReturnValue(mockBatch);
  (getDoc as jest.Mock).mockResolvedValue({
    exists: () => true,
    data: () => ({ photoURLs: ["https://dl/0", "https://dl/1"] }),
  });
  (getDocs as jest.Mock)
    .mockResolvedValueOnce({ docs: [] }) // comments
    .mockResolvedValueOnce({ docs: [] }) // likes
    .mockResolvedValueOnce({
      docs: [{ id: "post-1", data: () => ({ text: "deleted" }) }],
    });

  await deletePost("uid-1", "post-1");

  expect(deleteObject).toHaveBeenCalledTimes(2);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- posts.test.ts -t "deletes each Storage photo"`
Expected: FAIL — `deleteObject` not called.

- [ ] **Step 4: Implement.** Add `deleteObject` to the `firebase/storage` import in `src/services/posts.ts`:

```typescript
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
```

Near the top of `deletePost` (before building the batch), read the post and delete its photos:

```typescript
export async function deletePost(uid: string, postId: string): Promise<void> {
  // Remove Storage photos first (Firestore batches can't touch Storage).
  const postSnap = await getDoc(doc(db, "users", uid, "posts", postId));
  const photoURLs: string[] = postSnap.data()?.photoURLs ?? [];
  for (let i = 0; i < photoURLs.length; i++) {
    try {
      await deleteObject(ref(storage, `posts/${uid}/${postId}/${i}`));
    } catch (err: any) {
      // Tolerate a missing object (e.g. a partial upload); re-throw the rest.
      if (err?.code !== "storage/object-not-found") throw err;
    }
  }

  const batch = writeBatch(db);
  // ... existing comment/like/post/meta logic unchanged ...
```

Leave the rest of the function body exactly as-is.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- posts.test.ts`
Expected: PASS — including the pre-existing deletePost tests (their `getDoc` returns `undefined` data → `photoURLs` defaults to `[]` → no deleteObject calls). If a pre-existing test now needs `getDoc` mocked, add `(getDoc as jest.Mock).mockResolvedValue({ data: () => ({}) });` to its setup.

- [ ] **Step 6: Commit**

```bash
git add src/services/posts.ts tests/services/posts.test.ts
git commit -m "feat: deletePost removes a post's Storage photos"
```

---

## Task 5: Render photos in the post card

**Files:**
- Modify: `src/components/PostItem.tsx`
- Modify: `src/screens/mypage/MyPageScreen.tsx:215-232` (pass the new prop)

**Interfaces:**
- Consumes: `Post.photoURLs` (Task 1).
- Produces: `PostItem` accepts `photoURLs?: string[]` and renders one full-width square `<Image>` per URL, stacked vertically between the text and the action row.

- [ ] **Step 1: Add the prop and import `Image`** in `src/components/PostItem.tsx`. Update the import on line 2 and the props interface:

```typescript
import { View, Text, TouchableOpacity, Image } from "react-native";
```

```typescript
interface PostItemProps {
  text: string;
  createdAt: Date;
  commentCount: number;
  likeCount: number;
  isLiked: boolean;
  photoURLs?: string[];
  onLikePress: () => void;
  onCommentPress: () => void;
  onDeletePress?: () => void;
}
```

Add `photoURLs,` to the destructured params.

- [ ] **Step 2: Render the photos.** Between the text `<Text>` (line 29) and the action `<View>` (line 30), insert:

```tsx
      {text ? <Text className="text-base mb-2">{text}</Text> : null}
      {photoURLs && photoURLs.length > 0 ? (
        <View className="mb-2 gap-2">
          {photoURLs.map((url, i) => (
            <Image
              key={i}
              source={{ uri: url }}
              className="w-full aspect-square rounded-xl bg-gray-100"
              resizeMode="cover"
            />
          ))}
        </View>
      ) : null}
```

(Replace the original unconditional `<Text className="text-base mb-2">{text}</Text>` line with the `text ? ... : null` version above, so photo-only posts don't render an empty text block.)

- [ ] **Step 3: Pass the prop from MyPageScreen** in `src/screens/mypage/MyPageScreen.tsx`, inside `renderItem` (line 216-232), add to the `<PostItem ... />`:

```tsx
            photoURLs={item.photoURLs}
```

- [ ] **Step 4: Verify rendering manually.** Use the `run` skill to launch the app. Existing text-only posts must render unchanged (no empty image boxes).

Run: `npm test`
Expected: PASS (no test regressions).

- [ ] **Step 5: Commit**

```bash
git add src/components/PostItem.tsx src/screens/mypage/MyPageScreen.tsx
git commit -m "feat: render post photos stacked inline"
```

---

## Task 6: Photo picker + write-first composer flow

**Files:**
- Modify: `src/screens/mypage/MyPageScreen.tsx` (imports, state, picker fn, handlePost, composer UI)

**Interfaces:**
- Consumes: `uploadPostPhotos`, `updatePost`, `createPost` (Tasks 2–3); `ImagePicker` from `expo-image-picker`; `notify` from `src/utils/dialog`.
- Produces: composer that picks ≤4 photos, posts text immediately, uploads photos, then patches the doc.

- [ ] **Step 1: Add imports** to `src/screens/mypage/MyPageScreen.tsx`:

```typescript
import { Image } from "react-native"; // add to the existing react-native import
import * as ImagePicker from "expo-image-picker";
import { createPost, deletePost, uploadPostPhotos, updatePost } from "../../services/posts";
```

(Merge `Image` into the existing `react-native` destructured import rather than adding a second import line.)

- [ ] **Step 2: Add composer state and a picker guard** near the other `useState`/`useRef` (around line 38):

```typescript
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const pickerActiveRef = useRef(false);
```

- [ ] **Step 3: Add the picker function** (place it just above `handlePost`):

```typescript
  async function pickPhotos() {
    if (pickerActiveRef.current) return;
    const remaining = 4 - selectedPhotos.length;
    if (remaining <= 0) return;
    pickerActiveRef.current = true;
    try {
      // Web grants media-library permission automatically; requesting it there
      // would push the file dialog outside the user-gesture window.
      if (Platform.OS !== "web") {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          notify("Permission needed", "Allow photo access to add photos.");
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: remaining,
        quality: 0.7,
      });
      if (result.canceled) return;
      const uris = result.assets.map((a) => a.uri);
      setSelectedPhotos((prev) => [...prev, ...uris].slice(0, 4));
    } finally {
      pickerActiveRef.current = false;
    }
  }
```

- [ ] **Step 4: Rewrite `handlePost`** (replace the current body, lines 93-104) with the write-first flow:

```typescript
  async function handlePost() {
    const text = newPostText.trim();
    const photos = selectedPhotos;
    if ((!text && photos.length === 0) || !user) return;
    setPosting(true);
    try {
      const postId = await createPost(user.uid, text);
      // Clear the composer immediately; uploads continue in the background.
      setNewPostText("");
      setSelectedPhotos([]);
      if (photos.length > 0) {
        const urls = await uploadPostPhotos(user.uid, postId, photos);
        await updatePost(user.uid, postId, { photoURLs: urls });
      }
    } catch (err: any) {
      notify(
        "Upload issue",
        "Your post was saved, but the photos couldn't be uploaded. You can delete the post and try again."
      );
    } finally {
      setPosting(false);
    }
  }
```

- [ ] **Step 5: Add the thumbnail row and photo button to the composer.** Replace the composer `<View>` (lines 244-263) with:

```tsx
      {/* Composer */}
      <View className="border-t border-gray-100 bg-white">
        {selectedPhotos.length > 0 && (
          <View className="flex-row flex-wrap gap-2 px-3 pt-3">
            {selectedPhotos.map((uri, i) => (
              <View key={i} className="relative">
                <Image
                  source={{ uri }}
                  className="w-16 h-16 rounded-lg bg-gray-100"
                />
                <TouchableOpacity
                  className="absolute -top-1 -right-1 bg-black/60 rounded-full w-5 h-5 items-center justify-center"
                  onPress={() =>
                    setSelectedPhotos((prev) =>
                      prev.filter((_, idx) => idx !== i)
                    )
                  }
                >
                  <Ionicons name="close" size={14} color="white" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
        <View className="flex-row items-center p-3">
          <TouchableOpacity
            className="mr-2"
            onPress={pickPhotos}
            disabled={selectedPhotos.length >= 4}
          >
            <Ionicons
              name="image-outline"
              size={24}
              color={selectedPhotos.length >= 4 ? "#d1d5db" : "#6b7280"}
            />
          </TouchableOpacity>
          <TextInput
            className="flex-1 bg-gray-50 rounded-full px-4 py-2 text-sm mr-2"
            placeholder="write something..."
            value={newPostText}
            onChangeText={setNewPostText}
            multiline
          />
          <TouchableOpacity
            className={`rounded-full px-5 py-2 ${
              newPostText.trim() || selectedPhotos.length > 0
                ? "bg-peach"
                : "bg-gray-300"
            }`}
            onPress={handlePost}
            disabled={
              posting || (!newPostText.trim() && selectedPhotos.length === 0)
            }
          >
            <Text className="text-white font-semibold text-sm">
              {posting ? "..." : "Post"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
```

- [ ] **Step 6: Verify manually on web and native.** Use the `run` skill. Confirm: pick 1–4 photos, thumbnails appear with ✕, text posts instantly, photos appear shortly after, the 5th-photo attempt is blocked, and a photo-only post works.

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/screens/mypage/MyPageScreen.tsx
git commit -m "feat: photo picker and write-first composer flow"
```

---

## Task 7: Storage security rules + README roadmap

**Files:**
- Create: `storage.rules`
- Modify: `firebase.json` (register the rules file)
- Modify: `README.md` (tick the roadmap checkbox)

**Interfaces:**
- Produces: deployed Storage rules — owner-write, any-authenticated-read for `posts/{uid}/...` and `avatars/{uid}`.

- [ ] **Step 1: Create `storage.rules`** at the repo root:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /posts/{uid}/{postId}/{file} {
      allow read:  if request.auth != null;
      allow write: if request.auth.uid == uid;
    }
    match /avatars/{uid} {
      allow read:  if request.auth != null;
      allow write: if request.auth.uid == uid;
    }
  }
}
```

(If PR #16 already created an `avatars` block, keep a single consistent file — don't duplicate the match.)

- [ ] **Step 2: Register the rules file** in `firebase.json`. Read the file first; add (or merge into the existing) `"storage"` key:

```json
  "storage": {
    "rules": "storage.rules"
  }
```

- [ ] **Step 3: Deploy the rules.**

```bash
firebase deploy --only storage
```

Expected: "Deploy complete!". (If the user must authenticate, prompt them to run `! firebase login`.)

- [ ] **Step 4: Verify rules.** With the app running (web), confirm a logged-in user can upload to their own post and read photos. Confirm an unauthenticated read is denied (e.g. open a photo URL in a private browser window — should 403).

- [ ] **Step 5: Tick the README roadmap.** Find the photo-uploads checkbox in `README.md` and mark it `[x]`.

```bash
grep -n -i "photo" README.md
```

- [ ] **Step 6: Commit**

```bash
git add storage.rules firebase.json README.md
git commit -m "feat: add Storage security rules for post photos; update roadmap"
```

---

## Self-Review Notes

- **Spec coverage:** data model (T1), write-first ordering with returned postId (T2, T6), upload service (T3), deletion cleanup (T4), inline stacked rendering (T5), composer/picker (T6), Storage rules + roadmap (T7), prerequisite PR #16 (T0). Failure-mode toast handled in T6 step 4.
- **Type consistency:** `uploadPostPhotos`, `updatePost`, `createPost: Promise<string>`, and `photoURLs?: string[]` are used identically across tasks.
- **Out of scope (v1):** auto-retry, friend-gated Storage reads, editing photos after post, captions, cropping. Photo-only posts store `lastPostText: ""` in meta — acceptable for v1.
