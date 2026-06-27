import {
  createDoubleTapDetector,
  DOUBLE_TAP_WINDOW_MS,
} from "../../src/utils/doubleTap";

describe("createDoubleTapDetector", () => {
  it("does not fire on a single tap", () => {
    const d = createDoubleTapDetector();
    expect(d.tap(0)).toBe(false);
  });

  it("fires when a second tap lands within the window", () => {
    const d = createDoubleTapDetector();
    expect(d.tap(0)).toBe(false);
    expect(d.tap(DOUBLE_TAP_WINDOW_MS)).toBe(true);
  });

  it("does not fire when the second tap is too slow", () => {
    const d = createDoubleTapDetector();
    expect(d.tap(0)).toBe(false);
    expect(d.tap(DOUBLE_TAP_WINDOW_MS + 1)).toBe(false);
  });

  it("treats a third quick tap as the start of a new pair, not another fire", () => {
    const d = createDoubleTapDetector();
    expect(d.tap(0)).toBe(false);
    expect(d.tap(100)).toBe(true); // double tap fires, timestamp consumed
    expect(d.tap(150)).toBe(false); // third tap starts fresh
    expect(d.tap(200)).toBe(true); // fourth completes a new double tap
  });

  it("re-arms after a too-slow tap so a later pair still fires", () => {
    const d = createDoubleTapDetector();
    expect(d.tap(0)).toBe(false);
    expect(d.tap(1000)).toBe(false); // too slow; becomes the new "last" tap
    expect(d.tap(1100)).toBe(true); // pairs with the 1000 tap
  });

  it("respects a custom window", () => {
    const d = createDoubleTapDetector(50);
    expect(d.tap(0)).toBe(false);
    expect(d.tap(60)).toBe(false); // outside 50ms window
    expect(d.tap(100)).toBe(true); // within 50ms of the 60 tap
  });
});
