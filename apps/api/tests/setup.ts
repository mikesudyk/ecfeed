import { beforeAll, afterAll } from "vitest";

// Test setup — configure test database connection, mock auth, etc.
// In a real setup, this would spin up a test DB or use a transaction wrapper.

beforeAll(() => {
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = "test-secret-do-not-use-in-prod";
  process.env.ALLOWED_DOMAIN = "ecgroup-intl.com";
});

afterAll(() => {
  // Clean up connections, etc.
});
