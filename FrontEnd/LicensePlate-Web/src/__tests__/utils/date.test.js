import { describe, it, expect } from "vitest";
import {
  parseDT,
  toLocalDateKey,
  formatThaiDateTime,
  formatThaiDate,
  addDays,
} from "../../utils/date.js";

describe("parseDT", () => {
  it("parses ISO string", () => {
    const d = parseDT("2025-06-15T10:30:00");
    expect(d).toBeInstanceOf(Date);
    expect(d.getFullYear()).toBe(2025);
  });

  it("parses space-separated datetime", () => {
    const d = parseDT("2025-06-15 10:30:00");
    expect(d.getFullYear()).toBe(2025);
    expect(d.getHours()).toBe(10);
  });

  it("returns invalid date for null", () => {
    const d = parseDT(null);
    expect(Number.isNaN(d.getTime())).toBe(true);
  });

  it("returns invalid date for empty string", () => {
    const d = parseDT("");
    expect(Number.isNaN(d.getTime())).toBe(true);
  });

  it("handles Date input", () => {
    const input = new Date(2025, 5, 15);
    const d = parseDT(input);
    expect(d.getTime()).toBe(input.getTime());
    expect(d).not.toBe(input); // should be a clone
  });

  it("handles date-only string as local", () => {
    const d = parseDT("2025-06-15");
    expect(d.getFullYear()).toBe(2025);
    expect(d.getMonth()).toBe(5); // June = 5
    expect(d.getDate()).toBe(15);
    expect(d.getHours()).toBe(0);
  });
});

describe("toLocalDateKey", () => {
  it("returns YYYY-MM-DD from date", () => {
    const d = new Date(2025, 5, 15);
    expect(toLocalDateKey(d)).toBe("2025-06-15");
  });

  it("returns YYYY-MM-DD from string", () => {
    expect(toLocalDateKey("2025-01-01T12:00:00")).toBe("2025-01-01");
  });

  it("returns empty string for invalid input", () => {
    expect(toLocalDateKey("invalid")).toBe("");
  });
});

describe("formatThaiDateTime", () => {
  it("formats ISO datetime string", () => {
    const result = formatThaiDateTime("2025-06-15T10:30:45");
    expect(result).toBe("15/06/2025 10:30:45");
  });

  it("returns - for null", () => {
    expect(formatThaiDateTime(null)).toBe("-");
  });

  it("returns - for empty string", () => {
    expect(formatThaiDateTime("")).toBe("-");
  });
});

describe("formatThaiDate", () => {
  it("formats date string", () => {
    const d = new Date(2025, 0, 5);
    expect(formatThaiDate(d)).toBe("05/01/2025");
  });

  it("returns - for invalid", () => {
    expect(formatThaiDate("invalid")).toBe("-");
  });
});

describe("addDays", () => {
  it("adds days correctly", () => {
    const d = addDays("2025-06-15", 3);
    expect(d.getDate()).toBe(18);
  });

  it("subtracts days with negative value", () => {
    const d = addDays("2025-06-15", -5);
    expect(d.getDate()).toBe(10);
  });

  it("handles month boundary", () => {
    const d = addDays("2025-01-30", 3);
    expect(d.getMonth()).toBe(1); // February
    expect(d.getDate()).toBe(2);
  });
});
