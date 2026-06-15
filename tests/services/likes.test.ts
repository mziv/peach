import { getDoc, writeBatch } from "firebase/firestore";
import { likePost, unlikePost, hasLiked } from "../../src/services/likes";

jest.mock("firebase/firestore", () => ({
  doc: jest.fn(() => "mock-doc-ref"),
  collection: jest.fn(() => "mock-collection-ref"),
  getDoc: jest.fn(),
  deleteDoc: jest.fn(),
  writeBatch: jest.fn(),
  increment: jest.fn((n) => `increment(${n})`),
  serverTimestamp: jest.fn(() => "mock-server-timestamp"),
}));

jest.mock("../../src/config/firebase", () => ({
  db: {},
}));

describe("likes service", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("likePost", () => {
    it("creates a like doc, increments likeCount, and notifies the owner", async () => {
      const mockBatch = {
        set: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined),
      };
      (writeBatch as jest.Mock).mockReturnValue(mockBatch);

      await likePost("owner-1", "post-1", "liker-1", "liker", "Liker", "post text");

      expect(mockBatch.set).toHaveBeenCalledTimes(2);
      expect(mockBatch.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ type: "like", actorUid: "liker-1" })
      );
      expect(mockBatch.update).toHaveBeenCalledWith(expect.anything(), {
        likeCount: "increment(1)",
      });
      expect(mockBatch.commit).toHaveBeenCalled();
    });

    it("does not notify when liking your own post", async () => {
      const mockBatch = {
        set: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined),
      };
      (writeBatch as jest.Mock).mockReturnValue(mockBatch);

      await likePost("owner-1", "post-1", "owner-1", "owner", "Owner", "post text");

      expect(mockBatch.set).toHaveBeenCalledTimes(1);
    });
  });

  describe("unlikePost", () => {
    it("deletes the like doc, decrements likeCount, and removes the notification", async () => {
      const mockBatch = {
        set: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined),
      };
      (writeBatch as jest.Mock).mockReturnValue(mockBatch);

      await unlikePost("owner-1", "post-1", "liker-1");

      expect(mockBatch.delete).toHaveBeenCalledTimes(2);
      expect(mockBatch.update).toHaveBeenCalledWith(expect.anything(), {
        likeCount: "increment(-1)",
      });
      expect(mockBatch.commit).toHaveBeenCalled();
    });

    it("does not touch notifications when unliking your own post", async () => {
      const mockBatch = {
        set: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined),
      };
      (writeBatch as jest.Mock).mockReturnValue(mockBatch);

      await unlikePost("owner-1", "post-1", "owner-1");

      expect(mockBatch.delete).toHaveBeenCalledTimes(1);
    });
  });

  describe("hasLiked", () => {
    it("returns true when like doc exists", async () => {
      (getDoc as jest.Mock).mockResolvedValue({ exists: () => true });

      const result = await hasLiked("owner-1", "post-1", "liker-1");

      expect(result).toBe(true);
    });

    it("returns false when like doc does not exist", async () => {
      (getDoc as jest.Mock).mockResolvedValue({ exists: () => false });

      const result = await hasLiked("owner-1", "post-1", "liker-1");

      expect(result).toBe(false);
    });
  });
});
