import { calculateBackoff } from "../retry";

describe("calculateBackoff", () => {
  it("returns base delay for attempt 0", () => {
    // baseDelay * 2^0 = 1000, plus jitter 0-500
    const result = calculateBackoff(0, 1000);
    expect(result).toBeGreaterThanOrEqual(1000);
    expect(result).toBeLessThanOrEqual(1500);
  });

  it("doubles delay for each attempt", () => {
    // attempt 1: 2000 + jitter (0-500) = 2000-2500
    const result = calculateBackoff(1, 1000);
    expect(result).toBeGreaterThanOrEqual(2000);
    expect(result).toBeLessThanOrEqual(2500);
  });

  it("caps at 30 seconds", () => {
    const result = calculateBackoff(10, 1000);
    expect(result).toBeLessThanOrEqual(30000);
  });

  it("uses custom base delay", () => {
    const result = calculateBackoff(0, 500);
    expect(result).toBeGreaterThanOrEqual(500);
    expect(result).toBeLessThanOrEqual(750);
  });
});
