import { describe, it, expect, vi, afterEach } from "vitest";
import jwt from "jsonwebtoken";
import { ALLOWED_DOMAIN } from "@ecfeed/shared";
import { signToken, verifyToken } from "../src/middleware/auth.js";

describe("Auth — Domain Validation", () => {
  function isAllowedDomain(email: string): boolean {
    const domain = email.split("@")[1];
    return domain === ALLOWED_DOMAIN;
  }

  it("accepts emails from the allowed domain", () => {
    expect(isAllowedDomain("mike@ecgroup-intl.com")).toBe(true);
    expect(isAllowedDomain("sarah@ecgroup-intl.com")).toBe(true);
  });

  it("rejects emails from other domains", () => {
    expect(isAllowedDomain("someone@gmail.com")).toBe(false);
    expect(isAllowedDomain("hacker@evil.com")).toBe(false);
    expect(isAllowedDomain("close@ecgroup-intl.org")).toBe(false);
  });

  it("rejects emails with no domain", () => {
    expect(isAllowedDomain("nodomain")).toBe(false);
  });
});

describe("Auth — JWT", () => {
  it("sign and verify round-trip preserves payload", () => {
    const payload = { userId: "user-abc", email: "test@ecgroup-intl.com" };
    const token = signToken(payload);
    const decoded = verifyToken(token);
    expect(decoded.userId).toBe(payload.userId);
    expect(decoded.email).toBe(payload.email);
  });

  it("token signed with a different secret is rejected", () => {
    const badToken = jwt.sign(
      { userId: "user-abc", email: "test@ecgroup-intl.com" },
      "wrong-secret-entirely"
    );
    expect(() => verifyToken(badToken)).toThrow();
  });

  it("expired tokens are rejected", () => {
    // Sign a token now, then advance the clock past the 7-day expiry
    const token = signToken({ userId: "user-abc", email: "test@ecgroup-intl.com" });
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.now() + 8 * 24 * 60 * 60 * 1000));
    expect(() => verifyToken(token)).toThrow(/expired/i);
    vi.useRealTimers();
  });
});
