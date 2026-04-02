import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import passport from "passport";

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
app.use("/api/posts", postRoutes);
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
