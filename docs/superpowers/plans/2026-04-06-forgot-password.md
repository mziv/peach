# Forgot Password Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Forgot password?" flow so users can request a Firebase password reset email from the login screen.

**Architecture:** New `ForgotPasswordScreen` in the AuthStack, a `resetPassword` service function wrapping Firebase's `sendPasswordResetEmail`, and a link on the LoginScreen. Privacy-safe: always shows a generic confirmation regardless of whether the email exists.

**Tech Stack:** React Native, NativeWind, Firebase Auth, React Navigation

---

### File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/services/auth.ts` | Modify | Add `resetPassword()` function |
| `src/screens/auth/ForgotPasswordScreen.tsx` | Create | Forgot password UI (form + success states) |
| `src/navigation/AuthStack.tsx` | Modify | Add ForgotPassword route |
| `src/screens/auth/LoginScreen.tsx` | Modify | Add "Forgot password?" navigation link |

---

### Task 1: Add `resetPassword` service function

**Files:**
- Modify: `src/services/auth.ts`

- [ ] **Step 1: Add the `resetPassword` function to `src/services/auth.ts`**

Add the import for `sendPasswordResetEmail` to the existing Firebase Auth import, then add the function at the bottom of the file:

```typescript
// Add sendPasswordResetEmail to the existing import:
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
} from "firebase/auth";

// Add at end of file:
export async function resetPassword(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (err: any) {
    if (
      err.code === "auth/user-not-found" ||
      err.code === "auth/invalid-email"
    ) {
      return; // Suppress for privacy — caller always shows generic success
    }
    throw err; // Re-throw network errors etc.
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/auth.ts
git commit -m "feat: add resetPassword service function"
```

---

### Task 2: Create `ForgotPasswordScreen`

**Files:**
- Create: `src/screens/auth/ForgotPasswordScreen.tsx`

- [ ] **Step 1: Create the screen file**

Create `src/screens/auth/ForgotPasswordScreen.tsx` with this content:

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/auth/ForgotPasswordScreen.tsx
git commit -m "feat: add ForgotPasswordScreen"
```

---

### Task 3: Add ForgotPassword route to AuthStack

**Files:**
- Modify: `src/navigation/AuthStack.tsx`

- [ ] **Step 1: Update `AuthStackParamList` and add the screen**

In `src/navigation/AuthStack.tsx`:

1. Add the import:
```typescript
import { ForgotPasswordScreen } from "../screens/auth/ForgotPasswordScreen";
```

2. Add `ForgotPassword` to the type:
```typescript
export type AuthStackParamList = {
  Login: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
};
```

3. Add the screen inside `<Stack.Navigator>`, after the SignUp screen:
```tsx
<Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
```

- [ ] **Step 2: Commit**

```bash
git add src/navigation/AuthStack.tsx
git commit -m "feat: add ForgotPassword route to AuthStack"
```

---

### Task 4: Add "Forgot password?" link to LoginScreen

**Files:**
- Modify: `src/screens/auth/LoginScreen.tsx`

- [ ] **Step 1: Add the link between the Log In button and Sign Up link**

In `src/screens/auth/LoginScreen.tsx`, add this `TouchableOpacity` between the existing Log In button (`</TouchableOpacity>` at ~line 57) and the Sign Up `TouchableOpacity` (at ~line 58):

```tsx
<TouchableOpacity onPress={() => navigation.navigate("ForgotPassword")}>
  <Text className="text-center text-peach text-sm mb-2">
    Forgot your password?
  </Text>
</TouchableOpacity>
```

- [ ] **Step 2: Verify the app compiles and the flow works**

Run: `npx expo start`

Test manually:
1. Login screen shows "Forgot your password?" link
2. Tapping it navigates to the Reset Password screen
3. Submitting an email shows the confirmation message
4. "Back to Login" navigates back

- [ ] **Step 3: Commit**

```bash
git add src/screens/auth/LoginScreen.tsx
git commit -m "feat: add forgot password link to LoginScreen"
```
