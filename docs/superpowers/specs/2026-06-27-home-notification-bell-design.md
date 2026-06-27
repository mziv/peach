# Home Screen Header: Notification Bell + Settings — Design

## Goal
Give `HomeScreen` a header bar with the app title and quick access to notifications and settings.

## Current state
- `HomeScreen.tsx` has **no header** (stack uses `headerShown: false`).
- `MyPageScreen.tsx` (lines ~244–256) already implements the exact pattern: bell with unread dot + settings gear.
- `useUnreadActivity(uid)` hook drives the unread dot.
- `HomeStack` registers `Activity` and `Settings` routes — both reachable from `Home`.

## Design
Add a header `View` at the top of `HomeScreen`:
- **Left:** `peach` title text (styled consistently with the app).
- **Right:** notification bell (`notifications-outline`) with a peach unread dot when `useUnreadActivity(user?.uid)` is true, navigating to `Activity`; settings gear (`settings-outline`) navigating to `Settings`.

Mirror the MyPageScreen header markup (Ionicons, spacing `gap-3`, unread dot at `-top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-peach`).

## Out of scope
- Changing the activity feed itself or notification creation.

## Files
- `src/screens/home/HomeScreen.tsx` — add header, import `useUnreadActivity`, wire navigation.
