# Green Dots for New Activity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a green dot on the homepage beside any friend who has posted something the viewer hasn't seen, clearing it when the viewer opens that friend's page.

**Architecture:** A new `viewedFriends` Firestore subcollection records when the viewer last opened each friend's page (server-side, syncs across devices). `HomeScreen` reads this map on focus and compares each friend's `meta.lastPostAt` against the viewer's `lastViewedAt` via a pure `hasNewActivity` helper; `UserPreview` renders the dot. `FriendPageScreen` stamps `lastViewedAt = now` on focus. Because `HomeScreen` already reloads via `useFocusEffect`, the dot clears automatically on return.

**Tech Stack:** Expo / React Native, TypeScript, Firebase Firestore (web SDK), NativeWind (Tailwind), Jest + @testing-library/react-native.

**Spec:** `docs/superpowers/specs/2026-06-14-green-activity-dots-design.md`

---

## File Structure

- **Create** `src/services/viewedFriends.ts` — `markFriendViewed`, `getViewedMap`, and the pure `hasNewActivity` helper.
- **Create** `tests/services/viewedFriends.test.ts` — service + helper tests.
- **Modify** `src/components/UserPreview.tsx` — add `hasNewActivity?` prop + green dot before the preview text.
- **Create** `tests/components/UserPreview.test.tsx` — dot show/hide tests.
- **Modify** `src/screens/home/HomeScreen.tsx` — load viewed map, compute per-friend `hasNewActivity`, pass to `UserPreview`.
- **Modify** `src/screens/home/FriendPageScreen.tsx` — stamp `markFriendViewed` on focus.
- **Create** `firestore.rules` + `firebase.json` — reconstructed rules incl. the owner-only `viewedFriends` rule.
- **Modify** `README.md` — tick the four Tier-2 "Green dots for new activity" checkboxes.

---

## Task 1: viewedFriends service + hasNewActivity helper

**Files:**
- Create: `src/services/viewedFriends.ts`
- Test: `tests/services/viewedFriends.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/services/viewedFriends.test.ts`:

```ts
import { getDocs, setDoc } from "firebase/firestore";
import {
  markFriendViewed,
  getViewedMap,
  hasNewActivity,
} from "../../src/services/viewedFriends";

jest.mock("firebase/firestore", () => ({
  collection: jest.fn(() => "mock-collection-ref"),
  doc: jest.fn(() => "mock-doc-ref"),
  getDocs: jest.fn(),
  setDoc: jest.fn(),
  serverTimestamp: jest.fn(() => "mock-timestamp"),
}));

jest.mock("../../src/config/firebase", () => ({
  db: {},
}));

describe("viewedFriends service", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("markFriendViewed", () => {
    it("writes lastViewedAt with a server timestamp", async () => {
      (setDoc as jest.Mock).mockResolvedValue(undefined);

      await markFriendViewed("me-1", "friend-1");

      expect(setDoc).toHaveBeenCalledWith("mock-doc-ref", {
        lastViewedAt: "mock-timestamp",
      });
    });
  });

  describe("getViewedMap", () => {
    it("maps friend uids to their lastViewedAt dates", async () => {
      const viewedDate = new Date("2026-06-01T00:00:00Z");
      (getDocs as jest.Mock).mockResolvedValue({
        docs: [
          { id: "friend-1", data: () => ({ lastViewedAt: { toDate: () => viewedDate } }) },
          { id: "friend-2", data: () => ({ lastViewedAt: null }) },
        ],
      });

      const map = await getViewedMap("me-1");

      expect(map["friend-1"]).toEqual(viewedDate);
      expect(map["friend-2"]).toBeNull();
      expect("friend-3" in map).toBe(false);
    });
  });

  describe("hasNewActivity", () => {
    const older = new Date("2026-06-01T00:00:00Z");
    const newer = new Date("2026-06-02T00:00:00Z");

    it("is false when the friend has never posted", () => {
      expect(hasNewActivity(null, undefined)).toBe(false);
      expect(hasNewActivity(null, older)).toBe(false);
    });

    it("is true when there is no viewed record but the friend has posted", () => {
      expect(hasNewActivity(newer, undefined)).toBe(true);
    });

    it("is false when a record exists but its timestamp is still pending (null)", () => {
      expect(hasNewActivity(newer, null)).toBe(false);
    });

    it("is true when the post is newer than the last view", () => {
      expect(hasNewActivity(newer, older)).toBe(true);
    });

    it("is false when the post is older than or equal to the last view", () => {
      expect(hasNewActivity(older, newer)).toBe(false);
      expect(hasNewActivity(older, older)).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- viewedFriends`
Expected: FAIL — `Cannot find module '../../src/services/viewedFriends'`.

- [ ] **Step 3: Write the implementation**

Create `src/services/viewedFriends.ts`:

```ts
import {
  collection,
  doc,
  getDocs,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";

/**
 * Stamp that `uid` has just viewed `friendUid`'s page. The friend's uid is the
 * doc id so repeat views overwrite cleanly. `lastViewedAt` is a server
 * timestamp so the read state syncs across devices.
 */
export async function markFriendViewed(
  uid: string,
  friendUid: string
): Promise<void> {
  await setDoc(doc(db, "users", uid, "viewedFriends", friendUid), {
    lastViewedAt: serverTimestamp(),
  });
}

/**
 * Read `uid`'s viewedFriends subcollection into a map of friendUid ->
 * lastViewedAt. A doc whose server timestamp has not resolved yet reads back as
 * `null`; that key is still present in the map. Friends with no record are
 * simply absent (so `map[friendUid]` is `undefined`).
 */
export async function getViewedMap(
  uid: string
): Promise<Record<string, Date | null>> {
  const snap = await getDocs(collection(db, "users", uid, "viewedFriends"));
  const map: Record<string, Date | null> = {};
  for (const d of snap.docs) {
    map[d.id] = d.data().lastViewedAt?.toDate() ?? null;
  }
  return map;
}

/**
 * Whether to show a "new activity" dot for a friend.
 * - No post yet -> false.
 * - Record exists but timestamp still pending (null) -> false (just viewed).
 * - No record at all (undefined) -> true.
 * - Otherwise the post is newer than the last view.
 */
export function hasNewActivity(
  lastPostAt: Date | null,
  lastViewedAt: Date | null | undefined
): boolean {
  if (!lastPostAt) return false;
  if (lastViewedAt === undefined) return true;
  if (lastViewedAt === null) return false;
  return lastPostAt.getTime() > lastViewedAt.getTime();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- viewedFriends`
Expected: PASS (all cases green).

- [ ] **Step 5: Commit**

```bash
git add src/services/viewedFriends.ts tests/services/viewedFriends.test.ts
git commit -m "feat: add viewedFriends service and hasNewActivity helper"
```

---

## Task 2: Green dot in UserPreview

**Files:**
- Modify: `src/components/UserPreview.tsx`
- Test: `tests/components/UserPreview.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/components/UserPreview.test.tsx`:

```tsx
import React from "react";
import { render } from "@testing-library/react-native";
import UserPreview from "../../src/components/UserPreview";

describe("UserPreview", () => {
  const baseProps = {
    displayName: "Claire",
    username: "claire",
    previewText: "63 steps today",
    onPress: () => {},
  };

  it("shows the new-activity dot when hasNewActivity is true", () => {
    const { getByTestId } = render(
      <UserPreview {...baseProps} hasNewActivity />
    );
    expect(getByTestId("new-activity-dot")).toBeTruthy();
  });

  it("hides the dot when hasNewActivity is false or omitted", () => {
    const { queryByTestId } = render(<UserPreview {...baseProps} />);
    expect(queryByTestId("new-activity-dot")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- UserPreview`
Expected: FAIL — `Unable to find an element with testID: new-activity-dot`.

- [ ] **Step 3: Implement the dot**

In `src/components/UserPreview.tsx`, add `hasNewActivity` to the props interface and the destructured params, then wrap the preview-text `Text` so the dot precedes it.

Update the interface (currently lines 7-13):

```tsx
interface UserPreviewProps {
  displayName: string;
  username: string;
  previewText: string;
  timestamp?: Date | null;
  hasNewActivity?: boolean;
  onPress: () => void;
}
```

Update the destructure (currently lines 15-21):

```tsx
export default function UserPreview({
  displayName,
  username,
  previewText,
  timestamp,
  hasNewActivity = false,
  onPress,
}: UserPreviewProps) {
```

Replace the preview-text block (currently lines 28-33):

```tsx
      <View className="flex-1 ml-3">
        <Text className="text-base font-semibold">{displayName}</Text>
        <View className="flex-row items-center">
          {hasNewActivity && (
            <View
              testID="new-activity-dot"
              className="w-2 h-2 rounded-full bg-green mr-1.5"
            />
          )}
          <Text className="text-sm text-gray-500 flex-1" numberOfLines={1}>
            {previewText}
          </Text>
        </View>
      </View>
```

Note: `flex-1` moves onto the preview `Text` so the green dot keeps its width and the text truncates beside it.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- UserPreview`
Expected: PASS (both cases).

- [ ] **Step 5: Commit**

```bash
git add src/components/UserPreview.tsx tests/components/UserPreview.test.tsx
git commit -m "feat: render new-activity dot in UserPreview"
```

---

## Task 3: Wire the dot into HomeScreen

**Files:**
- Modify: `src/screens/home/HomeScreen.tsx`

No new unit test — the dot logic is already covered by `hasNewActivity` tests, and this screen depends on navigation/Firestore hooks that the repo does not unit-test (see the lone `tests/screens/relativeTime.test.ts`). Verification is via typecheck + the existing test suite + the manual smoke test in Task 6.

- [ ] **Step 1: Import the service**

Add to the imports near the top (after the `getFriendships` import on line 14):

```tsx
import { getViewedMap, hasNewActivity } from "../../services/viewedFriends";
```

- [ ] **Step 2: Extend the FriendWithMeta interface**

Add `hasNewActivity` to the interface (currently lines 20-26):

```tsx
interface FriendWithMeta {
  uid: string;
  displayName: string;
  username: string;
  lastPostText: string;
  lastPostAt: Date | null;
  hasNewActivity: boolean;
}
```

- [ ] **Step 3: Load the viewed map and compute per-friend activity**

Inside `loadData`, after `const friendships = await getFriendships(user!.uid);` (currently line 64), add:

```tsx
      const viewedMap = await getViewedMap(user!.uid);
```

Then in the `friendsWithMeta.push({ ... })` call (currently lines 80-86), add the computed flag:

```tsx
            friendsWithMeta.push({
              uid: friendUid,
              displayName: userData.displayName,
              username: userData.username,
              lastPostText: metaData?.lastPostText ?? "",
              lastPostAt: metaData?.lastPostAt?.toDate() ?? null,
              hasNewActivity: hasNewActivity(
                metaData?.lastPostAt?.toDate() ?? null,
                viewedMap[friendUid]
              ),
            });
```

- [ ] **Step 4: Pass the prop to the friend UserPreview**

In the `renderItem` friend row (currently lines 146-160), add the prop:

```tsx
          renderItem={({ item }) => (
            <UserPreview
              displayName={item.displayName}
              username={item.username}
              previewText={item.lastPostText || "No posts yet"}
              timestamp={item.lastPostAt}
              hasNewActivity={item.hasNewActivity}
              onPress={() =>
                navigation.navigate("FriendPage", {
                  friendUid: item.uid,
                  friendDisplayName: item.displayName,
                  friendUsername: item.username,
                })
              }
            />
          )}
```

The self-preview row in `ListHeaderComponent` is left unchanged — it never gets the prop, so it never shows a dot.

- [ ] **Step 5: Typecheck and run the suite**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors; all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/screens/home/HomeScreen.tsx
git commit -m "feat: show new-activity dots on home friend lines"
```

---

## Task 4: Stamp lastViewedAt on FriendPage focus

**Files:**
- Modify: `src/screens/home/FriendPageScreen.tsx`

- [ ] **Step 1: Import the service**

Add after the `likes` import (currently line 15):

```tsx
import { markFriendViewed } from "../../services/viewedFriends";
```

- [ ] **Step 2: Stamp the view on mount**

Immediately after the existing posts `useEffect` (which ends with `}, [friendUid, user]);` around line 72), add a second effect:

```tsx
  useEffect(() => {
    if (user) {
      markFriendViewed(user.uid, friendUid).catch(() => {
        // A failed write just leaves the dot until the next successful view.
      });
    }
  }, [friendUid, user]);
```

This runs when the friend page opens. The `.catch` keeps a failed Firestore write from surfacing an unhandled rejection.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/screens/home/FriendPageScreen.tsx
git commit -m "feat: stamp lastViewedAt when opening a friend page"
```

---

## Task 5: Firestore rules + firebase.json

**Files:**
- Create: `firebase.json`
- Create: `firestore.rules`

Reconstructed from the data model in the spec. The rules for pre-existing collections are best-effort and must be diffed against the live console rules before deploying. This task only adds the files; it does not deploy.

- [ ] **Step 1: Create firebase.json**

```json
{
  "firestore": {
    "rules": "firestore.rules"
  }
}
```

- [ ] **Step 2: Create firestore.rules**

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() {
      return request.auth != null;
    }

    function isOwner(uid) {
      return isSignedIn() && request.auth.uid == uid;
    }

    // User profile docs: any signed-in user can read (search, friend pages);
    // only the owner can write their own profile.
    match /users/{uid} {
      allow read: if isSignedIn();
      allow write: if isOwner(uid);

      // Profile meta (last post text/time): readable by any signed-in user,
      // writable only by the owner.
      match /meta/{metaId} {
        allow read: if isSignedIn();
        allow write: if isOwner(uid);
      }

      // Posts: readable by any signed-in user; only the owner writes their own.
      match /posts/{postId} {
        allow read: if isSignedIn();
        allow write: if isOwner(uid);

        // Comments: any signed-in user may read and add comments.
        match /comments/{commentId} {
          allow read: if isSignedIn();
          allow write: if isSignedIn();
        }

        // Likes: readable by any signed-in user; each user manages only their
        // own like doc (doc id == liker uid).
        match /likes/{likerUid} {
          allow read: if isSignedIn();
          allow write: if isOwner(likerUid);
        }
      }

      // Viewed-friends read state: private to the owner. The doc id is the
      // friend's uid; only the viewer can read or write their own history.
      match /viewedFriends/{friendUid} {
        allow read, write: if isOwner(uid);
      }
    }

    // Friendships: a signed-in user may read/write a friendship they are part
    // of. Creating a request: the requester must be the signed-in user.
    match /friendships/{friendshipId} {
      allow read: if isSignedIn() &&
        (request.auth.uid == resource.data.requesterId ||
         request.auth.uid == resource.data.receiverId);
      allow create: if isSignedIn() &&
        request.auth.uid == request.resource.data.requesterId;
      allow update, delete: if isSignedIn() &&
        (request.auth.uid == resource.data.requesterId ||
         request.auth.uid == resource.data.receiverId);
    }
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add firebase.json firestore.rules
git commit -m "feat: add firestore rules incl. owner-only viewedFriends"
```

---

## Task 6: README checkboxes + final verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Tick the Tier-2 checkboxes**

In `README.md`, under **Green dots for new activity** (currently lines 38-41), change each `- [ ]` to `- [x]`:

```markdown
- [x] `users/{uid}/viewedFriends/{friendUid}` docs storing `lastViewedAt`
- [x] Homepage shows a green dot when a friend's `meta.lastPostAt` is newer than my `lastViewedAt` (or never viewed)
- [x] Opening a friend's page stamps `lastViewedAt = now`, clearing the dot
- [x] Firestore security rules for `viewedFriends`
```

- [ ] **Step 2: Full verification**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors; all suites pass (the original 41 tests plus the new viewedFriends and UserPreview tests).

- [ ] **Step 3: Manual smoke test (optional but recommended)**

With at least two accounts that are friends: have friend B post, confirm a green dot appears on B's row on A's home; tap into B's page and back; confirm the dot is gone.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: tick green-dots roadmap checkboxes"
```

---

## Self-Review Notes

- **Spec coverage:** data model (Task 1), `markFriendViewed`/`getViewedMap`/`hasNewActivity` (Task 1), UserPreview dot (Task 2), HomeScreen wiring incl. self-row exclusion (Task 3), FriendPage stamp on focus (Task 4), firestore.rules + firebase.json incl. owner-only `viewedFriends` (Task 5), README (Task 6). All edge cases (no post, no record, pending timestamp, self row, write failure) are exercised by Task 1 tests and Task 4's `.catch`.
- **Type consistency:** `hasNewActivity(lastPostAt: Date | null, lastViewedAt: Date | null | undefined)` and `getViewedMap` returning `Record<string, Date | null>` are used identically in Task 3. `FriendWithMeta.hasNewActivity` flows to `UserPreview`'s `hasNewActivity?: boolean` prop.
- **Testing gap acknowledged:** HomeScreen/FriendPageScreen changes are verified by typecheck + suite + manual smoke rather than unit tests, consistent with the repo's existing (minimal) screen-test coverage.
