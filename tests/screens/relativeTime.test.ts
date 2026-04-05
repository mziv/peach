import { relativeTime } from "../../src/utils/relativeTime";

describe("relativeTime", () => {
  function minutesAgo(n: number): Date {
    return new Date(Date.now() - n * 60000);
  }

  function hoursAgo(n: number): Date {
    return new Date(Date.now() - n * 3600000);
  }

  function daysAgo(n: number): Date {
    return new Date(Date.now() - n * 86400000);
  }

  it("returns 'just now' for less than a minute ago", () => {
    expect(relativeTime(new Date(Date.now() - 30000))).toBe("just now");
  });

  it("returns minutes for 1-59 minutes", () => {
    expect(relativeTime(minutesAgo(1))).toBe("1m");
    expect(relativeTime(minutesAgo(30))).toBe("30m");
    expect(relativeTime(minutesAgo(59))).toBe("59m");
  });

  it("returns hours for 1-23 hours", () => {
    expect(relativeTime(hoursAgo(1))).toBe("1hr");
    expect(relativeTime(hoursAgo(12))).toBe("12hr");
    expect(relativeTime(hoursAgo(23))).toBe("23hr");
  });

  it("returns days for 1-6 days", () => {
    expect(relativeTime(daysAgo(1))).toBe("1 day");
    expect(relativeTime(daysAgo(2))).toBe("2 days");
    expect(relativeTime(daysAgo(6))).toBe("6 days");
  });

  it("returns weeks for 7+ days", () => {
    expect(relativeTime(daysAgo(7))).toBe("1 week");
    expect(relativeTime(daysAgo(14))).toBe("2 weeks");
    expect(relativeTime(daysAgo(21))).toBe("3 weeks");
  });
});
