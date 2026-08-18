import { renderHook, waitFor } from "@testing-library/react-native";

// Simulates a warm-cache re-subscribe: Firestore serves a single cache-only
// emission (fromCache: true) and — with no doc changes and no metadata-change
// subscription — never fires a follow-up server snapshot. The feed must still
// finish loading; skipping this emission leaves the spinner up forever (the bug
// seen when navigating away from My Page and back).
const CACHE_POST = {
  id: "p1",
  data: () => ({
    text: "hello",
    createdAt: { toDate: () => new Date("2026-06-01T00:00:00Z") },
    commentCount: 0,
    likeCount: 0,
    photoURLs: [],
  }),
};

jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  query: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  startAfter: jest.fn(),
  getDocs: jest.fn().mockResolvedValue({ docs: [] }),
  onSnapshot: jest.fn((_q: any, cb: any) => {
    cb({ docs: [CACHE_POST], metadata: { fromCache: true } });
    return jest.fn();
  }),
}));

jest.mock("../../src/config/firebase", () => ({ db: {} }));
jest.mock("../../src/contexts/AuthContext", () => {
  // Stable reference: the hook effect depends on `user`, so a fresh object each
  // render would re-subscribe every render and loop forever (as the real
  // AuthContext, which memoizes user, never does).
  const user = { uid: "me", username: "me", displayName: "Me" };
  return { useAuth: () => ({ user }) };
});
jest.mock("../../src/services/likes", () => ({
  hasLiked: jest.fn().mockResolvedValue(false),
  likePost: jest.fn(),
  unlikePost: jest.fn(),
}));

import { useUserPosts } from "../../src/hooks/useUserPosts";

describe("useUserPosts loading", () => {
  it("resolves loading from a cache-only emission (warm re-subscribe)", async () => {
    const { result } = renderHook(() => useUserPosts("me"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.posts.map((p) => p.postId)).toEqual(["p1"]);
  });
});
