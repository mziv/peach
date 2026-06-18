import React from "react";
import { Image } from "react-native";
import { render } from "@testing-library/react-native";
import Avatar from "../../src/components/Avatar";
import { avatarColor } from "../../src/utils/avatar";

describe("Avatar", () => {
  it("renders the initials derived from displayName", () => {
    const { getByText } = render(<Avatar displayName="Maya Ziv" />);
    expect(getByText("MZ")).toBeTruthy();
  });

  it("falls back to '?' when no displayName is given", () => {
    const { getByText } = render(<Avatar />);
    expect(getByText("?")).toBeTruthy();
  });

  it("uses a deterministic background color for the name", () => {
    const { getByText } = render(<Avatar displayName="Maya Ziv" />);
    // Walk up from the initials text to the circular container that carries
    // the background color (NativeWind inserts a wrapper in between).
    let node = getByText("MZ").parent;
    let backgroundColor: string | undefined;
    while (node && !backgroundColor) {
      const style = Array.isArray(node.props.style)
        ? Object.assign({}, ...node.props.style)
        : node.props.style;
      backgroundColor = style?.backgroundColor;
      node = node.parent;
    }
    expect(backgroundColor).toBe(avatarColor("Maya Ziv"));
  });

  it("renders the photo image when photoURL is provided", () => {
    const photoURL = "https://example.com/p.jpg";
    const { UNSAFE_getByType, queryByText } = render(
      <Avatar displayName="Maya Ziv" photoURL={photoURL} />
    );
    const img = UNSAFE_getByType(Image);
    expect(img.props.source).toEqual({ uri: photoURL });
    // Initials must NOT render once a photo is present.
    expect(queryByText("MZ")).toBeNull();
  });

  it("renders initials when no photoURL is provided", () => {
    const { getByText } = render(<Avatar displayName="Maya Ziv" />);
    expect(getByText("MZ")).toBeTruthy();
  });
});
