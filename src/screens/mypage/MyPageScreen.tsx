import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "../../contexts/AuthContext";
import { createPost, deletePost, uploadPostPhotos, updatePost } from "../../services/posts";
import { confirmDestructive, notify } from "../../utils/dialog";
import { HomeStackParamList } from "../../navigation/HomeStack";
import { useUnreadActivity } from "../../hooks/useUnreadActivity";
import { useUserPosts } from "../../hooks/useUserPosts";
import { Post } from "../../types";
import Avatar from "../../components/Avatar";
import UserPostFeed from "../../components/UserPostFeed";
import CommentModal from "../../components/CommentModal";

type MyPageNav = NativeStackNavigationProp<HomeStackParamList, "MyPage">;

export function MyPageScreen() {
  const navigation = useNavigation<MyPageNav>();
  const { user } = useAuth();
  const route = useRoute<RouteProp<HomeStackParamList, "MyPage">>();
  const hasUnread = useUnreadActivity(user?.uid);
  const { posts, loading, loadingMore, loadOlder, likedMap, toggleLike, doubleTapLike } =
    useUserPosts(user?.uid);
  const [newPostText, setNewPostText] = useState("");
  const [posting, setPosting] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<
    { uri: string; width?: number; height?: number }[]
  >([]);
  const pickerActiveRef = useRef(false);
  const [commentModal, setCommentModal] = useState<{
    visible: boolean;
    postOwnerUid: string;
    postId: string;
    postText: string;
  }>({ visible: false, postOwnerUid: "", postId: "", postText: "" });

  useEffect(() => {
    if (!user) return;
    const postId = route.params?.openCommentPostId;
    if (!postId || posts.length === 0) return;
    // Only posts already paged into the feed can be opened this way; a deep
    // link to a much older post won't match until it's scrolled into view.
    const post = posts.find((p) => p.postId === postId);
    if (!post) return;
    setCommentModal({
      visible: true,
      postOwnerUid: user.uid,
      postId: post.postId,
      postText: post.text,
    });
    navigation.setParams({ openCommentPostId: undefined });
  }, [route.params?.openCommentPostId, posts]);

  async function pickPhotos() {
    if (pickerActiveRef.current) return;
    const remaining = 4 - selectedPhotos.length;
    if (remaining <= 0) return;
    pickerActiveRef.current = true;
    try {
      // Web grants media-library permission automatically; requesting it there
      // would push the file dialog outside the user-gesture window.
      if (Platform.OS !== "web") {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          notify("Permission needed", "Allow photo access to add photos.");
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: remaining,
        quality: 0.7,
      });
      if (result.canceled) return;
      // Keep each asset's dimensions so the uploader can downscale without
      // upscaling images that are already small.
      const picked = result.assets.map((a) => ({
        uri: a.uri,
        width: a.width,
        height: a.height,
      }));
      setSelectedPhotos((prev) => [...prev, ...picked].slice(0, 4));
    } finally {
      pickerActiveRef.current = false;
    }
  }

  async function handlePost() {
    const text = newPostText.trim();
    const photos = selectedPhotos;
    // Enter bypasses the Post button's `disabled`, so guard re-entry here too.
    if (posting || (!text && photos.length === 0) || !user) return;
    setPosting(true);
    try {
      const postId = await createPost(user.uid, text);
      // Clear the composer immediately; uploads continue in the background.
      setNewPostText("");
      setSelectedPhotos([]);
      if (photos.length > 0) {
        const urls = await uploadPostPhotos(user.uid, postId, photos);
        await updatePost(user.uid, postId, { photoURLs: urls });
      }
    } catch (err: any) {
      notify(
        "Upload issue",
        "Your post was saved, but the photos couldn't be uploaded. You can delete the post and try again."
      );
    } finally {
      setPosting(false);
    }
  }

  async function handleDeletePost(postId: string) {
    if (!user) return;
    const confirmed = await confirmDestructive(
      "Delete post",
      "Are you sure you want to delete this post? This can't be undone."
    );
    if (!confirmed) return;
    try {
      await deletePost(user.uid, postId);
    } catch (err: any) {
      notify("Error", err.message);
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
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Custom header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100 bg-white">
        <View className="flex-row items-center flex-1">
          <TouchableOpacity onPress={() => navigation.popToTop()}>
            <Ionicons name="chevron-back" size={24} color="black" />
          </TouchableOpacity>
          <View className="flex-row items-center ml-2">
            <Avatar size={32} displayName={user?.displayName} photoURL={user?.photoURL} />
            <View className="ml-2">
              <Text className="text-base font-semibold">
                {user?.displayName}
              </Text>
              <Text className="text-sm text-gray-400">@{user?.username}</Text>
            </View>
          </View>
        </View>
        <View className="flex-row items-center gap-3">
          <TouchableOpacity onPress={() => navigation.navigate("Activity")}>
            <View>
              <Ionicons name="notifications-outline" size={22} color="black" />
              {hasUnread ? (
                <View className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-peach" />
              ) : null}
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate("Settings")}>
            <Ionicons name="settings-outline" size={22} color="black" />
          </TouchableOpacity>
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
            postOwnerUid: user!.uid,
            postId: post.postId,
            postText: post.text,
          })
        }
        onDeletePress={handleDeletePost}
        emptyText="No posts yet. Write your first one!"
      />

      {/* Composer */}
      <View className="border-t border-gray-100 bg-white">
        {selectedPhotos.length > 0 && (
          <View className="flex-row flex-wrap gap-2 px-3 pt-3">
            {selectedPhotos.map((photo, i) => (
              <View key={i} className="relative">
                <Image
                  source={{ uri: photo.uri }}
                  className="w-16 h-16 rounded-lg bg-gray-100"
                />
                <TouchableOpacity
                  className="absolute -top-1 -right-1 bg-black/60 rounded-full w-5 h-5 items-center justify-center"
                  onPress={() =>
                    setSelectedPhotos((prev) =>
                      prev.filter((_, idx) => idx !== i)
                    )
                  }
                >
                  <Ionicons name="close" size={14} color="white" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
        <View className="flex-row items-center p-3">
          <TouchableOpacity
            className="mr-2"
            onPress={pickPhotos}
            disabled={selectedPhotos.length >= 4}
          >
            <Ionicons
              name="image-outline"
              size={24}
              color={selectedPhotos.length >= 4 ? "#d1d5db" : "#6b7280"}
            />
          </TouchableOpacity>
          <TextInput
            className="flex-1 bg-gray-50 rounded-full px-4 py-2 text-sm mr-2"
            placeholder="write something..."
            value={newPostText}
            onChangeText={setNewPostText}
            multiline
            onSubmitEditing={handlePost}
            submitBehavior="submit"
            onKeyPress={(e: any) => {
              // react-native-web ignores submitBehavior on multiline inputs;
              // submit on plain Enter, let Shift+Enter fall through as newline.
              if (
                Platform.OS === "web" &&
                e.nativeEvent.key === "Enter" &&
                !e.nativeEvent.shiftKey &&
                // Enter during IME composition commits the candidate text,
                // not the post (mirrors react-native-web's own submit guard).
                !e.nativeEvent.isComposing &&
                e.nativeEvent.keyCode !== 229
              ) {
                e.preventDefault();
                handlePost();
              }
            }}
          />
          <TouchableOpacity
            className={`rounded-full px-5 py-2 ${
              newPostText.trim() || selectedPhotos.length > 0
                ? "bg-peach"
                : "bg-gray-300"
            }`}
            onPress={handlePost}
            disabled={
              posting || (!newPostText.trim() && selectedPhotos.length === 0)
            }
          >
            <Text className="text-white font-semibold text-sm">
              {posting ? "..." : "Post"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

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
    </KeyboardAvoidingView>
  );
}
