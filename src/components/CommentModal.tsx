import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Animated,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { useAuth } from "../contexts/AuthContext";
import { addComment, deleteComment } from "../services/comments";
import { getUserByUid } from "../services/users";
import { confirmDestructive, notify } from "../utils/dialog";
import {
  CommentAuthorInfo,
  distinctAuthorUids,
  withAuthorInfo,
} from "../utils/commentAuthors";
import { Comment } from "../types";
import Avatar from "./Avatar";

interface CommentModalProps {
  visible: boolean;
  onClose: () => void;
  postOwnerUid: string;
  postId: string;
  postText: string;
}

export default function CommentModal({
  visible,
  onClose,
  postOwnerUid,
  postId,
  postText,
}: CommentModalProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  // Author profile info hydrated on read, keyed by uid. Comment text renders
  // immediately; avatars fill in as these lookups resolve.
  const [authorInfo, setAuthorInfo] = useState<Map<string, CommentAuthorInfo>>(
    new Map()
  );
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Tracks comment deletes in flight so a double-tap can't fire deleteComment
  // twice and over-decrement the post's commentCount.
  const deletingIds = useRef<Set<string>>(new Set());

  // Keep the modal mounted while the close animation plays out.
  const [rendered, setRendered] = useState(visible);
  // A single opacity value fades the backdrop and the centered card together.
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const useNativeDriver = Platform.OS !== "web";

  useEffect(() => {
    if (visible) {
      setRendered(true);
      overlayOpacity.setValue(0);
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver,
      }).start();
    } else if (rendered) {
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver,
      }).start(() => setRendered(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

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

  // Hydrate author profile photos on read: look up each distinct author uid
  // once (skipping any already cached) and fold the result into authorInfo.
  // Lookups run independently and never block comment text from showing; a
  // failed/empty lookup still records an entry so we don't retry it and the
  // row simply falls back to the stored username's initials.
  useEffect(() => {
    let cancelled = false;
    const uidsToFetch = distinctAuthorUids(
      comments,
      new Set(authorInfo.keys())
    );
    if (uidsToFetch.length === 0) return;

    uidsToFetch.forEach(async (uid) => {
      let user = null;
      try {
        user = await getUserByUid(uid);
      } catch {
        // Swallow lookup failures — fall back to initials below.
      }
      if (cancelled) return;
      setAuthorInfo((prev) => withAuthorInfo(prev, uid, user));
    });

    return () => {
      cancelled = true;
    };
  }, [comments, authorInfo]);

  async function handleSend() {
    if (!user || !commentText.trim() || submitting) return;
    setSubmitting(true);
    try {
      await addComment(
        postOwnerUid,
        postId,
        user.uid,
        user.username,
        user.displayName,
        user.photoURL,
        commentText.trim(),
        postText
      );
      setCommentText("");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteComment(commentId: string) {
    if (deletingIds.current.has(commentId)) return;
    const confirmed = await confirmDestructive(
      "Delete comment",
      "Are you sure you want to delete this comment?"
    );
    if (!confirmed) return;
    deletingIds.current.add(commentId);
    try {
      await deleteComment(postOwnerUid, postId, commentId);
    } catch (err: any) {
      notify("Error", err.message);
    } finally {
      deletingIds.current.delete(commentId);
    }
  }

  return (
    <Modal
      visible={rendered}
      animationType="none"
      transparent={true}
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-center items-center">
        {/* Backdrop: full-screen dim that fades with the card.
            NativeWind's className isn't applied to Animated.View, so the
            background and fill are set via style. */}
        <Animated.View
          style={{
            ...StyleSheet.absoluteFillObject,
            backgroundColor: "rgba(0, 0, 0, 0.4)",
            opacity: overlayOpacity,
            // Mobile Safari won't promote this full-screen fade to its own GPU
            // layer on its own, so it repaints every frame. Hint it to. (web only)
            ...(Platform.OS === "web" ? ({ willChange: "opacity" } as any) : null),
          }}
        >
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={onClose}
          />
        </Animated.View>
        {/* Centered card: fades in/out with the backdrop, no slide.
            Fixed height (not maxHeight) so the card is a constant size
            regardless of how many comments there are. */}
        <Animated.View
          style={{
            width: "88%",
            height: "75%",
            opacity: overlayOpacity,
          }}
        >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1 bg-white rounded-2xl overflow-hidden"
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
            renderItem={({ item }) => {
              const info = authorInfo.get(item.authorUid);
              return (
              <View className="flex-row px-4 py-2">
                <Avatar
                  size={32}
                  photoURL={info?.photoURL}
                  displayName={info?.displayName ?? item.authorUsername}
                />
                <View className="ml-3 flex-1">
                  <Text className="text-sm font-semibold text-gray-500">
                    @{item.authorUsername}
                  </Text>
                  <Text className="text-sm text-gray-700">{item.text}</Text>
                </View>
                {user?.uid === item.authorUid && (
                  <TouchableOpacity
                    className="pl-2 self-start"
                    onPress={() => handleDeleteComment(item.commentId)}
                  >
                    <Ionicons name="trash-outline" size={16} color="gray" />
                  </TouchableOpacity>
                )}
              </View>
              );
            }}
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
        </Animated.View>
      </View>
    </Modal>
  );
}
