# peach

Unabashed peach clone.

## Roadmap

Peach is close to MVP. Remaining functionality is tracked below by milestone. See
[`docs/superpowers/specs/2026-06-14-functionality-roadmap-design.md`](docs/superpowers/specs/2026-06-14-functionality-roadmap-design.md)
for the detailed design and the decisions behind it.

### Tier 1 — MVP-required

**Settings page** _(entry: gear icon in My Page header)_

- [ ] Settings screen + navigation route from My Page
- [ ] Edit display name (updates `displayName` on the user doc)
- [ ] Delete account — hard delete (posts, friendships, notifications, user doc, Auth account) behind a confirmation dialog; handle Firebase's recent-login re-auth requirement
- [ ] Sign out control lives in Settings

**Avatar with initials** _(enabler for the feeds below)_

- [ ] Render colored initials from `displayName`; accept an optional `photoURL` prop (unused until Tier 3)
- [ ] Thread `displayName` into all `Avatar` usages

**Activity feed / notifications** _(entry: icon beside the gear in My Page header)_

- [ ] `users/{uid}/notifications` subcollection + service (create / list / mark read)
- [ ] `addComment` fans out a `comment` notification to the post owner (never self)
- [ ] `likePost` / `unlikePost` create / remove a `like` notification
- [ ] Activity screen UI: avatar + display name + verb + time + post preview; tapping a row opens the post
- [ ] `activityLastReadAt` on the user doc; unread dot on the header icon; opening Activity marks read
- [ ] Firestore security rules for `notifications`

### Tier 2 — Pre-MVP

**Blue dots for new activity** _(on the homepage friend lines)_

- [ ] `users/{uid}/viewedFriends/{friendUid}` docs storing `lastViewedAt`
- [ ] Homepage shows a blue dot when a friend's `meta.lastPostAt` is newer than my `lastViewedAt` (or never viewed)
- [ ] Opening a friend's page stamps `lastViewedAt = now`, clearing the dot
- [ ] Firestore security rules for `viewedFriends`

### Tier 3 — P1 (post-MVP)

**Tagging / @mentions**

- [ ] Exact `getUserByUsername` lookup (today only prefix search exists)
- [ ] Mention parser util; render `@username` as a tappable link in posts and comments
- [ ] Non-friend gated Friend Page state + "Request Friend" button ("Requested" when pending)
- [ ] `tag` notifications when a user is mentioned in a post or comment (extends the Tier 1 feed)
- [ ] _(Optional)_ `@` autocomplete in the composer / comment input

**Profile photo upload** _(the deferred half of Settings)_

- [ ] Add Firebase Storage + `expo-image-picker`
- [ ] Pick a photo → upload → store `photoURL` on the user doc
- [ ] `Avatar` renders `photoURL` (initials fallback)
- [ ] Photo picker UI in Settings

### Out of scope (for now)

- Real push notifications — the activity feed is in-app only.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Expo Go](https://expo.dev/go) app on your phone (optional, for mobile testing)

## Setup

```bash
npm install
```

## Running the app

```bash
# Start Expo dev server (opens options for web, iOS, Android)
npm start

# Launch directly in web browser
npm run web

# Launch on iOS simulator
npm run ios

# Launch on Android emulator
npm run android
```

To run on your physical phone, install Expo Go and scan the QR code shown in the terminal.

## Running tests

```bash
# Run all tests
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run a specific test file
npx jest tests/screens/HelloScreen.test.tsx
```
