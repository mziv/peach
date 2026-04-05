import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SectionList,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../../contexts/AuthContext";
import {
  getPendingRequests,
  getOutgoingRequests,
  getFriendships,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
} from "../../services/friendships";
import { getUserByUid } from "../../services/users";
import { FriendsStackParamList } from "../../navigation/FriendsStack";
import { Friendship } from "../../types";

type FriendsNav = NativeStackNavigationProp<FriendsStackParamList, "FriendRequests">;

interface RequestWithName extends Friendship {
  otherDisplayName: string;
  otherUsername: string;
}

export function FriendRequestsScreen() {
  const navigation = useNavigation<FriendsNav>();
  const { user } = useAuth();
  const [incoming, setIncoming] = useState<RequestWithName[]>([]);
  const [outgoing, setOutgoing] = useState<RequestWithName[]>([]);
  const [friends, setFriends] = useState<RequestWithName[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadAll() {
    if (!user) return;
    setLoading(true);
    const [inc, out, accepted] = await Promise.all([
      getPendingRequests(user.uid),
      getOutgoingRequests(user.uid),
      getFriendships(user.uid),
    ]);

    const incomingWithNames = await Promise.all(
      inc.map(async (f) => {
        const requester = await getUserByUid(f.requesterId);
        return { ...f, otherDisplayName: requester?.displayName ?? "Unknown", otherUsername: requester?.username ?? "" };
      })
    );

    const outgoingWithNames = await Promise.all(
      out.map(async (f) => {
        const receiver = await getUserByUid(f.receiverId);
        return { ...f, otherDisplayName: receiver?.displayName ?? "Unknown", otherUsername: receiver?.username ?? "" };
      })
    );

    const friendsWithNames = await Promise.all(
      accepted.map(async (f) => {
        const friendUid = f.requesterId === user.uid ? f.receiverId : f.requesterId;
        const friend = await getUserByUid(friendUid);
        return { ...f, otherDisplayName: friend?.displayName ?? "Unknown", otherUsername: friend?.username ?? "" };
      })
    );

    setIncoming(incomingWithNames);
    setOutgoing(outgoingWithNames);
    setFriends(friendsWithNames);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, [user]);

  async function handleAccept(friendshipId: string) {
    try {
      await acceptFriendRequest(friendshipId);
      await loadAll();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  }

  async function handleDecline(friendshipId: string) {
    try {
      await declineFriendRequest(friendshipId);
      await loadAll();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  }

  async function handleRemoveFriend(friendshipId: string, displayName: string) {
    Alert.alert(
      "Remove Friend",
      `Are you sure you want to unfriend ${displayName}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await removeFriend(friendshipId);
              await loadAll();
            } catch (err: any) {
              Alert.alert("Error", err.message);
            }
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const sections = [
    { title: "Your Friends", data: friends },
    { title: "Incoming Requests", data: incoming },
    { title: "Outgoing Requests", data: outgoing },
  ];

  return (
    <View className="flex-1">
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.friendshipId}
        renderSectionHeader={({ section }) => (
          <Text className="text-sm font-semibold text-gray-400 px-4 pt-5 pb-2 bg-gray-50">
            {section.title}
          </Text>
        )}
        renderItem={({ item, section }) => (
          <View className="flex-row justify-between items-center p-4 border-b border-gray-200">
            <Text className="text-sm font-medium">
              {item.otherDisplayName} <Text className="text-gray-400 font-normal text-xs">(@{item.otherUsername})</Text>
            </Text>
            {section.title === "Your Friends" ? (
              <TouchableOpacity
                className="border border-gray-300 rounded-md py-1.5 px-3.5 hover:bg-red-50 hover:border-red-300 active:bg-red-50 active:border-red-300"
                onPress={() => handleRemoveFriend(item.friendshipId, item.otherDisplayName)}
              >
                <Text className="text-gray-400 font-semibold text-sm hover:text-red-500 active:text-red-500">Unfriend</Text>
              </TouchableOpacity>
            ) : section.title === "Incoming Requests" ? (
              <View className="flex-row gap-2">
                <TouchableOpacity
                  className="bg-peach rounded-md py-1.5 px-3.5"
                  onPress={() => handleAccept(item.friendshipId)}
                >
                  <Text className="text-white font-semibold text-sm">Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="border border-gray-300 rounded-md py-1.5 px-3.5"
                  onPress={() => handleDecline(item.friendshipId)}
                >
                  <Text className="text-gray-400 font-semibold text-sm">Decline</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text className="text-sm text-gray-400 italic">Pending</Text>
            )}
          </View>
        )}
        renderSectionFooter={({ section }) =>
          section.data.length === 0 ? (
            <Text className="p-4 text-gray-300 text-sm">None</Text>
          ) : null
        }
        ListFooterComponent={
          <TouchableOpacity
            className="m-4 bg-peach rounded-lg p-3.5 items-center"
            onPress={() => navigation.navigate("SearchUsers")}
          >
            <Text className="text-white text-base font-semibold">Search for Friends</Text>
          </TouchableOpacity>
        }
      />
    </View>
  );
}
