# EC Feed — Pre-Launch Security & Engineering Audit

> **Audit Date:** 2026-04-04  
> **Auditor:** Senior Engineering Review  
> **Verdict:** ⛔ NOT READY FOR LAUNCH — 3 critical and 6 high severity issues must be resolved first.

---

## Executive Summary

The codebase is well-structured (TypeScript, Zod validation, proper test infrastructure, error middleware) but has **3 critical** and **6 high** severity issues that require fixing before a team launch. The most serious are SQL injection via string interpolation, a weak default JWT secret, and absent rate limiting.

---

## 🔴 Critical

### 1. SQL Injection via String Interpolation
**Files:** `apps/api/src/routes/posts.ts:91`, `apps/api/src/routes/users.ts:134`

The `liked_by_me` subquery uses direct string interpolation of `userId` into SQL — bypassing all parameterized query protection:

```typescript
// VULNERABLE — userId is interpolated directly into the query string
${userId ? `, EXISTS(SELECT 1 FROM likes l WHERE l.post_id = p.id AND l.user_id = '${userId}') AS liked_by_me` : ""}
```

`userId` comes from the validated JWT, so the attack vector requires a compromised session or a flaw in JWT generation. But defense-in-depth demands this be a real parameter.

**Impact:** Complete database compromise — data theft, modification, deletion.

**Fix:** Thread `userId` as a positional parameter (`$N`) instead of interpolating it into the query string.

---

### 2. Weak Default JWT Secret
**File:** `apps/api/src/middleware/auth.ts:28`

```typescript
const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production";
```

If `JWT_SECRET` is not set (misconfigured deploy, `.env` not uploaded), anyone can forge valid JWTs using the known fallback string — completely bypassing authentication.

**Impact:** Full authentication bypass. Attacker can impersonate any user.

**Fix:**
```typescript
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("FATAL: JWT_SECRET not set");
  process.exit(1);
}
```

---

### 3. No Rate Limiting Anywhere
**All routes**

Zero rate limiting on any endpoint. An attacker can:
- Spam post creation to flood the feed and exhaust the database
- Use `/api/link-preview` as an anonymous HTTP proxy to external sites
- Enumerate user IDs via `/api/users/:id`

**Impact:** Denial of service, database resource exhaustion, network abuse.

**Fix:** Add `express-rate-limit` — strict limits on write endpoints (posts, replies, likes), per-user limits on link previews, and a default limit globally.

---

## 🟠 High

### 4. No Transactions on Multi-Step Mutations
**File:** `apps/api/src/routes/posts.ts` — reply creation, delete, and like/unlike

When creating a reply, the `INSERT` and the `reply_count + 1` update are two separate queries. If the connection drops between them, the count is permanently wrong. Same issue on delete (`reply_count - 1`) and unlike (`like_count - 1`).

**Impact:** Data corruption accumulates silently over time.

**Fix:** Wrap each multi-step operation in `BEGIN / COMMIT / ROLLBACK` using a pool client.

---

### 5. Avatar URL Written to DB Before R2 Upload Completes
**File:** `apps/api/src/routes/uploads.ts:31-46`

The presign endpoint updates `users.avatar_url` immediately, before the client has uploaded the file to R2. If the upload fails or is abandoned, the user's profile permanently shows a broken image with no recovery path.

**Impact:** Broken avatar images with no recovery mechanism.

**Fix:** Either (a) don't update the DB until the client calls a `/avatar/confirm` endpoint, or (b) only update DB after verifying the object exists in R2.

---

### 6. Link Preview Endpoint Is an Open SSRF Vector
**File:** `apps/api/src/routes/uploads.ts:51`

The `/link-preview` endpoint fetches arbitrary user-supplied URLs from your server with no blocklist for private IP ranges. A logged-in user can probe your internal Railway network:

```
POST /api/link-preview  { "url": "http://169.254.169.254/latest/meta-data/" }
```

**Impact:** Internal network scanning, credential theft from cloud metadata endpoints.

**Fix:**
```typescript
const { hostname } = new URL(url);
if (/^(127\.|10\.|192\.168\.|169\.254\.|::1$|localhost)/i.test(hostname)) {
  throw new AppError(400, "invalid_url", "Cannot preview internal URLs");
}
```

---

### 7. Detailed URLs Logged in Production
**File:** `apps/api/src/routes/uploads.ts:71,94`

```typescript
console.log(`[link-preview] fetching OG data for: ${url}`);
console.log(`[link-preview] result for ${url}:`, preview);
```

Railway persists logs. URLs can contain tokens, session IDs, or PII. The full preview payload is also logged.

**Impact:** Privacy violation, potential credential leakage.

**Fix:** Log only the hostname, not the full URL. Remove the result payload log entirely.

---

### 8. Missing CSRF Protection
**All POST/PUT/DELETE endpoints**

The app uses `httpOnly` cookies, which is good, but there are no CSRF tokens. `sameSite: "lax"` mitigates most vectors but not all (e.g., top-level navigation POST from a malicious site).

**Impact:** Attacker can create posts, like posts, or modify profiles on behalf of a logged-in victim.

**Fix:** Implement CSRF tokens via `csurf` middleware, or upgrade cookies to `sameSite: "strict"`.

---

### 9. No Environment Validation at Startup
**File:** `apps/api/src/index.ts`

`DATABASE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `R2_*` variables are never validated at boot. A misconfigured deploy silently starts and only fails on the first user request.

**Fix:**
```typescript
const required = ["DATABASE_URL", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "JWT_SECRET"];
for (const key of required) {
  if (!process.env[key]) { console.error(`FATAL: ${key} not set`); process.exit(1); }
}
```

---

### 10. No React Error Boundary
**Frontend — `apps/web/src/main.tsx`**

A rendering exception in any component (e.g., an unexpected `null` field from the API) produces a full white screen with no recovery UI. No `<ErrorBoundary>` wraps the app.

**Impact:** Any unexpected API response shape can crash the entire UI.

**Fix:** Add a top-level `ErrorBoundary` class component wrapping `<App />` in `main.tsx`.

---

## 🟡 Medium

### 11. Missing Index on `likes.user_id`
**File:** `apps/api/src/db/migrations/001_initial-schema.cjs`

`likes.post_id` is indexed but `likes.user_id` is not. The Likes tab on a profile page will do a sequential scan as data grows.

**Fix:** `CREATE INDEX idx_likes_user ON likes(user_id);`

---

### 12. Presigned URL Content-Type Is Fully Client-Controlled
**File:** `apps/api/src/routes/uploads.ts`

`contentType` is taken directly from the request body and put into the presigned URL. A user can claim `contentType: "text/html"` and upload an HTML file to R2.

**Fix:**
```typescript
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
if (!ALLOWED_TYPES.includes(contentType)) throw new AppError(400, "invalid_type", "Unsupported file type");
```

---

### 13. Recursive Reply Tree Query Has No Depth Guard
**File:** `apps/api/src/routes/posts.ts:162-174`

The thread fetch uses a recursive CTE to fetch all descendants. Max depth is enforced at write time, but if data ever gets inconsistent the CTE could expand unexpectedly.

**Fix:** Add a `CYCLE` detection clause or add `AND p.depth <= 4` to the recursive CTE.

---

### 14. No Helmet / Security Headers
**File:** `apps/api/src/index.ts`

No `helmet()` middleware. Missing headers: `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, `Content-Security-Policy`.

**Fix:** `npm install helmet` and add `app.use(helmet())` as the first middleware.

---

### 15. Denormalized Counts Can Drift
**File:** `apps/api/src/routes/posts.ts`

Even with transactions (see #4), `reply_count` and `like_count` can drift over time from bugs or direct DB operations. There is no reconciliation mechanism.

**Fix:** Add a periodic reconciliation query that resets counts from actuals, or switch to real-time `COUNT(*)` subqueries.

---

## 🟢 Low / Info

| # | Issue | Location |
|---|-------|----------|
| 16 | No graceful shutdown (SIGTERM handler) | `apps/api/src/index.ts` |
| 17 | No database health check endpoint | `apps/api/src/db/pool.ts` |
| 18 | No request access logging (morgan) | `apps/api/src/index.ts` |
| 19 | No soft deletes — deleted content is unrecoverable | DB schema |
| 20 | `open-graph-scraper` version may have known CVEs | `package.json` |
| 21 | PWA manifest icons may 404 if deploy skipped them | `apps/web/public/` |
| 22 | `console.log` statements throughout production routes | Multiple |
| 23 | No database connection string validation | `apps/api/src/db/pool.ts` |
| 24 | Frontend has no retry logic for failed API calls | `apps/web/src/lib/api.ts` |
| 25 | No audit trail / request logging | All routes |

---

## Launch Blocker Checklist

### Must fix before any production launch

- [ ] **SQL injection** — parameterize the `liked_by_me` subquery in `postQuery()`
- [ ] **JWT secret** — enforce `JWT_SECRET` at startup, crash if missing
- [ ] **Rate limiting** — add `express-rate-limit` on post creation and link preview at minimum
- [ ] **Transactions** — wrap reply creation, delete, like, and unlike in `BEGIN/COMMIT`
- [ ] **SSRF** — block private IP ranges in the link preview endpoint
- [ ] **Security headers** — add `helmet()` middleware
- [ ] **Log redaction** — remove full URLs and preview payloads from logs

### Should fix before broader team rollout

- [ ] **Avatar upload ordering** — only update `avatar_url` after confirmed R2 upload
- [ ] **CSRF protection** — add tokens or upgrade to `sameSite: strict`
- [ ] **Env validation** — validate all required env vars at startup
- [ ] **React error boundary** — wrap app in `<ErrorBoundary>`
- [ ] **`idx_likes_user` index** — add missing index on `likes.user_id`
- [ ] **Content-type allowlist** — server-side validation on presign endpoint
- [ ] **Graceful shutdown** — handle SIGTERM before Railway stops the container

### Nice to have before GA

- [ ] Request access logging (morgan or custom middleware)
- [ ] Soft deletes for posts
- [ ] Denormalized count reconciliation job
- [ ] Database health check endpoint (`/health/db`)
- [ ] Frontend retry logic for transient API failures

---

## Findings by Severity

| # | Title | Severity | Category |
|---|-------|----------|----------|
| 1 | SQL Injection via String Interpolation | 🔴 Critical | Security |
| 2 | Weak Default JWT Secret | 🔴 Critical | Security |
| 3 | No Rate Limiting | 🔴 Critical | Security |
| 4 | No Transactions on Multi-Step Mutations | 🟠 High | Data Integrity |
| 5 | Avatar URL Written Before Upload Completes | 🟠 High | Data Integrity |
| 6 | SSRF via Link Preview Endpoint | 🟠 High | Security |
| 7 | Full URLs Logged in Production | 🟠 High | Security / Privacy |
| 8 | Missing CSRF Protection | 🟠 High | Security |
| 9 | No Environment Validation at Startup | 🟠 High | Reliability |
| 10 | No React Error Boundary | 🟠 High | Reliability / UX |
| 11 | Missing Index on `likes.user_id` | 🟡 Medium | Performance |
| 12 | Client-Controlled Content-Type on Uploads | 🟡 Medium | Security |
| 13 | Recursive CTE Has No Depth Guard | 🟡 Medium | Reliability |
| 14 | No Helmet / Security Headers | 🟡 Medium | Security |
| 15 | Denormalized Counts Can Drift | 🟡 Medium | Data Integrity |
| 16 | No Graceful Shutdown | 🟢 Low | Reliability |
| 17 | No Database Health Check | 🟢 Low | Reliability |
| 18 | No Request Access Logging | 🟢 Low | Observability |
| 19 | No Soft Deletes | 🟢 Low | Data Retention |
| 20 | Possible CVEs in `open-graph-scraper` | 🟢 Low | Security |
| 21 | PWA Icons May 404 | 🟢 Low | UX |
| 22 | Console Logs in Production Routes | 🟢 Low | Security / Hygiene |
| 23 | No DB Connection String Validation | 🟢 Low | Reliability |
| 24 | No API Retry Logic on Frontend | 🟢 Low | UX |
| 25 | No Audit Trail / Request Logging | ℹ️ Info | Compliance |
