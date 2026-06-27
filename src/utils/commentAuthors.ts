import { Comment, User } from "../types";

/**
 * Author info we cache per uid so comment rows can show a real avatar.
 * `displayName` and `photoURL` mirror the looked-up user doc; either may be
 * absent (no display name set / no photo uploaded).
 */
export interface CommentAuthorInfo {
  displayName?: string;
  photoURL?: string;
}

/**
 * Collects the distinct author uids across a comment list, skipping any uid
 * already present in `known` so we never look the same user up twice. Returns
 * them in first-seen order (stable, handy for tests).
 */
export function distinctAuthorUids(
  comments: Comment[],
  known: ReadonlySet<string> = new Set()
): string[] {
  const seen = new Set<string>(known);
  const result: string[] = [];
  for (const comment of comments) {
    const uid = comment.authorUid;
    if (!uid || seen.has(uid)) continue;
    seen.add(uid);
    result.push(uid);
  }
  return result;
}

/**
 * Folds a resolved user (or null, when the lookup found nothing / failed) into
 * a new author-info map keyed by uid. Records an entry even for a null user so
 * we don't retry a uid we've already resolved; the row then falls back to the
 * comment's stored username initials.
 */
export function withAuthorInfo(
  current: ReadonlyMap<string, CommentAuthorInfo>,
  uid: string,
  user: User | null
): Map<string, CommentAuthorInfo> {
  const next = new Map(current);
  next.set(uid, {
    displayName: user?.displayName,
    photoURL: user?.photoURL,
  });
  return next;
}
