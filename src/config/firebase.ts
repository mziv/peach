import { initializeApp } from "firebase/app";
import { getAuth, initializeAuth, getReactNativePersistence } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";
import { Platform } from "react-native";

const firebaseConfig = {
  apiKey: "AIzaSyCpYQvMuw8cTwut9Fy2abOPzGWXgtkgk8Y",
  authDomain: "peach-clone.firebaseapp.com",
  projectId: "peach-clone",
  storageBucket: "peach-clone.firebasestorage.app",
  messagingSenderId: "889806133846",
  appId: "1:889806133846:web:083594786555c3c3d839f7",
  measurementId: "G-08VY6BESEF",
};

const app = initializeApp(firebaseConfig);

let auth;
if (Platform.OS === "web") {
  auth = getAuth(app);
} else {
  const ReactNativeAsyncStorage = require("@react-native-async-storage/async-storage").default;
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage),
  });
}

export { auth };

// On mobile browsers/networks, Firestore's default WebChannel streaming
// transport often stalls before falling back to long-polling, leaving the
// app stuck. Auto-detecting long-polling avoids that initial stall.
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
});
