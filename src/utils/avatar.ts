// Palette of background colors used for initials-based avatars. Picked to read
// well with white text and to feel at home next to the app's peach accent.
export const AVATAR_COLORS = [
  "#F5A623", // amber
  "#E8643C", // peach/coral
  "#D0567E", // rose
  "#9B59B6", // purple
  "#5B6CF0", // indigo
  "#2D9CDB", // blue
  "#27AE94", // teal
  "#6FA82F", // green
];

/**
 * Derive up to two uppercase initials from a display name. Uses the first
 * letter of the first and last words ("Maya Jane Ziv" -> "MZ"), a single
 * initial for one-word names, and "?" when there is nothing to show.
 */
export function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0][0].toUpperCase();
  const first = words[0][0];
  const last = words[words.length - 1][0];
  return (first + last).toUpperCase();
}

/**
 * Deterministically map a seed string (typically a display name) to one of the
 * palette colors, so a given user always gets the same avatar background.
 */
export function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}
