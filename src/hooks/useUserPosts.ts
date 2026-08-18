import { useCallback, useEffect, useRef, useState } from "react";
import {
  collection,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  DocumentData,
  QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { useAuth } from "../contexts/AuthContext";
import { hasLiked, likePost, unlikePost } from "../services/likes";
import { Post } from "../types";

// Posts load a page at a time, newest first, so the feed can render as an
// inverted (chat-style) list without holding a user's entire history in memory.
export const PAGE_SIZE = 10;

// Merge a freshly-emitted live "head" page (the newest PAGE_SIZE posts, kept in
// real time by onSnapshot) with the posts we already had. The live page is
// authoritative for any post it contains — a new like/comment count or a
// brand-new post shows up here — so it wins on id collisions; everything older
// is preserved below it. Both inputs are newest-first, and so is the result.
export function mergeLiveHead(livePage: Post[], prev: Post[]): Post[] {
  const liveIds = new Set(livePage.map((p) => p.postId));
  return [...livePage, ...prev.filter((p) => !liveIds.has(p.postId))];
}

// Append an older, statically-fetched page to the tail. Dedupe by id so the
// boundary between the live head and the paged tail can never double up a post
// (e.g. if a new post shifted the window between fetches).
export function appendOlder(prev: Post[], olderPage: Post[]): Post[] {
  const seen = new Set(prev.map((p) => p.postId));
  return [...prev, ...olderPage.filter((p) => !seen.has(p.postId))];
}

function docToPost(d: QueryDocumentSnapshot<DocumentData>): Post {
  const data = d.data();
  return {
    postId: d.id,
    text: data.text,
    createdAt: data.createdAt?.toDate() ?? new Date(),
    commentCount: data.commentCount ?? 0,
    likeCount: data.likeCount ?? 0,
    photoURLs: data.photoURLs ?? [],
  };
}

export interface UseUserPosts {
  posts: Post[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  loadOlder: () => void;
  likedMap: Record<string, boolean>;
  toggleLike: (postId: string) => void;
  doubleTapLike: (postId: string) => void;
}

// Shared post-feed data source for a user's profile page (My Page and a
// friend's page). The newest PAGE_SIZE posts stay live via onSnapshot; older
// pages are pulled on demand with one-shot reads as the reader scrolls up.
export function useUserPosts(ownerUid: string | undefined): UseUserPosts {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Pagination cursors: the last doc of the live head, and the last doc of the
  // most recently paged-in older batch. startAfter() needs the raw snapshot,
  // not our mapped Post, so we keep them in refs alongside the mapped state.
  const liveLastDocRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  const olderLastDocRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  const hasPagedRef = useRef(false);
  const loadingMoreRef = useRef(false);

  async function likeMapFor(uidOwner: string, likerUid: string, page: Post[]) {
    const checks = await Promise.all(
      page.map((p) => hasLiked(uidOwner, p.postId, likerUid))
    );
    const next: Record<string, boolean> = {};
    page.forEach((p, i) => {
      next[p.postId] = checks[i];
    });
    return next;
  }

  useEffect(() => {
    if (!ownerUid) return;

    // Reset for a new owner so navigating between profiles never shows the
    // previous person's posts or a stale cursor.
    setPosts([]);
    setLikedMap({});
    setLoading(true);
    setHasMore(true);
    liveLastDocRef.current = null;
    olderLastDocRef.current = null;
    hasPagedRef.current = false;

    const q = query(
      collection(db, "users", ownerUid, "posts"),
      orderBy("createdAt", "desc"),
      limit(PAGE_SIZE)
    );
    const unsubscribe = onSnapshot(q, async (snap) => {
      // Firestore's offline cache makes onSnapshot fire twice: once with the
      // locally-cached docs (instant, but stale) and again with server data.
      // Skip the cache emission so the feed paints once with fresh data.
      if (snap.metadata?.fromCache) return;

      const livePage = snap.docs.map(docToPost);
      liveLastDocRef.current = snap.docs[snap.docs.length - 1] ?? null;
      // A full first page means there may be older posts to page in; a short
      // one means we've already got everything. Only decide this before the
      // reader has paged — loadOlder owns hasMore afterwards.
      if (!hasPagedRef.current) {
        setHasMore(snap.docs.length === PAGE_SIZE);
      }
      setPosts((prev) => mergeLiveHead(livePage, prev));

      // Keep the spinner up until likes resolve too, so the feed appears fully
      // formed (hearts filled in) rather than popping likes in a beat later.
      if (user) {
        const liveLikes = await likeMapFor(ownerUid, user.uid, livePage);
        setLikedMap((prev) => ({ ...prev, ...liveLikes }));
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [ownerUid, user]);

  const loadOlder = useCallback(async () => {
    if (!ownerUid || loadingMoreRef.current || !hasMore) return;
    const cursor = olderLastDocRef.current ?? liveLastDocRef.current;
    if (!cursor) return;

    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const q = query(
        collection(db, "users", ownerUid, "posts"),
        orderBy("createdAt", "desc"),
        startAfter(cursor),
        limit(PAGE_SIZE)
      );
      const snap = await getDocs(q);
      hasPagedRef.current = true;
      const olderPage = snap.docs.map(docToPost);
      olderLastDocRef.current =
        snap.docs[snap.docs.length - 1] ?? olderLastDocRef.current;
      setHasMore(snap.docs.length === PAGE_SIZE);
      setPosts((prev) => appendOlder(prev, olderPage));

      if (user && olderPage.length > 0) {
        const olderLikes = await likeMapFor(ownerUid, user.uid, olderPage);
        setLikedMap((prev) => ({ ...prev, ...olderLikes }));
      }
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [ownerUid, hasMore, user]);

  const toggleLike = useCallback(
    async (postId: string) => {
      if (!user || !ownerUid) return;
      const isLiked = likedMap[postId] ?? false;
      const post = posts.find((p) => p.postId === postId);

      // Optimistic update
      setLikedMap((prev) => ({ ...prev, [postId]: !isLiked }));
      setPosts((prev) =>
        prev.map((p) =>
          p.postId === postId
            ? { ...p, likeCount: p.likeCount + (isLiked ? -1 : 1) }
            : p
        )
      );

      try {
        if (isLiked) {
          await unlikePost(ownerUid, postId, user.uid);
        } else {
          await likePost(
            ownerUid,
            postId,
            user.uid,
            user.username,
            user.displayName,
            user.photoURL,
            post?.text ?? ""
          );
        }
      } catch {
        // Revert on error
        setLikedMap((prev) => ({ ...prev, [postId]: isLiked }));
        setPosts((prev) =>
          prev.map((p) =>
            p.postId === postId
              ? { ...p, likeCount: p.likeCount + (isLiked ? 1 : -1) }
              : p
          )
        );
      }
    },
    [user, ownerUid, likedMap, posts]
  );

  // Double-tapping a post likes it but never unlikes. If it's already liked,
  // do nothing; otherwise reuse the toggle's optimistic like path.
  const doubleTapLike = useCallback(
    (postId: string) => {
      if (likedMap[postId]) return;
      toggleLike(postId);
    },
    [likedMap, toggleLike]
  );

  return {
    posts,
    loading,
    loadingMore,
    hasMore,
    loadOlder,
    likedMap,
    toggleLike,
    doubleTapLike,
  };
}
