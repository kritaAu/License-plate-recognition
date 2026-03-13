import { describe, it, expect, beforeEach } from "vitest";

// Mock localStorage
const store = {};
const mockStorage = {
  getItem: (key) => store[key] ?? null,
  setItem: (key, val) => { store[key] = String(val); },
  removeItem: (key) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
};
Object.defineProperty(global, "localStorage", { value: mockStorage });

// Now import AuthService
import AuthService from "../../utils/auth.js";

describe("AuthService", () => {
  beforeEach(() => {
    mockStorage.clear();
  });

  it("setToken and getToken work correctly", () => {
    AuthService.setToken("test-token");
    expect(AuthService.getToken()).toBe("test-token");
  });

  it("removeToken removes the token", () => {
    AuthService.setToken("test-token");
    AuthService.removeToken();
    expect(AuthService.getToken()).toBeNull();
  });

  it("setUser and getUser work with objects", () => {
    const user = { username: "admin", role: "admin" };
    AuthService.setUser(user);
    expect(AuthService.getUser()).toEqual(user);
  });

  it("getUser returns null when no user exists", () => {
    expect(AuthService.getUser()).toBeNull();
  });

  it("isAuthenticated returns true when token exists", () => {
    AuthService.setToken("some-token");
    expect(AuthService.isAuthenticated()).toBe(true);
  });

  it("isAuthenticated returns false when no token", () => {
    expect(AuthService.isAuthenticated()).toBe(false);
  });

  it("logout clears both token and user", () => {
    AuthService.setToken("test-token");
    AuthService.setUser({ username: "admin" });
    AuthService.logout();
    expect(AuthService.getToken()).toBeNull();
    expect(AuthService.getUser()).toBeNull();
  });
});
