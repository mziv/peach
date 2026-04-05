import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { FriendsStackParamList } from "../../navigation/FriendsStack";

type FriendsNav = NativeStackNavigationProp<FriendsStackParamList, "FriendRequests">;

export function FriendRequestsScreen() {
  const navigation = useNavigation<FriendsNav>();

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Friend Requests Screen</Text>
      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate("SearchUsers")}
      >
        <Text style={styles.buttonText}>Search for Friends</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
  text: { fontSize: 24, fontWeight: "bold", marginBottom: 16 },
  button: {
    backgroundColor: "#FF6B6B",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  buttonText: { color: "white", fontSize: 16, fontWeight: "600" },
});
