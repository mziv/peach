# Peach App Visual Redesign Plan

## Context

The app works functionally but doesn't match the original Peach app's visual design. The user provided 4 screenshots (Homepage, My Page, Friend Page, Comment Modal) and wants a comprehensive restyling. This plan covers both the styling changes and the structural/navigation changes needed to match the original.

---

## Phase 0: Config & Dependencies

**Files:** `tailwind.config.js`

- Add `green: "#4CD964"` to the Tailwind color config (Peach's friend action color)
- `@expo/vector-icons` (Ionicons) is already bundled with Expo — no install needed

---

## Phase 1: Shared Components

Create `src/components/` with 4 reusable components that all subsequent screens depend on.

### `src/components/Avatar.tsx`
- Circular gray placeholder (`rounded-full bg-gray-300`)
- Props: `size?: number` (default 40)
- Later accepts `imageUri` for real profile photos

### `src/components/UserPreview.tsx`
- Row component for the home screen friend list
- Props: `displayName`, `username`, `previewText`, `timestamp?`, `onPress`
- Layout: Avatar | name + preview text (flex-1) | relative time | `>` chevron

### `src/components/PostItem.tsx`
- Single post in a feed (used on both MyPage and FriendPage)
- Props: `text`, `createdAt`, `commentCount`, `likeCount`, `isLiked`, `onLikePress`, `onCommentPress`
- Layout: post text, timestamp, action row (heart icon + count, comment bubble icon + count, relative time)
- Heart icon is filled/red when `isLiked`, outline when not. Tapping triggers `onLikePress`.
- Comment icon triggers `onCommentPress`.
- No share icon.

### `src/components/CommentModal.tsx`
- Bottom-sheet modal overlay replacing the current full-screen PostDetailScreen
- Props: `visible`, `onClose`, `postOwnerUid`, `postId`
- Uses React Native `Modal` with `animationType="slide"` + semi-transparent overlay
- Title bar: "Leave a comment" + X close button
- Comment list with Avatar + displayName + @handle + text (realtime Firestore listener, same pattern as current PostDetailScreen)
- Bottom input: "Say something nice" placeholder + green Send button
- Absorbs all comment logic from PostDetailScreen

---

## Phase 2: Likes Feature (Data Layer)

Add like support before building the UI that uses it.

### `src/services/likes.ts` (new)
- `likePost(postOwnerUid, postId, likerUid)` — creates a doc in `users/{uid}/posts/{postId}/likes/{likerUid}` and increments `likeCount` on the post doc (batch write, same pattern as comment count)
- `unlikePost(postOwnerUid, postId, likerUid)` — deletes the like doc and decrements `likeCount`
- `hasLiked(postOwnerUid, postId, likerUid)` — checks if a like doc exists

### `src/types/index.ts`
- Add `likeCount: number` to the `Post` interface

### `src/services/posts.ts`
- Include `likeCount` when reading post docs (same as `commentCount`)

### `tests/services/likes.test.ts`
- Unit tests for like/unlike/hasLiked

---

## Phase 3: Navigation Restructure

### `src/navigation/MainTabs.tsx` — 3 tabs to 2 tabs
- Remove MyPageTab entirely
- Two icon-only tabs (no text labels):
  - House icon (`Ionicons home-outline`) → HomeStack
  - People icon (`Ionicons people-outline`) → FriendsStack
- Style: `tabBarShowLabel: false`, dark active / light gray inactive icons

### `src/navigation/HomeStack.tsx` — Add MyPage + SearchUsers
- Add `MyPage: undefined` and `SearchUsers: undefined` to `HomeStackParamList`
- Add `friendUsername: string` to `FriendPage` params
- Remove `PostDetail` from param list (replaced by CommentModal)
- Set `headerShown: false` on all screens (custom headers in each screen)
- Import and register MyPageScreen and SearchUsersScreen as Stack.Screens

### `src/navigation/FriendsStack.tsx` — Hide default headers
- Set `headerShown: false` on all screens

### Delete `src/navigation/MyPageStack.tsx`
- No longer needed — MyPage lives in HomeStack

### Delete `src/screens/PostDetailScreen.tsx`
- Replaced by CommentModal

---

## Phase 4: Home Screen Redesign

**File:** `src/screens/home/HomeScreen.tsx`

Complete rewrite to match the Peach homepage screenshot:

1. **Self-preview at top**: UserPreview showing your own avatar, displayName, last post text, `>` chevron. Tapping navigates to `MyPage` in HomeStack.
2. **"Add Friend..." button**: Green pill button below self-preview. Navigates to `SearchUsers` in HomeStack.
3. **Friend list**: Each accepted friend shown as a UserPreview row with avatar, displayName, post preview, relative time. Tapping navigates to FriendPage.
4. **No default header** — clean white background.
5. Also need to fetch user's own meta for the self-preview row.

---

## Phase 5: MyPage + FriendPage Redesign

Both pages share nearly identical layouts with a few key differences.

### `src/screens/mypage/MyPageScreen.tsx`
- **Navigation type**: Change from `MyPageStackParamList` to `HomeStackParamList`
- **Custom sticky header**: Back chevron + Avatar(32) + displayName bold + @handle gray | right side: activity log icon (chat bubble with heart, stub for now) + gear icon (stub — shows log out via Alert for now)
- **Post feed**: Use PostItem component with like support. `onCommentPress` opens CommentModal. `onLikePress` toggles like.
- **Composer at bottom**: "write something..." input + "Post" button, restyled to match screenshot (single-line, subtle)
- **CommentModal state**: `{ visible, postOwnerUid, postId }` — rendered at component bottom

### `src/screens/home/FriendPageScreen.tsx`
- **Custom sticky header**: Back chevron + Avatar(32) + displayName bold + @handle gray (no gear/activity icons)
- **Route params**: Now receives `friendUsername` in addition to existing params
- **Post feed**: Use PostItem component with like support. `onCommentPress` opens CommentModal.
- **No composer** at the bottom
- Update HomeScreen navigation call to pass `friendUsername`

---

## Phase 6: Friends Tab Restyle

### `src/screens/friends/FriendRequestsScreen.tsx`
- Custom header ("Friends" title, no default React Navigation header)
- Use Avatar component in all rows
- Restyle accept/decline buttons to match Peach's cleaner look
- Green pill "Add Friend..." button styling

### `src/screens/friends/SearchUsersScreen.tsx`
- Custom header with back arrow
- Use Avatar component in search results
- Green "Add" button style

---

## Phase 7: Cleanup & Tests

- Remove `src/navigation/MyPageStack.tsx`
- Remove `src/screens/PostDetailScreen.tsx`
- Remove `src/screens/HelloScreen.tsx` (no longer used)
- Update `tests/` — replace HelloScreen test with tests for new components/services
- Run all tests, fix any breakage

---

## Future Features (NOT in this pass)

### Settings Page
- Accessible from gear icon on MyPage header
- Change display name, password, profile photo, delete account

### Profile Photos
- Upload option during account creation
- Update from settings page
- Display in Avatar component (already designed with future `imageUri` prop)

### Activity Log
- Accessible from chat-bubble-with-heart icon on MyPage header (top right)
- Shows who liked your posts and who commented on your posts
- Chronological feed of activity on your content

---

## Additional Differences from Screenshots (Not Mentioned by User)

1. **Post action row**: Original Peach shows heart, comment bubble, and relative time on every post. Our app has none of these. Plan adds them via PostItem component with working likes and comments.

2. **No default React Navigation headers**: Original Peach uses custom slim headers everywhere. Plan removes all default headers and builds custom ones.

3. **Circular avatars everywhere**: Original uses profile photos in circular frames. Plan adds gray circle placeholders now, designed for easy photo support later.

4. **Green accent for friend actions**: Original uses green (#4CD964) for "Add Friend" buttons, not our coral/peach color. Plan adds the green token.

5. **Composer styling**: Original's composer is a subtle single-line input at the bottom ("write something..."), not a tall textarea. Plan restyles to match.

6. **Tab bar is icon-only**: Original has no text labels on tabs, just minimal outline icons. Plan implements this.

---

## Verification

After implementation:
1. `npx jest` — all tests pass
2. `npx expo start --web` — visual verification:
   - 2 icon-only tabs at bottom
   - Home shows self-preview, Add Friend button, friend list with avatars
   - Tapping self-preview → MyPage with custom header, posts with like/comment actions, composer
   - Tapping a friend → FriendPage with custom header, posts with like/comment actions
   - Tapping heart on a post → toggles like, count updates
   - Tapping comment icon on a post → modal slides up
   - Friends tab shows clean request management with avatars
3. Test on Expo Go (phone) for modal keyboard behavior
