// A lightweight, dependency-free double-tap detector.
//
// react-native-gesture-handler is intentionally NOT a dependency, so we detect
// double taps by hand: remember when the last tap landed, and treat the next
// tap as a double tap if it arrives within `windowMs`. The logic is pure and
// time-injectable so it can be unit tested without timers.

export const DOUBLE_TAP_WINDOW_MS = 300;

export interface DoubleTapDetector {
  // Records a tap at time `now` (ms). Returns true if this tap completes a
  // double tap (i.e. it followed a previous tap within the window).
  tap(now: number): boolean;
}

// Creates a stateful detector. Each completed double tap "consumes" the
// timestamp so a third quick tap doesn't immediately fire again — it takes two
// fresh taps to trigger the next double tap.
export function createDoubleTapDetector(
  windowMs: number = DOUBLE_TAP_WINDOW_MS
): DoubleTapDetector {
  let lastTapAt: number | null = null;

  return {
    tap(now: number): boolean {
      if (lastTapAt !== null && now - lastTapAt <= windowMs) {
        lastTapAt = null; // consume so a triple tap isn't two double taps
        return true;
      }
      lastTapAt = now;
      return false;
    },
  };
}
