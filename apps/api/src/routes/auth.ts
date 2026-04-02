import { Router, Request, Response, NextFunction } from "express";
import passport from "passport";
import { signToken, requireAuth } from "../middleware/auth.js";
import pool from "../db/pool.js";

const router = Router();

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: "/",
};

// Initiate Google OAuth
router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
  })
);

// Google OAuth callback
router.get(
  "/google/callback",
  (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate(
      "google",
      { session: false },
      (err: Error | null, user: Express.User | false) => {
        if (err) {
          console.error("OAuth callback error:", err);
          return next(err);
        }
        if (!user) {
          return res.redirect(`${FRONTEND_URL}?auth_error=domain_not_allowed`);
        }
        const token = signToken({ userId: user.id, email: user.email });
        res.cookie("token", token, COOKIE_OPTS);
        res.redirect(FRONTEND_URL);
      }
    )(req, res, next);
  }
);

// Get current user
router.get("/me", requireAuth, async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT id, google_id, email, display_name, avatar_url, bio, role_title, created_at
       FROM users WHERE id = $1`,
      [req.user!.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: "not_found", message: "User not found", statusCode: 404 });
      return;
    }

    const user = result.rows[0];
    res.json({
      id: user.id,
      googleId: user.google_id,
      email: user.email,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
      bio: user.bio,
      roleTitle: user.role_title,
      createdAt: user.created_at,
    });
  } catch (err) {
    console.error("Error fetching current user:", err);
    res.status(500).json({ error: "internal_error", message: "Failed to fetch user", statusCode: 500 });
  }
});

// Logout
router.post("/logout", (_req: Request, res: Response) => {
  res.clearCookie("token", { path: "/" });
  res.json({ message: "Logged out" });
});

export default router;
