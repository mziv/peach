// These are pure functions, but importing the hook module pulls in Firebase's
// ESM, which Jest can't load untransformed — so stub the Firebase-touching
// modules just to let the file import (matching the rest of the suite).
jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  query: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  startAfter: jest.fn(),
  getDocs: jest.fn(),
  onSnapshot: jest.fn(),
}));
jest.mock("../../src/config/firebase", () => ({ db: {} }));
jest.mock("../../src/contexts/AuthContext", () => ({
  useAuth: () => ({ user: null }),
}));
jest.mock("../../src/services/likes", () => ({
  hasLiked: jest.fn(),
  likePost: jest.fn(),
  unlikePost: jest.fn(),
}));

import { mergeLiveHead, appendOlder } from "../../src/hooks/useUserPosts";
import { Post } from "../../src/types";

// Minimal Post factory — only the fields the merge helpers touch matter here.
function post(id: string, likeCount = 0): Post {
  return {
    postId: id,
    text: id,
    createdAt: new Date("2026-01-01"),
    commentCount: 0,
    likeCount,
    photoURLs: [],
  };
}

describe("mergeLiveHead", () => {
  it("puts the live head first and preserves older posts below it", () => {
    const live = [post("p5"), post("p4")];
    const prev = [post("p5"), post("p4"), post("p3"), post("p2")];

    const merged = mergeLiveHead(live, prev);

    expect(merged.map((p) => p.postId)).toEqual(["p5", "p4", "p3", "p2"]);
  });

  it("lets the live version win on an id collision (fresh like counts)", () => {
    const live = [post("p5", 9)];
    const prev = [post("p5", 3), post("p4", 1)];

    const merged = mergeLiveHead(live, prev);

    expect(merged[0]).toMatchObject({ postId: "p5", likeCount: 9 });
    expect(merged.map((p) => p.postId)).toEqual(["p5", "p4"]);
  });

  it("prepends a brand-new post from the live head", () => {
    const live = [post("p6"), post("p5")];
    const prev = [post("p5"), post("p4")];

    const merged = mergeLiveHead(live, prev);

    expect(merged.map((p) => p.postId)).toEqual(["p6", "p5", "p4"]);
  });
});

describe("appendOlder", () => {
  it("appends an older page to the tail", () => {
    const prev = [post("p5"), post("p4")];
    const older = [post("p3"), post("p2")];

    const merged = appendOlder(prev, older);

    expect(merged.map((p) => p.postId)).toEqual(["p5", "p4", "p3", "p2"]);
  });

  it("drops ids already present so the head/tail boundary can't duplicate", () => {
    const prev = [post("p5"), post("p4"), post("p3")];
    // p3 shifted into this page after a new post appeared at the top.
    const older = [post("p3"), post("p2")];

    const merged = appendOlder(prev, older);

    expect(merged.map((p) => p.postId)).toEqual(["p5", "p4", "p3", "p2"]);
  });
});
