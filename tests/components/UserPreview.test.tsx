import React from "react";
import { render } from "@testing-library/react-native";
import UserPreview from "../../src/components/UserPreview";

describe("UserPreview", () => {
  const baseProps = {
    displayName: "Claire",
    username: "claire",
    previewText: "63 steps today",
    onPress: () => {},
  };

  it("shows the new-activity dot when hasNewActivity is true", () => {
    const { getByTestId } = render(
      <UserPreview {...baseProps} hasNewActivity />
    );
    expect(getByTestId("new-activity-dot")).toBeTruthy();
  });

  it("hides the dot when hasNewActivity is false or omitted", () => {
    const { queryByTestId } = render(<UserPreview {...baseProps} />);
    expect(queryByTestId("new-activity-dot")).toBeNull();
  });
});
