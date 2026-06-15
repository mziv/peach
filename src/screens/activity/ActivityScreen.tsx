import React, { useEffect, useState } from "react";
import { View, Text, FlatList, TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../contexts/AuthContext";
import {
  subscribeNotifications,
  markActivityRead,
} from "../../services/notifications";
import { HomeStackParamList } from "../../navigation/HomeStack";
import { Notification } from "../../types";
import ActivityRow from "../../components/ActivityRow";

type ActivityNav = NativeStackNavigationProp<HomeStackParamList, "Activity">;

export function ActivityScreen() {
  const navigation = useNavigation<ActivityNav>();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeNotifications(user.uid, setNotifications);
    markActivityRead(user.uid).catch(() => {});
    return unsub;
  }, [user]);

  return (
    <View className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-gray-100">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="black" />
        </TouchableOpacity>
        <Text className="text-lg font-semibold ml-2">Activity</Text>
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.notifId}
        renderItem={({ item }) => (
          <ActivityRow
            notification={item}
            onPress={() =>
              navigation.navigate("MyPage", {
                focusPostId: item.postId,
                openComments: item.type === "comment",
              })
            }
          />
        )}
        ListEmptyComponent={
          <View className="flex-1 justify-center items-center p-6">
            <Text className="text-sm text-gray-400">No activity yet.</Text>
          </View>
        }
      />
    </View>
  );
}
