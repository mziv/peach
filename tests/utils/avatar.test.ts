import { getInitials, avatarColor, AVATAR_COLORS } from "../../src/utils/avatar";

describe("getInitials", () => {
  it("returns first letters of first and last name, uppercased", () => {
    expect(getInitials("Maya Ziv")).toBe("MZ");
  });

  it("uppercases lowercase names", () => {
    expect(getInitials("maya ziv")).toBe("MZ");
  });

  it("uses first and last word when there are middle names", () => {
    expect(getInitials("Maya Jane Ziv")).toBe("MZ");
  });

  it("returns a single initial for a one-word name", () => {
    expect(getInitials("Maya")).toBe("M");
  });

  it("ignores surrounding and repeated whitespace", () => {
    expect(getInitials("  Maya   Ziv  ")).toBe("MZ");
  });

  it("returns a fallback for an empty or whitespace-only name", () => {
    expect(getInitials("")).toBe("?");
    expect(getInitials("   ")).toBe("?");
  });
});

describe("avatarColor", () => {
  it("is deterministic for the same seed", () => {
    expect(avatarColor("maya")).toBe(avatarColor("maya"));
  });

  it("always returns a color from the palette", () => {
    for (const seed of ["maya", "ziv", "peach", "a", "", "Maya Ziv"]) {
      expect(AVATAR_COLORS).toContain(avatarColor(seed));
    }
  });

  it("distributes different seeds across more than one color", () => {
    const seeds = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const distinct = new Set(seeds.map(avatarColor));
    expect(distinct.size).toBeGreaterThan(1);
  });
});
