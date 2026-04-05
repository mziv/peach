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
import { useRoute, RouteProp } from "@react-navigation/native";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { useAuth } from "../contexts/AuthContext";
import { addComment } from "../services/comments";
import { Post, Comment } from "../types";

type PostDetailParams = {
  PostDetail: { postOwnerUid: string; postId: string };
};
type PostDetailRoute = RouteProp<PostDetailParams, "PostDetail">;

export function PostDetailScreen() {
  const route = useRoute<PostDetailRoute>();
  const { postOwnerUid, postId } = route.params;
  const { user } = useAuth();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const postRef = doc(db, "users", postOwnerUid, "posts", postId);
    const unsubPost = onSnapshot(postRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setPost({
          postId: snap.id,
          text: data.text,
          createdAt: data.createdAt?.toDate() ?? new Date(),
        });
      }
      setLoading(false);
    });

    const commentsQuery = query(
      collection(db, "users", postOwnerUid, "posts", postId, "comments"),
      orderBy("createdAt", "asc")
    );
    const unsubComments = onSnapshot(commentsQuery, (snap) => {
      setComments(
        snap.docs.map((d) => ({
          commentId: d.id,
          authorUid: d.data().authorUid,
          authorUsername: d.data().authorUsername,
          text: d.data().text,
          createdAt: d.data().createdAt?.toDate() ?? new Date(),
        }))
      );
    });

    return () => {
      unsubPost();
      unsubComments();
    };
  }, [postOwnerUid, postId]);

  async function handleComment() {
    if (!commentText.trim() || !user) return;
    setSubmitting(true);
    try {
      await addComment(
        postOwnerUid,
        postId,
        user.uid,
        user.username,
        commentText.trim()
      );
      setCommentText("");
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!post) {
    return (
      <View className="flex-1 justify-center items-center">
        <Text>Post not found.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <FlatList
        data={comments}
        keyExtractor={(item) => item.commentId}
        ListHeaderComponent={
          <View className="p-4 border-b-2 border-gray-200 mb-2">
            <Text className="text-lg mb-2">{post.text}</Text>
            <Text className="text-xs text-gray-400">
              {post.createdAt.toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View className="px-4 py-2.5">
            <Text className="font-semibold text-sm mb-0.5">@{item.authorUsername}</Text>
            <Text className="text-sm text-gray-700">{item.text}</Text>
          </View>
        )}
        ListEmptyComponent={
          <View className="p-4 items-center">
            <Text className="text-sm text-gray-400">No comments yet.</Text>
          </View>
        }
      />
      <View className="flex-row p-3 border-t border-gray-200 items-center">
        <TextInput
          className="flex-1 border border-gray-300 rounded-lg p-2.5 text-sm mr-2"
          placeholder="Add a comment..."
          value={commentText}
          onChangeText={setCommentText}
        />
        <TouchableOpacity
          className={`rounded-lg py-2.5 px-4 ${commentText.trim() ? "bg-peach" : "bg-gray-300"}`}
          onPress={handleComment}
          disabled={submitting || !commentText.trim()}
        >
          <Text className="text-white font-semibold">
            {submitting ? "..." : "Send"}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
