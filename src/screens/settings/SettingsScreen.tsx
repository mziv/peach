import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  Modal,
  ScrollView,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../contexts/AuthContext";
import { logOut, reauthenticate, deleteAuthAccount } from "../../services/auth";
import { updateDisplayName, deleteAccountData } from "../../services/users";
import { HomeStackParamList } from "../../navigation/HomeStack";

type SettingsNav = NativeStackNavigationProp<HomeStackParamList, "Settings">;

export function SettingsScreen() {
  const navigation = useNavigation<SettingsNav>();
  const { user, firebaseUser, refreshUser } = useAuth();
  const [name, setName] = useState(user?.displayName ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pwModalVisible, setPwModalVisible] = useState(false);
  const [password, setPassword] = useState("");

  const trimmed = name.trim();
  const canSave = trimmed.length > 0 && trimmed !== user?.displayName && !saving;

  async function handleSave() {
    if (!user || !canSave) return;
    setSaving(true);
    try {
      await updateDisplayName(user.uid, trimmed);
      await refreshUser();
      Alert.alert("Saved", "Your display name has been updated.");
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    try {
      await logOut();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  }

  function confirmDelete() {
    Alert.alert(
      "Delete account",
      "This permanently deletes your account, posts, and friendships. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (!user) return;
            setDeleting(true);
            try {
              await deleteAccountData(user.uid);
              await deleteAuthAccount();
              // onAuthStateChanged clears the session → routes to auth stack.
            } catch (err: any) {
              if (err.code === "auth/requires-recent-login") {
                setPwModalVisible(true);
              } else {
                Alert.alert("Error", err.message);
              }
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  }

  async function handleReauthAndDelete() {
    setDeleting(true);
    try {
      await reauthenticate(password);
      await deleteAuthAccount();
      setPwModalVisible(false);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setPassword("");
      setDeleting(false);
    }
  }

  return (
    <View className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-gray-100">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="black" />
        </TouchableOpacity>
        <Text className="text-base font-semibold ml-2">Settings</Text>
      </View>

      <ScrollView className="flex-1">
        {/* Profile section */}
        <Text className="text-xs uppercase text-gray-400 px-4 pt-5 pb-2">
          Profile
        </Text>
        <View className="px-4">
          <Text className="text-sm text-gray-500 mb-1">Display name</Text>
          <View className="flex-row items-center">
            <TextInput
              className="flex-1 bg-gray-50 rounded-full px-4 py-3 text-base mr-2"
              value={name}
              onChangeText={setName}
              placeholder="Your name"
            />
            <TouchableOpacity
              className={`rounded-full px-5 py-2 ${
                canSave ? "bg-peach" : "bg-gray-300"
              }`}
              onPress={handleSave}
              disabled={!canSave}
            >
              <Text className="text-white font-semibold text-sm">
                {saving ? "Saving..." : "Save"}
              </Text>
            </TouchableOpacity>
          </View>

          <View className="mt-5">
            <Text className="text-sm text-gray-500">Username</Text>
            <Text className="text-base mt-1">@{user?.username}</Text>
          </View>
          <View className="mt-4">
            <Text className="text-sm text-gray-500">Email</Text>
            <Text className="text-base mt-1">{firebaseUser?.email}</Text>
          </View>
        </View>

        {/* Account section */}
        <Text className="text-xs uppercase text-gray-400 px-4 pt-8 pb-2">
          Account
        </Text>
        <View className="px-4">
          <TouchableOpacity
            className="rounded-full border border-gray-200 px-4 py-3"
            onPress={handleSignOut}
            disabled={deleting}
          >
            <Text className="text-base text-center">Sign Out</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="rounded-full border border-red-200 px-4 py-3 mt-3"
            onPress={confirmDelete}
            disabled={deleting}
          >
            <Text className="text-base text-center text-red-600">
              {deleting ? "Deleting..." : "Delete Account"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Re-auth password modal (Alert.prompt is iOS-only, so use a modal) */}
      <Modal
        visible={pwModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPwModalVisible(false)}
      >
        {/* Backdrop color via inline style — NativeWind className on the
            backdrop has bitten us before (see commit c12e1a6). */}
        <View
          className="flex-1 justify-center items-center px-8"
          style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
        >
          <View className="bg-white rounded-2xl p-5 w-full">
            <Text className="text-base font-semibold mb-2">
              Confirm your password
            </Text>
            <Text className="text-sm text-gray-500 mb-3">
              For security, please re-enter your password to delete your account.
            </Text>
            <TextInput
              className="bg-gray-50 rounded-lg px-4 py-3 text-base"
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              secureTextEntry
              autoFocus
            />
            <View className="flex-row justify-end gap-3 mt-4">
              <TouchableOpacity
                onPress={() => {
                  if (deleting) return;
                  setPwModalVisible(false);
                  setPassword("");
                }}
              >
                <Text className="text-base text-gray-500 py-2 px-3">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="bg-red-600 rounded-full px-5 py-2"
                onPress={handleReauthAndDelete}
                disabled={deleting || !password}
              >
                <Text className="text-white font-semibold">
                  {deleting ? "..." : "Delete"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
