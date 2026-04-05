# Peach Clone — MVP Design Spec

## Overview

A social media app cloning the core experience of Peach (by Dom Hofmann). This MVP focuses on posting, friends, and commenting — no magic words, drawings, or other advanced features. Targets iOS, Android, and web from a single codebase.

## Tech Stack

- **Frontend:** React Native with Expo (managed workflow), TypeScript
- **Navigation:** React Navigation (stack navigator + bottom tab navigator)
- **Backend/Database:** Firebase — Auth (email/password), Firestore (data), Cloud Functions (server-side logic if needed)
- **State Management:** React Context for auth state; component-level state + Firestore `onSnapshot` listeners for realtime data
- **Platforms:** iOS, Android, Web — all via Expo

## Features

### Account Creation & Login
- Email/password authentication via Firebase Auth
- Sign-up requires: email, password, username, display name
- Username must be unique (enforced by querying `users` collection before creation)
- Auth state listener determines which navigation stack is shown

### Posting
- Users can create text posts on their own page
- Posts appear in reverse chronological order (newest first)
- Creating a post writes to `users/{uid}/posts` and batch-updates `users/{uid}/meta` with preview text and timestamp

### Friend Requests
- Users search for others by username
- Search with no results shows "No users found"
- Cannot send a request to someone you already have a pending or accepted friendship with (button disabled or hidden)
- Sending a request creates a `friendship` doc with status "pending"
- Receiver sees incoming requests in their Friend Requests screen
- Accept: updates status to "accepted"
- Decline: deletes the friendship doc

### Viewing Friends' Pages
- Tap a friend on the home screen to view their posts
- Posts displayed in reverse chronological order, scrollable
- Realtime updates via Firestore `onSnapshot`

### Commenting
- Tap a post to view its comments and add new ones
- Comments stored as a subcollection under the post
- Author username is denormalized onto the comment doc for display

### Home Screen
- List of accepted friends, sorted by most recent post
- Each entry shows: display name + first ~100 characters of their latest post
- Tapping a friend navigates to their page

## Data Model (Firestore)

### `users` collection
| Field | Type | Description |
|-------|------|-------------|
| `uid` | string | Matches Firebase Auth UID |
| `username` | string | Unique, lowercase, used for search |
| `displayName` | string | User's display name |
| `createdAt` | timestamp | Account creation time |

### `users/{uid}/posts` subcollection
| Field | Type | Description |
|-------|------|-------------|
| `postId` | string | Auto-generated |
| `text` | string | Post content |
| `createdAt` | timestamp | Post creation time |

### `users/{uid}/posts/{postId}/comments` subcollection
| Field | Type | Description |
|-------|------|-------------|
| `commentId` | string | Auto-generated |
| `authorUid` | string | Commenter's UID |
| `authorUsername` | string | Denormalized for display |
| `text` | string | Comment content |
| `createdAt` | timestamp | Comment creation time |

### `friendships` collection (top-level)
| Field | Type | Description |
|-------|------|-------------|
| `friendshipId` | string | Auto-generated |
| `requesterId` | string | UID of user who sent the request |
| `receiverId` | string | UID of user who received the request |
| `status` | string | "pending" or "accepted" |
| `createdAt` | timestamp | Request creation time |

Composite index on `receiverId + status` for efficient pending request queries. Use Firestore `or()` filter to query all friendships for a given user.

### `users/{uid}/meta` doc
| Field | Type | Description |
|-------|------|-------------|
| `lastPostText` | string | First ~100 chars of most recent post |
| `lastPostAt` | timestamp | Time of most recent post |

Denormalized data to power the home screen without querying every friend's posts subcollection.

## Screens & Navigation

### Auth Stack (logged out)
- **Login Screen** — email + password fields, link to sign up
- **Sign Up Screen** — email, password, username, display name fields

### Main Stack (logged in, bottom tab navigator)

**Home Tab**
- **Home Screen** — friend list with post previews, sorted by recency
- **Friend Page Screen** — a friend's posts in reverse chronological order
- **Post Detail Screen** — a single post with comments + comment input

**My Page Tab**
- **My Page Screen** — your posts + "new post" button. Tapping a post goes to Post Detail Screen.

**Friends Tab**
- **Friend Requests Screen** — incoming requests (accept/decline) and outgoing pending requests
- **Search Users Screen** — search by username, send friend requests

### Navigation Logic
Auth state (Firebase Auth listener) conditionally renders Auth Stack or Main Stack. Each tab in the Main Stack has its own stack navigator for push/pop screen transitions.

## Key Behaviors

### Realtime Updates
Firestore `onSnapshot` listeners provide live updates:
- Home screen: friendships + friend meta docs
- Friend page: friend's posts subcollection
- Post detail: post's comments subcollection

### Data Consistency
- Post creation + meta update use Firestore batch writes
- Username uniqueness checked before account creation
- Author username denormalized on comments to avoid extra reads

## Future Enhancements (Out of Scope)
- Blue dot indicator for unseen friend posts (requires per-user-per-friend "last viewed" tracking)
- Magic words
- GIFs, drawings, and other media
- Push notifications
- Profile pictures
