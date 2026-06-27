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

// Render Ionicons as plain Text of its `name` so the icons are queryable.
// Under jest-expo the real Ionicons doesn't render as a node whose type
// matches the imported reference, so getAllByType(Ionicons) finds nothing.
jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return { Ionicons: ({ name }: { name: string }) => <Text>{name}</Text> };
});

import { HomeScreen } from "../../src/screens/home/HomeScreen";

describe("HomeScreen header", () => {
  beforeEach(() => mockNavigate.mockClear());

  it("renders the logo, notification bell, and settings", async () => {
    const { getByText, getByLabelText } = render(<HomeScreen />);

    // The peach logo plus both header icons confirm the header rendered.
    await waitFor(() => expect(getByLabelText("peach")).toBeTruthy());
    expect(getByText("notifications-outline")).toBeTruthy();
    expect(getByText("settings-outline")).toBeTruthy();
  });

  it("navigates to Activity when the bell is pressed", async () => {
    const { getByLabelText, UNSAFE_getAllByType } = render(<HomeScreen />);
    await waitFor(() => expect(getByLabelText("peach")).toBeTruthy());

    const { TouchableOpacity } = require("react-native");
    const touchables = UNSAFE_getAllByType(TouchableOpacity);
    const bellTouchable = touchables[0];
    fireEvent.press(bellTouchable);
    expect(mockNavigate).toHaveBeenCalledWith("Activity");
  });
});
