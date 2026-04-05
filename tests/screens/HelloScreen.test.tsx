import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { HelloScreen } from "../../src/screens/HelloScreen";

describe("HelloScreen", () => {
  it("shows the initial greeting", () => {
    const { getByText } = render(<HelloScreen />);
    expect(getByText("Hello Peach!")).toBeTruthy();
  });

  it("changes text when button is tapped", () => {
    const { getByText } = render(<HelloScreen />);
    fireEvent.press(getByText("Tap me"));
    expect(getByText("You tapped the button!")).toBeTruthy();
  });
});
