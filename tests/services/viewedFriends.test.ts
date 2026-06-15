import { getDocs, setDoc } from "firebase/firestore";
import {
  markFriendViewed,
  getViewedMap,
  hasNewActivity,
} from "../../src/services/viewedFriends";

jest.mock("firebase/firestore", () => ({
  collection: jest.fn(() => "mock-collection-ref"),
  doc: jest.fn(() => "mock-doc-ref"),
  getDocs: jest.fn(),
  setDoc: jest.fn(),
  serverTimestamp: jest.fn(() => "mock-timestamp"),
}));

jest.mock("../../src/config/firebase", () => ({
  db: {},
}));

describe("viewedFriends service", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("markFriendViewed", () => {
    it("writes lastViewedAt with a server timestamp", async () => {
      (setDoc as jest.Mock).mockResolvedValue(undefined);

      await markFriendViewed("me-1", "friend-1");

      expect(setDoc).toHaveBeenCalledWith("mock-doc-ref", {
        lastViewedAt: "mock-timestamp",
      });
    });
  });

  describe("getViewedMap", () => {
    it("maps friend uids to their lastViewedAt dates", async () => {
      const viewedDate = new Date("2026-06-01T00:00:00Z");
      (getDocs as jest.Mock).mockResolvedValue({
        docs: [
          { id: "friend-1", data: () => ({ lastViewedAt: { toDate: () => viewedDate } }) },
          { id: "friend-2", data: () => ({ lastViewedAt: null }) },
        ],
      });

      const map = await getViewedMap("me-1");

      expect(map["friend-1"]).toEqual(viewedDate);
      expect(map["friend-2"]).toBeNull();
      expect("friend-3" in map).toBe(false);
    });
  });

  describe("hasNewActivity", () => {
    const older = new Date("2026-06-01T00:00:00Z");
    const newer = new Date("2026-06-02T00:00:00Z");

    it("is false when the friend has never posted", () => {
      expect(hasNewActivity(null, undefined)).toBe(false);
      expect(hasNewActivity(null, older)).toBe(false);
    });

    it("is true when there is no viewed record but the friend has posted", () => {
      expect(hasNewActivity(newer, undefined)).toBe(true);
    });

    it("is false when a record exists but its timestamp is still pending (null)", () => {
      expect(hasNewActivity(newer, null)).toBe(false);
    });

    it("is true when the post is newer than the last view", () => {
      expect(hasNewActivity(newer, older)).toBe(true);
    });

    it("is false when the post is older than or equal to the last view", () => {
      expect(hasNewActivity(older, newer)).toBe(false);
      expect(hasNewActivity(older, older)).toBe(false);
    });
  });
});
