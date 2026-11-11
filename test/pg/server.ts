import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import type { Db } from "../../db/types.ts";
import * as schema from "../../db/schema.ts";

const run = promisify(execFile);
const PASSWORD = "owner-pw";

const freePort = () =>
  new Promise<number>((resolve, reject) => {
    const s = createServer();
    s.once("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address() as { port: number };
      s.close(() => resolve(port));
    });
  });

// One client (one connection) per simulated user.
export function connect(url: string): Db & { $client: postgres.Sql } {
  return drizzle(postgres(url, { max: 1, onnotice: () => {} }), { schema, casing: "snake_case" }) as never;
}

async function prepare(url: string, adminUrl: string): Promise<void> {
  const admin = postgres(adminUrl, { max: 1, onnotice: () => {} });
  await admin.unsafe(`CREATE ROLE app_owner LOGIN PASSWORD '${PASSWORD}'`);
  await admin.unsafe(`CREATE ROLE anon NOLOGIN`);
  await admin.unsafe(`CREATE ROLE authenticated NOLOGIN`);
  await admin.unsafe(`GRANT anon, authenticated TO app_owner`); // like Supabase's postgres: lets it SET ROLE
  await admin.unsafe(`CREATE DATABASE app OWNER app_owner`);
  await admin.end();

  const mig = postgres(url, { max: 1, onnotice: () => {} });
  await migrate(drizzle(mig, { schema, casing: "snake_case" }), { migrationsFolder: "db/migrations" });
  await mig.unsafe(`GRANT USAGE ON SCHEMA public TO anon, authenticated`);
  await mig.unsafe(`GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated`);
  await mig.unsafe(`GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated`);
  await mig.end();
}

export async function startPostgres(): Promise<{ url: string; stop: () => Promise<void> }> {
  if (process.env.TEST_DATABASE_URL) {
    // ponytail: assumes the external DB is empty and already has app_owner-like roles; no teardown.
    return { url: process.env.TEST_DATABASE_URL, stop: async () => {} };
  }
  const bin = process.env.PG_BIN ?? "/opt/homebrew/opt/postgresql@17/bin";
  const dir = await mkdtemp(join(tmpdir(), "gh-pg-"));
  const data = join(dir, "data");
  const port = await freePort();
  await run(join(bin, "initdb"), ["-D", data, "-U", "postgres", "--auth=trust", "-E", "UTF8"]);
  await run(join(bin, "pg_ctl"), [
    "-D", data, "-w", "-l", join(dir, "log"), "start",
    "-o", `-c listen_addresses=127.0.0.1 -p ${port} -k ${dir} -c max_connections=50`,
  ]);
  const stop = async () => {
    await run(join(bin, "pg_ctl"), ["-D", data, "-m", "immediate", "stop"]).catch(() => {});
    await rm(dir, { recursive: true, force: true });
  };
  const base = `postgres://app_owner:${PASSWORD}@127.0.0.1:${port}`;
  try {
    await prepare(`${base}/app`, `postgres://postgres@127.0.0.1:${port}/postgres`);
  } catch (e) {
    await stop();
    throw e;
  }
  return { url: `${base}/app`, stop };
}
