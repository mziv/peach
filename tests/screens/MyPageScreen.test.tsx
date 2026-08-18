import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";

jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  orderBy: jest.fn(),
  query: jest.fn(),
  limit: jest.fn(),
  startAfter: jest.fn(),
  getDocs: jest.fn().mockResolvedValue({ docs: [] }),
  // Deliver an empty post list immediately so the screen finishes loading.
  onSnapshot: jest.fn((_q: any, cb: any) => {
    cb({ docs: [], metadata: { fromCache: false } });
    return jest.fn();
  }),
}));

jest.mock("../../src/config/firebase", () => ({ db: {} }));

jest.mock("../../src/contexts/AuthContext", () => {
  const user = { uid: "me", username: "me", displayName: "Me", photoURL: null };
  return { useAuth: () => ({ user }) };
});

jest.mock("../../src/services/posts", () => ({
  createPost: jest.fn().mockResolvedValue("post1"),
  deletePost: jest.fn(),
  uploadPostPhotos: jest.fn().mockResolvedValue([]),
  updatePost: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../src/services/likes", () => ({
  likePost: jest.fn(),
  unlikePost: jest.fn(),
  hasLiked: jest.fn().mockResolvedValue(false),
}));

jest.mock("../../src/hooks/useUnreadActivity", () => ({
  useUnreadActivity: () => false,
}));

jest.mock("expo-image-picker", () => ({
  launchImageLibraryAsync: jest
    .fn()
    .mockResolvedValue({ canceled: true, assets: [] }),
  requestMediaLibraryPermissionsAsync: jest
    .fn()
    .mockResolvedValue({ granted: true }),
  MediaTypeOptions: { Images: "Images" },
}));

const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
  useRoute: () => ({ params: {} }),
}));

jest.mock("../../src/components/Avatar", () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

jest.mock("../../src/components/PostItem", () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

jest.mock("../../src/components/CommentModal", () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return { Ionicons: ({ name }: { name: string }) => <Text>{name}</Text> };
});

import { MyPageScreen } from "../../src/screens/mypage/MyPageScreen";
import { createPost } from "../../src/services/posts";

describe("MyPageScreen enter-to-submit", () => {
  beforeEach(() => (createPost as jest.Mock).mockClear());

  it("posts when the composer input is submitted", async () => {
    const { getByPlaceholderText } = render(<MyPageScreen />);
    const input = await waitFor(() =>
      getByPlaceholderText("write something...")
    );

    fireEvent.changeText(input, "hello world");
    fireEvent(input, "submitEditing");

    await waitFor(() =>
      expect(createPost).toHaveBeenCalledWith("me", "hello world")
    );
  });

  it("does nothing when submitted with empty text and no photos", async () => {
    const { getByPlaceholderText } = render(<MyPageScreen />);
    const input = await waitFor(() =>
      getByPlaceholderText("write something...")
    );

    fireEvent(input, "submitEditing");
    expect(createPost).not.toHaveBeenCalled();
  });
});
