import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Notification } from "../types";
import { relativeTime } from "../utils/relativeTime";
import Avatar from "./Avatar";

interface ActivityRowProps {
  notification: Notification;
  /** Omit to render a non-interactive row (e.g. likes, which have nowhere useful to go). */
  onPress?: () => void;
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
  // Comment text is darker than a like's post preview so the two are visually distinct.
  const previewColor =
    notification.type === "comment" ? "text-gray-800" : "text-gray-400";

  const content = (
    <>
      <Avatar
        size={40}
        displayName={notification.actorDisplayName}
        photoURL={notification.actorPhotoURL}
      />
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
          <Text className={`text-sm ${previewColor} mt-1`} numberOfLines={1}>
            {preview}
          </Text>
        ) : null}
      </View>
    </>
  );

  const className = "flex-row px-4 py-3 border-b border-gray-100";

  if (!onPress) {
    return <View className={className}>{content}</View>;
  }

  return (
    <TouchableOpacity className={className} onPress={onPress}>
      {content}
    </TouchableOpacity>
  );
}
