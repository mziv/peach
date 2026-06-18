import React, { useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  Platform,
  ScrollView,
  Image,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "../../contexts/AuthContext";
import { confirmDestructive, notify } from "../../utils/dialog";
import { logOut, reauthenticate, deleteAuthAccount } from "../../services/auth";
import { updateDisplayName, deleteAccountData, uploadProfilePhoto, removeProfilePhoto } from "../../services/users";
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
  const [photoStatus, setPhotoStatus] = useState<
    "idle" | "uploading" | "removing"
  >("idle");
  const photoBusy = photoStatus !== "idle";
  const [photoModalVisible, setPhotoModalVisible] = useState(false);
  // Shown inline in the photo modal. We can't use Alert for photo feedback:
  // react-native-web's Alert.alert is a no-op, so errors would be invisible
  // on web (the same reason the chooser itself is a Modal, not an action sheet).
  const [photoError, setPhotoError] = useState<string | null>(null);
  // Guards the whole pick flow (permission + picker) against re-entry, since
  // photoStatus only flips once an upload actually starts.
  const pickerActiveRef = useRef(false);

  const trimmed = name.trim();
  const canSave = trimmed.length > 0 && trimmed !== user?.displayName && !saving;

  async function handleSave() {
    if (!user || !canSave) return;
    setSaving(true);
    try {
      await updateDisplayName(user.uid, trimmed);
      await refreshUser();
      notify("Saved", "Your display name has been updated.");
    } catch (err: any) {
      notify("Error", err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    try {
      await logOut();
    } catch (err: any) {
      notify("Error", err.message);
    }
  }

  async function confirmDelete() {
    const confirmed = await confirmDestructive(
      "Delete account",
      "This permanently deletes your account, posts, and friendships. This cannot be undone."
    );
    if (!confirmed || !user) return;
    setDeleting(true);
    try {
      await deleteAccountData(user.uid);
      await deleteAuthAccount();
      // onAuthStateChanged clears the session → routes to auth stack.
    } catch (err: any) {
      if (err.code === "auth/requires-recent-login") {
        setPwModalVisible(true);
      } else {
        notify("Error", err.message);
      }
    } finally {
      setDeleting(false);
    }
  }

  async function handleReauthAndDelete() {
    setDeleting(true);
    try {
      await reauthenticate(password);
      await deleteAuthAccount();
      setPwModalVisible(false);
    } catch (err: any) {
      notify("Error", err.message);
    } finally {
      setPassword("");
      setDeleting(false);
    }
  }

  async function pickAndUpload() {
    if (pickerActiveRef.current) return;
    pickerActiveRef.current = true;
    setPhotoError(null);
    try {
      // On web the media-library permission is always granted, and the file
      // dialog only opens inside the tap's user-gesture window — awaiting the
      // permission first can drop that activation, so we skip it on web and
      // launch the picker directly.
      if (Platform.OS !== "web") {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          setPhotoError(
            "Enable photo library access in Settings to choose a profile photo."
          );
          return;
        }
      }
      // mediaTypes defaults to images; omitted to avoid version-specific
      // MediaTypeOptions/MediaType API churn across expo-image-picker releases.
      // allowsEditing/aspect/quality apply on native; web ignores them.
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (result.canceled || !user) return;
      setPhotoStatus("uploading");
      try {
        const asset = result.assets[0];
        await uploadProfilePhoto(user.uid, asset.uri, {
          width: asset.width,
          height: asset.height,
        });
        await refreshUser();
        setPhotoModalVisible(false);
      } catch (err: any) {
        setPhotoError(err.message ?? "Upload failed. Please try again.");
      } finally {
        setPhotoStatus("idle");
      }
    } finally {
      pickerActiveRef.current = false;
    }
  }

  async function handleRemovePhoto() {
    if (!user) return;
    setPhotoError(null);
    setPhotoStatus("removing");
    try {
      await removeProfilePhoto(user.uid);
      await refreshUser();
      setPhotoModalVisible(false);
    } catch (err: any) {
      setPhotoError(err.message ?? "Couldn't remove photo. Please try again.");
    } finally {
      setPhotoStatus("idle");
    }
  }

  function openPhotoOptions() {
    if (photoBusy || pickerActiveRef.current) return;
    setPhotoError(null);
    setPhotoModalVisible(true);
  }

  function closePhotoModal() {
    if (photoBusy) return; // don't dismiss mid-upload/remove
    setPhotoModalVisible(false);
    setPhotoError(null);
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
        <TouchableOpacity
          className="items-center pb-4"
          onPress={openPhotoOptions}
          disabled={photoBusy}
          accessibilityRole="button"
          accessibilityLabel="Profile photo"
          accessibilityHint="Opens options to change or remove your profile photo"
        >
          {user?.photoURL ? (
            <Image
              source={{ uri: user.photoURL }}
              style={{ width: 80, height: 80, borderRadius: 40 }}
            />
          ) : (
            <View
              className="rounded-full items-center justify-center bg-gray-200"
              style={{ width: 80, height: 80 }}
            >
              <Ionicons name="camera-outline" size={28} color="gray" />
            </View>
          )}
          <Text className="text-sm text-peach mt-2">
            {photoStatus === "uploading"
              ? "Uploading…"
              : photoStatus === "removing"
                ? "Removing…"
                : "Change photo"}
          </Text>
        </TouchableOpacity>
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
                className="bg-red-600 rounded-full px-5 py-2 items-center justify-center"
                onPress={handleReauthAndDelete}
                disabled={deleting || !password}
              >
                <Text className="text-white font-semibold text-center">
                  {deleting ? "..." : "Delete"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Photo chooser modal. Built as a Modal (not Alert.alert) because
          react-native-web's Alert is a no-op — an action sheet would do
          nothing on web. */}
      <Modal
        visible={photoModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closePhotoModal}
      >
        <View
          className="flex-1 justify-center items-center px-8"
          style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
        >
          <View className="bg-white rounded-2xl p-5 w-full">
            <Text className="text-base font-semibold mb-2">Profile photo</Text>
            {photoError && (
              <Text className="text-sm text-red-600 mb-3">{photoError}</Text>
            )}
            <TouchableOpacity
              className="rounded-full bg-peach px-4 py-3"
              onPress={pickAndUpload}
              disabled={photoBusy}
            >
              <Text className="text-white font-semibold text-center">
                {photoStatus === "uploading" ? "Uploading…" : "Change photo"}
              </Text>
            </TouchableOpacity>
            {user?.photoURL && (
              <TouchableOpacity
                className="rounded-full border border-red-200 px-4 py-3 mt-3"
                onPress={handleRemovePhoto}
                disabled={photoBusy}
              >
                <Text className="text-red-600 font-semibold text-center">
                  {photoStatus === "removing" ? "Removing…" : "Remove photo"}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              className="px-4 py-3 mt-1"
              onPress={closePhotoModal}
              disabled={photoBusy}
            >
              <Text className="text-base text-gray-500 text-center">Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
