import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { HomeScreen } from "../screens/home/HomeScreen";
import { FriendPageScreen } from "../screens/home/FriendPageScreen";
import { PostDetailScreen } from "../screens/PostDetailScreen";

export type HomeStackParamList = {
  Home: undefined;
  FriendPage: { friendUid: string; friendDisplayName: string };
  PostDetail: { postOwnerUid: string; postId: string };
};

const Stack = createNativeStackNavigator<HomeStackParamList>();

export function HomeStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Home" component={HomeScreen} options={{ title: "Peach" }} />
      <Stack.Screen
        name="FriendPage"
        component={FriendPageScreen}
        options={({ route }) => ({ title: route.params.friendDisplayName })}
      />
      <Stack.Screen name="PostDetail" component={PostDetailScreen} options={{ title: "Post" }} />
    </Stack.Navigator>
  );
}
