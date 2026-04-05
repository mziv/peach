import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { MainTabs } from "./src/navigation/MainTabs";
import "./global.css";

export default function App() {
  return (
    <NavigationContainer>
      <MainTabs />
    </NavigationContainer>
  );
}
