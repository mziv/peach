import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { HomeStack } from "./HomeStack";
import { MyPageStack } from "./MyPageStack";
import { FriendsStack } from "./FriendsStack";

const Tab = createBottomTabNavigator();

export function MainTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="HomeTab" component={HomeStack} options={{ title: "Home" }} />
      <Tab.Screen name="MyPageTab" component={MyPageStack} options={{ title: "My Page" }} />
      <Tab.Screen name="FriendsTab" component={FriendsStack} options={{ title: "Friends" }} />
    </Tab.Navigator>
  );
}
