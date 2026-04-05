import React from "react";
import { View } from "react-native";

interface AvatarProps {
  size?: number;
}

export default function Avatar({ size = 40 }: AvatarProps) {
  return (
    <View
      className="rounded-full bg-gray-300"
      style={{ width: size, height: size }}
    />
  );
}
