import React from "react";
import { Text, Linking } from "react-native";
import { render, fireEvent } from "@testing-library/react-native";
import LinkifiedText, { parseLinks } from "../../src/components/LinkifiedText";

describe("parseLinks", () => {
  it("returns a single text segment when there is no URL", () => {
    expect(parseLinks("just some plain text")).toEqual([
      { type: "text", value: "just some plain text" },
    ]);
  });

  it("splits a URL out of the middle of a sentence", () => {
    expect(parseLinks("see https://example.com for more")).toEqual([
      { type: "text", value: "see " },
      { type: "link", value: "https://example.com" },
      { type: "text", value: " for more" },
    ]);
  });

  it("handles a URL at the very start", () => {
    expect(parseLinks("https://example.com is great")).toEqual([
      { type: "link", value: "https://example.com" },
      { type: "text", value: " is great" },
    ]);
  });

  it("handles a URL at the very end", () => {
    expect(parseLinks("go to https://example.com")).toEqual([
      { type: "text", value: "go to " },
      { type: "link", value: "https://example.com" },
    ]);
  });

  it("supports multiple URLs in one caption", () => {
    expect(
      parseLinks("a https://one.com b https://two.com c")
    ).toEqual([
      { type: "text", value: "a " },
      { type: "link", value: "https://one.com" },
      { type: "text", value: " b " },
      { type: "link", value: "https://two.com" },
      { type: "text", value: " c" },
    ]);
  });

  it("trims trailing sentence punctuation that is not part of the URL", () => {
    expect(parseLinks("check https://example.com.")).toEqual([
      { type: "text", value: "check " },
      { type: "link", value: "https://example.com" },
      { type: "text", value: "." },
    ]);
    expect(parseLinks("(see https://example.com)")).toEqual([
      { type: "text", value: "(see " },
      { type: "link", value: "https://example.com" },
      { type: "text", value: ")" },
    ]);
    expect(parseLinks("read https://example.com, then go")).toEqual([
      { type: "text", value: "read " },
      { type: "link", value: "https://example.com" },
      { type: "text", value: "," },
      { type: "text", value: " then go" },
    ]);
  });

  it("keeps a path/query intact while trimming trailing punctuation", () => {
    expect(parseLinks("see https://example.com/path?q=1.")).toEqual([
      { type: "text", value: "see " },
      { type: "link", value: "https://example.com/path?q=1" },
      { type: "text", value: "." },
    ]);
  });

  it("supports http as well as https", () => {
    expect(parseLinks("old http://example.com link")).toEqual([
      { type: "text", value: "old " },
      { type: "link", value: "http://example.com" },
      { type: "text", value: " link" },
    ]);
  });

  it("preserves surrounding whitespace and newlines", () => {
    expect(parseLinks("a\nhttps://example.com\nb")).toEqual([
      { type: "text", value: "a\n" },
      { type: "link", value: "https://example.com" },
      { type: "text", value: "\nb" },
    ]);
  });

  it("returns nothing meaningful for empty input", () => {
    expect(parseLinks("")).toEqual([]);
  });
});

describe("LinkifiedText", () => {
  afterEach(() => jest.restoreAllMocks());

  it("opens the tapped URL via Linking.openURL", () => {
    const spy = jest
      .spyOn(Linking, "openURL")
      .mockResolvedValue(undefined as never);

    const { getByText } = render(
      <LinkifiedText text="visit https://example.com now" />
    );

    fireEvent.press(getByText("https://example.com"));
    expect(spy).toHaveBeenCalledWith("https://example.com");
  });

  it("fails silently when Linking.openURL rejects", () => {
    jest
      .spyOn(Linking, "openURL")
      .mockRejectedValue(new Error("cannot open"));

    const { getByText } = render(
      <LinkifiedText text="visit https://example.com" />
    );

    // Should not throw when pressed.
    expect(() => fireEvent.press(getByText("https://example.com"))).not.toThrow();
  });

  it("renders plain text with no link when there is no URL", () => {
    const { getByText, UNSAFE_getAllByType } = render(
      <LinkifiedText text="no links here" />
    );
    expect(getByText("no links here")).toBeTruthy();
    // Only the container Text (and its single child string) — no nested
    // pressable link Text nodes.
    expect(UNSAFE_getAllByType(Text).length).toBe(1);
  });
});
