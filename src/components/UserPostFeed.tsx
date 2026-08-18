import React from "react";
import { View, Text, FlatList, ActivityIndicator } from "react-native";
import { Post } from "../types";
import PostItem from "./PostItem";

interface UserPostFeedProps {
  posts: Post[];
  likedMap: Record<string, boolean>;
  loadingMore: boolean;
  onLoadOlder: () => void;
  onLikePress: (postId: string) => void;
  onDoubleTapLike: (postId: string) => void;
  onCommentPress: (post: Post) => void;
  // Only owners can delete, so My Page passes this and a friend's page omits it.
  onDeletePress?: (postId: string) => void;
  emptyText: string;
}

// The posts list shared by My Page and a friend's page. The list is inverted so
// the newest post sits at the bottom and the view opens pinned there (chat
// style) with no manual scrolling — and scrolling UP toward older posts is the
// list's normal onEndReached, which pages in the next batch. When there are no
// posts we render right-side up so the empty message isn't flipped upside down.
export default function UserPostFeed({
  posts,
  likedMap,
  loadingMore,
  onLoadOlder,
  onLikePress,
  onDoubleTapLike,
  onCommentPress,
  onDeletePress,
  emptyText,
}: UserPostFeedProps) {
  return (
    <FlatList
      inverted={posts.length > 0}
      data={posts}
      keyExtractor={(item) => item.postId}
      onEndReached={onLoadOlder}
      onEndReachedThreshold={0.5}
      ListFooterComponent={
        loadingMore ? (
          <View className="py-4">
            <ActivityIndicator />
          </View>
        ) : null
      }
      renderItem={({ item }) => (
        <PostItem
          text={item.text}
          createdAt={item.createdAt}
          commentCount={item.commentCount}
          likeCount={item.likeCount}
          isLiked={likedMap[item.postId] ?? false}
          photoURLs={item.photoURLs}
          onLikePress={() => onLikePress(item.postId)}
          onDoubleTapLike={() => onDoubleTapLike(item.postId)}
          onCommentPress={() => onCommentPress(item)}
          onDeletePress={
            onDeletePress ? () => onDeletePress(item.postId) : undefined
          }
        />
      )}
      ListEmptyComponent={
        <View className="flex-1 justify-center items-center p-6">
          <Text className="text-sm text-gray-400">{emptyText}</Text>
        </View>
      }
    />
  );
}
