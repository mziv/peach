import React from "react";
import { View, Text } from "react-native";

export function FriendPageScreen() {
  return (
    <View className="flex-1 justify-center items-center">
      <Text className="text-2xl font-bold mb-2">Friend Page Screen</Text>
      <Text className="text-sm text-[#888]">A friend's posts will appear here</Text>
    </View>
  );
}
