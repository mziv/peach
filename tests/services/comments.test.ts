import { addDoc, getDocs } from "firebase/firestore";
import { addComment, getComments } from "../../src/services/comments";

jest.mock("firebase/firestore", () => ({
  collection: jest.fn(() => "mock-collection-ref"),
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
