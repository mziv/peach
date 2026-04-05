import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

export function HelloScreen() {
  const [message, setMessage] = useState("Hello Peach!");

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{message}</Text>
      <TouchableOpacity
        style={styles.button}
        onPress={() => setMessage("You tapped the button!")}
      >
        <Text style={styles.buttonText}>Tap me</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 32, fontWeight: "bold", marginBottom: 24 },
  button: {
    backgroundColor: "#FF6B6B",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  buttonText: { color: "white", fontSize: 18, fontWeight: "600" },
});
