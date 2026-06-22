import React from "react";
import { render, waitFor } from "@testing-library/react-native";

// onSnapshot immediately emits a single friend post that has photos. The
// returned value is the unsubscribe fn the screen calls on cleanup.
const FRIEND_POST = {
  id: "post1",
  data: () => ({
    text: "at the beach",
    createdAt: { toDate: () => new Date("2026-06-01T00:00:00Z") },
    commentCount: 0,
    likeCount: 0,
    photoURLs: ["https://img/beach.jpg"],
  }),
};

jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  query: jest.fn(),
  orderBy: jest.fn(),
  onSnapshot: jest.fn((_q, cb) => {
    cb({ docs: [FRIEND_POST] });
    return jest.fn();
  }),
}));

jest.mock("../../src/config/firebase", () => ({ db: {} }));

jest.mock("../../src/contexts/AuthContext", () => {
  // Stable reference: the screen effect depends on `user`, so a fresh object
  // each render would retrigger onSnapshot every render and loop forever.
  const user = { uid: "me", username: "me", displayName: "Me" };
  return { useAuth: () => ({ user }) };
});

jest.mock("../../src/services/likes", () => ({
  hasLiked: jest.fn().mockResolvedValue(false),
  likePost: jest.fn(),
  unlikePost: jest.fn(),
}));

jest.mock("../../src/services/viewedFriends", () => ({
  markFriendViewed: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@react-navigation/native", () => ({
  useRoute: () => ({
    params: {
      friendUid: "friend1",
      friendDisplayName: "Claire",
      friendUsername: "claire",
      friendPhotoURL: undefined,
    },
  }),
  useNavigation: () => ({ goBack: jest.fn() }),
  useFocusEffect: jest.fn(),
}));

// Stub PostItem with a jest.fn so we can inspect the props the screen hands it.
// The bug under test is that the screen never forwards a friend post's photos
// to PostItem, so this boundary is exactly what we assert. Rendering a real RN
// host component here would pull in the NativeWind babel transform, which isn't
// allowed inside a jest.mock factory — returning null sidesteps that.
jest.mock("../../src/components/PostItem", () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

import { FriendPageScreen } from "../../src/screens/home/FriendPageScreen";
import PostItem from "../../src/components/PostItem";

describe("FriendPageScreen", () => {
  it("forwards a friend's post photos to PostItem", async () => {
    render(<FriendPageScreen />);
    await waitFor(() => {
      const calls = (PostItem as jest.Mock).mock.calls;
      const photoURLs = calls.map((c) => c[0]?.photoURLs);
      expect(photoURLs).toContainEqual(["https://img/beach.jpg"]);
    });
  });
});
