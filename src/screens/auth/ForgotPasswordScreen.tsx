import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { AuthStackParamList } from "../../navigation/AuthStack";
import { resetPassword } from "../../services/auth";

type ForgotPasswordNav = NativeStackNavigationProp<
  AuthStackParamList,
  "ForgotPassword"
>;

export function ForgotPasswordScreen() {
  const navigation = useNavigation<ForgotPasswordNav>();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleReset() {
    if (!email) {
      Alert.alert("Error", "Please enter your email address.");
      return;
    }
    setLoading(true);
    try {
      await resetPassword(email);
      setSent(true);
    } catch {
      Alert.alert(
        "Error",
        "Something went wrong. Please check your connection and try again."
      );
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <View className="flex-1 justify-center p-6">
        <Text className="text-2xl font-bold text-center mb-4">
          Check Your Email
        </Text>
        <Text className="text-base text-gray-600 text-center mb-8">
          If an account exists with this email, you'll receive a password reset
          link.
        </Text>
        <TouchableOpacity onPress={() => navigation.navigate("Login")}>
          <Text className="text-center text-peach text-sm">Back to Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 justify-center p-6">
      <Text className="text-2xl font-bold text-center mb-2">
        Reset Password
      </Text>
      <Text className="text-base text-gray-600 text-center mb-8">
        Enter your email and we'll send you a reset link.
      </Text>
      <TextInput
        className="border border-gray-300 rounded-lg p-3 mb-3 text-base"
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TouchableOpacity
        className="bg-peach rounded-lg p-3.5 items-center mb-4"
        onPress={handleReset}
        disabled={loading}
      >
        <Text className="text-white text-base font-semibold">
          {loading ? "Sending..." : "Send Reset Link"}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text className="text-center text-peach text-sm">Back to Login</Text>
      </TouchableOpacity>
    </View>
  );
}
