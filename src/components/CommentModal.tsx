import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "expo/node_modules/@expo/vector-icons";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { useAuth } from "../contexts/AuthContext";
import { addComment } from "../services/comments";
import { Comment } from "../types";
import Avatar from "./Avatar";

interface CommentModalProps {
  visible: boolean;
  onClose: () => void;
  postOwnerUid: string;
  postId: string;
}

export default function CommentModal({
  visible,
  onClose,
  postOwnerUid,
  postId,
}: CommentModalProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible || !postOwnerUid || !postId) return;

    const q = query(
      collection(db, "users", postOwnerUid, "posts", postId, "comments"),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const loaded: Comment[] = snap.docs.map((d) => ({
        commentId: d.id,
        authorUid: d.data().authorUid,
        authorUsername: d.data().authorUsername,
        text: d.data().text,
        createdAt: d.data().createdAt?.toDate() ?? new Date(),
      }));
      setComments(loaded);
    });

    return unsubscribe;
  }, [visible, postOwnerUid, postId]);

  async function handleSend() {
    if (!user || !commentText.trim() || submitting) return;
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
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end">
        <TouchableOpacity
          className="absolute inset-0 bg-black/40"
          activeOpacity={1}
          onPress={onClose}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-[0.6] bg-white rounded-t-2xl"
        >
          {/* Title bar */}
          <View className="flex-row justify-between items-center px-4 py-3 border-b border-gray-100">
            <Text className="text-lg font-semibold">Leave a comment</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="gray" />
            </TouchableOpacity>
          </View>

          {/* Comment list */}
          <FlatList
            data={comments}
            keyExtractor={(item) => item.commentId}
            className="flex-1"
            renderItem={({ item }) => (
              <View className="flex-row px-4 py-2">
                <Avatar size={32} />
                <View className="ml-3 flex-1">
                  <Text className="text-sm font-semibold text-gray-500">
                    @{item.authorUsername}
                  </Text>
                  <Text className="text-sm text-gray-700">{item.text}</Text>
                </View>
              </View>
            )}
          />

          {/* Bottom input */}
          <View className="flex-row items-center px-4 py-3 border-t border-gray-100">
            <TextInput
              className="flex-1 bg-gray-50 rounded-full px-4 py-2 text-sm mr-2"
              placeholder="Say something nice"
              value={commentText}
              onChangeText={setCommentText}
              multiline={false}
            />
            <TouchableOpacity
              className={`rounded-full px-4 py-2 ${
                commentText.trim() ? "bg-green" : "bg-gray-300"
              }`}
              onPress={handleSend}
              disabled={!commentText.trim() || submitting}
            >
              <Text className="text-white font-semibold text-sm">Send</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
