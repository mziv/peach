# Fix Report: deleteAccountData removes post photos from Storage

## Change Summary

`deleteAccountData` in `src/services/users.ts` previously deleted post Firestore docs and the user avatar from Storage, but left all post photos (at `posts/{uid}/{postId}/{index}`) orphaned.

## Exact Diff: deleteAccountData change

```diff
@@ -128,6 +128,7 @@ export async function deleteAccountData(uid: string): Promise<void> {
   // Posts, plus each post's comments and likes subcollections.
   const postsSnap = await getDocs(collection(db, "users", uid, "posts"));
+  const photoPaths: string[] = [];
   for (const postDoc of postsSnap.docs) {
     const commentsSnap = await getDocs(
       collection(db, "users", uid, "posts", postDoc.id, "comments")
@@ -140,6 +141,9 @@ export async function deleteAccountData(uid: string): Promise<void> {
     );
     likesSnap.docs.forEach((l) => batch.delete(l.ref));
 
+    const photoURLs: string[] = postDoc.data?.()?.photoURLs ?? [];
+    photoURLs.forEach((_, i) => photoPaths.push(`posts/${uid}/${postDoc.id}/${i}`));
+
     batch.delete(postDoc.ref);
   }
@@ -163,6 +167,15 @@ export async function deleteAccountData(uid: string): Promise<void> {
     if (err?.code !== "storage/object-not-found") throw err;
   }
 
+  // Remove all post photos from Storage.
+  for (const path of photoPaths) {
+    try {
+      await deleteObject(ref(storage, path));
+    } catch (err: any) {
+      if (err?.code !== "storage/object-not-found") throw err;
+    }
+  }
+
   await batch.commit();
```

### Key decision: `postDoc.data?.()` vs `postDoc.data()`

The spec suggested `postDoc.data()?.photoURLs ?? []`, but the existing test mocks provide post docs without a `data` method (e.g., `{ id: "post1", ref: "postRef" }`). Calling `.data()` on such an object throws `TypeError: postDoc.data is not a function`. Used `postDoc.data?.()?.photoURLs ?? []` (optional chaining on the method call itself) so existing mocks pass without modification, while still being safe at runtime where `data()` is always present.

## New Test

Added to `tests/services/users.test.ts` in the `deleteAccountData` describe block:

```
it("deletes post photos from Storage for each photoURL in a post doc")
```

- Mocks a post doc with `data: () => ({ photoURLs: ["url-a", "url-b"] })`
- Overrides `ref` mock to `(_storage, path) => ({ path })` to capture paths
- Asserts `deleteObject` was called with refs for `posts/uid-1/post-abc/0`, `posts/uid-1/post-abc/1`, and `avatars/uid-1`

## Existing Test Adjustments

No existing tests needed modification. The `postDoc.data?.()` optional chaining keeps all prior mocks (which lack `data()`) safe — they simply yield `[]` for `photoURLs`, adding no paths to `photoPaths`.

## Jest Results

```
npx jest users.test.ts --no-coverage
PASS tests/services/users.test.ts
  deleteAccountData
    ✓ batch-deletes posts (+ comments/likes), meta, friendships, and the user doc
    ✓ queries friendships where the user is requester or receiver
    ✓ does not throw if the avatar object is missing
    ✓ deletes post photos from Storage for each photoURL in a post doc
Tests: 18 passed, 18 total

npx jest --no-coverage
Test Suites: 14 passed, 14 total
Tests:       102 passed, 102 total  (was 101 before this change)
```

## TypeScript

```
npx tsc --noEmit
(no output — clean)
```

## Concerns

None. The change is minimal, follows the exact same error-swallowing pattern as the avatar deletion, and is gated by optional chaining so it's backward-safe with existing test mocks.
