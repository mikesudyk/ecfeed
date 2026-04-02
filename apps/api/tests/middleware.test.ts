import { describe, it, expect, vi, afterEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { requireAuth, optionalAuth, signToken } from "../src/middleware/auth.js";

function makeReq(cookies: Record<string, string> = {}): Request {
  return { cookies } as unknown as Request;
}

function makeRes() {
  const jsonFn = vi.fn();
  const statusFn = vi.fn().mockReturnValue({ json: jsonFn });
  return {
    res: { status: statusFn, json: jsonFn } as unknown as Response,
    status: statusFn,
    json: jsonFn,
  };
}

describe("requireAuth", () => {
  it("returns 401 when no cookie is present", () => {
    const req = makeReq();
    const { res, status } = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    requireAuth(req, res, next);

    expect(status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next and populates req.user with a valid token", () => {
    const token = signToken({ userId: "user-1", email: "alice@ecgroup-intl.com" });
    const req = makeReq({ token });
    const { res } = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    requireAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect((req as any).user?.id).toBe("user-1");
    expect((req as any).user?.email).toBe("alice@ecgroup-intl.com");
  });

  it("returns 401 when token is malformed", () => {
    const req = makeReq({ token: "not.a.valid.jwt" });
    const { res, status } = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    requireAuth(req, res, next);

    expect(status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when token is expired", () => {
    const token = signToken({ userId: "user-1", email: "alice@ecgroup-intl.com" });
    // Advance past the 7-day expiry
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.now() + 8 * 24 * 60 * 60 * 1000));

    const req = makeReq({ token });
    const { res, status } = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    requireAuth(req, res, next);

    vi.useRealTimers();

    expect(status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe("optionalAuth", () => {
  it("calls next without user when no cookie is present", () => {
    const req = makeReq();
    const { res } = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    optionalAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect((req as any).user).toBeUndefined();
  });

  it("calls next and sets req.user with a valid token", () => {
    const token = signToken({ userId: "user-2", email: "bob@ecgroup-intl.com" });
    const req = makeReq({ token });
    const { res } = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    optionalAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect((req as any).user?.id).toBe("user-2");
  });

  it("calls next without error when token is invalid", () => {
    const req = makeReq({ token: "garbage.token.value" });
    const { res } = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    expect(() => optionalAuth(req, res, next)).not.toThrow();
    expect(next).toHaveBeenCalled();
    expect((req as any).user).toBeUndefined();
  });
});
