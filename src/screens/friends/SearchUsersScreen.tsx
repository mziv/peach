import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../contexts/AuthContext";
import { searchUsersByUsername } from "../../services/users";
import {
  sendFriendRequest,
  getFriendshipBetween,
} from "../../services/friendships";
import { User } from "../../types";
import Avatar from "../../components/Avatar";
import { FriendsStackParamList } from "../../navigation/FriendsStack";

type SearchNav = NativeStackNavigationProp<FriendsStackParamList, "SearchUsers">;

interface SearchResult extends User {
  friendshipStatus: "none" | "pending" | "accepted";
}

export function SearchUsersScreen() {
  const navigation = useNavigation<SearchNav>();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searched, setSearched] = useState(false);

  async function handleSearch() {
    if (!searchTerm.trim() || !user) return;
    const users = await searchUsersByUsername(searchTerm.trim());

    const resultsWithStatus: SearchResult[] = await Promise.all(
      users
        .filter((u) => u.uid !== user.uid)
        .map(async (u) => {
          const friendship = await getFriendshipBetween(user.uid, u.uid);
          return {
            ...u,
            friendshipStatus: friendship ? friendship.status : "none",
          };
        })
    );

    setResults(resultsWithStatus);
    setSearched(true);
  }

  async function handleSendRequest(receiverUid: string) {
    if (!user) return;
    try {
      await sendFriendRequest(user.uid, receiverUid);
      setResults((prev) =>
        prev.map((r) =>
          r.uid === receiverUid ? { ...r, friendshipStatus: "pending" } : r
        )
      );
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  }

  return (
    <View className="flex-1 bg-white">
      {/* Custom Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-gray-100 bg-white">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text className="text-lg font-semibold ml-2">Search Users</Text>
      </View>

      {/* Search bar */}
      <View className="flex-row items-center px-4 py-3">
        <TextInput
          className="flex-1 bg-gray-50 rounded-full px-4 py-2.5 text-sm mr-2"
          placeholder="Search by username"
          value={searchTerm}
          onChangeText={setSearchTerm}
          autoCapitalize="none"
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        <TouchableOpacity
          className="bg-green rounded-full px-4 py-2.5"
          onPress={handleSearch}
        >
          <Text className="text-white font-semibold">Search</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={results}
        keyExtractor={(item) => item.uid}
        renderItem={({ item }) => (
          <View className="flex-row justify-between items-center px-4 py-3">
            <View className="flex-row items-center flex-1 mr-3">
              <Avatar size={40} />
              <View className="ml-3">
                <Text className="text-base font-medium">{item.displayName}</Text>
                <Text className="text-sm text-gray-400">@{item.username}</Text>
              </View>
            </View>
            {item.friendshipStatus === "none" ? (
              <TouchableOpacity
                className="bg-green rounded-full py-1.5 px-4"
                onPress={() => handleSendRequest(item.uid)}
              >
                <Text className="text-white font-semibold text-sm">Add Friend</Text>
              </TouchableOpacity>
            ) : item.friendshipStatus === "pending" ? (
              <Text className="text-sm text-gray-400 italic">Pending</Text>
            ) : (
              <Text className="text-sm text-gray-400 italic">Friends</Text>
            )}
          </View>
        )}
        ListEmptyComponent={
          searched ? (
            <View className="p-6 items-center">
              <Text className="text-sm text-gray-400">No users found.</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}
