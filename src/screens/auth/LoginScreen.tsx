import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { AuthStackParamList } from "../../navigation/AuthStack";
import { logIn } from "../../services/auth";

type LoginNav = NativeStackNavigationProp<AuthStackParamList, "Login">;

export function LoginScreen() {
  const navigation = useNavigation<LoginNav>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert("Error", "Please fill in all fields.");
      return;
    }
    setLoading(true);
    try {
      await logIn(email, password);
    } catch (err: any) {
      Alert.alert("Login Failed", err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View className="flex-1 justify-center p-6">
      <Text className="text-4xl font-bold text-center mb-8">Peach</Text>
      <TextInput
        className="border border-gray-300 rounded-lg p-3 mb-3 text-base"
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        className="border border-gray-300 rounded-lg p-3 mb-3 text-base"
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <TouchableOpacity
        className="bg-peach rounded-lg p-3.5 items-center mb-4"
        onPress={handleLogin}
        disabled={loading}
      >
        <Text className="text-white text-base font-semibold">
          {loading ? "Logging in..." : "Log In"}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate("SignUp")}>
        <Text className="text-center text-peach text-sm">
          Don't have an account? Sign up
        </Text>
      </TouchableOpacity>
    </View>
  );
}
