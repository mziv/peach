import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { MyPageScreen } from "../screens/mypage/MyPageScreen";
import { PostDetailScreen } from "../screens/PostDetailScreen";

export type MyPageStackParamList = {
  MyPage: undefined;
  PostDetail: { postOwnerUid: string; postId: string };
};

const Stack = createNativeStackNavigator<MyPageStackParamList>();

export function MyPageStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="MyPage" component={MyPageScreen} options={{ title: "My Page" }} />
      <Stack.Screen name="PostDetail" component={PostDetailScreen} options={{ title: "Post" }} />
    </Stack.Navigator>
  );
}
