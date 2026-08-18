import React, { useCallback, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import {
  useNavigation,
  useRoute,
  useFocusEffect,
  RouteProp,
} from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../contexts/AuthContext";
import { markFriendViewed } from "../../services/viewedFriends";
import { HomeStackParamList } from "../../navigation/HomeStack";
import { Post } from "../../types";
import Avatar from "../../components/Avatar";
import UserPostFeed from "../../components/UserPostFeed";
import CommentModal from "../../components/CommentModal";
import { useUserPosts } from "../../hooks/useUserPosts";

type FriendPageRoute = RouteProp<HomeStackParamList, "FriendPage">;
type FriendPageNav = NativeStackNavigationProp<
  HomeStackParamList,
  "FriendPage"
>;

export function FriendPageScreen() {
  const route = useRoute<FriendPageRoute>();
  const navigation = useNavigation<FriendPageNav>();
  const { user } = useAuth();
  const { friendUid, friendDisplayName, friendUsername, friendPhotoURL } = route.params;
  const { posts, loading, loadingMore, loadOlder, likedMap, toggleLike, doubleTapLike } =
    useUserPosts(friendUid);
  const [commentModal, setCommentModal] = useState<{
    visible: boolean;
    postOwnerUid: string;
    postId: string;
    postText: string;
  }>({ visible: false, postOwnerUid: "", postId: "", postText: "" });

  useFocusEffect(
    useCallback(() => {
      if (user) {
        markFriendViewed(user.uid, friendUid).catch(() => {
          // A failed write just leaves the dot until the next successful view.
        });
      }
    }, [friendUid, user])
  );

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      {/* Custom header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100 bg-white">
        <View className="flex-row items-center flex-1">
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={24} color="black" />
          </TouchableOpacity>
          <View className="flex-row items-center ml-2">
            <Avatar size={32} displayName={friendDisplayName} photoURL={friendPhotoURL} />
            <View className="ml-2">
              <Text className="text-base font-semibold">
                {friendDisplayName}
              </Text>
              <Text className="text-sm text-gray-400">
                @{friendUsername}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Post feed */}
      <UserPostFeed
        posts={posts}
        likedMap={likedMap}
        loadingMore={loadingMore}
        onLoadOlder={loadOlder}
        onLikePress={toggleLike}
        onDoubleTapLike={doubleTapLike}
        onCommentPress={(post: Post) =>
          setCommentModal({
            visible: true,
            postOwnerUid: friendUid,
            postId: post.postId,
            postText: post.text,
          })
        }
        emptyText="No posts yet."
      />

      {/* Comment Modal */}
      <CommentModal
        visible={commentModal.visible}
        onClose={() =>
          setCommentModal({ ...commentModal, visible: false })
        }
        postOwnerUid={commentModal.postOwnerUid}
        postId={commentModal.postId}
        postText={commentModal.postText}
      />
    </View>
  );
}
