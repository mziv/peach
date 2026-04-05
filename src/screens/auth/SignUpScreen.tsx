import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { AuthStackParamList } from "../../navigation/AuthStack";
import { signUp } from "../../services/auth";

type SignUpNav = NativeStackNavigationProp<AuthStackParamList, "SignUp">;

export function SignUpScreen() {
  const navigation = useNavigation<SignUpNav>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignUp() {
    if (!email || !password || !username || !displayName) {
      Alert.alert("Error", "Please fill in all fields.");
      return;
    }
    setLoading(true);
    try {
      await signUp(email, password, username, displayName);
    } catch (err: any) {
      Alert.alert("Sign Up Failed", err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View className="flex-1 justify-center p-6">
      <Text className="text-4xl font-bold text-center mb-8">Join Peach</Text>
      <TextInput
        className="border border-gray-300 rounded-lg p-3 mb-3 text-base"
        placeholder="Display Name"
        value={displayName}
        onChangeText={setDisplayName}
      />
      <TextInput
        className="border border-gray-300 rounded-lg p-3 mb-3 text-base"
        placeholder="Username"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
      />
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
        onPress={handleSignUp}
        disabled={loading}
      >
        <Text className="text-white text-base font-semibold">
          {loading ? "Creating account..." : "Sign Up"}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text className="text-center text-peach text-sm">
          Already have an account? Log in
        </Text>
      </TouchableOpacity>
    </View>
  );
}
