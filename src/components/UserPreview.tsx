import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "expo/node_modules/@expo/vector-icons";
import Avatar from "./Avatar";
import { relativeTime } from "../utils/relativeTime";

interface UserPreviewProps {
  displayName: string;
  username: string;
  previewText: string;
  timestamp?: Date | null;
  onPress: () => void;
}

export default function UserPreview({
  displayName,
  username,
  previewText,
  timestamp,
  onPress,
}: UserPreviewProps) {
  return (
    <TouchableOpacity
      className="flex-row items-center p-4 border-b border-gray-100"
      onPress={onPress}
    >
      <Avatar size={40} />
      <View className="flex-1 ml-3">
        <Text className="text-base font-semibold">{displayName}</Text>
        <Text className="text-sm text-gray-500" numberOfLines={1}>
          {previewText}
        </Text>
      </View>
      {timestamp && (
        <Text className="text-xs text-gray-400 mr-1">
          {relativeTime(timestamp)}
        </Text>
      )}
      <Ionicons name="chevron-forward" size={20} color="gray" />
    </TouchableOpacity>
  );
}
