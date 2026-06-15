import { Alert, Platform } from "react-native";

// react-native-web ships an Alert whose `alert()` is an empty no-op, so the
// native Alert.alert dialogs silently do nothing on web. These helpers fall
// back to the browser's window.confirm / window.alert on web and use the real
// Alert on native, giving us one cross-platform API for confirmations.

/**
 * Ask the user to confirm a destructive action. Resolves true if they confirm,
 * false if they cancel/dismiss.
 */
export function confirmDestructive(
  title: string,
  message: string,
  confirmLabel: string = "Delete"
): Promise<boolean> {
  if (Platform.OS === "web") {
    const ok =
      typeof window !== "undefined" && window.confirm(`${title}\n\n${message}`);
    return Promise.resolve(!!ok);
  }

  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      { text: confirmLabel, style: "destructive", onPress: () => resolve(true) },
    ]);
  });
}

/** Show a simple informational message (single dismiss). */
export function notify(title: string, message: string): void {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
}
