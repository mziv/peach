import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { FriendsStackParamList } from "../../navigation/FriendsStack";

type FriendsNav = NativeStackNavigationProp<FriendsStackParamList, "FriendRequests">;

export function FriendRequestsScreen() {
  const navigation = useNavigation<FriendsNav>();

  return (
    <View className="flex-1 justify-center items-center">
      <Text className="text-2xl font-bold mb-4">Friend Requests Screen</Text>
      <TouchableOpacity
        className="bg-peach rounded-lg py-3 px-6"
        onPress={() => navigation.navigate("SearchUsers")}
      >
        <Text className="text-white text-base font-semibold">Search for Friends</Text>
      </TouchableOpacity>
    </View>
  );
}
