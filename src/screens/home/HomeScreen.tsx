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
import { HomeStackParamList } from "../../navigation/HomeStack";
import UserPreview from "../../components/UserPreview";

type HomeNav = NativeStackNavigationProp<HomeStackParamList, "Home">;

interface FriendWithMeta {
  uid: string;
  displayName: string;
  username: string;
  lastPostText: string;
  lastPostAt: Date | null;
}

interface SelfMeta {
  lastPostText: string;
  lastPostAt: Date | null;
}

export function HomeScreen() {
  const navigation = useNavigation<HomeNav>();
  const { user } = useAuth();
  const [friends, setFriends] = useState<FriendWithMeta[]>([]);
  const [selfMeta, setSelfMeta] = useState<SelfMeta>({
    lastPostText: "",
    lastPostAt: null,
  });
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;

      let cancelled = false;

      async function loadData() {
        // Fetch self meta
        const selfMetaSnap = await getDoc(
          doc(db, "users", user!.uid, "meta", "meta")
        );
        const selfMetaData = selfMetaSnap.exists()
          ? selfMetaSnap.data()
          : null;

        if (!cancelled) {
          setSelfMeta({
            lastPostText: selfMetaData?.lastPostText ?? "",
            lastPostAt: selfMetaData?.lastPostAt?.toDate() ?? null,
          });
        }

        // Fetch friendships and friend meta
        const friendships = await getFriendships(user!.uid);

        const friendUids = friendships.map((f) =>
          f.requesterId === user!.uid ? f.receiverId : f.requesterId
        );

        const friendsWithMeta: FriendWithMeta[] = [];
        for (const friendUid of friendUids) {
          const userSnap = await getDoc(doc(db, "users", friendUid));
          const metaSnap = await getDoc(
            doc(db, "users", friendUid, "meta", "meta")
          );

          if (userSnap.exists()) {
            const userData = userSnap.data();
            const metaData = metaSnap.exists() ? metaSnap.data() : null;
            friendsWithMeta.push({
              uid: friendUid,
              displayName: userData.displayName,
              username: userData.username,
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

      loadData();

      return () => {
        cancelled = true;
      };
    }, [user])
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
      <FlatList
        data={friends}
        keyExtractor={(item) => item.uid}
        ListHeaderComponent={
          <>
            {/* Self-preview row */}
            <UserPreview
              displayName={user?.displayName ?? ""}
              username={user?.username ?? ""}
              previewText={selfMeta.lastPostText || "No posts yet"}
              timestamp={selfMeta.lastPostAt}
              onPress={() => navigation.navigate("MyPage")}
            />

            {/* Add Friend button */}
            <TouchableOpacity
              className="bg-green rounded-full py-3 mx-4 my-3 items-center"
              onPress={() => navigation.navigate("SearchUsers")}
            >
              <Text className="text-white font-semibold text-base">
                Add Friend...
              </Text>
            </TouchableOpacity>
          </>
        }
        renderItem={({ item }) => (
          <UserPreview
            displayName={item.displayName}
            username={item.username}
            previewText={item.lastPostText || "No posts yet"}
            timestamp={item.lastPostAt}
            onPress={() =>
              navigation.navigate("FriendPage", {
                friendUid: item.uid,
                friendDisplayName: item.displayName,
                friendUsername: item.username,
              })
            }
          />
        )}
        ListEmptyComponent={
          <View className="flex-1 justify-center items-center p-6">
            <Text className="text-sm text-gray-400">
              No friends yet. Tap "Add Friend..." to find people!
            </Text>
          </View>
        }
      />
    </View>
  );
}
