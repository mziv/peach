import { doc, getDocs, getDoc, writeBatch, updateDoc } from "firebase/firestore";
import {
  createPost,
  getPostsByUser,
  getPost,
  deletePost,
  uploadPostPhotos,
  updatePost,
} from "../../src/services/posts";
import { uploadBytes } from "firebase/storage";

jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  doc: jest.fn(() => ({})),
  getDocs: jest.fn(),
  getDoc: jest.fn(),
  query: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  serverTimestamp: jest.fn(() => "mock-timestamp"),
  writeBatch: jest.fn(),
  updateDoc: jest.fn(),
}));

jest.mock("firebase/storage", () => ({
  ref: jest.fn((_s, path) => ({ path })),
  uploadBytes: jest.fn().mockResolvedValue(undefined),
  getDownloadURL: jest.fn((r) => Promise.resolve(`https://dl/${r.path}`)),
}));

jest.mock("../../src/config/firebase", () => ({
  db: {},
  storage: {},
}));

describe("posts service", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("createPost", () => {
    it("creates a post, updates meta, and returns the new postId", async () => {
      const mockBatch = {
        set: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined),
      };
      (writeBatch as jest.Mock).mockReturnValue(mockBatch);
      (doc as jest.Mock).mockReturnValueOnce({ id: "new-post-id" });

      const postId = await createPost("uid-1", "Hello world!");

      expect(postId).toBe("new-post-id");
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

    it("maps photoURLs when present and defaults to [] when absent", async () => {
      const mockDocs = [
        {
          id: "post-a",
          data: () => ({
            text: "with photos",
            createdAt: { toDate: () => new Date("2026-01-03") },
            photoURLs: ["https://s/0", "https://s/1"],
          }),
        },
        {
          id: "post-b",
          data: () => ({
            text: "no photos",
            createdAt: { toDate: () => new Date("2026-01-02") },
          }),
        },
      ];
      (getDocs as jest.Mock).mockResolvedValue({ docs: mockDocs });

      const posts = await getPostsByUser("uid-1");

      expect(posts[0].photoURLs).toEqual(["https://s/0", "https://s/1"]);
      expect(posts[1].photoURLs).toEqual([]);
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

  describe("deletePost", () => {
    function makeBatch() {
      return {
        set: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined),
      };
    }

    it("deletes the post and all of its comments and likes in a batch", async () => {
      const mockBatch = makeBatch();
      (writeBatch as jest.Mock).mockReturnValue(mockBatch);
      (getDocs as jest.Mock)
        // comments subcollection
        .mockResolvedValueOnce({ docs: [{ ref: "c-1" }, { ref: "c-2" }] })
        // likes subcollection
        .mockResolvedValueOnce({ docs: [{ ref: "l-1" }] })
        // recent-posts recompute query (only the deleted post remains)
        .mockResolvedValueOnce({ docs: [{ id: "post-1", data: () => ({}) }] });

      await deletePost("uid-1", "post-1");

      // 2 comments + 1 like + 1 post = 4 deletes
      expect(mockBatch.delete).toHaveBeenCalledTimes(4);
      expect(mockBatch.commit).toHaveBeenCalled();
    });

    it("recomputes meta to the next-most-recent post", async () => {
      const mockBatch = makeBatch();
      (writeBatch as jest.Mock).mockReturnValue(mockBatch);
      (getDocs as jest.Mock)
        .mockResolvedValueOnce({ docs: [] }) // comments
        .mockResolvedValueOnce({ docs: [] }) // likes
        .mockResolvedValueOnce({
          docs: [
            { id: "post-1", data: () => ({ text: "deleted" }) },
            {
              id: "post-0",
              data: () => ({ text: "older post", createdAt: "ts-older" }),
            },
          ],
        });

      await deletePost("uid-1", "post-1");

      expect(mockBatch.set).toHaveBeenCalledWith(
        expect.anything(),
        { lastPostText: "older post", lastPostAt: "ts-older" },
        { merge: true }
      );
    });

    it("clears meta when no posts remain", async () => {
      const mockBatch = makeBatch();
      (writeBatch as jest.Mock).mockReturnValue(mockBatch);
      (getDocs as jest.Mock)
        .mockResolvedValueOnce({ docs: [] }) // comments
        .mockResolvedValueOnce({ docs: [] }) // likes
        .mockResolvedValueOnce({
          docs: [{ id: "post-1", data: () => ({ text: "deleted" }) }],
        });

      await deletePost("uid-1", "post-1");

      expect(mockBatch.set).toHaveBeenCalledWith(
        expect.anything(),
        { lastPostText: "", lastPostAt: null },
        { merge: true }
      );
    });
  });
});

describe("uploadPostPhotos", () => {
  beforeEach(() => {
    (global as any).fetch = jest
      .fn()
      .mockResolvedValue({ blob: () => Promise.resolve({ type: "image/jpeg" }) });
  });

  it("uploads each uri to posts/{uid}/{postId}/{index} and returns URLs", async () => {
    const urls = await uploadPostPhotos("uid-1", "post-1", [
      "file:///a.jpg",
      "file:///b.jpg",
    ]);

    expect(uploadBytes).toHaveBeenCalledTimes(2);
    expect(urls).toEqual([
      "https://dl/posts/uid-1/post-1/0",
      "https://dl/posts/uid-1/post-1/1",
    ]);
  });
});

describe("updatePost", () => {
  it("patches the post doc with the given fields", async () => {
    await updatePost("uid-1", "post-1", { photoURLs: ["https://dl/x"] });
    expect(updateDoc).toHaveBeenCalledWith(expect.anything(), {
      photoURLs: ["https://dl/x"],
    });
  });
});
