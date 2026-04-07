# Forgot Password Flow

## Overview

Add a "Forgot password?" flow to the auth stack, allowing users to request a password reset email via Firebase Auth. The flow prioritizes user privacy by always showing a generic confirmation message regardless of whether the email exists.

## User Flow

1. User taps "Forgot password?" link on Login screen
2. App navigates to ForgotPasswordScreen
3. User enters their email and taps "Send Reset Link"
4. App calls Firebase's `sendPasswordResetEmail`
5. Screen shows generic message: "If an account exists with this email, you'll receive a reset link"
6. User taps "Back to Login" to return to Login screen

## Architecture

### New File: `src/screens/auth/ForgotPasswordScreen.tsx`

- Follows existing Login/SignUp screen patterns
- NativeWind styling consistent with LoginScreen (`flex-1 justify-center p-6`)
- Two states:
  - **Form state:** Email TextInput + "Send Reset Link" button (peach bg, white text)
  - **Success state:** Generic confirmation message + "Back to Login" link
- Loading state: button disabled, text changes to "Sending..."

### Modified: `src/services/auth.ts`

Add `resetPassword(email: string)` function:
- Wraps Firebase `sendPasswordResetEmail(auth, email)`
- Catches and suppresses `auth/user-not-found` and `auth/invalid-email` errors (privacy)
- Re-throws network errors so they can be surfaced to the user

### Modified: `src/navigation/AuthStack.tsx`

- Add `ForgotPassword: undefined` to `AuthStackParamList`
- Add `<Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />` to the navigator

### Modified: `src/screens/auth/LoginScreen.tsx`

- Add "Forgot password?" TouchableOpacity link between the Log In button and the Sign Up link
- Navigates to `ForgotPassword` screen
- Styled as small peach-colored text, matching the Sign Up link style

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Valid email with account | Firebase sends reset email; generic success message shown |
| Valid email without account | Firebase error suppressed; same generic success message shown |
| Invalid email format | Firebase error suppressed; same generic success message shown |
| Empty email | Alert: "Please enter your email address" (pre-submit validation) |
| Network error | Alert: "Something went wrong. Please check your connection and try again." |

## Files Changed Summary

| File | Change |
|------|--------|
| `src/screens/auth/ForgotPasswordScreen.tsx` | New file |
| `src/services/auth.ts` | Add `resetPassword()` function |
| `src/navigation/AuthStack.tsx` | Add ForgotPassword route |
| `src/screens/auth/LoginScreen.tsx` | Add "Forgot password?" link |

## No Changes To

- AuthContext / AuthProvider
- Firebase config
- Any authenticated screens
- No new dependencies required
