import { getDoc, getDocs } from "firebase/firestore";
import { getUserByUid, searchUsersByUsername } from "../../src/services/users";

jest.mock("firebase/firestore", () => ({
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(),
  collection: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
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
});
