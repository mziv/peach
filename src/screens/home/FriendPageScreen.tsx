import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../../config/firebase";
import { HomeStackParamList } from "../../navigation/HomeStack";
import { Post } from "../../types";

type FriendPageRoute = RouteProp<HomeStackParamList, "FriendPage">;
type FriendPageNav = NativeStackNavigationProp<HomeStackParamList, "FriendPage">;

export function FriendPageScreen() {
  const route = useRoute<FriendPageRoute>();
  const navigation = useNavigation<FriendPageNav>();
  const { friendUid } = route.params;
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "users", friendUid, "posts"),
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
  }, [friendUid]);

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
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
              postOwnerUid: friendUid,
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
          <Text className="text-sm text-gray-400">No posts yet.</Text>
        </View>
      }
    />
  );
}
