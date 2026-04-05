import React, { useEffect, useState } from "react";
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
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../../config/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { createPost } from "../../services/posts";
import { logOut } from "../../services/auth";
import { MyPageStackParamList } from "../../navigation/MyPageStack";
import { Post } from "../../types";

type MyPageNav = NativeStackNavigationProp<MyPageStackParamList, "MyPage">;

export function MyPageScreen() {
  const navigation = useNavigation<MyPageNav>();
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPostText, setNewPostText] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "users", user.uid, "posts"),
      orderBy("createdAt", "asc")
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      const postList: Post[] = snap.docs.map((d) => ({
        postId: d.id,
        text: d.data().text,
        createdAt: d.data().createdAt?.toDate() ?? new Date(),
        commentCount: d.data().commentCount ?? 0,
      }));
      setPosts(postList);
      setLoading(false);
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

  async function handleLogout() {
    try {
      await logOut();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  }

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View className="flex-row justify-between items-center p-4 border-b border-gray-200">
        <Text className="text-base font-semibold">@{user?.username}</Text>
        <TouchableOpacity onPress={handleLogout}>
          <Text className="text-peach text-sm">Log Out</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        ref={(ref) => {
          if (ref && posts.length > 0) {
            setTimeout(() => ref.scrollToEnd({ animated: false }), 100);
          }
        }}
        data={posts}
        keyExtractor={(item) => item.postId}
        renderItem={({ item }) => (
          <TouchableOpacity
            className="p-4 border-b border-gray-200"
            onPress={() =>
              navigation.navigate("PostDetail", {
                postOwnerUid: user!.uid,
                postId: item.postId,
              })
            }
          >
            <Text className="text-base mb-1">{item.text}</Text>
            <View className="flex-row justify-between items-center">
              <Text className="text-xs text-gray-400">
                {item.createdAt.toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
              </Text>
              {item.commentCount > 0 && (
                <Text className="text-xs text-gray-400">
                  {item.commentCount} comment{item.commentCount === 1 ? "" : "s"}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View className="flex-1 justify-center items-center p-6">
            <Text className="text-sm text-gray-400">No posts yet. Write your first one!</Text>
          </View>
        }
      />
      <View className="p-4 border-t border-gray-200">
        <TextInput
          className="border border-gray-300 rounded-lg p-3 text-base min-h-[60px] mb-2"
          placeholder="What's on your mind?"
          value={newPostText}
          onChangeText={setNewPostText}
          multiline
        />
        <TouchableOpacity
          className={`rounded-lg p-2.5 items-center ${newPostText.trim() ? "bg-peach" : "bg-gray-300"}`}
          onPress={handlePost}
          disabled={posting || !newPostText.trim()}
        >
          <Text className="text-white font-semibold">
            {posting ? "Posting..." : "Post"}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
