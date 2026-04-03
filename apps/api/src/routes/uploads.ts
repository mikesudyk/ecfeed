import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth.js";
import { validateBody, presignSchema, linkPreviewSchema } from "../middleware/validation.js";
import { getPresignedUploadUrl, getAvatarKey, getPostImageKey } from "../lib/r2.js";
import pool from "../db/pool.js";

const router = Router();

// ─── Get presigned upload URL ───────────────────────────────

router.post("/presign", requireAuth, validateBody(presignSchema), async (req: Request, res: Response) => {
  try {
    const { filename, contentType } = req.body;
    const userId = req.user!.id;

    // Determine key based on context (avatar vs post image)
    // For now, generate a generic image key; the frontend will specify usage
    const key = `uploads/${userId}/${Date.now()}-${filename}`;

    const { uploadUrl, publicUrl } = await getPresignedUploadUrl(key, contentType);

    res.json({ uploadUrl, publicUrl });
  } catch (err) {
    console.error("Error generating presigned URL:", err);
    res.status(500).json({ error: "internal_error", message: "Failed to generate upload URL", statusCode: 500 });
  }
});

// ─── Upload avatar ──────────────────────────────────────────

router.post("/avatar", requireAuth, validateBody(presignSchema), async (req: Request, res: Response) => {
  try {
    const { filename, contentType } = req.body;
    const userId = req.user!.id;
    const key = getAvatarKey(userId, filename);

    const { uploadUrl, publicUrl } = await getPresignedUploadUrl(key, contentType);

    // Update the user's avatar_url
    await pool.query("UPDATE users SET avatar_url = $1 WHERE id = $2", [publicUrl, userId]);

    res.json({ uploadUrl, publicUrl });
  } catch (err) {
    console.error("Error generating avatar upload URL:", err);
    res.status(500).json({ error: "internal_error", message: "Failed to generate avatar upload URL", statusCode: 500 });
  }
});

// ─── Link preview (fetch Open Graph data) ───────────────────

router.post("/link-preview", requireAuth, validateBody(linkPreviewSchema), async (req: Request, res: Response) => {
  try {
    const { url } = req.body;

    // Check cache first
    const cached = await pool.query("SELECT * FROM link_previews WHERE url = $1", [url]);
    if (cached.rows.length > 0) {
      const lp = cached.rows[0];
      res.json({
        title: lp.title,
        description: lp.description,
        imageUrl: lp.image_url,
        siteName: lp.site_name,
        faviconUrl: lp.favicon_url,
      });
      return;
    }

    // Fetch OG data
    // Dynamic import for open-graph-scraper (ESM)
    console.log(`[link-preview] fetching OG data for: ${url}`);
    const ogs = (await import("open-graph-scraper")).default;
    const { result, error: ogsError } = await ogs({ url, timeout: 8000 });

    if (ogsError) {
      console.warn(`[link-preview] OGS error for ${url}:`, result);
    }

    // Resolve relative image URLs against the target URL's origin
    let imageUrl = result.ogImage?.[0]?.url || null;
    if (imageUrl && imageUrl.startsWith("/")) {
      try {
        imageUrl = new URL(imageUrl, url).href;
      } catch { imageUrl = null; }
    }

    const preview = {
      title: result.ogTitle || result.dcTitle || null,
      description: result.ogDescription || result.dcDescription || null,
      imageUrl,
      siteName: result.ogSiteName || null,
      faviconUrl: result.favicon || null,
    };
    console.log(`[link-preview] result for ${url}:`, preview);

    // Cache it
    await pool.query(
      `INSERT INTO link_previews (url, title, description, image_url, site_name, favicon_url)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (url) DO UPDATE SET
         title = $2, description = $3, image_url = $4, site_name = $5, favicon_url = $6,
         fetched_at = NOW()`,
      [url, preview.title, preview.description, preview.imageUrl, preview.siteName, preview.faviconUrl]
    );

    res.json(preview);
  } catch (err) {
    console.error("Error fetching link preview:", err);
    // Don't fail hard — link previews are a nice-to-have
    res.json({ title: null, description: null, imageUrl: null, siteName: null, faviconUrl: null });
  }
});

export default router;
