# peach

Unabashed peach clone.

## Roadmap

Peach is close to MVP. Remaining functionality is tracked below by milestone. See
[`docs/superpowers/specs/2026-06-14-functionality-roadmap-design.md`](docs/superpowers/specs/2026-06-14-functionality-roadmap-design.md)
for the detailed design and the decisions behind it.

### Tier 1 — MVP-required

**Settings page** _(entry: gear icon in My Page header)_

- [x] Settings screen + navigation route from My Page
- [x] Edit display name (updates `displayName` on the user doc)
- [x] Delete account — hard delete (posts, friendships, notifications, user doc, Auth account) behind a confirmation dialog; handle Firebase's recent-login re-auth requirement
- [x] Sign out control lives in Settings

**Avatar with initials** _(enabler for the feeds below)_

- [ ] Render colored initials from `displayName`; accept an optional `photoURL` prop (unused until Tier 3)
- [ ] Thread `displayName` into all `Avatar` usages

**Activity feed / notifications** _(entry: icon beside the gear in My Page header)_

- [x] `users/{uid}/notifications` subcollection + service (create / list / mark read)
- [x] `addComment` fans out a `comment` notification to the post owner (never self)
- [x] `likePost` / `unlikePost` create / remove a `like` notification
- [x] Double-tap a post to like it (idempotent — never unlikes; heart button keeps its single-tap toggle)
- [x] Activity screen UI: avatar + display name + verb + time + post preview; tapping a comment row opens that post's comment thread (like rows are non-interactive)
- [x] `activityLastReadAt` on the user doc; unread dot on the header icon; opening Activity marks read
- [x] Firestore security rules for `notifications`

> The `notifications` rules live in `firestore.rules` (wired for deploy via `firebase.json`).

### Tier 2 — Pre-MVP

**Green dots for new activity** _(on the homepage friend lines, matching the reference app)_

- [x] `users/{uid}/viewedFriends/{friendUid}` docs storing `lastViewedAt`
- [x] Homepage shows a green dot when a friend's `meta.lastPostAt` is newer than my `lastViewedAt` (or never viewed)
- [x] Opening a friend's page stamps `lastViewedAt = now`, clearing the dot
- [x] Firestore security rules for `viewedFriends`

### Tier 3 — P1 (post-MVP)

**Tagging / @mentions**

- [ ] Exact `getUserByUsername` lookup (today only prefix search exists)
- [ ] Mention parser util; render `@username` as a tappable link in posts and comments
- [ ] Non-friend gated Friend Page state + "Request Friend" button ("Requested" when pending)
- [ ] `tag` notifications when a user is mentioned in a post or comment (extends the Tier 1 feed)
- [ ] _(Optional)_ `@` autocomplete in the composer / comment input

**Profile photo upload** _(the deferred half of Settings)_

- [x] Add Firebase Storage + `expo-image-picker`
- [x] Pick a photo → upload → store `photoURL` on the user doc
- [x] `Avatar` renders `photoURL` (initials fallback)
- [x] Photo picker UI in Settings
- [x] Storage security rules: owner-only avatar writes, signed-in reads
- [x] Storage CORS policy so web uploads work
- [x] Downscale to 512px / JPEG q0.7 before upload (native + web)

> Storage rules live in `storage.rules` (wired for deploy via `firebase.json`).
> The bucket also needs a one-time CORS policy — see Setup below.

**Photos in posts**

- [x] Attach up to 4 photos to a post (`expo-image-picker`, multi-select)
- [x] Write-first flow: post text saves immediately, photos upload then patch the doc
- [x] Photos render stacked inline in the post card
- [x] Photos display at their original aspect ratio (no square cropping)
- [x] Downscale to 1600px / JPEG q0.7 before upload (native + web)
- [x] `deletePost` cleans up the post's Storage objects
- [x] Storage rules: owner-only post-photo writes, signed-in reads

### Out of scope (for now)

- Real push notifications — the activity feed is in-app only.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Expo Go](https://expo.dev/go) app on your phone (optional, for mobile testing)

## Setup

```bash
npm install
```

### Firebase Storage CORS (required for profile photo uploads)

Browser uploads to Firebase Storage are blocked by CORS until a policy is applied
to the bucket. The policy lives in [`storage.cors.json`](storage.cors.json) (allows
`localhost` dev ports + the production domain). Apply it once per bucket:

```bash
# Requires the Google Cloud SDK (`brew install --cask google-cloud-sdk`)
gcloud auth login
gsutil cors set storage.cors.json gs://peach-clone.firebasestorage.app
gsutil cors get gs://peach-clone.firebasestorage.app   # verify
```

CORS matches on origin (scheme + host + port) only — the path is ignored. When
adding a new deploy origin, add it to `storage.cors.json` and re-run `cors set`.

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
