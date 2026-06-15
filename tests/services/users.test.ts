import { doc, getDoc, getDocs, updateDoc, where, writeBatch, or } from "firebase/firestore";
import { getUserByUid, searchUsersByUsername, updateDisplayName, deleteAccountData } from "../../src/services/users";

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
}));

jest.mock("../../src/config/firebase", () => ({
  db: {},
}));

describe("users service", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("getUserByUid", () => {
    it("returns user data when user exists", async () => {
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

      expect(user).toEqual({
        uid: "uid-1",
        username: "alice",
        displayName: "Alice",
        createdAt: new Date("2026-01-01"),
      });
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
          createdAt: { toDate: () => new Date("2026-01-01") },
        }),
      };
      (getDocs as jest.Mock).mockResolvedValue({ docs: [mockDoc] });

      const users = await searchUsersByUsername("bob");

      expect(users).toHaveLength(1);
      expect(users[0].username).toBe("bob");
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
    });

    it("queries friendships where the user is requester or receiver", async () => {
      const batch = { delete: jest.fn(), commit: jest.fn().mockResolvedValue(undefined) };
      (writeBatch as jest.Mock).mockReturnValue(batch);
      (getDocs as jest.Mock).mockResolvedValue({ docs: [] });

      await deleteAccountData("uid-1");

      expect(where).toHaveBeenCalledWith("requesterId", "==", "uid-1");
      expect(where).toHaveBeenCalledWith("receiverId", "==", "uid-1");
    });
  });
});
