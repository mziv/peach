import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Avatar from "./Avatar";
import { relativeTime } from "../utils/relativeTime";

interface UserPreviewProps {
  displayName: string;
  username: string;
  previewText: string;
  timestamp?: Date | null;
  hasNewActivity?: boolean;
  onPress: () => void;
}

export default function UserPreview({
  displayName,
  username,
  previewText,
  timestamp,
  hasNewActivity = false,
  onPress,
}: UserPreviewProps) {
  return (
    <TouchableOpacity
      className="flex-row items-center p-4 border-b border-gray-100"
      onPress={onPress}
    >
      <Avatar size={40} displayName={displayName} />
      <View className="flex-1 ml-3">
        <Text className="text-base font-semibold">{displayName}</Text>
        <View className="flex-row items-center">
          {hasNewActivity && (
            <View
              testID="new-activity-dot"
              className="w-2 h-2 rounded-full bg-green mr-1.5"
            />
          )}
          <Text className="text-sm text-gray-500 flex-1" numberOfLines={1}>
            {previewText}
          </Text>
        </View>
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
