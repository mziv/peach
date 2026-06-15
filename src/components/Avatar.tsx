import React from "react";
import { View, Text } from "react-native";
import { getInitials, avatarColor } from "../utils/avatar";

interface AvatarProps {
  /** Name to derive the initials and background color from. */
  displayName?: string;
  /** Avatar diameter in pixels. */
  size?: number;
  /**
   * Profile photo URL. Wired through now but not yet rendered — photo upload
   * lands in Tier 3, at which point this overrides the initials fallback.
   */
  photoURL?: string;
}

export default function Avatar({ displayName, size = 40 }: AvatarProps) {
  const initials = getInitials(displayName ?? "");

  return (
    <View
      className="rounded-full items-center justify-center"
      style={{
        width: size,
        height: size,
        backgroundColor: avatarColor(displayName ?? ""),
      }}
    >
      <Text
        className="text-white font-semibold"
        style={{ fontSize: size * 0.4 }}
      >
        {initials}
      </Text>
    </View>
  );
}
