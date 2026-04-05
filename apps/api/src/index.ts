import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import passport from "passport";
import rateLimit from "express-rate-limit";

import { configurePassport } from "./middleware/auth.js";
import { notFound, errorHandler } from "./middleware/errors.js";
import authRoutes from "./routes/auth.js";
import postRoutes from "./routes/posts.js";
import userRoutes from "./routes/users.js";
import uploadRoutes from "./routes/uploads.js";

// ─── Config ─────────────────────────────────────────────────

const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

// ─── App ────────────────────────────────────────────────────

const app = express();

// Security
app.use(helmet());
app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  })
);

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "too_many_requests", message: "Too many requests, please try again later.", statusCode: 429 },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "too_many_requests", message: "Too many auth attempts, please try again later.", statusCode: 429 },
});

const writeLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "too_many_requests", message: "Slow down — too many writes.", statusCode: 429 },
});

app.use("/auth", authLimiter);
app.use(generalLimiter);

// Parsing
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

// Auth
configurePassport();
app.use(passport.initialize());

// ─── Routes ─────────────────────────────────────────────────

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/auth", authRoutes);
app.use("/api/posts", writeLimiter, postRoutes);
app.use("/api/users", userRoutes);
app.use("/api", uploadRoutes);

// ─── Error handling ─────────────────────────────────────────

app.use(notFound);
app.use(errorHandler);

// ─── Start ──────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`🚀 EC Feed API running on http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
});

export default app;
