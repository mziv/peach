import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "expo/node_modules/@expo/vector-icons";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../../config/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { createPost } from "../../services/posts";
import { logOut } from "../../services/auth";
import { likePost, unlikePost, hasLiked } from "../../services/likes";
import { HomeStackParamList } from "../../navigation/HomeStack";
import { Post } from "../../types";
import Avatar from "../../components/Avatar";
import PostItem from "../../components/PostItem";
import CommentModal from "../../components/CommentModal";

type MyPageNav = NativeStackNavigationProp<HomeStackParamList, "MyPage">;

export function MyPageScreen() {
  const navigation = useNavigation<MyPageNav>();
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPostText, setNewPostText] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});
  const [commentModal, setCommentModal] = useState<{
    visible: boolean;
    postOwnerUid: string;
    postId: string;
  }>({ visible: false, postOwnerUid: "", postId: "" });
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "users", user.uid, "posts"),
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
      const likeChecks = await Promise.all(
        postList.map((p) => hasLiked(user.uid, p.postId, user.uid))
      );
      const newLikedMap: Record<string, boolean> = {};
      postList.forEach((p, i) => {
        newLikedMap[p.postId] = likeChecks[i];
      });
      setLikedMap(newLikedMap);
    });
    return unsubscribe;
  }, [user]);

  async function handlePost() {
    if (!newPostText.trim() || !user) return;
    setPosting(true);
    try {
      await createPost(user.uid, newPostText.trim());
      setNewPostText("");
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setPosting(false);
    }
  }

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
        await unlikePost(user.uid, postId, user.uid);
      } else {
        await likePost(user.uid, postId, user.uid);
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

  function handleLogout() {
    Alert.alert("Settings", "What would you like to do?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          try {
            await logOut();
          } catch (err: any) {
            Alert.alert("Error", err.message);
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
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
                {user?.displayName}
              </Text>
              <Text className="text-sm text-gray-400">@{user?.username}</Text>
            </View>
          </View>
        </View>
        <View className="flex-row items-center gap-3">
          <TouchableOpacity
            onPress={() => Alert.alert("Coming soon", "Activity log is coming soon!")}
          >
            <Ionicons name="notifications-outline" size={22} color="black" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout}>
            <Ionicons name="settings-outline" size={22} color="black" />
          </TouchableOpacity>
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
                postOwnerUid: user!.uid,
                postId: item.postId,
              })
            }
          />
        )}
        ListEmptyComponent={
          <View className="flex-1 justify-center items-center p-6">
            <Text className="text-sm text-gray-400">
              No posts yet. Write your first one!
            </Text>
          </View>
        }
      />

      {/* Composer */}
      <View className="flex-row items-center p-3 border-t border-gray-100 bg-white">
        <TextInput
          className="flex-1 bg-gray-50 rounded-full px-4 py-2 text-sm mr-2"
          placeholder="write something..."
          value={newPostText}
          onChangeText={setNewPostText}
          multiline
        />
        <TouchableOpacity
          className={`rounded-full px-5 py-2 ${
            newPostText.trim() ? "bg-peach" : "bg-gray-300"
          }`}
          onPress={handlePost}
          disabled={posting || !newPostText.trim()}
        >
          <Text className="text-white font-semibold text-sm">
            {posting ? "..." : "Post"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Comment Modal */}
      <CommentModal
        visible={commentModal.visible}
        onClose={() =>
          setCommentModal({ ...commentModal, visible: false })
        }
        postOwnerUid={commentModal.postOwnerUid}
        postId={commentModal.postId}
      />
    </KeyboardAvoidingView>
  );
}
