import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { relativeTime } from "../utils/relativeTime";

interface PostItemProps {
  text: string;
  createdAt: Date;
  commentCount: number;
  likeCount: number;
  isLiked: boolean;
  onLikePress: () => void;
  onCommentPress: () => void;
  onDeletePress?: () => void;
}

export default function PostItem({
  text,
  createdAt,
  commentCount,
  likeCount,
  isLiked,
  onLikePress,
  onCommentPress,
  onDeletePress,
}: PostItemProps) {
  return (
    <View className="p-4 border-b border-gray-100">
      <Text className="text-base mb-2">{text}</Text>
      <View className="flex-row items-center gap-4">
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
        <Text className="text-xs text-gray-300">—</Text>
        <Text className="text-xs text-gray-400">
          {relativeTime(createdAt)}
        </Text>
        {onDeletePress && (
          <TouchableOpacity className="ml-auto" onPress={onDeletePress}>
            <Ionicons name="trash-outline" size={18} color="gray" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
