import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { HomeScreen } from "../screens/home/HomeScreen";
import { FriendPageScreen } from "../screens/home/FriendPageScreen";
import { MyPageScreen } from "../screens/mypage/MyPageScreen";
import { SearchUsersScreen } from "../screens/friends/SearchUsersScreen";

export type HomeStackParamList = {
  Home: undefined;
  MyPage: undefined;
  FriendPage: { friendUid: string; friendDisplayName: string; friendUsername: string };
  SearchUsers: undefined;
};

const Stack = createNativeStackNavigator<HomeStackParamList>();

export function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="MyPage" component={MyPageScreen} />
      <Stack.Screen name="FriendPage" component={FriendPageScreen} />
      <Stack.Screen name="SearchUsers" component={SearchUsersScreen} />
    </Stack.Navigator>
  );
}
