import { defineConfig } from "drizzle-kit";

// drizzle-kit doesn't read .env on its own (Next does for the app).
try {
  process.loadEnvFile(".env");
} catch {}

export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema.ts",
  out: "./db/migrations",
  casing: "snake_case",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
