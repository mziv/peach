import React from "react";
import { View, Text } from "react-native";

export function PostDetailScreen() {
  return (
    <View className="flex-1 justify-center items-center">
      <Text className="text-2xl font-bold mb-2">Post Detail Screen</Text>
      <Text className="text-sm text-[#888]">A post and its comments will appear here</Text>
    </View>
  );
}
