import { Router, Request, Response, NextFunction } from "express";
import { requireAuth, optionalAuth } from "../middleware/auth.js";
import { validateBody, validateQuery, updateProfileSchema, paginationSchema } from "../middleware/validation.js";
import { AppError } from "../middleware/errors.js";
import pool from "../db/pool.js";

const router = Router();

// ─── Get user profile (public) ──────────────────────────────

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT
        u.*,
        (SELECT COUNT(*) FROM posts WHERE author_id = u.id AND parent_id IS NULL) AS post_count,
        (SELECT COALESCE(SUM(p.like_count), 0) FROM posts p WHERE p.author_id = u.id) AS likes_received
       FROM users u
       WHERE u.id = $1`,
      [req.params.id]
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
      postCount: parseInt(user.post_count, 10),
      likesReceived: parseInt(user.likes_received, 10),
    });
  } catch (err) {
    console.error("Error fetching user profile:", err);
    res.status(500).json({ error: "internal_error", message: "Failed to fetch profile", statusCode: 500 });
  }
});

// ─── Get user's posts (public) ──────────────────────────────

router.get("/:id/posts", optionalAuth, validateQuery(paginationSchema), async (req: Request, res: Response) => {
  try {
    const { cursor, limit } = req.query as any;
    const userId = req.user?.id;
    const params: any[] = [req.params.id];
    let paramIndex = 2;

    let whereClause = "WHERE p.author_id = $1 AND p.parent_id IS NULL";

    if (cursor) {
      whereClause += ` AND p.created_at < $${paramIndex++}`;
      params.push(cursor);
    }

    params.push(limit + 1);

    const result = await pool.query(
      `SELECT p.*,
        u.display_name AS author_display_name,
        u.avatar_url AS author_avatar_url,
        u.email AS author_email,
        u.role_title AS author_role_title
        ${userId ? `, EXISTS(SELECT 1 FROM likes l WHERE l.post_id = p.id AND l.user_id = '${userId}') AS liked_by_me` : ""}
       FROM posts p
       JOIN users u ON p.author_id = u.id
       ${whereClause}
       ORDER BY p.created_at DESC
       LIMIT $${paramIndex}`,
      params
    );

    const hasMore = result.rows.length > limit;
    const rows = hasMore ? result.rows.slice(0, limit) : result.rows;

    res.json({
      data: rows.map((r: any) => ({
        id: r.id,
        authorId: r.author_id,
        author: {
          id: r.author_id,
          displayName: r.author_display_name,
          avatarUrl: r.author_avatar_url,
        },
        title: r.title,
        body: r.body,
        url: r.url,
        imageUrl: r.image_url,
        category: r.category,
        replyCount: parseInt(r.reply_count, 10),
        likeCount: parseInt(r.like_count, 10),
        likedByMe: r.liked_by_me || false,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
      cursor: rows.length > 0 ? rows[rows.length - 1].created_at : null,
      hasMore,
    });
  } catch (err) {
    console.error("Error listing user posts:", err);
    res.status(500).json({ error: "internal_error", message: "Failed to list posts", statusCode: 500 });
  }
});

// ─── Get user's replies (public) ────────────────────────────

router.get("/:id/replies", validateQuery(paginationSchema), async (req: Request, res: Response) => {
  try {
    const { cursor, limit } = req.query as any;
    const params: any[] = [req.params.id];
    let paramIndex = 2;

    let whereClause = "WHERE p.author_id = $1 AND p.parent_id IS NOT NULL";

    if (cursor) {
      whereClause += ` AND p.created_at < $${paramIndex++}`;
      params.push(cursor);
    }

    params.push(limit + 1);

    const result = await pool.query(
      `SELECT p.*, u.display_name AS author_display_name, u.avatar_url AS author_avatar_url
       FROM posts p JOIN users u ON p.author_id = u.id
       ${whereClause}
       ORDER BY p.created_at DESC LIMIT $${paramIndex}`,
      params
    );

    const hasMore = result.rows.length > limit;
    const rows = hasMore ? result.rows.slice(0, limit) : result.rows;

    res.json({ data: rows, cursor: rows.length > 0 ? rows[rows.length - 1].created_at : null, hasMore });
  } catch (err) {
    console.error("Error listing user replies:", err);
    res.status(500).json({ error: "internal_error", message: "Failed to list replies", statusCode: 500 });
  }
});

// ─── Get posts user has liked (public) ──────────────────────

router.get("/:id/likes", validateQuery(paginationSchema), async (req: Request, res: Response) => {
  try {
    const { cursor, limit } = req.query as any;
    const params: any[] = [req.params.id];
    let paramIndex = 2;

    let whereClause = "";
    if (cursor) {
      whereClause = `AND l.created_at < $${paramIndex++}`;
      params.push(cursor);
    }

    params.push(limit + 1);

    const result = await pool.query(
      `SELECT p.*, l.created_at AS liked_at,
        u.display_name AS author_display_name, u.avatar_url AS author_avatar_url,
        u.email AS author_email
       FROM likes l
       JOIN posts p ON l.post_id = p.id
       JOIN users u ON p.author_id = u.id
       WHERE l.user_id = $1 ${whereClause}
       ORDER BY l.created_at DESC LIMIT $${paramIndex}`,
      params
    );

    const hasMore = result.rows.length > limit;
    const rows = hasMore ? result.rows.slice(0, limit) : result.rows;

    res.json({ data: rows, cursor: rows.length > 0 ? rows[rows.length - 1].liked_at : null, hasMore });
  } catch (err) {
    console.error("Error listing liked posts:", err);
    res.status(500).json({ error: "internal_error", message: "Failed to list likes", statusCode: 500 });
  }
});

// ─── Update own profile (auth required) ─────────────────────

router.put("/me", requireAuth, validateBody(updateProfileSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { displayName, bio, roleTitle } = req.body;

    const updates: string[] = [];
    const params: any[] = [];
    let i = 1;

    if (displayName !== undefined) { updates.push(`display_name = $${i++}`); params.push(displayName); }
    if (bio !== undefined) { updates.push(`bio = $${i++}`); params.push(bio); }
    if (roleTitle !== undefined) { updates.push(`role_title = $${i++}`); params.push(roleTitle); }

    if (updates.length === 0) {
      throw new AppError(400, "bad_request", "No fields to update");
    }

    params.push(userId);
    await pool.query(`UPDATE users SET ${updates.join(", ")} WHERE id = $${i}`, params);

    const result = await pool.query("SELECT * FROM users WHERE id = $1", [userId]);
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
    next(err);
  }
});

export default router;
