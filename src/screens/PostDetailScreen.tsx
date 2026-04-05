import React from "react";
import { View, Text, StyleSheet } from "react-native";

export function PostDetailScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Post Detail Screen</Text>
      <Text style={styles.subtext}>A post and its comments will appear here</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
  text: { fontSize: 24, fontWeight: "bold", marginBottom: 8 },
  subtext: { fontSize: 14, color: "#888" },
});
