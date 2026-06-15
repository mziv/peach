import { doc, getDoc, getDocs, updateDoc, where, writeBatch } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import {
  getUserByUid,
  searchUsersByUsername,
  updateDisplayName,
  deleteAccountData,
  uploadProfilePhoto,
  removeProfilePhoto,
} from "../../src/services/users";

jest.mock("firebase/firestore", () => ({
  doc: jest.fn(() => ({ id: "mock-doc-ref" })),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(),
  collection: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  updateDoc: jest.fn(),
  or: jest.fn(),
  writeBatch: jest.fn(),
  deleteField: jest.fn(() => "mock-delete-field"),
}));

jest.mock("firebase/storage", () => ({
  ref: jest.fn(() => ({ fullPath: "mock-storage-ref" })),
  uploadBytes: jest.fn(),
  getDownloadURL: jest.fn(),
  deleteObject: jest.fn(),
}));

jest.mock("../../src/config/firebase", () => ({
  db: {},
  storage: {},
}));

describe("users service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).fetch = jest.fn().mockResolvedValue({
      blob: jest.fn().mockResolvedValue("mock-blob"),
    });
  });

  describe("getUserByUid", () => {
    it("returns user data including photoURL when user exists", async () => {
      const mockData = {
        uid: "uid-1",
        username: "alice",
        displayName: "Alice",
        photoURL: "https://example.com/alice.jpg",
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
        photoURL: "https://example.com/alice.jpg",
        createdAt: new Date("2026-01-01"),
      });
    });

    it("returns photoURL as undefined when the field is absent", async () => {
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

      expect(user?.photoURL).toBeUndefined();
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
          photoURL: "https://example.com/bob.jpg",
          createdAt: { toDate: () => new Date("2026-01-01") },
        }),
      };
      (getDocs as jest.Mock).mockResolvedValue({ docs: [mockDoc] });

      const users = await searchUsersByUsername("bob");

      expect(users).toHaveLength(1);
      expect(users[0]).toEqual({
        uid: "uid-2",
        username: "bob",
        displayName: "Bob",
        photoURL: "https://example.com/bob.jpg",
        createdAt: new Date("2026-01-01"),
      });
    });

    it("returns empty array when no matches", async () => {
      (getDocs as jest.Mock).mockResolvedValue({ docs: [] });

      const users = await searchUsersByUsername("nobody");

      expect(users).toEqual([]);
    });
  });

  describe("updateDisplayName", () => {
    it("writes the new display name to the user doc", async () => {
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      await updateDisplayName("uid-1", "New Name");

      expect(doc).toHaveBeenCalledWith(expect.anything(), "users", "uid-1");
      expect(updateDoc).toHaveBeenCalledWith(expect.anything(), {
        displayName: "New Name",
      });
    });
  });

  describe("deleteAccountData", () => {
    it("batch-deletes posts (+ comments/likes), meta, friendships, and the user doc", async () => {
      const batch = { delete: jest.fn(), commit: jest.fn().mockResolvedValue(undefined) };
      (writeBatch as jest.Mock).mockReturnValue(batch);

      // getDocs is called in this order:
      // 1) posts, 2) comments(post1), 3) likes(post1), 4) friendships
      (getDocs as jest.Mock)
        .mockResolvedValueOnce({ docs: [{ id: "post1", ref: "postRef" }] }) // posts
        .mockResolvedValueOnce({ docs: [{ ref: "commentRef" }] })           // comments
        .mockResolvedValueOnce({ docs: [{ ref: "likeRef" }] })              // likes
        .mockResolvedValueOnce({ docs: [{ ref: "friendshipRef" }] });       // friendships

      await deleteAccountData("uid-1");

      // 1 comment + 1 like + 1 post + 1 meta + 1 friendship + 1 user = 6 deletes
      expect(batch.delete).toHaveBeenCalledTimes(6);
      expect(batch.commit).toHaveBeenCalledTimes(1);
      expect(deleteObject).toHaveBeenCalled();
    });

    it("queries friendships where the user is requester or receiver", async () => {
      const batch = { delete: jest.fn(), commit: jest.fn().mockResolvedValue(undefined) };
      (writeBatch as jest.Mock).mockReturnValue(batch);
      (getDocs as jest.Mock).mockResolvedValue({ docs: [] });

      await deleteAccountData("uid-1");

      expect(where).toHaveBeenCalledWith("requesterId", "==", "uid-1");
      expect(where).toHaveBeenCalledWith("receiverId", "==", "uid-1");
    });

    it("does not throw if the avatar object is missing", async () => {
      const batch = { delete: jest.fn(), commit: jest.fn().mockResolvedValue(undefined) };
      (writeBatch as jest.Mock).mockReturnValue(batch);
      (getDocs as jest.Mock).mockResolvedValue({ docs: [] });
      (deleteObject as jest.Mock).mockRejectedValue({ code: "storage/object-not-found" });

      await expect(deleteAccountData("uid-1")).resolves.toBeUndefined();
    });
  });

  describe("uploadProfilePhoto", () => {
    it("uploads the blob to avatars/{uid}, sets photoURL, and returns the URL", async () => {
      (getDownloadURL as jest.Mock).mockResolvedValue("https://cdn/avatar.jpg");
      (uploadBytes as jest.Mock).mockResolvedValue(undefined);
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      const url = await uploadProfilePhoto("uid-1", "file:///tmp/pic.jpg");

      expect(global.fetch).toHaveBeenCalledWith("file:///tmp/pic.jpg");
      expect(ref).toHaveBeenCalledWith(expect.anything(), "avatars/uid-1");
      expect(uploadBytes).toHaveBeenCalledWith(expect.anything(), "mock-blob");
      expect(updateDoc).toHaveBeenCalledWith(expect.anything(), {
        photoURL: "https://cdn/avatar.jpg",
      });
      expect(url).toBe("https://cdn/avatar.jpg");
    });
  });

  describe("removeProfilePhoto", () => {
    it("deletes the storage object and clears photoURL", async () => {
      (deleteObject as jest.Mock).mockResolvedValue(undefined);
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      await removeProfilePhoto("uid-1");

      expect(ref).toHaveBeenCalledWith(expect.anything(), "avatars/uid-1");
      expect(deleteObject).toHaveBeenCalled();
      expect(updateDoc).toHaveBeenCalledWith(expect.anything(), {
        photoURL: "mock-delete-field",
      });
    });

    it("clears photoURL even when the object does not exist", async () => {
      (deleteObject as jest.Mock).mockRejectedValue({ code: "storage/object-not-found" });
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      await expect(removeProfilePhoto("uid-1")).resolves.toBeUndefined();
      expect(updateDoc).toHaveBeenCalledWith(expect.anything(), {
        photoURL: "mock-delete-field",
      });
    });
  });
});
