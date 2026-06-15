import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Notification } from "../types";
import { relativeTime } from "../utils/relativeTime";
import Avatar from "./Avatar";

interface ActivityRowProps {
  notification: Notification;
  onPress: () => void;
}

export default function ActivityRow({ notification, onPress }: ActivityRowProps) {
  const verb =
    notification.type === "comment"
      ? "commented on your post"
      : "liked your post";
  const preview =
    notification.type === "comment"
      ? notification.commentText ?? ""
      : notification.postTextPreview;

  return (
    <TouchableOpacity
      className="flex-row px-4 py-3 border-b border-gray-100"
      onPress={onPress}
    >
      <Avatar size={40} displayName={notification.actorDisplayName} />
      <View className="ml-3 flex-1">
        <View className="flex-row items-center justify-between">
          <View className="flex-row flex-1 flex-wrap">
            <Text className="text-sm font-semibold">
              {notification.actorDisplayName}
            </Text>
            <Text className="text-sm"> </Text>
            <Text className="text-sm">{verb}</Text>
          </View>
          <Text className="text-xs text-gray-400 ml-2">
            {relativeTime(notification.createdAt)}
          </Text>
        </View>
        {preview ? (
          <Text className="text-sm text-gray-400 mt-1" numberOfLines={1}>
            {preview}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}
