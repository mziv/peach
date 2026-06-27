import React from "react";
import { Text, Linking } from "react-native";

// A run of text — either plain prose or a tappable URL.
export type Segment =
  | { type: "text"; value: string }
  | { type: "link"; value: string };

// Matches an http(s) URL. We deliberately keep this greedy and then trim
// trailing sentence punctuation below, so "see https://x.com." doesn't treat
// the period as part of the link.
const URL_REGEX = /https?:\/\/[^\s]+/g;

// Punctuation that commonly trails a URL in prose but isn't part of it.
const TRAILING_PUNCTUATION = /[.,)\]}>!?;:'"]+$/;

/**
 * Split a caption into ordered text and link segments. Pure (no React), so the
 * parsing rules can be unit-tested directly. Preserves all surrounding text and
 * whitespace, supports multiple URLs, and trims trailing sentence punctuation
 * that isn't really part of the URL (pushing it back into the following text
 * segment).
 */
export function parseLinks(text: string): Segment[] {
  const segments: Segment[] = [];
  let lastIndex = 0;

  URL_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = URL_REGEX.exec(text)) !== null) {
    let url = match[0];
    let trailing = "";

    // Peel trailing punctuation off the URL. If it leaves a dangling "(" with
    // no matching ")", a single trailing ")" is most likely closing the prose,
    // not the URL — but we keep this simple and just trim the run.
    const punct = url.match(TRAILING_PUNCTUATION);
    if (punct) {
      trailing = punct[0];
      url = url.slice(0, url.length - trailing.length);
    }

    const start = match.index;
    if (start > lastIndex) {
      segments.push({ type: "text", value: text.slice(lastIndex, start) });
    }
    segments.push({ type: "link", value: url });
    if (trailing) {
      segments.push({ type: "text", value: trailing });
    }
    lastIndex = start + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) });
  }

  return segments;
}

function openLink(url: string) {
  // Fail silently — a malformed or unhandleable URL shouldn't crash the feed.
  Linking.openURL(url).catch(() => {});
}

interface LinkifiedTextProps {
  text: string;
  className?: string;
}

/**
 * Renders a caption with any http(s) URLs as tappable, styled links. Non-URL
 * runs render as plain text inside a single container <Text>.
 */
export default function LinkifiedText({ text, className }: LinkifiedTextProps) {
  const segments = parseLinks(text);

  return (
    <Text className={className}>
      {segments.map((segment, i) =>
        segment.type === "link" ? (
          <Text
            key={i}
            className="text-blue-600 underline"
            onPress={() => openLink(segment.value)}
          >
            {segment.value}
          </Text>
        ) : (
          segment.value
        )
      )}
    </Text>
  );
}
