import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";

jest.mock("firebase/firestore", () => ({
  doc: jest.fn(),
  getDoc: jest.fn().mockResolvedValue({ exists: () => false, data: () => null }),
}));

jest.mock("../../src/config/firebase", () => ({ db: {} }));

jest.mock("../../src/contexts/AuthContext", () => {
  // Stable reference: loadData depends on `user`, so a fresh object each render
  // would retrigger the focus effect every render.
  const user = { uid: "me", username: "me", displayName: "Me" };
  return { useAuth: () => ({ user }) };
});

jest.mock("../../src/services/friendships", () => ({
  getFriendships: jest.fn().mockResolvedValue([]),
}));

jest.mock("../../src/services/viewedFriends", () => ({
  getViewedMap: jest.fn().mockResolvedValue({}),
  hasNewActivity: jest.fn(() => false),
}));

// Drive the unread dot on so we can assert the bell renders it.
jest.mock("../../src/hooks/useUnreadActivity", () => ({
  useUnreadActivity: () => true,
}));

jest.mock("../../src/hooks/useWebPullToRefresh", () => ({
  useWebPullToRefresh: jest.fn(),
}));

const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  // Run the focus callback immediately so loadData resolves and the screen
  // leaves its loading state.
  useFocusEffect: (cb: () => void) => cb(),
}));

// Stub UserPreview to avoid pulling the NativeWind transform through it.
jest.mock("../../src/components/UserPreview", () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

import { HomeScreen } from "../../src/screens/home/HomeScreen";

describe("HomeScreen header", () => {
  beforeEach(() => mockNavigate.mockClear());

  it("renders the title and notification bell", async () => {
    const { getByText, UNSAFE_getAllByType } = render(<HomeScreen />);

    // The peach app title confirms the header rendered.
    await waitFor(() => expect(getByText("peach")).toBeTruthy());

    const { Ionicons } = require("@expo/vector-icons");
    const bell = UNSAFE_getAllByType(Ionicons).find(
      (node: any) => node.props.name === "notifications-outline"
    );
    expect(bell).toBeTruthy();
  });

  it("navigates to Activity when the bell is pressed", async () => {
    const { getByText, UNSAFE_getAllByType } = render(<HomeScreen />);
    await waitFor(() => expect(getByText("peach")).toBeTruthy());

    const { TouchableOpacity } = require("react-native");
    const touchables = UNSAFE_getAllByType(TouchableOpacity);
    const bellTouchable = touchables[0];
    fireEvent.press(bellTouchable);
    expect(mockNavigate).toHaveBeenCalledWith("Activity");
  });
});
