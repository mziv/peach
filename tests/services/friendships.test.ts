import { doc, setDoc, getDocs, updateDoc, deleteDoc } from "firebase/firestore";
import {
  pairId,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  getFriendships,
  getPendingRequests,
} from "../../src/services/friendships";

jest.mock("firebase/firestore", () => ({
  collection: jest.fn(() => "mock-collection-ref"),
  doc: jest.fn((_db, _coll, id) => ({ id })),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  getDocs: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  query: jest.fn(() => "mock-query"),
  where: jest.fn(() => "mock-where"),
  or: jest.fn(() => "mock-or"),
  and: jest.fn(() => "mock-and"),
  serverTimestamp: jest.fn(() => "mock-timestamp"),
}));

jest.mock("../../src/config/firebase", () => ({
  db: {},
}));

describe("friendships service", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("pairId", () => {
    it("is deterministic regardless of argument order", () => {
      expect(pairId("uid-1", "uid-2")).toBe("uid-1_uid-2");
      expect(pairId("uid-2", "uid-1")).toBe("uid-1_uid-2");
    });
  });

  describe("sendFriendRequest", () => {
    it("creates a friendship doc with pending status at the canonical pair id", async () => {
      (setDoc as jest.Mock).mockResolvedValue(undefined);

      await sendFriendRequest("uid-2", "uid-1");

      // Doc id is the sorted pair, independent of requester/receiver order.
      expect(doc).toHaveBeenCalledWith(
        expect.anything(),
        "friendships",
        "uid-1_uid-2"
      );
      expect(setDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          requesterId: "uid-2",
          receiverId: "uid-1",
          status: "pending",
        })
      );
    });
  });

  describe("acceptFriendRequest", () => {
    it("updates friendship status to accepted", async () => {
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      await acceptFriendRequest("f-1");

      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        { status: "accepted" }
      );
    });
  });

  describe("declineFriendRequest", () => {
    it("deletes the friendship doc", async () => {
      (deleteDoc as jest.Mock).mockResolvedValue(undefined);

      await declineFriendRequest("f-1");

      expect(deleteDoc).toHaveBeenCalled();
    });
  });

  describe("getFriendships", () => {
    it("returns accepted friendships for a user", async () => {
      const mockDoc = {
        id: "f-1",
        data: () => ({
          requesterId: "uid-1",
          receiverId: "uid-2",
          status: "accepted",
          createdAt: { toDate: () => new Date("2026-01-01") },
        }),
      };
      (getDocs as jest.Mock).mockResolvedValue({ docs: [mockDoc] });

      const friendships = await getFriendships("uid-1");

      expect(friendships).toHaveLength(1);
      expect(friendships[0].status).toBe("accepted");
    });
  });

  describe("getPendingRequests", () => {
    it("returns pending requests where user is the receiver", async () => {
      const mockDoc = {
        id: "f-2",
        data: () => ({
          requesterId: "uid-3",
          receiverId: "uid-1",
          status: "pending",
          createdAt: { toDate: () => new Date("2026-01-01") },
        }),
      };
      (getDocs as jest.Mock).mockResolvedValue({ docs: [mockDoc] });

      const requests = await getPendingRequests("uid-1");

      expect(requests).toHaveLength(1);
      expect(requests[0].requesterId).toBe("uid-3");
    });
  });
});
