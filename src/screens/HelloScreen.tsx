import React, { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";

export function HelloScreen() {
  const [message, setMessage] = useState("Hello Peach!");

  return (
    <View className="flex-1 justify-center items-center">
      <Text className="text-4xl font-bold mb-6">{message}</Text>
      <TouchableOpacity
        className="bg-peach rounded-lg py-3 px-6"
        onPress={() => setMessage("You tapped the button!")}
      >
        <Text className="text-white text-lg font-semibold">Tap me</Text>
      </TouchableOpacity>
    </View>
  );
}
