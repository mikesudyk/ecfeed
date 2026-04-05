import { Router, Request, Response, NextFunction } from "express";
import { requireAuth, optionalAuth } from "../middleware/auth.js";
import { validateBody, validateQuery, updateProfileSchema, paginationSchema } from "../middleware/validation.js";
import { AppError } from "../middleware/errors.js";
import { ALLOWED_DOMAIN } from "@ecfeed/shared";
import pool from "../db/pool.js";

function isTeamMember(email?: string): boolean {
  return !!email?.endsWith(`@${ALLOWED_DOMAIN}`);
}

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
    // $1 = viewer (for liked_by_me), $2 = profile user id
    const params: any[] = [req.user?.id ?? null, req.params.id];
    let paramIndex = 3;

    let whereClause = "WHERE p.author_id = $2 AND p.parent_id IS NULL";

    if (!isTeamMember(req.user?.email)) {
      whereClause += " AND p.visibility = 'public'";
    }

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
        u.role_title AS author_role_title,
        EXISTS(SELECT 1 FROM likes l WHERE l.post_id = p.id AND l.user_id = $1) AS liked_by_me
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

// ─── Shared post query helpers (mirrors posts router) ────────
// $1 is always the viewer's user id (or NULL). All other params start at $2.

function postSelect(): string {
  return `
    SELECT
      p.*,
      u.display_name AS author_display_name,
      u.avatar_url   AS author_avatar_url,
      u.email        AS author_email,
      u.role_title   AS author_role_title,
      qp.body        AS qp_body,
      qp.title       AS qp_title,
      qp.author_id   AS qp_author_id,
      qp.created_at  AS qp_created_at,
      qu.display_name AS qp_author_name,
      qu.avatar_url   AS qp_author_avatar,
      lp.url          AS lp_url,
      lp.title        AS lp_title,
      lp.description  AS lp_description,
      lp.image_url    AS lp_image_url,
      lp.site_name    AS lp_site_name,
      lp.favicon_url  AS lp_favicon_url,
      EXISTS(SELECT 1 FROM likes l2 WHERE l2.post_id = p.id AND l2.user_id = $1) AS liked_by_me
    FROM posts p
    JOIN users u ON p.author_id = u.id
    LEFT JOIN posts qp ON p.quoted_post_id = qp.id
    LEFT JOIN users qu ON qp.author_id = qu.id
    LEFT JOIN link_previews lp ON p.url = lp.url
  `;
}

function formatPost(row: any): any {
  return {
    id: row.id,
    authorId: row.author_id,
    author: {
      id: row.author_id,
      displayName: row.author_display_name,
      avatarUrl: row.author_avatar_url,
      email: row.author_email,
      roleTitle: row.author_role_title,
    },
    parentId: row.parent_id,
    quotedPostId: row.quoted_post_id,
    quotedPost: row.quoted_post_id
      ? {
          id: row.quoted_post_id,
          body: row.qp_body,
          title: row.qp_title,
          author: {
            id: row.qp_author_id,
            displayName: row.qp_author_name,
            avatarUrl: row.qp_author_avatar,
          },
          createdAt: row.qp_created_at,
        }
      : null,
    title: row.title,
    body: row.body,
    url: row.url,
    imageUrl: row.image_url,
    category: row.category,
    visibility: row.visibility,
    depth: row.depth,
    replyCount: parseInt(row.reply_count, 10),
    likeCount: parseInt(row.like_count, 10),
    likedByMe: row.liked_by_me || false,
    linkPreview: row.lp_url
      ? {
          url: row.lp_url,
          title: row.lp_title,
          description: row.lp_description,
          imageUrl: row.lp_image_url,
          siteName: row.lp_site_name,
          faviconUrl: row.lp_favicon_url,
        }
      : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─── Get user's replies (public) ────────────────────────────

router.get("/:id/replies", optionalAuth, validateQuery(paginationSchema), async (req: Request, res: Response) => {
  try {
    const { cursor, limit } = req.query as any;
    // $1 = viewer, $2 = profile user id
    const params: any[] = [req.user?.id ?? null, req.params.id];
    let paramIndex = 3;

    let whereClause = "WHERE p.author_id = $2 AND p.parent_id IS NOT NULL";

    if (!isTeamMember(req.user?.email)) {
      whereClause += " AND p.visibility = 'public'";
    }

    if (cursor) {
      whereClause += ` AND p.created_at < $${paramIndex++}`;
      params.push(cursor);
    }
    params.push(limit + 1);

    const result = await pool.query(
      `${postSelect()} ${whereClause} ORDER BY p.created_at DESC LIMIT $${paramIndex}`,
      params
    );

    const hasMore = result.rows.length > limit;
    const rows = hasMore ? result.rows.slice(0, limit) : result.rows;

    res.json({
      data: rows.map((r) => formatPost(r)),
      cursor: rows.length > 0 ? rows[rows.length - 1].created_at : null,
      hasMore,
    });
  } catch (err) {
    console.error("Error listing user replies:", err);
    res.status(500).json({ error: "internal_error", message: "Failed to list replies", statusCode: 500 });
  }
});

// ─── Get posts user has liked (public) ──────────────────────

router.get("/:id/likes", optionalAuth, validateQuery(paginationSchema), async (req: Request, res: Response) => {
  try {
    const { cursor, limit } = req.query as any;
    // $1 = viewer (for liked_by_me), $2 = profile user id
    const params: any[] = [req.user?.id ?? null, req.params.id];
    let paramIndex = 3;

    const visibilityClause = isTeamMember(req.user?.email) ? "" : "AND p.visibility = 'public'";

    let cursorClause = "";
    if (cursor) {
      cursorClause = `AND l.created_at < $${paramIndex++}`;
      params.push(cursor);
    }
    params.push(limit + 1);

    const result = await pool.query(
      `${postSelect()}
       JOIN likes l ON l.post_id = p.id
       WHERE l.user_id = $2 ${visibilityClause} ${cursorClause}
       ORDER BY l.created_at DESC LIMIT $${paramIndex}`,
      params
    );

    const hasMore = result.rows.length > limit;
    const rows = hasMore ? result.rows.slice(0, limit) : result.rows;

    res.json({
      data: rows.map((r) => formatPost(r)),
      cursor: rows.length > 0 ? rows[rows.length - 1].created_at : null,
      hasMore,
    });
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
