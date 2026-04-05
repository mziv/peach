import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../config/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { getFriendships } from "../../services/friendships";
import { relativeTime } from "../../utils/relativeTime";
import { HomeStackParamList } from "../../navigation/HomeStack";

type HomeNav = NativeStackNavigationProp<HomeStackParamList, "Home">;

interface FriendWithMeta {
  uid: string;
  displayName: string;
  lastPostText: string;
  lastPostAt: Date | null;
}

export function HomeScreen() {
  const navigation = useNavigation<HomeNav>();
  const { user } = useAuth();
  const [friends, setFriends] = useState<FriendWithMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    if (!user) return;

    let cancelled = false;

    async function loadFriends() {
      const friendships = await getFriendships(user!.uid);

      const friendUids = friendships.map((f) =>
        f.requesterId === user!.uid ? f.receiverId : f.requesterId
      );

      const friendsWithMeta: FriendWithMeta[] = [];
      for (const friendUid of friendUids) {
        const userSnap = await getDoc(doc(db, "users", friendUid));
        const metaSnap = await getDoc(doc(db, "users", friendUid, "meta", "meta"));

        if (userSnap.exists()) {
          const userData = userSnap.data();
          const metaData = metaSnap.exists() ? metaSnap.data() : null;
          friendsWithMeta.push({
            uid: friendUid,
            displayName: userData.displayName,
            lastPostText: metaData?.lastPostText ?? "",
            lastPostAt: metaData?.lastPostAt?.toDate() ?? null,
          });
        }
      }

      friendsWithMeta.sort((a, b) => {
        if (!a.lastPostAt && !b.lastPostAt) return 0;
        if (!a.lastPostAt) return 1;
        if (!b.lastPostAt) return -1;
        return b.lastPostAt.getTime() - a.lastPostAt.getTime();
      });

      if (!cancelled) {
        setFriends(friendsWithMeta);
        setLoading(false);
      }
    }

    loadFriends();

    return () => {
      cancelled = true;
    };
  }, [user]));

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (friends.length === 0) {
    return (
      <View className="flex-1 justify-center items-center p-6">
        <Text className="text-lg font-semibold mb-2">No friends yet.</Text>
        <Text className="text-sm text-gray-400">
          Go to the Friends tab to find people!
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={friends}
      keyExtractor={(item) => item.uid}
      renderItem={({ item }) => (
        <TouchableOpacity
          className="p-4 border-b border-gray-200"
          onPress={() =>
            navigation.navigate("FriendPage", {
              friendUid: item.uid,
              friendDisplayName: item.displayName,
            })
          }
        >
          <View className="flex-row justify-between items-center mb-1">
            <Text className="text-base font-semibold">{item.displayName}</Text>
            {item.lastPostAt && (
              <Text className="text-xs text-gray-400">{relativeTime(item.lastPostAt)}</Text>
            )}
          </View>
          {item.lastPostText ? (
            <Text className="text-sm text-gray-500" numberOfLines={2}>
              {item.lastPostText}
            </Text>
          ) : (
            <Text className="text-sm text-gray-300 italic">No posts yet</Text>
          )}
        </TouchableOpacity>
      )}
    />
  );
}
