import { getDocs, writeBatch } from "firebase/firestore";
import {
  addComment,
  getComments,
  deleteComment,
} from "../../src/services/comments";

jest.mock("firebase/firestore", () => ({
  collection: jest.fn(() => "mock-collection-ref"),
  doc: jest.fn(() => "mock-doc-ref"),
  getDocs: jest.fn(),
  query: jest.fn(),
  orderBy: jest.fn(),
  serverTimestamp: jest.fn(() => "mock-timestamp"),
  writeBatch: jest.fn(),
  increment: jest.fn((n) => `increment(${n})`),
}));

jest.mock("../../src/config/firebase", () => ({
  db: {},
}));

describe("comments service", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("addComment", () => {
    function mockBatchSetup() {
      const mockBatch = {
        set: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined),
      };
      (writeBatch as jest.Mock).mockReturnValue(mockBatch);
      return mockBatch;
    }

    it("creates a comment and increments commentCount in a batch", async () => {
      const mockBatch = mockBatchSetup();

      await addComment(
        "owner-1",
        "post-1",
        "uid-2",
        "commenter",
        "Commenter Name",
        "https://photos/commenter.jpg",
        "Nice post!",
        "the original post text"
      );

      expect(mockBatch.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          authorUid: "uid-2",
          authorUsername: "commenter",
          text: "Nice post!",
        })
      );
      expect(mockBatch.update).toHaveBeenCalledWith(expect.anything(), {
        commentCount: "increment(1)",
      });
      expect(mockBatch.commit).toHaveBeenCalled();
    });

    it("fans out a comment notification to the post owner", async () => {
      const mockBatch = mockBatchSetup();

      await addComment(
        "owner-1",
        "post-1",
        "uid-2",
        "commenter",
        "Commenter Name",
        "https://photos/commenter.jpg",
        "Nice post!",
        "the original post text"
      );

      expect(mockBatch.set).toHaveBeenCalledTimes(2);
      expect(mockBatch.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          type: "comment",
          actorUid: "uid-2",
          actorPhotoURL: "https://photos/commenter.jpg",
        })
      );
    });

    it("omits actorPhotoURL from the notification when the actor has no photo", async () => {
      const mockBatch = mockBatchSetup();

      await addComment(
        "owner-1",
        "post-1",
        "uid-2",
        "commenter",
        "Commenter Name",
        undefined,
        "Nice post!",
        "the original post text"
      );

      const notifPayload = mockBatch.set.mock.calls[1][1];
      expect(notifPayload).not.toHaveProperty("actorPhotoURL");
    });

    it("does not notify when commenting on your own post", async () => {
      const mockBatch = mockBatchSetup();

      await addComment(
        "owner-1",
        "post-1",
        "owner-1",
        "owner",
        "Owner Name",
        "https://photos/owner.jpg",
        "self comment",
        "my own post"
      );

      expect(mockBatch.set).toHaveBeenCalledTimes(1);
    });
  });

  describe("deleteComment", () => {
    it("deletes the comment and decrements commentCount in a batch", async () => {
      const mockBatch = {
        delete: jest.fn(),
        update: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined),
      };
      (writeBatch as jest.Mock).mockReturnValue(mockBatch);

      await deleteComment("uid-1", "post-1", "c-1");

      expect(mockBatch.delete).toHaveBeenCalled();
      expect(mockBatch.update).toHaveBeenCalledWith(expect.anything(), {
        commentCount: "increment(-1)",
      });
      expect(mockBatch.commit).toHaveBeenCalled();
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
