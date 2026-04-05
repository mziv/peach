import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "expo/node_modules/@expo/vector-icons";
import { relativeTime } from "../utils/relativeTime";

interface PostItemProps {
  text: string;
  createdAt: Date;
  commentCount: number;
  likeCount: number;
  isLiked: boolean;
  onLikePress: () => void;
  onCommentPress: () => void;
}

export default function PostItem({
  text,
  createdAt,
  commentCount,
  likeCount,
  isLiked,
  onLikePress,
  onCommentPress,
}: PostItemProps) {
  return (
    <View className="p-4 border-b border-gray-100">
      <Text className="text-base">{text}</Text>
      <Text className="text-xs text-gray-400 mt-1">
        {createdAt.toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
      </Text>
      <View className="flex-row items-center gap-4 mt-2">
        <TouchableOpacity
          className="flex-row items-center gap-1"
          onPress={onLikePress}
        >
          <Ionicons
            name={isLiked ? "heart" : "heart-outline"}
            size={18}
            color={isLiked ? "#ef4444" : "gray"}
          />
          <Text className="text-xs text-gray-500">{likeCount}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-row items-center gap-1"
          onPress={onCommentPress}
        >
          <Ionicons name="chatbubble-outline" size={18} color="gray" />
          <Text className="text-xs text-gray-500">{commentCount}</Text>
        </TouchableOpacity>
        <Text className="text-xs text-gray-400 ml-auto">
          {relativeTime(createdAt)}
        </Text>
      </View>
    </View>
  );
}
