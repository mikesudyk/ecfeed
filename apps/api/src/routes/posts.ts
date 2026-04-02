import { Router, Request, Response, NextFunction } from "express";
import { requireAuth, optionalAuth } from "../middleware/auth.js";
import {
  validateBody,
  validateQuery,
  createPostSchema,
  updatePostSchema,
  createReplySchema,
  paginationSchema,
} from "../middleware/validation.js";
import { AppError } from "../middleware/errors.js";
import { MAX_REPLY_DEPTH } from "@ecfeed/shared";
import pool from "../db/pool.js";

const router = Router();

// ─── Helper: format post row to API response ───────────────

function formatPost(row: any, userId?: string): any {
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

// ─── Base query for posts with joins ────────────────────────

function postQuery(userId?: string): string {
  return `
    SELECT
      p.*,
      u.display_name AS author_display_name,
      u.avatar_url AS author_avatar_url,
      u.email AS author_email,
      u.role_title AS author_role_title,
      qp.body AS qp_body,
      qp.title AS qp_title,
      qp.author_id AS qp_author_id,
      qp.created_at AS qp_created_at,
      qu.display_name AS qp_author_name,
      qu.avatar_url AS qp_author_avatar,
      lp.url AS lp_url,
      lp.title AS lp_title,
      lp.description AS lp_description,
      lp.image_url AS lp_image_url,
      lp.site_name AS lp_site_name,
      lp.favicon_url AS lp_favicon_url
      ${userId ? `, EXISTS(SELECT 1 FROM likes l WHERE l.post_id = p.id AND l.user_id = '${userId}') AS liked_by_me` : ""}
    FROM posts p
    JOIN users u ON p.author_id = u.id
    LEFT JOIN posts qp ON p.quoted_post_id = qp.id
    LEFT JOIN users qu ON qp.author_id = qu.id
    LEFT JOIN link_previews lp ON p.url = lp.url
  `;
}

// ─── List top-level posts (public) ──────────────────────────

router.get("/", optionalAuth, validateQuery(paginationSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { cursor, limit, category } = req.query as any;
    const userId = req.user?.id;

    let whereClause = "WHERE p.parent_id IS NULL";
    const params: any[] = [];
    let paramIndex = 1;

    if (category) {
      whereClause += ` AND p.category = $${paramIndex++}`;
      params.push(category);
    }

    if (cursor) {
      whereClause += ` AND p.created_at < $${paramIndex++}`;
      params.push(cursor);
    }

    params.push(limit + 1); // fetch one extra to check hasMore

    const sql = `
      ${postQuery(userId)}
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT $${paramIndex}
    `;

    const result = await pool.query(sql, params);
    const hasMore = result.rows.length > limit;
    const rows = hasMore ? result.rows.slice(0, limit) : result.rows;

    res.json({
      data: rows.map((r) => formatPost(r, userId)),
      cursor: rows.length > 0 ? rows[rows.length - 1].created_at : null,
      hasMore,
    });
  } catch (err) {
    next(err);
  }
});

// ─── Get single post with replies (public) ──────────────────

router.get("/:id", optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;

    // Fetch the post
    const postResult = await pool.query(
      `${postQuery(userId)} WHERE p.id = $1`,
      [req.params.id]
    );

    if (postResult.rows.length === 0) {
      res.status(404).json({ error: "not_found", message: "Post not found", statusCode: 404 });
      return;
    }

    // Fetch replies (ordered by created_at, all depths)
    const repliesResult = await pool.query(
      `${postQuery(userId)}
       WHERE p.parent_id = $1 OR p.id IN (
         WITH RECURSIVE reply_tree AS (
           SELECT id FROM posts WHERE parent_id = $1
           UNION ALL
           SELECT p2.id FROM posts p2 JOIN reply_tree rt ON p2.parent_id = rt.id
         )
         SELECT id FROM reply_tree
       )
       ORDER BY p.created_at ASC`,
      [req.params.id]
    );

    res.json({
      post: formatPost(postResult.rows[0], userId),
      replies: repliesResult.rows.map((r) => formatPost(r, userId)),
    });
  } catch (err) {
    next(err);
  }
});

// ─── Create post (auth required) ────────────────────────────

router.post("/", requireAuth, validateBody(createPostSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, body, url, imageUrl, category, quotedPostId } = req.body;
    const userId = req.user!.id;

    // If quoting, verify the quoted post exists
    if (quotedPostId) {
      const quoted = await pool.query("SELECT id FROM posts WHERE id = $1", [quotedPostId]);
      if (quoted.rows.length === 0) {
        throw new AppError(404, "not_found", "Quoted post not found");
      }
    }

    const result = await pool.query(
      `INSERT INTO posts (author_id, title, body, url, image_url, category, quoted_post_id, depth)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 0)
       RETURNING *`,
      [userId, title || null, body, url || null, imageUrl || null, category, quotedPostId || null]
    );

    // Re-fetch with joins
    const postResult = await pool.query(
      `${postQuery(userId)} WHERE p.id = $1`,
      [result.rows[0].id]
    );

    res.status(201).json(formatPost(postResult.rows[0], userId));
  } catch (err) {
    next(err);
  }
});

// ─── Update own post (auth required) ────────────────────────

router.put("/:id", requireAuth, validateBody(updatePostSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;

    // Check ownership
    const existing = await pool.query("SELECT author_id FROM posts WHERE id = $1", [req.params.id]);
    if (existing.rows.length === 0) {
      throw new AppError(404, "not_found", "Post not found");
    }
    if (existing.rows[0].author_id !== userId) {
      throw new AppError(403, "forbidden", "You can only edit your own posts");
    }

    const { title, body, url, imageUrl, category } = req.body;
    const updates: string[] = [];
    const params: any[] = [];
    let i = 1;

    if (title !== undefined) { updates.push(`title = $${i++}`); params.push(title); }
    if (body !== undefined) { updates.push(`body = $${i++}`); params.push(body); }
    if (url !== undefined) { updates.push(`url = $${i++}`); params.push(url); }
    if (imageUrl !== undefined) { updates.push(`image_url = $${i++}`); params.push(imageUrl); }
    if (category !== undefined) { updates.push(`category = $${i++}`); params.push(category); }

    if (updates.length === 0) {
      throw new AppError(400, "bad_request", "No fields to update");
    }

    updates.push(`updated_at = NOW()`);
    params.push(req.params.id);

    await pool.query(
      `UPDATE posts SET ${updates.join(", ")} WHERE id = $${i}`,
      params
    );

    const postResult = await pool.query(`${postQuery(userId)} WHERE p.id = $1`, [req.params.id]);
    res.json(formatPost(postResult.rows[0], userId));
  } catch (err) {
    next(err);
  }
});

// ─── Delete own post (auth required) ────────────────────────

router.delete("/:id", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const existing = await pool.query("SELECT author_id, parent_id FROM posts WHERE id = $1", [req.params.id]);

    if (existing.rows.length === 0) {
      throw new AppError(404, "not_found", "Post not found");
    }
    if (existing.rows[0].author_id !== userId) {
      throw new AppError(403, "forbidden", "You can only delete your own posts");
    }

    // If this is a reply, decrement parent's reply_count
    if (existing.rows[0].parent_id) {
      await pool.query(
        "UPDATE posts SET reply_count = GREATEST(reply_count - 1, 0) WHERE id = $1",
        [existing.rows[0].parent_id]
      );
    }

    await pool.query("DELETE FROM posts WHERE id = $1", [req.params.id]);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ─── Create reply (auth required) ───────────────────────────

router.post("/:id/replies", requireAuth, validateBody(createReplySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const postId = req.params.id;
    const { body, parentId } = req.body;

    // Determine what we're replying to
    const replyToId = parentId || postId;
    const replyTo = await pool.query("SELECT id, depth, category, parent_id FROM posts WHERE id = $1", [replyToId]);

    if (replyTo.rows.length === 0) {
      throw new AppError(404, "not_found", "Parent post not found");
    }

    const parentDepth = replyTo.rows[0].depth;
    const newDepth = parentDepth + 1;

    if (newDepth > MAX_REPLY_DEPTH) {
      throw new AppError(400, "bad_request", `Maximum reply depth of ${MAX_REPLY_DEPTH} reached`);
    }

    // Inherit category from the root post
    const rootPost = await pool.query("SELECT category FROM posts WHERE id = $1", [postId]);
    const category = rootPost.rows[0].category;

    const result = await pool.query(
      `INSERT INTO posts (author_id, parent_id, body, category, depth)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, replyToId, body, category, newDepth]
    );

    // Increment reply_count on the parent
    await pool.query(
      "UPDATE posts SET reply_count = reply_count + 1 WHERE id = $1",
      [replyToId]
    );

    const postResult = await pool.query(`${postQuery(userId)} WHERE p.id = $1`, [result.rows[0].id]);
    res.status(201).json(formatPost(postResult.rows[0], userId));
  } catch (err) {
    next(err);
  }
});

// ─── Like / Unlike (auth required) ──────────────────────────

router.post("/:id/like", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const postId = req.params.id;

    // Verify post exists
    const post = await pool.query("SELECT id FROM posts WHERE id = $1", [postId]);
    if (post.rows.length === 0) {
      throw new AppError(404, "not_found", "Post not found");
    }

    await pool.query(
      `INSERT INTO likes (user_id, post_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [userId, postId]
    );

    await pool.query(
      "UPDATE posts SET like_count = (SELECT COUNT(*) FROM likes WHERE post_id = $1) WHERE id = $1",
      [postId]
    );

    res.json({ liked: true });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id/like", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const postId = req.params.id;

    await pool.query("DELETE FROM likes WHERE user_id = $1 AND post_id = $2", [userId, postId]);

    await pool.query(
      "UPDATE posts SET like_count = (SELECT COUNT(*) FROM likes WHERE post_id = $1) WHERE id = $1",
      [postId]
    );

    res.json({ liked: false });
  } catch (err) {
    next(err);
  }
});

// ─── List likes (public) ───────────────────────────────────

router.get("/:id/likes", async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT l.created_at, u.id, u.display_name, u.avatar_url
       FROM likes l JOIN users u ON l.user_id = u.id
       WHERE l.post_id = $1
       ORDER BY l.created_at DESC`,
      [req.params.id]
    );

    res.json(
      result.rows.map((r) => ({
        userId: r.id,
        postId: req.params.id,
        user: { id: r.id, displayName: r.display_name, avatarUrl: r.avatar_url },
        createdAt: r.created_at,
      }))
    );
  } catch (err) {
    console.error("Error listing likes:", err);
    res.status(500).json({ error: "internal_error", message: "Failed to list likes", statusCode: 500 });
  }
});

export default router;
