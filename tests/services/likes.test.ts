import { getDoc, writeBatch } from "firebase/firestore";
import { likePost, unlikePost, hasLiked } from "../../src/services/likes";

jest.mock("firebase/firestore", () => ({
  doc: jest.fn(() => "mock-doc-ref"),
  getDoc: jest.fn(),
  deleteDoc: jest.fn(),
  writeBatch: jest.fn(),
  increment: jest.fn((n) => `increment(${n})`),
}));

jest.mock("../../src/config/firebase", () => ({
  db: {},
}));

describe("likes service", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("likePost", () => {
    it("creates a like doc and increments likeCount in a batch", async () => {
      const mockBatch = {
        set: jest.fn(),
        update: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined),
      };
      (writeBatch as jest.Mock).mockReturnValue(mockBatch);

      await likePost("owner-1", "post-1", "liker-1");

      expect(mockBatch.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ likedAt: expect.any(Date) })
      );
      expect(mockBatch.update).toHaveBeenCalledWith(
        expect.anything(),
        { likeCount: "increment(1)" }
      );
      expect(mockBatch.commit).toHaveBeenCalled();
    });
  });

  describe("unlikePost", () => {
    it("deletes the like doc and decrements likeCount in a batch", async () => {
      const mockBatch = {
        delete: jest.fn(),
        update: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined),
      };
      (writeBatch as jest.Mock).mockReturnValue(mockBatch);

      await unlikePost("owner-1", "post-1", "liker-1");

      expect(mockBatch.delete).toHaveBeenCalled();
      expect(mockBatch.update).toHaveBeenCalledWith(
        expect.anything(),
        { likeCount: "increment(-1)" }
      );
      expect(mockBatch.commit).toHaveBeenCalled();
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
