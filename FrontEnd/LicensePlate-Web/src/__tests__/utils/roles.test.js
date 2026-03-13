import { describe, it, expect } from "vitest";
import { isInsideRole } from "../../utils/roles.js";

describe("isInsideRole", () => {
  it('returns true for "นักศึกษา"', () => {
    expect(isInsideRole("นักศึกษา")).toBe(true);
  });

  it('returns true for "อาจารย์"', () => {
    expect(isInsideRole("อาจารย์")).toBe(true);
  });

  it('returns true for "เจ้าหน้าที่"', () => {
    expect(isInsideRole("เจ้าหน้าที่")).toBe(true);
  });

  it('returns true for English role "staff"', () => {
    expect(isInsideRole("staff")).toBe(true);
  });

  it('returns true for "employee"', () => {
    expect(isInsideRole("employee")).toBe(true);
  });

  it('returns true for "internal"', () => {
    expect(isInsideRole("internal")).toBe(true);
  });

  it("returns false for visitor", () => {
    expect(isInsideRole("visitor")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isInsideRole("")).toBe(false);
  });

  it("returns false for null", () => {
    expect(isInsideRole(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isInsideRole(undefined)).toBe(false);
  });

  it("handles whitespace correctly", () => {
    expect(isInsideRole("  นักศึกษา  ")).toBe(true);
  });
});
