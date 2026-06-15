import { onSnapshot, updateDoc } from "firebase/firestore";
import {
  likeNotifId,
  addCommentNotification,
  addLikeNotification,
  removeLikeNotification,
  markActivityRead,
  subscribeNotifications,
} from "../../src/services/notifications";

jest.mock("firebase/firestore", () => ({
  collection: jest.fn(() => "mock-collection-ref"),
  doc: jest.fn(() => "mock-doc-ref"),
  query: jest.fn(() => "mock-query"),
  orderBy: jest.fn(),
  onSnapshot: jest.fn(),
  updateDoc: jest.fn(),
  serverTimestamp: jest.fn(() => "mock-timestamp"),
}));

jest.mock("../../src/config/firebase", () => ({ db: {} }));

describe("notifications service", () => {
  beforeEach(() => jest.clearAllMocks());

  it("likeNotifId is deterministic", () => {
    expect(likeNotifId("post-1", "actor-1")).toBe("like_post-1_actor-1");
  });

  it("addCommentNotification sets a comment notif on the batch", () => {
    const batch = { set: jest.fn(), delete: jest.fn() };
    addCommentNotification(batch as any, "owner-1", {
      actorUid: "actor-1",
      actorUsername: "bob",
      actorDisplayName: "Bob",
      postId: "post-1",
      postOwnerUid: "owner-1",
      postTextPreview: "hello",
      commentText: "nice!",
    });
    expect(batch.set).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: "comment",
        actorUid: "actor-1",
        commentText: "nice!",
        createdAt: "mock-timestamp",
      })
    );
  });

  it("addLikeNotification sets a like notif on the batch", () => {
    const batch = { set: jest.fn(), delete: jest.fn() };
    addLikeNotification(batch as any, "owner-1", {
      actorUid: "actor-1",
      actorUsername: "bob",
      actorDisplayName: "Bob",
      postId: "post-1",
      postOwnerUid: "owner-1",
      postTextPreview: "hello",
    });
    expect(batch.set).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: "like", actorUid: "actor-1" })
    );
  });

  it("removeLikeNotification deletes from the batch", () => {
    const batch = { set: jest.fn(), delete: jest.fn() };
    removeLikeNotification(batch as any, "owner-1", "post-1", "actor-1");
    expect(batch.delete).toHaveBeenCalled();
  });

  it("markActivityRead updates the user doc with a server timestamp", async () => {
    (updateDoc as jest.Mock).mockResolvedValue(undefined);
    await markActivityRead("uid-1");
    expect(updateDoc).toHaveBeenCalledWith(expect.anything(), {
      activityLastReadAt: "mock-timestamp",
    });
  });

  it("subscribeNotifications maps snapshot docs newest-first", () => {
    const cb = jest.fn();
    (onSnapshot as jest.Mock).mockImplementation((_q, handler) => {
      handler({
        docs: [
          {
            id: "n-1",
            data: () => ({
              type: "like",
              actorUid: "a",
              actorUsername: "u",
              actorDisplayName: "U",
              postId: "p",
              postOwnerUid: "o",
              postTextPreview: "x",
              createdAt: { toDate: () => new Date("2026-06-01") },
            }),
          },
        ],
      });
      return () => undefined;
    });
    const unsub = subscribeNotifications("uid-1", cb);
    expect(cb).toHaveBeenCalledWith([
      expect.objectContaining({ notifId: "n-1", type: "like" }),
    ]);
    expect(typeof unsub).toBe("function");
  });
});
