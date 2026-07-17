import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";

jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  orderBy: jest.fn(),
  query: jest.fn(),
  // Deliver an empty comment list immediately so the modal finishes loading.
  onSnapshot: jest.fn((_q: any, cb: any) => {
    cb({ docs: [] });
    return jest.fn();
  }),
}));

jest.mock("../../src/config/firebase", () => ({ db: {} }));

jest.mock("../../src/contexts/AuthContext", () => {
  const user = { uid: "me", username: "me", displayName: "Me", photoURL: null };
  return { useAuth: () => ({ user }) };
});

jest.mock("../../src/services/comments", () => ({
  addComment: jest.fn().mockResolvedValue(undefined),
  deleteComment: jest.fn(),
}));

jest.mock("../../src/services/users", () => ({
  getUserByUid: jest.fn().mockResolvedValue(null),
}));

jest.mock("../../src/components/Avatar", () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return { Ionicons: ({ name }: { name: string }) => <Text>{name}</Text> };
});

import CommentModal from "../../src/components/CommentModal";
import { addComment } from "../../src/services/comments";

function renderModal() {
  return render(
    <CommentModal
      visible
      onClose={jest.fn()}
      postOwnerUid="owner"
      postId="p1"
      postText="original post"
    />
  );
}

describe("CommentModal enter-to-submit", () => {
  beforeEach(() => (addComment as jest.Mock).mockClear());

  it("sends the comment when the input is submitted", async () => {
    const { getByPlaceholderText } = renderModal();
    const input = getByPlaceholderText("Say something nice");

    fireEvent.changeText(input, "nice post!");
    fireEvent(input, "submitEditing");

    await waitFor(() =>
      expect(addComment).toHaveBeenCalledWith(
        "owner",
        "p1",
        "me",
        "me",
        "Me",
        null,
        "nice post!",
        "original post"
      )
    );
  });

  it("does nothing when submitted with empty text", async () => {
    const { getByPlaceholderText } = renderModal();
    fireEvent(getByPlaceholderText("Say something nice"), "submitEditing");
    expect(addComment).not.toHaveBeenCalled();
  });
});
