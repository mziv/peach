# Enter-to-Submit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pressing Enter submits an in-progress comment (CommentModal) or post (MyPageScreen); Shift+Enter still inserts a newline in the multiline post composer on web.

**Architecture:** Use React Native's built-in `onSubmitEditing` + `submitBehavior="submit"` props on both composer inputs, routing through the existing `handleSend`/`handlePost` functions. Add a `posting` re-entry guard to `handlePost` (Enter bypasses the button's `disabled` prop). A web-only `onKeyPress` fallback exists for the multiline post composer, applied only if react-native-web ignores `submitBehavior` there.

**Tech Stack:** React Native 0.81 / Expo 54 / react-native-web 0.21, NativeWind, Jest with jest-expo + @testing-library/react-native.

**Spec:** `docs/superpowers/specs/2026-07-17-enter-to-submit-design.md`

## Global Constraints

- Work happens in the worktree at `/Users/mziv/peach/.claude/worktrees/enter-to-submit` on branch `feature/enter-to-submit`. Run all commands from that directory.
- Do not change any existing behavior of the Post/Send buttons.
- `handleSend` in CommentModal already guards (`!user || !commentText.trim() || submitting`) — do not duplicate that guard.
- Test files follow the existing pattern in `tests/screens/HomeScreen.test.tsx`: `jest.mock` calls before importing the component under test, Ionicons mocked as `Text`.
- Run tests with `npx jest <path> -v` for a single file, `npm test` for the suite.

---

### Task 1: CommentModal — Enter sends the comment

**Files:**
- Modify: `src/components/CommentModal.tsx` (TextInput at ~line 259)
- Test: `tests/components/CommentModal.test.tsx` (new)

**Interfaces:**
- Consumes: existing `handleSend()` in CommentModal (already guards empty/busy/no-user) and `addComment(postOwnerUid, postId, uid, username, displayName, photoURL, text, postText)` from `src/services/comments`.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Write the failing test**

Create `tests/components/CommentModal.test.tsx`:

```tsx
import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";

jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  orderBy: jest.fn(),
  query: jest.fn(),
  // Deliver an empty comment list immediately so the modal finishes loading.
  onSnapshot: jest.fn((_q: any, cb: any) => {
    cb({ docs: [] });
    return jest.fn();
  }),
}));

jest.mock("../../src/config/firebase", () => ({ db: {} }));

jest.mock("../../src/contexts/AuthContext", () => {
  const user = { uid: "me", username: "me", displayName: "Me", photoURL: null };
  return { useAuth: () => ({ user }) };
});

jest.mock("../../src/services/comments", () => ({
  addComment: jest.fn().mockResolvedValue(undefined),
  deleteComment: jest.fn(),
}));

jest.mock("../../src/services/users", () => ({
  getUserByUid: jest.fn().mockResolvedValue(null),
}));

jest.mock("../../src/components/Avatar", () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return { Ionicons: ({ name }: { name: string }) => <Text>{name}</Text> };
});

import CommentModal from "../../src/components/CommentModal";
import { addComment } from "../../src/services/comments";

function renderModal() {
  return render(
    <CommentModal
      visible
      onClose={jest.fn()}
      postOwnerUid="owner"
      postId="p1"
      postText="original post"
    />
  );
}

describe("CommentModal enter-to-submit", () => {
  beforeEach(() => (addComment as jest.Mock).mockClear());

  it("sends the comment when the input is submitted", async () => {
    const { getByPlaceholderText } = renderModal();
    const input = getByPlaceholderText("Say something nice");

    fireEvent.changeText(input, "nice post!");
    fireEvent(input, "submitEditing");

    await waitFor(() =>
      expect(addComment).toHaveBeenCalledWith(
        "owner",
        "p1",
        "me",
        "me",
        "Me",
        null,
        "nice post!",
        "original post"
      )
    );
  });

  it("does nothing when submitted with empty text", async () => {
    const { getByPlaceholderText } = renderModal();
    fireEvent(getByPlaceholderText("Say something nice"), "submitEditing");
    expect(addComment).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest tests/components/CommentModal.test.tsx -v`
Expected: "sends the comment when the input is submitted" FAILS (`addComment` never called — the input has no `onSubmitEditing`). The empty-text test may already pass; that's fine.

- [ ] **Step 3: Wire up the input**

In `src/components/CommentModal.tsx`, change the bottom-input TextInput (~line 259) to:

```tsx
            <TextInput
              className="flex-1 bg-gray-50 rounded-full px-4 py-2 text-sm mr-2"
              placeholder="Say something nice"
              value={commentText}
              onChangeText={setCommentText}
              multiline={false}
              onSubmitEditing={handleSend}
              submitBehavior="submit"
            />
```

(`submitBehavior="submit"` keeps focus in the input after sending, so several comments can be sent in a row without re-tapping the field.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest tests/components/CommentModal.test.tsx -v`
Expected: both tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/CommentModal.tsx tests/components/CommentModal.test.tsx
git commit -m "feat: Enter sends the in-progress comment"
```

---

### Task 2: MyPageScreen — Enter posts, with a posting re-entry guard

**Files:**
- Modify: `src/screens/mypage/MyPageScreen.tsx` (`handlePost` at ~line 135, TextInput at ~line 351)
- Test: `tests/screens/MyPageScreen.test.tsx` (new)

**Interfaces:**
- Consumes: existing `handlePost()` in MyPageScreen and `createPost(uid, text)` from `src/services/posts`.
- Produces: nothing consumed by later tasks; Task 3 verifies this input's web behavior.

- [ ] **Step 1: Write the failing test**

Create `tests/screens/MyPageScreen.test.tsx`:

```tsx
import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";

jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  orderBy: jest.fn(),
  query: jest.fn(),
  // Deliver an empty post list immediately so the screen finishes loading.
  onSnapshot: jest.fn((_q: any, cb: any) => {
    cb({ docs: [] });
    return jest.fn();
  }),
}));

jest.mock("../../src/config/firebase", () => ({ db: {} }));

jest.mock("../../src/contexts/AuthContext", () => {
  const user = { uid: "me", username: "me", displayName: "Me", photoURL: null };
  return { useAuth: () => ({ user }) };
});

jest.mock("../../src/services/posts", () => ({
  createPost: jest.fn().mockResolvedValue("post1"),
  deletePost: jest.fn(),
  uploadPostPhotos: jest.fn().mockResolvedValue([]),
  updatePost: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../src/services/likes", () => ({
  likePost: jest.fn(),
  unlikePost: jest.fn(),
  hasLiked: jest.fn().mockResolvedValue(false),
}));

jest.mock("../../src/hooks/useUnreadActivity", () => ({
  useUnreadActivity: () => false,
}));

jest.mock("expo-image-picker", () => ({
  launchImageLibraryAsync: jest
    .fn()
    .mockResolvedValue({ canceled: true, assets: [] }),
  requestMediaLibraryPermissionsAsync: jest
    .fn()
    .mockResolvedValue({ granted: true }),
  MediaTypeOptions: { Images: "Images" },
}));

const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
  useRoute: () => ({ params: {} }),
}));

jest.mock("../../src/components/Avatar", () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

jest.mock("../../src/components/PostItem", () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

jest.mock("../../src/components/CommentModal", () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return { Ionicons: ({ name }: { name: string }) => <Text>{name}</Text> };
});

import { MyPageScreen } from "../../src/screens/mypage/MyPageScreen";
import { createPost } from "../../src/services/posts";

describe("MyPageScreen enter-to-submit", () => {
  beforeEach(() => (createPost as jest.Mock).mockClear());

  it("posts when the composer input is submitted", async () => {
    const { getByPlaceholderText } = render(<MyPageScreen />);
    const input = await waitFor(() =>
      getByPlaceholderText("write something...")
    );

    fireEvent.changeText(input, "hello world");
    fireEvent(input, "submitEditing");

    await waitFor(() =>
      expect(createPost).toHaveBeenCalledWith("me", "hello world")
    );
  });

  it("does nothing when submitted with empty text and no photos", async () => {
    const { getByPlaceholderText } = render(<MyPageScreen />);
    const input = await waitFor(() =>
      getByPlaceholderText("write something...")
    );

    fireEvent(input, "submitEditing");
    expect(createPost).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest tests/screens/MyPageScreen.test.tsx -v`
Expected: "posts when the composer input is submitted" FAILS (`createPost` never called — the input has no `onSubmitEditing`). If instead the render itself fails on an unmocked module, fix the mock set, not the screen.

- [ ] **Step 3: Guard handlePost against re-entry and wire up the input**

In `src/screens/mypage/MyPageScreen.tsx`, change the first lines of `handlePost` (~line 135) from:

```tsx
  async function handlePost() {
    const text = newPostText.trim();
    const photos = selectedPhotos;
    if ((!text && photos.length === 0) || !user) return;
```

to:

```tsx
  async function handlePost() {
    const text = newPostText.trim();
    const photos = selectedPhotos;
    // Enter bypasses the Post button's `disabled`, so guard re-entry here too.
    if (posting || (!text && photos.length === 0) || !user) return;
```

Then change the composer TextInput (~line 351) to:

```tsx
          <TextInput
            className="flex-1 bg-gray-50 rounded-full px-4 py-2 text-sm mr-2"
            placeholder="write something..."
            value={newPostText}
            onChangeText={setNewPostText}
            multiline
            onSubmitEditing={handlePost}
            submitBehavior="submit"
          />
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest tests/screens/MyPageScreen.test.tsx -v`
Expected: both tests PASS.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: all suites pass (22 suites — the 20 existing plus the two new files).

- [ ] **Step 6: Commit**

```bash
git add src/screens/mypage/MyPageScreen.tsx tests/screens/MyPageScreen.test.tsx
git commit -m "feat: Enter posts the in-progress post"
```

---

### Task 3: Verify web behavior; add Shift+Enter fallback only if needed

react-native-web may ignore `submitBehavior="submit"` on a multiline input (rendered as a `<textarea>`), in which case Enter would still insert a newline in the post composer on web. This task verifies real browser behavior and applies a fallback only if needed.

**Files:**
- Modify (only if verification fails): `src/screens/mypage/MyPageScreen.tsx` (composer TextInput)

**Interfaces:**
- Consumes: `handlePost()` and the composer TextInput from Task 2.
- Produces: nothing.

- [ ] **Step 1: Start the web app**

Run: `npm run web` (from the worktree root; Expo serves at the URL it prints, typically http://localhost:8081).

- [ ] **Step 2: Verify in the browser**

On My Page (the logged-in user's own page):
1. Type text in the post composer, press **Enter** → the post is created and the input clears.
2. Type text, press **Shift+Enter** → a newline is inserted, no post is created.
3. Press **Enter** on an empty composer → nothing happens.

In a post's comment modal:
4. Type text, press **Enter** → the comment sends and the input clears.
5. Press **Enter** on an empty comment input → nothing happens.

If all five pass, skip Step 3 and go to Step 4.

- [ ] **Step 3 (only if check 1 or 2 failed): Add the web-only keyboard fallback**

Add `onKeyPress` to the composer TextInput in `src/screens/mypage/MyPageScreen.tsx` (`Platform` is already imported):

```tsx
          <TextInput
            className="flex-1 bg-gray-50 rounded-full px-4 py-2 text-sm mr-2"
            placeholder="write something..."
            value={newPostText}
            onChangeText={setNewPostText}
            multiline
            onSubmitEditing={handlePost}
            submitBehavior="submit"
            onKeyPress={(e: any) => {
              // react-native-web ignores submitBehavior on multiline inputs;
              // submit on plain Enter, let Shift+Enter fall through as newline.
              if (
                Platform.OS === "web" &&
                e.nativeEvent.key === "Enter" &&
                !e.nativeEvent.shiftKey
              ) {
                e.preventDefault();
                handlePost();
              }
            }}
          />
```

Then repeat Step 2's checks; all five must pass. Also re-run `npx jest tests/screens/MyPageScreen.test.tsx -v` (must still pass — `Platform.OS` is `"ios"` under jest-expo, so the fallback is inert in tests).

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: all suites pass.

- [ ] **Step 5: Commit (only if Step 3 changed code)**

```bash
git add src/screens/mypage/MyPageScreen.tsx
git commit -m "fix: web-only Shift+Enter fallback for multiline post composer"
```
