import pg from "pg";

const { Pool } = pg;

// Railway's internal Postgres network doesn't support SSL; external
// managed DBs (e.g. Supabase, RDS) do. Detect by hostname.
const ssl =
  process.env.NODE_ENV === "production" &&
  !process.env.DATABASE_URL?.includes(".railway.internal")
    ? { rejectUnauthorized: false }
    : false;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on("error", (err) => {
  console.error("Unexpected database pool error:", err);
});

export default pool;
