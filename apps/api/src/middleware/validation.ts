import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import {
  POST_CATEGORIES,
  POST_VISIBILITY,
  MAX_BODY_LENGTH,
  MAX_TITLE_LENGTH,
  MAX_BIO_LENGTH,
  MAX_ROLE_TITLE_LENGTH,
} from "@ecfeed/shared";

// ─── Schemas ────────────────────────────────────────────────

export const createPostSchema = z.object({
  title: z.string().max(MAX_TITLE_LENGTH).optional(),
  body: z.string().min(1, "Body is required").max(MAX_BODY_LENGTH),
  url: z.string().url().max(2048).optional(),
  imageUrl: z.string().url().max(2048).optional(),
  category: z.enum(POST_CATEGORIES),
  visibility: z.enum(POST_VISIBILITY).default("public"),
  quotedPostId: z.string().uuid().optional(),
});

export const updatePostSchema = z.object({
  title: z.string().max(MAX_TITLE_LENGTH).optional(),
  body: z.string().min(1).max(MAX_BODY_LENGTH).optional(),
  url: z.string().url().max(2048).nullable().optional(),
  imageUrl: z.string().url().max(2048).nullable().optional(),
  category: z.enum(POST_CATEGORIES).optional(),
});

export const createReplySchema = z.object({
  body: z.string().min(1, "Body is required").max(MAX_BODY_LENGTH),
  parentId: z.string().uuid().optional(),
});

export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  bio: z.string().max(MAX_BIO_LENGTH).nullable().optional(),
  roleTitle: z.string().max(MAX_ROLE_TITLE_LENGTH).nullable().optional(),
});

export const linkPreviewSchema = z.object({
  url: z.string().url().max(2048),
});

export const presignSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
});

export const paginationSchema = z.object({
  cursor: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  category: z.enum(POST_CATEGORIES).optional(),
});

// ─── Validation middleware ──────────────────────────────────

export function validateBody(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: "validation_error",
        message: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", "),
        statusCode: 400,
      });
      return;
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      res.status(400).json({
        error: "validation_error",
        message: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", "),
        statusCode: 400,
      });
      return;
    }
    req.query = result.data;
    next();
  };
}
