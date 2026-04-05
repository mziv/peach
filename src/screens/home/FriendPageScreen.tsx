import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "expo/node_modules/@expo/vector-icons";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../../config/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { likePost, unlikePost, hasLiked } from "../../services/likes";
import { HomeStackParamList } from "../../navigation/HomeStack";
import { Post } from "../../types";
import Avatar from "../../components/Avatar";
import PostItem from "../../components/PostItem";
import CommentModal from "../../components/CommentModal";

type FriendPageRoute = RouteProp<HomeStackParamList, "FriendPage">;
type FriendPageNav = NativeStackNavigationProp<
  HomeStackParamList,
  "FriendPage"
>;

export function FriendPageScreen() {
  const route = useRoute<FriendPageRoute>();
  const navigation = useNavigation<FriendPageNav>();
  const { user } = useAuth();
  const { friendUid, friendDisplayName, friendUsername } = route.params;
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});
  const [commentModal, setCommentModal] = useState<{
    visible: boolean;
    postOwnerUid: string;
    postId: string;
  }>({ visible: false, postOwnerUid: "", postId: "" });
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    const q = query(
      collection(db, "users", friendUid, "posts"),
      orderBy("createdAt", "asc")
    );
    const unsubscribe = onSnapshot(q, async (snap) => {
      const postList: Post[] = snap.docs.map((d) => ({
        postId: d.id,
        text: d.data().text,
        createdAt: d.data().createdAt?.toDate() ?? new Date(),
        commentCount: d.data().commentCount ?? 0,
        likeCount: d.data().likeCount ?? 0,
      }));
      setPosts(postList);
      setLoading(false);

      // Batch check likes
      if (user) {
        const likeChecks = await Promise.all(
          postList.map((p) => hasLiked(friendUid, p.postId, user.uid))
        );
        const newLikedMap: Record<string, boolean> = {};
        postList.forEach((p, i) => {
          newLikedMap[p.postId] = likeChecks[i];
        });
        setLikedMap(newLikedMap);
      }
    });
    return unsubscribe;
  }, [friendUid, user]);

  async function handleLikeToggle(postId: string) {
    if (!user) return;
    const isLiked = likedMap[postId] ?? false;

    // Optimistic update
    setLikedMap((prev) => ({ ...prev, [postId]: !isLiked }));
    setPosts((prev) =>
      prev.map((p) =>
        p.postId === postId
          ? { ...p, likeCount: p.likeCount + (isLiked ? -1 : 1) }
          : p
      )
    );

    try {
      if (isLiked) {
        await unlikePost(friendUid, postId, user.uid);
      } else {
        await likePost(friendUid, postId, user.uid);
      }
    } catch {
      // Revert on error
      setLikedMap((prev) => ({ ...prev, [postId]: isLiked }));
      setPosts((prev) =>
        prev.map((p) =>
          p.postId === postId
            ? { ...p, likeCount: p.likeCount + (isLiked ? 1 : -1) }
            : p
        )
      );
    }
  }

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
            <Avatar size={32} />
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
      <FlatList
        ref={flatListRef}
        data={posts}
        keyExtractor={(item) => item.postId}
        onContentSizeChange={() => {
          if (posts.length > 0) {
            flatListRef.current?.scrollToEnd({ animated: false });
          }
        }}
        renderItem={({ item }) => (
          <PostItem
            text={item.text}
            createdAt={item.createdAt}
            commentCount={item.commentCount}
            likeCount={item.likeCount}
            isLiked={likedMap[item.postId] ?? false}
            onLikePress={() => handleLikeToggle(item.postId)}
            onCommentPress={() =>
              setCommentModal({
                visible: true,
                postOwnerUid: friendUid,
                postId: item.postId,
              })
            }
          />
        )}
        ListEmptyComponent={
          <View className="flex-1 justify-center items-center p-6">
            <Text className="text-sm text-gray-400">No posts yet.</Text>
          </View>
        }
      />

      {/* Comment Modal */}
      <CommentModal
        visible={commentModal.visible}
        onClose={() =>
          setCommentModal({ ...commentModal, visible: false })
        }
        postOwnerUid={commentModal.postOwnerUid}
        postId={commentModal.postId}
      />
    </View>
  );
}
