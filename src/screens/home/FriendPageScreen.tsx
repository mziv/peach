import React from "react";
import { View, Text, StyleSheet } from "react-native";

export function FriendPageScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Friend Page Screen</Text>
      <Text style={styles.subtext}>A friend's posts will appear here</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
  text: { fontSize: 24, fontWeight: "bold", marginBottom: 8 },
  subtext: { fontSize: 14, color: "#888" },
});
