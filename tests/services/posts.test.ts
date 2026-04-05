import { getDocs, getDoc, writeBatch } from "firebase/firestore";
import { createPost, getPostsByUser, getPost } from "../../src/services/posts";

jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  doc: jest.fn(() => ({})),
  getDocs: jest.fn(),
  getDoc: jest.fn(),
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
