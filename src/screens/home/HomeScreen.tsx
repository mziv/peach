import React from "react";
import { View, Text } from "react-native";

export function HomeScreen() {
  return (
    <View className="flex-1 justify-center items-center">
      <Text className="text-2xl font-bold mb-2">Home Screen</Text>
      <Text className="text-sm text-[#888]">Your friends will appear here</Text>
    </View>
  );
}
