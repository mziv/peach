import {
  distinctAuthorUids,
  withAuthorInfo,
  CommentAuthorInfo,
} from "../../src/utils/commentAuthors";
import { Comment, User } from "../../src/types";

function comment(authorUid: string, commentId = authorUid): Comment {
  return {
    commentId,
    authorUid,
    authorUsername: `user_${authorUid}`,
    text: "hi",
    createdAt: new Date(),
  };
}

describe("distinctAuthorUids", () => {
  it("returns each uid once, in first-seen order", () => {
    const comments = [
      comment("a", "c1"),
      comment("b", "c2"),
      comment("a", "c3"),
      comment("c", "c4"),
    ];
    expect(distinctAuthorUids(comments)).toEqual(["a", "b", "c"]);
  });

  it("skips uids already known", () => {
    const comments = [comment("a"), comment("b"), comment("c")];
    expect(distinctAuthorUids(comments, new Set(["a", "c"]))).toEqual(["b"]);
  });

  it("ignores empty/missing uids", () => {
    const comments = [comment(""), comment("a")];
    expect(distinctAuthorUids(comments)).toEqual(["a"]);
  });

  it("returns an empty array for no comments", () => {
    expect(distinctAuthorUids([])).toEqual([]);
  });
});

describe("withAuthorInfo", () => {
  const user: User = {
    uid: "a",
    username: "alice",
    displayName: "Alice",
    photoURL: "https://cdn/alice.jpg",
    createdAt: new Date(),
  };

  it("records displayName and photoURL for a resolved user", () => {
    const next = withAuthorInfo(new Map(), "a", user);
    expect(next.get("a")).toEqual({
      displayName: "Alice",
      photoURL: "https://cdn/alice.jpg",
    });
  });

  it("records an entry (no photo) even when the user is null", () => {
    const next = withAuthorInfo(new Map(), "a", null);
    expect(next.has("a")).toBe(true);
    expect(next.get("a")).toEqual({
      displayName: undefined,
      photoURL: undefined,
    });
  });

  it("does not mutate the input map", () => {
    const current = new Map<string, CommentAuthorInfo>();
    const next = withAuthorInfo(current, "a", user);
    expect(current.size).toBe(0);
    expect(next.size).toBe(1);
  });

  it("preserves existing entries when adding a new uid", () => {
    const first = withAuthorInfo(new Map(), "a", user);
    const second = withAuthorInfo(first, "b", null);
    expect(second.get("a")?.displayName).toBe("Alice");
    expect(second.has("b")).toBe(true);
  });
});
