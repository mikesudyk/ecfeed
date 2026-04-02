# EC Feed — Claude Code Context

## What is this?
EC Feed is a semi-public team learning micro-blog at ecfeed.com. Team members (authenticated via Google Workspace, domain `ecgroup-intl.com`) can post, reply, like, and quote. Anyone can browse the public feed.

## Tech Stack
- **Monorepo** with npm workspaces
- **Frontend**: React 19 + Vite + TypeScript + Tailwind CSS + PWA (Cloudflare Pages)
- **Backend**: Node.js + Express + TypeScript (Railway)
- **Database**: PostgreSQL (Railway)
- **Storage**: Cloudflare R2 (avatars, post images)
- **Auth**: Google OAuth 2.0, domain-restricted to `ecgroup-intl.com`
- **Testing**: Vitest + React Testing Library + Playwright

## Project Structure
```
ecfeed/
├── apps/web/          # React frontend (Cloudflare Pages)
├── apps/api/          # Express backend (Railway)
├── packages/shared/   # Shared types, constants, validation
└── .env.example       # Required environment variables
```

## Key Commands
```bash
npm run dev:web        # Start frontend dev server (port 5173)
npm run dev:api        # Start backend dev server (port 3001)
npm run test:api       # Run API tests
npm run test:web       # Run frontend tests
npm run test:e2e       # Run Playwright e2e tests
npm run db:migrate     # Run database migrations
```

## Architecture Decisions
- Posts and replies share the same `posts` table (replies have non-null `parent_id`)
- Max reply depth: 4 levels
- Likes: team members only, one per user per post, stored in `likes` table
- Quote posts: top-level posts with `quoted_post_id` referencing another post
- Link previews: Open Graph metadata fetched server-side, cached in `link_previews` table
- Images: presigned R2 URLs, direct browser upload, top-level posts only in v1
- Auth: JWT in httpOnly cookie, Google OAuth with domain check
- Dark mode: class-based via Tailwind, persisted in localStorage

## API Conventions
- All endpoints return JSON
- Paginated endpoints use cursor-based pagination (`?cursor=<ISO timestamp>&limit=20`)
- Auth-required endpoints return 401 if no valid token
- Ownership checks return 403 if user doesn't own the resource
- Validation errors return 400 with field-specific messages (via Zod)

## Database
- Migrations in `apps/api/src/db/migrations/` using node-pg-migrate
- Single migration file `001_initial-schema.cjs` creates all tables
- Category enum: dev, ai, sales_marketing, design, other
- Denormalized counts: `reply_count` and `like_count` on posts table

## What needs to be built next
1. **Post card component** — render posts with avatar, body, category badge, actions
2. **Compose modal** — create new posts with category picker, optional title/URL/image
3. **Thread view** — full post + threaded replies with depth indentation
4. **Profile page** — user info + tabbed post/reply/likes history
5. **Like interaction** — optimistic UI with heart bounce animation
6. **Reply composer** — inline reply form within threads
7. **Quote post** — compose modal with embedded quoted post preview
8. **Link preview cards** — auto-fetch OG data on URL paste, render preview cards
9. **Image upload** — drag-and-drop to R2 via presigned URLs
10. **Profile editing** — update display name, bio, role title, avatar
11. **Flesh out tests** — complete the placeholder tests, add integration tests
12. **PWA install prompt** — subtle banner for mobile users

## Design Direction
- Clean, modern, fun — Linear meets X.com aesthetic
- DM Sans font, generous whitespace, mobile-first
- Category badge colors: Dev=blue, AI=purple, Sales&Marketing=green, Design=pink, Other=gray
- Dark mode as default, light mode available
- Subtle animations: heart bounce on like, smooth modal transitions
- See the mockup artifact in the conversation for visual reference

## Spec
Full spec is in `ecfeed-spec-v2.md` (in the project conversation history)
