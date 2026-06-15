import React from "react";
import { View, Text, Image } from "react-native";
import { getInitials, avatarColor } from "../utils/avatar";

interface AvatarProps {
  /** Name to derive the initials and background color from. */
  displayName?: string;
  /** Avatar diameter in pixels. */
  size?: number;
  /**
   * Profile photo URL. When set, renders the photo clipped to a circle;
   * falls back to the initials avatar when absent.
   */
  photoURL?: string;
}

export default function Avatar({ displayName, size = 40, photoURL }: AvatarProps) {
  if (photoURL) {
    return (
      <Image
        source={{ uri: photoURL }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }

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
