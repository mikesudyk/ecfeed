# EC Feed

**What the team is learning, out loud.**

A semi-public micro-blog for sharing team learnings. Browse at [ecfeed.com](https://ecfeed.com).

## Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 15+
- A Google Cloud project with OAuth 2.0 credentials
- A Cloudflare account with R2 enabled

### Setup

```bash
# Clone and install
git clone <your-repo-url> ecfeed
cd ecfeed
npm install

# Configure environment
cp .env.example .env
# Edit .env with your credentials (see below)

# Create database and run migrations
createdb ecfeed_dev
npm run db:migrate

# Start development
npm run dev:api   # Terminal 1 — API on :3001
npm run dev:web   # Terminal 2 — Frontend on :5173
```

### Environment Variables

See `.env.example` for all required variables. Key ones:

| Variable | Where to get it |
|----------|----------------|
| `DATABASE_URL` | Your local or Railway PostgreSQL URL |
| `GOOGLE_CLIENT_ID` | Google Cloud Console → APIs & Services → Credentials |
| `GOOGLE_CLIENT_SECRET` | Same as above |
| `JWT_SECRET` | Generate: `openssl rand -base64 32` |
| `R2_*` | Cloudflare Dashboard → R2 → API Tokens |

## Development

```bash
npm run dev:web         # Frontend dev server
npm run dev:api         # Backend dev server
npm run test:api        # API tests
npm run test:web        # Frontend component tests
npm run test:e2e        # Playwright e2e tests
npm run db:migrate      # Run pending migrations
```

## Deployment

- **Frontend**: Cloudflare Pages (auto-deploy from Git)
- **Backend**: Railway (auto-deploy from Git)
- **Database**: Railway PostgreSQL
- **Storage**: Cloudflare R2

## License

Private — EC Group International
