# Peach Clone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a cross-platform social media app (Peach clone) with posting, friends, and commenting, running on iOS, Android, and web.

**Architecture:** Expo (managed) React Native app with Firebase Auth + Firestore. Bottom tab navigation with three tabs (Home, My Page, Friends). Firestore realtime listeners for live updates. Services layer abstracts all Firebase interactions.

**Tech Stack:** Expo, React Native, TypeScript, React Navigation, Firebase Auth, Firestore

---

## File Structure

```
app.json                          — Expo config
App.tsx                           — Entry point, wraps app in AuthProvider
babel.config.js                   — Babel config (expo preset)
firestore.rules                   — Firestore security rules (reference)
src/
  config/
    firebase.ts                   — Firebase app init + auth/firestore exports
  types/
    index.ts                      — Shared TypeScript types (User, Post, Comment, Friendship)
  contexts/
    AuthContext.tsx                — Auth state provider + useAuth hook
  services/
    auth.ts                       — Sign up, log in, log out
    users.ts                      — Get user by UID, search by username
    posts.ts                      — Create post, list posts, get single post
    friendships.ts                — Send/accept/decline requests, list friends
    comments.ts                   — Add comment, list comments
  navigation/
    RootNavigator.tsx             — Switches between AuthStack and MainTabs based on auth state
    AuthStack.tsx                 — Login + SignUp screens
    MainTabs.tsx                  — Bottom tabs: Home, My Page, Friends
    HomeStack.tsx                 — Home > FriendPage > PostDetail
    MyPageStack.tsx               — MyPage > PostDetail
    FriendsStack.tsx              — FriendRequests + SearchUsers
  screens/
    auth/
      LoginScreen.tsx             — Email/password login form
      SignUpScreen.tsx             — Registration form with username
    home/
      HomeScreen.tsx              — Friend list with post previews
      FriendPageScreen.tsx        — A friend's posts in reverse chronological order
    mypage/
      MyPageScreen.tsx            — Your posts + new post button
    friends/
      FriendRequestsScreen.tsx    — Incoming/outgoing friend requests
      SearchUsersScreen.tsx       — Search users by username, send requests
    PostDetailScreen.tsx          — Post with comments + comment input (shared across tabs)
tests/
  services/
    auth.test.ts
    users.test.ts
    posts.test.ts
    friendships.test.ts
    comments.test.ts
```

---

### Task 1: Project Scaffolding

**Files:**
- Create: `app.json`, `App.tsx`, `babel.config.js`, `tsconfig.json`, `src/types/index.ts`

- [ ] **Step 1: Initialize Expo project**

Run:
```bash
npx create-expo-app@latest peach-app --template blank-typescript
```

Then move all generated files into the repo root:
```bash
mv peach-app/* peach-app/.* . 2>/dev/null; rmdir peach-app
```

Expected: Expo project files in repo root, `package.json` exists.

- [ ] **Step 2: Install dependencies**

```bash
npx expo install firebase
npx expo install @react-navigation/native @react-navigation/bottom-tabs @react-navigation/native-stack
npx expo install react-native-screens react-native-safe-area-context
npm install --save-dev @types/react jest @testing-library/react-native @testing-library/jest-native
```

- [ ] **Step 3: Create shared types**

Create `src/types/index.ts`:

```typescript
export interface User {
  uid: string;
  username: string;
  displayName: string;
  createdAt: Date;
}

export interface UserMeta {
  lastPostText: string;
  lastPostAt: Date;
}

export interface Post {
  postId: string;
  text: string;
  createdAt: Date;
}

export interface Comment {
  commentId: string;
  authorUid: string;
  authorUsername: string;
  text: string;
  createdAt: Date;
}

export interface Friendship {
  friendshipId: string;
  requesterId: string;
  receiverId: string;
  status: "pending" | "accepted";
  createdAt: Date;
}
```

- [ ] **Step 4: Verify the app runs**

Run: `npx expo start --web`
Expected: Default Expo app loads in browser.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: scaffold Expo project with dependencies and shared types"
```

---

### Task 2: Firebase Configuration

**Files:**
- Create: `src/config/firebase.ts`

- [ ] **Step 1: Create a Firebase project**

Go to https://console.firebase.google.com and create a new project called "peach-clone". Enable:
1. **Authentication** — Email/Password provider
2. **Cloud Firestore** — Start in test mode

Copy the Firebase config object from Project Settings > General > Your apps > Web app.

- [ ] **Step 2: Create Firebase config file**

Create `src/config/firebase.ts`:

```typescript
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
```

Replace the placeholder values with actual Firebase config.

- [ ] **Step 3: Commit**

```bash
git add src/config/firebase.ts
git commit -m "feat: add Firebase configuration"
```

---

### Task 3: Auth Service

**Files:**
- Create: `src/services/auth.ts`, `tests/services/auth.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/services/auth.test.ts`:

```typescript
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { setDoc, getDocs, query, collection, where } from "firebase/firestore";
import { signUp, logIn, logOut } from "../../src/services/auth";
import { auth, db } from "../../src/config/firebase";

jest.mock("firebase/auth", () => ({
  createUserWithEmailAndPassword: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
}));

jest.mock("firebase/firestore", () => ({
  doc: jest.fn(),
  setDoc: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(),
  collection: jest.fn(),
  where: jest.fn(),
  serverTimestamp: jest.fn(() => "mock-timestamp"),
}));

jest.mock("../../src/config/firebase", () => ({
  auth: { currentUser: null },
  db: {},
}));

describe("auth service", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("signUp", () => {
    it("creates a Firebase Auth user and Firestore user doc", async () => {
      (getDocs as jest.Mock).mockResolvedValue({ empty: true });
      (createUserWithEmailAndPassword as jest.Mock).mockResolvedValue({
        user: { uid: "uid-123" },
      });
      (setDoc as jest.Mock).mockResolvedValue(undefined);

      await signUp("test@example.com", "password123", "testuser", "Test User");

      expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(
        auth,
        "test@example.com",
        "password123"
      );
      expect(setDoc).toHaveBeenCalled();
    });

    it("throws if username is already taken", async () => {
      (getDocs as jest.Mock).mockResolvedValue({ empty: false });

      await expect(
        signUp("test@example.com", "password123", "taken", "Test User")
      ).rejects.toThrow("Username is already taken");
    });
  });

  describe("logIn", () => {
    it("signs in with email and password", async () => {
      (signInWithEmailAndPassword as jest.Mock).mockResolvedValue({
        user: { uid: "uid-123" },
      });

      await logIn("test@example.com", "password123");

      expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
        auth,
        "test@example.com",
        "password123"
      );
    });
  });

  describe("logOut", () => {
    it("signs out the current user", async () => {
      (signOut as jest.Mock).mockResolvedValue(undefined);

      await logOut();

      expect(signOut).toHaveBeenCalledWith(auth);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tests/services/auth.test.ts`
Expected: FAIL — module `../../src/services/auth` not found.

- [ ] **Step 3: Implement auth service**

Create `src/services/auth.ts`:

```typescript
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  doc,
  setDoc,
  getDocs,
  query,
  collection,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "../config/firebase";

export async function signUp(
  email: string,
  password: string,
  username: string,
  displayName: string
): Promise<void> {
  const usernameLC = username.toLowerCase();

  const usernameQuery = query(
    collection(db, "users"),
    where("username", "==", usernameLC)
  );
  const existing = await getDocs(usernameQuery);
  if (!existing.empty) {
    throw new Error("Username is already taken");
  }

  const { user } = await createUserWithEmailAndPassword(auth, email, password);

  await setDoc(doc(db, "users", user.uid), {
    uid: user.uid,
    username: usernameLC,
    displayName,
    createdAt: serverTimestamp(),
  });
}

export async function logIn(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(auth, email, password);
}

export async function logOut(): Promise<void> {
  await signOut(auth);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest tests/services/auth.test.ts`
Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/auth.ts tests/services/auth.test.ts
git commit -m "feat: add auth service with signup, login, logout"
```

---

### Task 4: Auth Context

**Files:**
- Create: `src/contexts/AuthContext.tsx`

- [ ] **Step 1: Create AuthContext**

Create `src/contexts/AuthContext.tsx`:

```typescript
import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../config/firebase";
import { User } from "../types";

interface AuthState {
  firebaseUser: FirebaseUser | null;
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthState>({
  firebaseUser: null,
  user: null,
  loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
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
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ firebaseUser, user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/contexts/AuthContext.tsx
git commit -m "feat: add AuthContext with Firebase auth state listener"
```

---

### Task 5: Users Service

**Files:**
- Create: `src/services/users.ts`, `tests/services/users.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/services/users.test.ts`:

```typescript
import { getDoc, getDocs } from "firebase/firestore";
import { getUserByUid, searchUsersByUsername } from "../../src/services/users";

jest.mock("firebase/firestore", () => ({
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(),
  collection: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
}));

jest.mock("../../src/config/firebase", () => ({
  db: {},
}));

describe("users service", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("getUserByUid", () => {
    it("returns user data when user exists", async () => {
      const mockData = {
        uid: "uid-1",
        username: "alice",
        displayName: "Alice",
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
        createdAt: new Date("2026-01-01"),
      });
    });

    it("returns null when user does not exist", async () => {
      (getDoc as jest.Mock).mockResolvedValue({
        exists: () => false,
      });

      const user = await getUserByUid("nonexistent");

      expect(user).toBeNull();
    });
  });

  describe("searchUsersByUsername", () => {
    it("returns matching users", async () => {
      const mockDoc = {
        data: () => ({
          uid: "uid-2",
          username: "bob",
          displayName: "Bob",
          createdAt: { toDate: () => new Date("2026-01-01") },
        }),
      };
      (getDocs as jest.Mock).mockResolvedValue({ docs: [mockDoc] });

      const users = await searchUsersByUsername("bob");

      expect(users).toHaveLength(1);
      expect(users[0].username).toBe("bob");
    });

    it("returns empty array when no matches", async () => {
      (getDocs as jest.Mock).mockResolvedValue({ docs: [] });

      const users = await searchUsersByUsername("nobody");

      expect(users).toEqual([]);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tests/services/users.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement users service**

Create `src/services/users.ts`:

```typescript
import {
  doc,
  getDoc,
  getDocs,
  query,
  collection,
  where,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { User } from "../types";

export async function getUserByUid(uid: string): Promise<User | null> {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    uid: data.uid,
    username: data.username,
    displayName: data.displayName,
    createdAt: data.createdAt?.toDate() ?? new Date(),
  };
}

export async function searchUsersByUsername(
  searchTerm: string
): Promise<User[]> {
  const term = searchTerm.toLowerCase();
  const q = query(
    collection(db, "users"),
    where("username", ">=", term),
    where("username", "<=", term + "\uf8ff"),
    orderBy("username"),
    limit(20)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      uid: data.uid,
      username: data.username,
      displayName: data.displayName,
      createdAt: data.createdAt?.toDate() ?? new Date(),
    };
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest tests/services/users.test.ts`
Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/users.ts tests/services/users.test.ts
git commit -m "feat: add users service with getByUid and search"
```

---

### Task 6: Posts Service

**Files:**
- Create: `src/services/posts.ts`, `tests/services/posts.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/services/posts.test.ts`:

```typescript
import { addDoc, getDocs, getDoc, writeBatch } from "firebase/firestore";
import { createPost, getPostsByUser, getPost } from "../../src/services/posts";

jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  addDoc: jest.fn(),
  getDocs: jest.fn(),
  getDoc: jest.fn(),
  doc: jest.fn(),
  query: jest.fn(),
  orderBy: jest.fn(),
  serverTimestamp: jest.fn(() => "mock-timestamp"),
  writeBatch: jest.fn(),
}));

jest.mock("../../src/config/firebase", () => ({
  db: {},
}));

describe("posts service", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("createPost", () => {
    it("creates a post and updates user meta in a batch", async () => {
      const mockBatch = {
        set: jest.fn(),
        update: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined),
      };
      (writeBatch as jest.Mock).mockReturnValue(mockBatch);

      await createPost("uid-1", "Hello world!");

      expect(mockBatch.set).toHaveBeenCalled();
      expect(mockBatch.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ text: "Hello world!" })
      );
      expect(mockBatch.commit).toHaveBeenCalled();
    });
  });

  describe("getPostsByUser", () => {
    it("returns posts sorted by createdAt descending", async () => {
      const mockDocs = [
        {
          id: "post-2",
          data: () => ({
            text: "Second post",
            createdAt: { toDate: () => new Date("2026-01-02") },
          }),
        },
        {
          id: "post-1",
          data: () => ({
            text: "First post",
            createdAt: { toDate: () => new Date("2026-01-01") },
          }),
        },
      ];
      (getDocs as jest.Mock).mockResolvedValue({ docs: mockDocs });

      const posts = await getPostsByUser("uid-1");

      expect(posts).toHaveLength(2);
      expect(posts[0].postId).toBe("post-2");
      expect(posts[1].postId).toBe("post-1");
    });
  });

  describe("getPost", () => {
    it("returns a single post by ID", async () => {
      (getDoc as jest.Mock).mockResolvedValue({
        exists: () => true,
        id: "post-1",
        data: () => ({
          text: "Hello",
          createdAt: { toDate: () => new Date("2026-01-01") },
        }),
      });

      const post = await getPost("uid-1", "post-1");

      expect(post).not.toBeNull();
      expect(post!.text).toBe("Hello");
    });

    it("returns null when post does not exist", async () => {
      (getDoc as jest.Mock).mockResolvedValue({ exists: () => false });

      const post = await getPost("uid-1", "nonexistent");

      expect(post).toBeNull();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tests/services/posts.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement posts service**

Create `src/services/posts.ts`:

```typescript
import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  orderBy,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { Post } from "../types";

export async function createPost(uid: string, text: string): Promise<void> {
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
}

export async function getPostsByUser(uid: string): Promise<Post[]> {
  const q = query(
    collection(db, "users", uid, "posts"),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    postId: d.id,
    text: d.data().text,
    createdAt: d.data().createdAt?.toDate() ?? new Date(),
  }));
}

export async function getPost(
  uid: string,
  postId: string
): Promise<Post | null> {
  const snap = await getDoc(doc(db, "users", uid, "posts", postId));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    postId: snap.id,
    text: data.text,
    createdAt: data.createdAt?.toDate() ?? new Date(),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest tests/services/posts.test.ts`
Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/posts.ts tests/services/posts.test.ts
git commit -m "feat: add posts service with create, list, and get"
```

---

### Task 7: Friendships Service

**Files:**
- Create: `src/services/friendships.ts`, `tests/services/friendships.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/services/friendships.test.ts`:

```typescript
import { addDoc, getDocs, updateDoc, deleteDoc } from "firebase/firestore";
import {
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  getFriendships,
  getPendingRequests,
} from "../../src/services/friendships";

jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  addDoc: jest.fn(),
  getDocs: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  or: jest.fn(),
  and: jest.fn(),
  serverTimestamp: jest.fn(() => "mock-timestamp"),
}));

jest.mock("../../src/config/firebase", () => ({
  db: {},
}));

describe("friendships service", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("sendFriendRequest", () => {
    it("creates a friendship doc with pending status", async () => {
      (addDoc as jest.Mock).mockResolvedValue({ id: "f-1" });

      await sendFriendRequest("uid-1", "uid-2");

      expect(addDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          requesterId: "uid-1",
          receiverId: "uid-2",
          status: "pending",
        })
      );
    });
  });

  describe("acceptFriendRequest", () => {
    it("updates friendship status to accepted", async () => {
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      await acceptFriendRequest("f-1");

      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        { status: "accepted" }
      );
    });
  });

  describe("declineFriendRequest", () => {
    it("deletes the friendship doc", async () => {
      (deleteDoc as jest.Mock).mockResolvedValue(undefined);

      await declineFriendRequest("f-1");

      expect(deleteDoc).toHaveBeenCalled();
    });
  });

  describe("getFriendships", () => {
    it("returns accepted friendships for a user", async () => {
      const mockDoc = {
        id: "f-1",
        data: () => ({
          requesterId: "uid-1",
          receiverId: "uid-2",
          status: "accepted",
          createdAt: { toDate: () => new Date("2026-01-01") },
        }),
      };
      (getDocs as jest.Mock).mockResolvedValue({ docs: [mockDoc] });

      const friendships = await getFriendships("uid-1");

      expect(friendships).toHaveLength(1);
      expect(friendships[0].status).toBe("accepted");
    });
  });

  describe("getPendingRequests", () => {
    it("returns pending requests where user is the receiver", async () => {
      const mockDoc = {
        id: "f-2",
        data: () => ({
          requesterId: "uid-3",
          receiverId: "uid-1",
          status: "pending",
          createdAt: { toDate: () => new Date("2026-01-01") },
        }),
      };
      (getDocs as jest.Mock).mockResolvedValue({ docs: [mockDoc] });

      const requests = await getPendingRequests("uid-1");

      expect(requests).toHaveLength(1);
      expect(requests[0].requesterId).toBe("uid-3");
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tests/services/friendships.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement friendships service**

Create `src/services/friendships.ts`:

```typescript
import {
  collection,
  doc,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  or,
  and,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { Friendship } from "../types";

function docToFriendship(d: any): Friendship {
  const data = d.data();
  return {
    friendshipId: d.id,
    requesterId: data.requesterId,
    receiverId: data.receiverId,
    status: data.status,
    createdAt: data.createdAt?.toDate() ?? new Date(),
  };
}

export async function sendFriendRequest(
  requesterId: string,
  receiverId: string
): Promise<void> {
  await addDoc(collection(db, "friendships"), {
    requesterId,
    receiverId,
    status: "pending",
    createdAt: serverTimestamp(),
  });
}

export async function acceptFriendRequest(
  friendshipId: string
): Promise<void> {
  await updateDoc(doc(db, "friendships", friendshipId), {
    status: "accepted",
  });
}

export async function declineFriendRequest(
  friendshipId: string
): Promise<void> {
  await deleteDoc(doc(db, "friendships", friendshipId));
}

export async function getFriendships(uid: string): Promise<Friendship[]> {
  const q = query(
    collection(db, "friendships"),
    and(
      where("status", "==", "accepted"),
      or(
        where("requesterId", "==", uid),
        where("receiverId", "==", uid)
      )
    )
  );
  const snap = await getDocs(q);
  return snap.docs.map(docToFriendship);
}

export async function getPendingRequests(uid: string): Promise<Friendship[]> {
  const q = query(
    collection(db, "friendships"),
    where("receiverId", "==", uid),
    where("status", "==", "pending")
  );
  const snap = await getDocs(q);
  return snap.docs.map(docToFriendship);
}

export async function getOutgoingRequests(uid: string): Promise<Friendship[]> {
  const q = query(
    collection(db, "friendships"),
    where("requesterId", "==", uid),
    where("status", "==", "pending")
  );
  const snap = await getDocs(q);
  return snap.docs.map(docToFriendship);
}

export async function getFriendshipBetween(
  uid1: string,
  uid2: string
): Promise<Friendship | null> {
  const q = query(
    collection(db, "friendships"),
    or(
      and(where("requesterId", "==", uid1), where("receiverId", "==", uid2)),
      and(where("requesterId", "==", uid2), where("receiverId", "==", uid1))
    )
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return docToFriendship(snap.docs[0]);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest tests/services/friendships.test.ts`
Expected: 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/friendships.ts tests/services/friendships.test.ts
git commit -m "feat: add friendships service with request, accept, decline, list"
```

---

### Task 8: Comments Service

**Files:**
- Create: `src/services/comments.ts`, `tests/services/comments.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/services/comments.test.ts`:

```typescript
import { addDoc, getDocs } from "firebase/firestore";
import { addComment, getComments } from "../../src/services/comments";

jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  addDoc: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(),
  orderBy: jest.fn(),
  serverTimestamp: jest.fn(() => "mock-timestamp"),
}));

jest.mock("../../src/config/firebase", () => ({
  db: {},
}));

describe("comments service", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("addComment", () => {
    it("creates a comment doc in the post's comments subcollection", async () => {
      (addDoc as jest.Mock).mockResolvedValue({ id: "c-1" });

      await addComment("uid-1", "post-1", "uid-2", "commenter", "Nice post!");

      expect(addDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          authorUid: "uid-2",
          authorUsername: "commenter",
          text: "Nice post!",
        })
      );
    });
  });

  describe("getComments", () => {
    it("returns comments sorted by createdAt ascending", async () => {
      const mockDocs = [
        {
          id: "c-1",
          data: () => ({
            authorUid: "uid-2",
            authorUsername: "bob",
            text: "First!",
            createdAt: { toDate: () => new Date("2026-01-01") },
          }),
        },
        {
          id: "c-2",
          data: () => ({
            authorUid: "uid-3",
            authorUsername: "carol",
            text: "Great post",
            createdAt: { toDate: () => new Date("2026-01-02") },
          }),
        },
      ];
      (getDocs as jest.Mock).mockResolvedValue({ docs: mockDocs });

      const comments = await getComments("uid-1", "post-1");

      expect(comments).toHaveLength(2);
      expect(comments[0].text).toBe("First!");
      expect(comments[1].text).toBe("Great post");
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tests/services/comments.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement comments service**

Create `src/services/comments.ts`:

```typescript
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { Comment } from "../types";

export async function addComment(
  postOwnerUid: string,
  postId: string,
  authorUid: string,
  authorUsername: string,
  text: string
): Promise<void> {
  await addDoc(
    collection(db, "users", postOwnerUid, "posts", postId, "comments"),
    {
      authorUid,
      authorUsername,
      text,
      createdAt: serverTimestamp(),
    }
  );
}

export async function getComments(
  postOwnerUid: string,
  postId: string
): Promise<Comment[]> {
  const q = query(
    collection(db, "users", postOwnerUid, "posts", postId, "comments"),
    orderBy("createdAt", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    commentId: d.id,
    authorUid: d.data().authorUid,
    authorUsername: d.data().authorUsername,
    text: d.data().text,
    createdAt: d.data().createdAt?.toDate() ?? new Date(),
  }));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest tests/services/comments.test.ts`
Expected: 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/comments.ts tests/services/comments.test.ts
git commit -m "feat: add comments service with add and list"
```

---

### Task 9: Navigation Structure

**Files:**
- Create: `src/navigation/RootNavigator.tsx`, `src/navigation/AuthStack.tsx`, `src/navigation/MainTabs.tsx`, `src/navigation/HomeStack.tsx`, `src/navigation/MyPageStack.tsx`, `src/navigation/FriendsStack.tsx`
- Modify: `App.tsx`

- [ ] **Step 1: Create AuthStack**

Create `src/navigation/AuthStack.tsx`:

```typescript
import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { LoginScreen } from "../screens/auth/LoginScreen";
import { SignUpScreen } from "../screens/auth/SignUpScreen";

export type AuthStackParamList = {
  Login: undefined;
  SignUp: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
    </Stack.Navigator>
  );
}
```

- [ ] **Step 2: Create HomeStack**

Create `src/navigation/HomeStack.tsx`:

```typescript
import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { HomeScreen } from "../screens/home/HomeScreen";
import { FriendPageScreen } from "../screens/home/FriendPageScreen";
import { PostDetailScreen } from "../screens/PostDetailScreen";

export type HomeStackParamList = {
  Home: undefined;
  FriendPage: { friendUid: string; friendDisplayName: string };
  PostDetail: { postOwnerUid: string; postId: string };
};

const Stack = createNativeStackNavigator<HomeStackParamList>();

export function HomeStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Home" component={HomeScreen} options={{ title: "Peach" }} />
      <Stack.Screen
        name="FriendPage"
        component={FriendPageScreen}
        options={({ route }) => ({ title: route.params.friendDisplayName })}
      />
      <Stack.Screen name="PostDetail" component={PostDetailScreen} options={{ title: "Post" }} />
    </Stack.Navigator>
  );
}
```

- [ ] **Step 3: Create MyPageStack**

Create `src/navigation/MyPageStack.tsx`:

```typescript
import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { MyPageScreen } from "../screens/mypage/MyPageScreen";
import { PostDetailScreen } from "../screens/PostDetailScreen";

export type MyPageStackParamList = {
  MyPage: undefined;
  PostDetail: { postOwnerUid: string; postId: string };
};

const Stack = createNativeStackNavigator<MyPageStackParamList>();

export function MyPageStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="MyPage" component={MyPageScreen} options={{ title: "My Page" }} />
      <Stack.Screen name="PostDetail" component={PostDetailScreen} options={{ title: "Post" }} />
    </Stack.Navigator>
  );
}
```

- [ ] **Step 4: Create FriendsStack**

Create `src/navigation/FriendsStack.tsx`:

```typescript
import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { FriendRequestsScreen } from "../screens/friends/FriendRequestsScreen";
import { SearchUsersScreen } from "../screens/friends/SearchUsersScreen";

export type FriendsStackParamList = {
  FriendRequests: undefined;
  SearchUsers: undefined;
};

const Stack = createNativeStackNavigator<FriendsStackParamList>();

export function FriendsStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="FriendRequests"
        component={FriendRequestsScreen}
        options={{ title: "Friends" }}
      />
      <Stack.Screen
        name="SearchUsers"
        component={SearchUsersScreen}
        options={{ title: "Search Users" }}
      />
    </Stack.Navigator>
  );
}
```

- [ ] **Step 5: Create MainTabs**

Create `src/navigation/MainTabs.tsx`:

```typescript
import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { HomeStack } from "./HomeStack";
import { MyPageStack } from "./MyPageStack";
import { FriendsStack } from "./FriendsStack";

const Tab = createBottomTabNavigator();

export function MainTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="HomeTab" component={HomeStack} options={{ title: "Home" }} />
      <Tab.Screen name="MyPageTab" component={MyPageStack} options={{ title: "My Page" }} />
      <Tab.Screen name="FriendsTab" component={FriendsStack} options={{ title: "Friends" }} />
    </Tab.Navigator>
  );
}
```

- [ ] **Step 6: Create RootNavigator**

Create `src/navigation/RootNavigator.tsx`:

```typescript
import React from "react";
import { ActivityIndicator, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { useAuth } from "../contexts/AuthContext";
import { AuthStack } from "./AuthStack";
import { MainTabs } from "./MainTabs";

export function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {user ? <MainTabs /> : <AuthStack />}
    </NavigationContainer>
  );
}
```

- [ ] **Step 7: Update App.tsx**

Replace the contents of `App.tsx`:

```typescript
import React from "react";
import { AuthProvider } from "./src/contexts/AuthContext";
import { RootNavigator } from "./src/navigation/RootNavigator";

export default function App() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}
```

- [ ] **Step 8: Create placeholder screens so the app compiles**

Create minimal placeholder files for each screen. Each one follows this pattern (we'll flesh them out in subsequent tasks):

Create `src/screens/auth/LoginScreen.tsx`:
```typescript
import React from "react";
import { View, Text } from "react-native";

export function LoginScreen() {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text>Login Screen</Text>
    </View>
  );
}
```

Create `src/screens/auth/SignUpScreen.tsx`:
```typescript
import React from "react";
import { View, Text } from "react-native";

export function SignUpScreen() {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text>Sign Up Screen</Text>
    </View>
  );
}
```

Create `src/screens/home/HomeScreen.tsx`:
```typescript
import React from "react";
import { View, Text } from "react-native";

export function HomeScreen() {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text>Home Screen</Text>
    </View>
  );
}
```

Create `src/screens/home/FriendPageScreen.tsx`:
```typescript
import React from "react";
import { View, Text } from "react-native";

export function FriendPageScreen() {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text>Friend Page Screen</Text>
    </View>
  );
}
```

Create `src/screens/mypage/MyPageScreen.tsx`:
```typescript
import React from "react";
import { View, Text } from "react-native";

export function MyPageScreen() {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text>My Page Screen</Text>
    </View>
  );
}
```

Create `src/screens/friends/FriendRequestsScreen.tsx`:
```typescript
import React from "react";
import { View, Text } from "react-native";

export function FriendRequestsScreen() {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text>Friend Requests Screen</Text>
    </View>
  );
}
```

Create `src/screens/friends/SearchUsersScreen.tsx`:
```typescript
import React from "react";
import { View, Text } from "react-native";

export function SearchUsersScreen() {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text>Search Users Screen</Text>
    </View>
  );
}
```

Create `src/screens/PostDetailScreen.tsx`:
```typescript
import React from "react";
import { View, Text } from "react-native";

export function PostDetailScreen() {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text>Post Detail Screen</Text>
    </View>
  );
}
```

- [ ] **Step 9: Verify the app compiles**

Run: `npx expo start --web`
Expected: App loads with the Login placeholder screen (since no user is logged in).

- [ ] **Step 10: Commit**

```bash
git add App.tsx src/navigation/ src/screens/
git commit -m "feat: add navigation structure with placeholder screens"
```

---

### Task 10: Auth Screens (Login + Sign Up)

**Files:**
- Modify: `src/screens/auth/LoginScreen.tsx`, `src/screens/auth/SignUpScreen.tsx`

- [ ] **Step 1: Implement LoginScreen**

Replace `src/screens/auth/LoginScreen.tsx`:

```typescript
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { AuthStackParamList } from "../../navigation/AuthStack";
import { logIn } from "../../services/auth";

type LoginNav = NativeStackNavigationProp<AuthStackParamList, "Login">;

export function LoginScreen() {
  const navigation = useNavigation<LoginNav>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert("Error", "Please fill in all fields.");
      return;
    }
    setLoading(true);
    try {
      await logIn(email, password);
    } catch (err: any) {
      Alert.alert("Login Failed", err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Peach</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <TouchableOpacity
        style={styles.button}
        onPress={handleLogin}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? "Logging in..." : "Log In"}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate("SignUp")}>
        <Text style={styles.link}>Don't have an account? Sign up</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24 },
  title: { fontSize: 36, fontWeight: "bold", textAlign: "center", marginBottom: 32 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  button: {
    backgroundColor: "#FF6B6B",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginBottom: 16,
  },
  buttonText: { color: "white", fontSize: 16, fontWeight: "600" },
  link: { textAlign: "center", color: "#FF6B6B", fontSize: 14 },
});
```

- [ ] **Step 2: Implement SignUpScreen**

Replace `src/screens/auth/SignUpScreen.tsx`:

```typescript
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { AuthStackParamList } from "../../navigation/AuthStack";
import { signUp } from "../../services/auth";

type SignUpNav = NativeStackNavigationProp<AuthStackParamList, "SignUp">;

export function SignUpScreen() {
  const navigation = useNavigation<SignUpNav>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignUp() {
    if (!email || !password || !username || !displayName) {
      Alert.alert("Error", "Please fill in all fields.");
      return;
    }
    setLoading(true);
    try {
      await signUp(email, password, username, displayName);
    } catch (err: any) {
      Alert.alert("Sign Up Failed", err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Join Peach</Text>
      <TextInput
        style={styles.input}
        placeholder="Display Name"
        value={displayName}
        onChangeText={setDisplayName}
      />
      <TextInput
        style={styles.input}
        placeholder="Username"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <TouchableOpacity
        style={styles.button}
        onPress={handleSignUp}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? "Creating account..." : "Sign Up"}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.link}>Already have an account? Log in</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24 },
  title: { fontSize: 36, fontWeight: "bold", textAlign: "center", marginBottom: 32 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  button: {
    backgroundColor: "#FF6B6B",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginBottom: 16,
  },
  buttonText: { color: "white", fontSize: 16, fontWeight: "600" },
  link: { textAlign: "center", color: "#FF6B6B", fontSize: 14 },
});
```

- [ ] **Step 3: Verify login and signup screens render**

Run: `npx expo start --web`
Expected: Login screen renders with form fields. Tapping "Don't have an account?" navigates to Sign Up screen.

- [ ] **Step 4: Commit**

```bash
git add src/screens/auth/
git commit -m "feat: implement Login and SignUp screens"
```

---

### Task 11: Home Screen

**Files:**
- Modify: `src/screens/home/HomeScreen.tsx`

- [ ] **Step 1: Implement HomeScreen**

Replace `src/screens/home/HomeScreen.tsx`:

```typescript
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
  or,
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { getFriendships } from "../../services/friendships";
import { HomeStackParamList } from "../../navigation/HomeStack";
import { UserMeta } from "../../types";

type HomeNav = NativeStackNavigationProp<HomeStackParamList, "Home">;

interface FriendWithMeta {
  uid: string;
  displayName: string;
  lastPostText: string;
  lastPostAt: Date | null;
}

export function HomeScreen() {
  const navigation = useNavigation<HomeNav>();
  const { user } = useAuth();
  const [friends, setFriends] = useState<FriendWithMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    async function loadFriends() {
      const friendships = await getFriendships(user!.uid);

      const friendUids = friendships.map((f) =>
        f.requesterId === user!.uid ? f.receiverId : f.requesterId
      );

      const friendsWithMeta: FriendWithMeta[] = [];
      for (const friendUid of friendUids) {
        const userSnap = await getDoc(doc(db, "users", friendUid));
        const metaSnap = await getDoc(doc(db, "users", friendUid, "meta", "meta"));

        if (userSnap.exists()) {
          const userData = userSnap.data();
          const metaData = metaSnap.exists() ? metaSnap.data() : null;
          friendsWithMeta.push({
            uid: friendUid,
            displayName: userData.displayName,
            lastPostText: metaData?.lastPostText ?? "",
            lastPostAt: metaData?.lastPostAt?.toDate() ?? null,
          });
        }
      }

      friendsWithMeta.sort((a, b) => {
        if (!a.lastPostAt && !b.lastPostAt) return 0;
        if (!a.lastPostAt) return 1;
        if (!b.lastPostAt) return -1;
        return b.lastPostAt.getTime() - a.lastPostAt.getTime();
      });

      if (!cancelled) {
        setFriends(friendsWithMeta);
        setLoading(false);
      }
    }

    loadFriends();

    return () => {
      cancelled = true;
    };
  }, [user]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (friends.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>No friends yet.</Text>
        <Text style={styles.emptySubtext}>
          Go to the Friends tab to find people!
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={friends}
      keyExtractor={(item) => item.uid}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.friendRow}
          onPress={() =>
            navigation.navigate("FriendPage", {
              friendUid: item.uid,
              friendDisplayName: item.displayName,
            })
          }
        >
          <Text style={styles.friendName}>{item.displayName}</Text>
          {item.lastPostText ? (
            <Text style={styles.postPreview} numberOfLines={2}>
              {item.lastPostText}
            </Text>
          ) : (
            <Text style={styles.noPost}>No posts yet</Text>
          )}
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  emptyText: { fontSize: 18, fontWeight: "600", marginBottom: 8 },
  emptySubtext: { fontSize: 14, color: "#888" },
  friendRow: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  friendName: { fontSize: 16, fontWeight: "600", marginBottom: 4 },
  postPreview: { fontSize: 14, color: "#555" },
  noPost: { fontSize: 14, color: "#aaa", fontStyle: "italic" },
});
```

- [ ] **Step 2: Verify home screen renders**

Run: `npx expo start --web`
Expected: After logging in (create a test account first), home screen shows "No friends yet."

- [ ] **Step 3: Commit**

```bash
git add src/screens/home/HomeScreen.tsx
git commit -m "feat: implement Home screen with friend list and post previews"
```

---

### Task 12: My Page Screen

**Files:**
- Modify: `src/screens/mypage/MyPageScreen.tsx`

- [ ] **Step 1: Implement MyPageScreen**

Replace `src/screens/mypage/MyPageScreen.tsx`:

```typescript
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../../config/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { createPost } from "../../services/posts";
import { logOut } from "../../services/auth";
import { MyPageStackParamList } from "../../navigation/MyPageStack";
import { Post } from "../../types";

type MyPageNav = NativeStackNavigationProp<MyPageStackParamList, "MyPage">;

export function MyPageScreen() {
  const navigation = useNavigation<MyPageNav>();
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPostText, setNewPostText] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "users", user.uid, "posts"),
      orderBy("createdAt", "desc")
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      const postList: Post[] = snap.docs.map((d) => ({
        postId: d.id,
        text: d.data().text,
        createdAt: d.data().createdAt?.toDate() ?? new Date(),
      }));
      setPosts(postList);
      setLoading(false);
    });
    return unsubscribe;
  }, [user]);

  async function handlePost() {
    if (!newPostText.trim() || !user) return;
    setPosting(true);
    try {
      await createPost(user.uid, newPostText.trim());
      setNewPostText("");
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setPosting(false);
    }
  }

  async function handleLogout() {
    try {
      await logOut();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <Text style={styles.username}>@{user?.username}</Text>
        <TouchableOpacity onPress={handleLogout}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          placeholder="What's on your mind?"
          value={newPostText}
          onChangeText={setNewPostText}
          multiline
        />
        <TouchableOpacity
          style={[styles.postButton, !newPostText.trim() && styles.postButtonDisabled]}
          onPress={handlePost}
          disabled={posting || !newPostText.trim()}
        >
          <Text style={styles.postButtonText}>
            {posting ? "Posting..." : "Post"}
          </Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.postId}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.postRow}
            onPress={() =>
              navigation.navigate("PostDetail", {
                postOwnerUid: user!.uid,
                postId: item.postId,
              })
            }
          >
            <Text style={styles.postText}>{item.text}</Text>
            <Text style={styles.postDate}>
              {item.createdAt.toLocaleDateString()}
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyText}>No posts yet. Write your first one!</Text>
          </View>
        }
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  username: { fontSize: 16, fontWeight: "600" },
  logoutText: { color: "#FF6B6B", fontSize: 14 },
  composer: { padding: 16, borderBottomWidth: 1, borderBottomColor: "#eee" },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 60,
    marginBottom: 8,
  },
  postButton: {
    backgroundColor: "#FF6B6B",
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
  },
  postButtonDisabled: { backgroundColor: "#ccc" },
  postButtonText: { color: "white", fontWeight: "600" },
  postRow: { padding: 16, borderBottomWidth: 1, borderBottomColor: "#eee" },
  postText: { fontSize: 16, marginBottom: 4 },
  postDate: { fontSize: 12, color: "#888" },
  emptyText: { fontSize: 14, color: "#888" },
});
```

- [ ] **Step 2: Verify My Page screen renders**

Run: `npx expo start --web`
Expected: My Page tab shows username, composer, and empty posts list.

- [ ] **Step 3: Commit**

```bash
git add src/screens/mypage/MyPageScreen.tsx
git commit -m "feat: implement My Page screen with post creation and list"
```

---

### Task 13: Friend Page Screen

**Files:**
- Modify: `src/screens/home/FriendPageScreen.tsx`

- [ ] **Step 1: Implement FriendPageScreen**

Replace `src/screens/home/FriendPageScreen.tsx`:

```typescript
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../../config/firebase";
import { HomeStackParamList } from "../../navigation/HomeStack";
import { Post } from "../../types";

type FriendPageRoute = RouteProp<HomeStackParamList, "FriendPage">;
type FriendPageNav = NativeStackNavigationProp<HomeStackParamList, "FriendPage">;

export function FriendPageScreen() {
  const route = useRoute<FriendPageRoute>();
  const navigation = useNavigation<FriendPageNav>();
  const { friendUid } = route.params;
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "users", friendUid, "posts"),
      orderBy("createdAt", "desc")
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      const postList: Post[] = snap.docs.map((d) => ({
        postId: d.id,
        text: d.data().text,
        createdAt: d.data().createdAt?.toDate() ?? new Date(),
      }));
      setPosts(postList);
      setLoading(false);
    });
    return unsubscribe;
  }, [friendUid]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <FlatList
      data={posts}
      keyExtractor={(item) => item.postId}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.postRow}
          onPress={() =>
            navigation.navigate("PostDetail", {
              postOwnerUid: friendUid,
              postId: item.postId,
            })
          }
        >
          <Text style={styles.postText}>{item.text}</Text>
          <Text style={styles.postDate}>
            {item.createdAt.toLocaleDateString()}
          </Text>
        </TouchableOpacity>
      )}
      ListEmptyComponent={
        <View style={styles.center}>
          <Text style={styles.emptyText}>No posts yet.</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  postRow: { padding: 16, borderBottomWidth: 1, borderBottomColor: "#eee" },
  postText: { fontSize: 16, marginBottom: 4 },
  postDate: { fontSize: 12, color: "#888" },
  emptyText: { fontSize: 14, color: "#888" },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/home/FriendPageScreen.tsx
git commit -m "feat: implement Friend Page screen with realtime post list"
```

---

### Task 14: Post Detail Screen (Comments)

**Files:**
- Modify: `src/screens/PostDetailScreen.tsx`

- [ ] **Step 1: Implement PostDetailScreen**

Replace `src/screens/PostDetailScreen.tsx`:

```typescript
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRoute, RouteProp } from "@react-navigation/native";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { useAuth } from "../contexts/AuthContext";
import { addComment } from "../services/comments";
import { Post, Comment } from "../types";

type PostDetailParams = {
  PostDetail: { postOwnerUid: string; postId: string };
};
type PostDetailRoute = RouteProp<PostDetailParams, "PostDetail">;

export function PostDetailScreen() {
  const route = useRoute<PostDetailRoute>();
  const { postOwnerUid, postId } = route.params;
  const { user } = useAuth();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const postRef = doc(db, "users", postOwnerUid, "posts", postId);
    const unsubPost = onSnapshot(postRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setPost({
          postId: snap.id,
          text: data.text,
          createdAt: data.createdAt?.toDate() ?? new Date(),
        });
      }
      setLoading(false);
    });

    const commentsQuery = query(
      collection(db, "users", postOwnerUid, "posts", postId, "comments"),
      orderBy("createdAt", "asc")
    );
    const unsubComments = onSnapshot(commentsQuery, (snap) => {
      setComments(
        snap.docs.map((d) => ({
          commentId: d.id,
          authorUid: d.data().authorUid,
          authorUsername: d.data().authorUsername,
          text: d.data().text,
          createdAt: d.data().createdAt?.toDate() ?? new Date(),
        }))
      );
    });

    return () => {
      unsubPost();
      unsubComments();
    };
  }, [postOwnerUid, postId]);

  async function handleComment() {
    if (!commentText.trim() || !user) return;
    setSubmitting(true);
    try {
      await addComment(
        postOwnerUid,
        postId,
        user.uid,
        user.username,
        commentText.trim()
      );
      setCommentText("");
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!post) {
    return (
      <View style={styles.center}>
        <Text>Post not found.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <FlatList
        data={comments}
        keyExtractor={(item) => item.commentId}
        ListHeaderComponent={
          <View style={styles.postSection}>
            <Text style={styles.postText}>{post.text}</Text>
            <Text style={styles.postDate}>
              {post.createdAt.toLocaleDateString()}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.commentRow}>
            <Text style={styles.commentAuthor}>@{item.authorUsername}</Text>
            <Text style={styles.commentText}>{item.text}</Text>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyComments}>
            <Text style={styles.emptyText}>No comments yet.</Text>
          </View>
        }
      />
      <View style={styles.commentInputRow}>
        <TextInput
          style={styles.commentInput}
          placeholder="Add a comment..."
          value={commentText}
          onChangeText={setCommentText}
        />
        <TouchableOpacity
          style={[styles.sendButton, !commentText.trim() && styles.sendButtonDisabled]}
          onPress={handleComment}
          disabled={submitting || !commentText.trim()}
        >
          <Text style={styles.sendButtonText}>
            {submitting ? "..." : "Send"}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  postSection: {
    padding: 16,
    borderBottomWidth: 2,
    borderBottomColor: "#eee",
    marginBottom: 8,
  },
  postText: { fontSize: 18, marginBottom: 8 },
  postDate: { fontSize: 12, color: "#888" },
  commentRow: { paddingHorizontal: 16, paddingVertical: 10 },
  commentAuthor: { fontWeight: "600", fontSize: 14, marginBottom: 2 },
  commentText: { fontSize: 14, color: "#333" },
  emptyComments: { padding: 16, alignItems: "center" },
  emptyText: { color: "#888", fontSize: 14 },
  commentInputRow: {
    flexDirection: "row",
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    alignItems: "center",
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    marginRight: 8,
  },
  sendButton: {
    backgroundColor: "#FF6B6B",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  sendButtonDisabled: { backgroundColor: "#ccc" },
  sendButtonText: { color: "white", fontWeight: "600" },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/PostDetailScreen.tsx
git commit -m "feat: implement Post Detail screen with realtime comments"
```

---

### Task 15: Friend Requests Screen

**Files:**
- Modify: `src/screens/friends/FriendRequestsScreen.tsx`

- [ ] **Step 1: Implement FriendRequestsScreen**

Replace `src/screens/friends/FriendRequestsScreen.tsx`:

```typescript
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  SectionList,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../../contexts/AuthContext";
import {
  getPendingRequests,
  getOutgoingRequests,
  acceptFriendRequest,
  declineFriendRequest,
} from "../../services/friendships";
import { getUserByUid } from "../../services/users";
import { FriendsStackParamList } from "../../navigation/FriendsStack";
import { Friendship } from "../../types";

type FriendsNav = NativeStackNavigationProp<FriendsStackParamList, "FriendRequests">;

interface RequestWithName extends Friendship {
  otherDisplayName: string;
}

export function FriendRequestsScreen() {
  const navigation = useNavigation<FriendsNav>();
  const { user } = useAuth();
  const [incoming, setIncoming] = useState<RequestWithName[]>([]);
  const [outgoing, setOutgoing] = useState<RequestWithName[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadRequests() {
    if (!user) return;
    setLoading(true);
    const [inc, out] = await Promise.all([
      getPendingRequests(user.uid),
      getOutgoingRequests(user.uid),
    ]);

    const incomingWithNames = await Promise.all(
      inc.map(async (f) => {
        const requester = await getUserByUid(f.requesterId);
        return { ...f, otherDisplayName: requester?.displayName ?? "Unknown" };
      })
    );

    const outgoingWithNames = await Promise.all(
      out.map(async (f) => {
        const receiver = await getUserByUid(f.receiverId);
        return { ...f, otherDisplayName: receiver?.displayName ?? "Unknown" };
      })
    );

    setIncoming(incomingWithNames);
    setOutgoing(outgoingWithNames);
    setLoading(false);
  }

  useEffect(() => {
    loadRequests();
  }, [user]);

  async function handleAccept(friendshipId: string) {
    try {
      await acceptFriendRequest(friendshipId);
      await loadRequests();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  }

  async function handleDecline(friendshipId: string) {
    try {
      await declineFriendRequest(friendshipId);
      await loadRequests();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const sections = [
    { title: "Incoming Requests", data: incoming },
    { title: "Outgoing Requests", data: outgoing },
  ];

  return (
    <View style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.friendshipId}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        renderItem={({ item, section }) => (
          <View style={styles.requestRow}>
            <Text style={styles.name}>{item.otherDisplayName}</Text>
            {section.title === "Incoming Requests" ? (
              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.acceptButton}
                  onPress={() => handleAccept(item.friendshipId)}
                >
                  <Text style={styles.buttonText}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.declineButton}
                  onPress={() => handleDecline(item.friendshipId)}
                >
                  <Text style={styles.declineText}>Decline</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.pendingLabel}>Pending</Text>
            )}
          </View>
        )}
        renderSectionFooter={({ section }) =>
          section.data.length === 0 ? (
            <Text style={styles.emptySection}>None</Text>
          ) : null
        }
        ListFooterComponent={
          <TouchableOpacity
            style={styles.searchButton}
            onPress={() => navigation.navigate("SearchUsers")}
          >
            <Text style={styles.searchButtonText}>Search for Friends</Text>
          </TouchableOpacity>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  sectionHeader: {
    fontSize: 14,
    fontWeight: "600",
    color: "#888",
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
    backgroundColor: "#f9f9f9",
  },
  requestRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  name: { fontSize: 16, fontWeight: "500" },
  actions: { flexDirection: "row", gap: 8 },
  acceptButton: {
    backgroundColor: "#FF6B6B",
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  buttonText: { color: "white", fontWeight: "600", fontSize: 14 },
  declineButton: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  declineText: { color: "#888", fontWeight: "600", fontSize: 14 },
  pendingLabel: { color: "#888", fontSize: 14, fontStyle: "italic" },
  emptySection: { padding: 16, color: "#aaa", fontSize: 14 },
  searchButton: {
    margin: 16,
    backgroundColor: "#FF6B6B",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
  },
  searchButtonText: { color: "white", fontSize: 16, fontWeight: "600" },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/friends/FriendRequestsScreen.tsx
git commit -m "feat: implement Friend Requests screen with accept/decline"
```

---

### Task 16: Search Users Screen

**Files:**
- Modify: `src/screens/friends/SearchUsersScreen.tsx`

- [ ] **Step 1: Implement SearchUsersScreen**

Replace `src/screens/friends/SearchUsersScreen.tsx`:

```typescript
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { useAuth } from "../../contexts/AuthContext";
import { searchUsersByUsername } from "../../services/users";
import {
  sendFriendRequest,
  getFriendshipBetween,
} from "../../services/friendships";
import { User } from "../../types";

interface SearchResult extends User {
  friendshipStatus: "none" | "pending" | "accepted";
}

export function SearchUsersScreen() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searched, setSearched] = useState(false);

  async function handleSearch() {
    if (!searchTerm.trim() || !user) return;
    const users = await searchUsersByUsername(searchTerm.trim());

    const resultsWithStatus: SearchResult[] = await Promise.all(
      users
        .filter((u) => u.uid !== user.uid)
        .map(async (u) => {
          const friendship = await getFriendshipBetween(user.uid, u.uid);
          return {
            ...u,
            friendshipStatus: friendship ? friendship.status : "none",
          };
        })
    );

    setResults(resultsWithStatus);
    setSearched(true);
  }

  async function handleSendRequest(receiverUid: string) {
    if (!user) return;
    try {
      await sendFriendRequest(user.uid, receiverUid);
      setResults((prev) =>
        prev.map((r) =>
          r.uid === receiverUid ? { ...r, friendshipStatus: "pending" } : r
        )
      );
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by username"
          value={searchTerm}
          onChangeText={setSearchTerm}
          autoCapitalize="none"
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
          <Text style={styles.searchButtonText}>Search</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={results}
        keyExtractor={(item) => item.uid}
        renderItem={({ item }) => (
          <View style={styles.resultRow}>
            <View>
              <Text style={styles.displayName}>{item.displayName}</Text>
              <Text style={styles.username}>@{item.username}</Text>
            </View>
            {item.friendshipStatus === "none" ? (
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => handleSendRequest(item.uid)}
              >
                <Text style={styles.addButtonText}>Add Friend</Text>
              </TouchableOpacity>
            ) : item.friendshipStatus === "pending" ? (
              <Text style={styles.statusText}>Pending</Text>
            ) : (
              <Text style={styles.statusText}>Friends</Text>
            )}
          </View>
        )}
        ListEmptyComponent={
          searched ? (
            <View style={styles.center}>
              <Text style={styles.emptyText}>No users found.</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchRow: {
    flexDirection: "row",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    marginRight: 8,
  },
  searchButton: {
    backgroundColor: "#FF6B6B",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  searchButtonText: { color: "white", fontWeight: "600" },
  resultRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  displayName: { fontSize: 16, fontWeight: "500" },
  username: { fontSize: 14, color: "#888" },
  addButton: {
    backgroundColor: "#FF6B6B",
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  addButtonText: { color: "white", fontWeight: "600", fontSize: 14 },
  statusText: { color: "#888", fontSize: 14, fontStyle: "italic" },
  center: { padding: 24, alignItems: "center" },
  emptyText: { color: "#888", fontSize: 14 },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/friends/SearchUsersScreen.tsx
git commit -m "feat: implement Search Users screen with friend request sending"
```

---

### Task 17: End-to-End Smoke Test

- [ ] **Step 1: Start the app**

Run: `npx expo start --web`
Expected: App loads and shows Login screen.

- [ ] **Step 2: Test sign up flow**

1. Tap "Don't have an account? Sign up"
2. Fill in display name, username, email, password
3. Tap "Sign Up"

Expected: Account is created, app navigates to Main Stack (Home tab).

- [ ] **Step 3: Test posting**

1. Navigate to "My Page" tab
2. Type a message and tap "Post"

Expected: Post appears in the list below.

- [ ] **Step 4: Test friend flow (requires two accounts)**

1. Log out and create a second account
2. Navigate to Friends tab > Search for Friends
3. Search for the first account's username
4. Tap "Add Friend"
5. Log out, log in as first account
6. Navigate to Friends tab, see incoming request, tap Accept
7. Navigate to Home tab

Expected: Second user appears on the home screen with their post preview.

- [ ] **Step 5: Test comments**

1. Navigate to a friend's page from the home screen
2. Tap on a post
3. Add a comment

Expected: Comment appears in the list below the post.

- [ ] **Step 6: Run all unit tests**

Run: `npx jest`
Expected: All tests pass.

- [ ] **Step 7: Commit any fixes**

If any issues were found during smoke testing, fix and commit:
```bash
git add -A
git commit -m "fix: address issues found during smoke testing"
```
