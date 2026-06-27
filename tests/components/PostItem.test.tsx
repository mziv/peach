import React from "react";
import { Image } from "react-native";
import { render, waitFor } from "@testing-library/react-native";
import PostItem from "../../src/components/PostItem";

const baseProps = {
  text: "hello",
  createdAt: new Date(),
  commentCount: 0,
  likeCount: 0,
  isLiked: false,
  onLikePress: () => {},
  onCommentPress: () => {},
};

// NativeWind may flatten className into a style array; read aspectRatio
// whichever way the style prop arrives.
function styleOf(node: { props: { style?: unknown } }) {
  const style = node.props.style;
  return Array.isArray(style) ? Object.assign({}, ...style) : style ?? {};
}

describe("PostItem photos", () => {
  afterEach(() => jest.restoreAllMocks());

  it("renders each photo at its natural aspect ratio", async () => {
    jest
      .spyOn(Image, "getSize")
      .mockImplementation((_uri, success) => success(1200, 800)); // 3:2

    const { UNSAFE_getAllByType } = render(
      <PostItem {...baseProps} photoURLs={["https://img/a.jpg"]} />
    );

    await waitFor(() => {
      const img = UNSAFE_getAllByType(Image)[0];
      expect(styleOf(img).aspectRatio).toBeCloseTo(1.5);
    });
  });

  it("falls back to a square while dimensions are still loading", () => {
    // Never resolve — dimensions stay unknown.
    jest.spyOn(Image, "getSize").mockImplementation(() => {});

    const { UNSAFE_getAllByType } = render(
      <PostItem {...baseProps} photoURLs={["https://img/a.jpg"]} />
    );

    const img = UNSAFE_getAllByType(Image)[0];
    expect(styleOf(img).aspectRatio).toBe(1);
  });

  it("gives each photo in a multi-photo post its own aspect ratio", async () => {
    const sizes: Record<string, [number, number]> = {
      "https://img/wide.jpg": [1600, 800], // 2:1
      "https://img/tall.jpg": [800, 1600], // 1:2
    };
    jest
      .spyOn(Image, "getSize")
      .mockImplementation((uri, success) => success(...sizes[uri]));

    const { UNSAFE_getAllByType } = render(
      <PostItem
        {...baseProps}
        photoURLs={["https://img/wide.jpg", "https://img/tall.jpg"]}
      />
    );

    await waitFor(() => {
      const imgs = UNSAFE_getAllByType(Image);
      expect(styleOf(imgs[0]).aspectRatio).toBeCloseTo(2);
      expect(styleOf(imgs[1]).aspectRatio).toBeCloseTo(0.5);
    });
  });
});
