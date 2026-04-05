import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { FriendRequestsScreen } from "../screens/friends/FriendRequestsScreen";
import { SearchUsersScreen } from "../screens/friends/SearchUsersScreen";

export type FriendsStackParamList = {
  FriendRequests: undefined;
  SearchUsers: undefined;
};

const Stack = createNativeStackNavigator<FriendsStackParamList>();

export function FriendsStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="FriendRequests"
        component={FriendRequestsScreen}
        options={{ title: "Friends" }}
      />
      <Stack.Screen
        name="SearchUsers"
        component={SearchUsersScreen}
        options={{ title: "Search Users" }}
      />
    </Stack.Navigator>
  );
}
