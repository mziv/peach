import React, { useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, Image, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { relativeTime } from "../utils/relativeTime";
import { createDoubleTapDetector } from "../utils/doubleTap";

// A feed photo shown at its original aspect ratio. A remote Image doesn't
// report its dimensions until fetched, so we ask for them up front via
// Image.getSize and derive width/height. Until they're known (or if the
// lookup fails), we fall back to a square so the layout never collapses.
function FeedPhoto({ uri }: { uri: string }) {
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    Image.getSize(
      uri,
      (width, height) => {
        if (active && height > 0) setAspectRatio(width / height);
      },
      () => {
        // Keep the square fallback if dimensions can't be loaded.
      }
    );
    return () => {
      active = false;
    };
  }, [uri]);

  return (
    <Image
      source={{ uri }}
      className="w-full rounded-xl bg-gray-100"
      style={{ aspectRatio: aspectRatio ?? 1 }}
      resizeMode="cover"
    />
  );
}

interface PostItemProps {
  text: string;
  createdAt: Date;
  commentCount: number;
  likeCount: number;
  isLiked: boolean;
  photoURLs?: string[];
  onLikePress: () => void;
  onCommentPress: () => void;
  onDeletePress?: () => void;
  // Fired when the user double-taps the post body. Parents should treat this
  // as a like-only action (idempotent — never unlikes).
  onDoubleTapLike?: () => void;
}

export default function PostItem({
  text,
  createdAt,
  commentCount,
  likeCount,
  isLiked,
  photoURLs,
  onLikePress,
  onCommentPress,
  onDeletePress,
  onDoubleTapLike,
}: PostItemProps) {
  // One detector per card instance, kept stable across renders.
  const doubleTap = useRef(createDoubleTapDetector()).current;

  function handleBodyPress() {
    if (!onDoubleTapLike) return;
    if (doubleTap.tap(Date.now())) {
      onDoubleTapLike();
    }
  }

  return (
    // The body is a Pressable so a double tap anywhere on the text/photos
    // likes the post. The action buttons below are their own touchables and
    // sit outside this Pressable, so single-tapping the heart/comment/delete
    // controls never feeds the double-tap detector.
    <View className="p-4 border-b border-gray-100">
      <Pressable onPress={handleBodyPress}>
        {text ? <Text className="text-base mb-2">{text}</Text> : null}
        {photoURLs && photoURLs.length > 0 ? (
          <View className="mb-2 gap-2 max-w-md">
            {photoURLs.map((url, i) => (
              <FeedPhoto key={i} uri={url} />
            ))}
          </View>
        ) : null}
      </Pressable>
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
