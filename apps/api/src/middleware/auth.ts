import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { ALLOWED_DOMAIN } from "@ecfeed/shared";
import pool from "../db/pool.js";

// ─── Types ──────────────────────────────────────────────────

declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      displayName: string;
      avatarUrl: string | null;
    }
  }
}

interface JwtPayload {
  userId: string;
  email: string;
}

// ─── JWT helpers ────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production";
const JWT_EXPIRY = "7d";

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

// ─── Auth middleware ────────────────────────────────────────

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.token;

  if (!token) {
    res.status(401).json({ error: "unauthorized", message: "Sign in required", statusCode: 401 });
    return;
  }

  try {
    const payload = verifyToken(token);
    req.user = { id: payload.userId, email: payload.email, displayName: "", avatarUrl: null };
    next();
  } catch {
    res.status(401).json({ error: "unauthorized", message: "Invalid or expired token", statusCode: 401 });
  }
}

export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.token;

  if (token) {
    try {
      const payload = verifyToken(token);
      req.user = { id: payload.userId, email: payload.email, displayName: "", avatarUrl: null };
    } catch {
      // Invalid token — continue as unauthenticated
    }
  }

  next();
}

// ─── Google OAuth setup ─────────────────────────────────────

export function configurePassport(): void {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.warn("⚠️  Google OAuth not configured — auth routes will not work. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env");
    return;
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID || "",
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
        callbackURL: process.env.GOOGLE_CALLBACK_URL || "http://localhost:3001/auth/google/callback",
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) {
            return done(new Error("No email found in Google profile"));
          }

          // Domain check
          const domain = email.split("@")[1];
          if (domain !== ALLOWED_DOMAIN) {
            return done(new Error(`EC Feed is for EC Group team members. Domain ${domain} is not allowed.`));
          }

          const displayName = profile.displayName || email.split("@")[0];
          const avatarUrl = profile.photos?.[0]?.value || null;

          // Upsert user
          const result = await pool.query(
            `INSERT INTO users (google_id, email, display_name, avatar_url)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (google_id) DO UPDATE SET
               display_name = COALESCE(NULLIF(users.display_name, ''), $3),
               avatar_url = COALESCE(users.avatar_url, $4)
             RETURNING id, email, display_name, avatar_url`,
            [profile.id, email, displayName, avatarUrl]
          );

          const user = result.rows[0];
          return done(null, {
            id: user.id,
            email: user.email,
            displayName: user.display_name,
            avatarUrl: user.avatar_url,
          });
        } catch (err) {
          console.error("Passport Google strategy error:", err);
          return done(err as Error);
        }
      }
    )
  );
}
