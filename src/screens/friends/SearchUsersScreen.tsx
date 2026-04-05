import React from "react";
import { View, Text } from "react-native";

export function SearchUsersScreen() {
  return (
    <View className="flex-1 justify-center items-center">
      <Text className="text-2xl font-bold mb-2">Search Users Screen</Text>
      <Text className="text-sm text-[#888]">Find friends by username</Text>
    </View>
  );
}
