#!/usr/bin/env node
/**
 * Apply migration 0006 to remote Supabase.
 *
 * Usage:
 *   node scripts/apply-migration.mjs <database-password>
 *
 * Find your database password in:
 *   Supabase Dashboard → Settings → Database → Connection string → password
 */

import fs from "fs";
import pg from "pg";

const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL?.match(
  /https:\/\/(.+)\.supabase\.co/,
)?.[1];

if (!projectRef) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL in environment.");
  process.exit(1);
}

const dbPassword = process.argv[2];
if (!dbPassword) {
  console.error("Usage: node scripts/apply-migration.mjs <database-password>");
  console.error(
    "Find it in Supabase Dashboard → Settings → Database → Connection string",
  );
  process.exit(1);
}

const connectionString = `postgresql://postgres.${projectRef}:${encodeURIComponent(dbPassword)}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  console.log("Connected to Supabase Postgres.");

  const sql = fs.readFileSync("supabase/migrations/0006_phase3_str_states.sql", "utf8");
  await client.query(sql);
  console.log("✓ Migration 0006 applied successfully!");

  const { rows } = await client.query(
    "SELECT count(*) as c FROM zillow_state_regions",
  );
  console.log(`✓ zillow_state_regions: ${rows[0].c} states seeded.`);
} catch (err) {
  console.error("Error:", err.message);
  process.exit(1);
} finally {
  await client.end();
}
