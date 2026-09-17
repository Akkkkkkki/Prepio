import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// scripts/check-schema-snapshot.sh fails CI when a table defined in
// supabase/migrations/ never made it into the supabase/schema.sql snapshot
// (PREPIO-173). It exposes three seams so the classifier is testable against
// fixtures rather than the repo's real database/migrations:
// SCHEMA_SNAPSHOT_MIGRATIONS_DIR, SCHEMA_SNAPSHOT_FILE, and
// SCHEMA_SNAPSHOT_ALLOWLIST. We build a tiny migrations dir + snapshot per case
// and assert how each is classified.
const SCRIPT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "check-schema-snapshot.sh",
);

let workDir: string;
let migrationsDir: string;
let schemaFile: string;

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), "schema-snapshot-"));
  migrationsDir = join(workDir, "migrations");
  schemaFile = join(workDir, "schema.sql");
  mkdirSync(migrationsDir);
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

function migration(name: string, sql: string) {
  writeFileSync(join(migrationsDir, name), sql);
}

function snapshot(sql: string) {
  writeFileSync(schemaFile, sql);
}

function run(allowlist: string) {
  const env: NodeJS.ProcessEnv = { ...process.env };
  delete env.CI;
  env.SCHEMA_SNAPSHOT_MIGRATIONS_DIR = migrationsDir;
  env.SCHEMA_SNAPSHOT_FILE = schemaFile;
  // A single space stands in for an empty allowlist (an unset var would fall
  // back to the real five-table default).
  env.SCHEMA_SNAPSHOT_ALLOWLIST = allowlist === "" ? " " : allowlist;
  return spawnSync("bash", [SCRIPT], { env, encoding: "utf8" });
}

describe("check-schema-snapshot.sh", () => {
  it("passes when every non-dropped migration table is in the snapshot", () => {
    migration(
      "001.sql",
      "create table public.foo (id uuid);\ncreate table public.bar (id uuid);\n",
    );
    snapshot(
      'CREATE TABLE IF NOT EXISTS "public"."foo" (id uuid);\nCREATE TABLE IF NOT EXISTS "public"."bar" (id uuid);\n',
    );

    const r = run("");

    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/in sync with migrations/);
  });

  it("fails an undocumented table that a migration creates but the snapshot omits", () => {
    migration(
      "001.sql",
      "create table public.foo (id uuid);\nCREATE TABLE bar (id uuid);\n",
    );
    snapshot('CREATE TABLE IF NOT EXISTS "public"."foo" (id uuid);\n');

    const r = run("");

    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/Schema snapshot drift/);
    expect(r.stderr).toMatch(/- bar/);
  });

  it("passes a missing table that is on the allowlist", () => {
    migration(
      "001.sql",
      "create table public.foo (id uuid);\nCREATE TABLE bar (id uuid);\n",
    );
    snapshot('CREATE TABLE IF NOT EXISTS "public"."foo" (id uuid);\n');

    const r = run("bar");

    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/1 table\(s\) allowlisted/);
  });

  it("does not flag a table that is created and later dropped in migrations", () => {
    migration(
      "001.sql",
      "create table public.foo (id uuid);\ncreate table if not exists public.baz (id uuid);\n",
    );
    migration("002.sql", "DROP TABLE IF EXISTS public.baz;\n");
    snapshot('CREATE TABLE IF NOT EXISTS "public"."foo" (id uuid);\n');

    const r = run("");

    expect(r.status).toBe(0);
  });

  it("flags a table dropped and then re-created by a later migration when the snapshot omits it", () => {
    // Regression for the set-arithmetic bug Codex caught: collapsing creates and
    // drops into sets let an earlier DROP cancel a later re-CREATE, so a
    // re-created table missing from the snapshot slipped through. Resolution must
    // key on each table's last operation in migration order.
    migration("001.sql", "CREATE TABLE foo (id uuid);\n");
    migration("002.sql", "DROP TABLE IF EXISTS foo;\n");
    migration("003.sql", "CREATE TABLE foo (id uuid);\n");
    snapshot('CREATE TABLE IF NOT EXISTS "public"."other" (id uuid);\n');

    const r = run("");

    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/- foo/);
  });

  it("passes the same re-create sequence once the snapshot carries the table", () => {
    migration("001.sql", "CREATE TABLE foo (id uuid);\n");
    migration("002.sql", "DROP TABLE IF EXISTS foo;\n");
    migration("003.sql", "CREATE TABLE foo (id uuid);\n");
    snapshot('CREATE TABLE IF NOT EXISTS "public"."foo" (id uuid);\n');

    const r = run("");

    expect(r.status).toBe(0);
  });

  it("matches a CREATE TABLE statement split across lines", () => {
    // Regression for the second Codex P2: a line-oriented grep with literal
    // spaces misses `CREATE TABLE\nname` (and `CREATE TABLE\nIF NOT EXISTS\nname`),
    // silently bypassing the guard. Whitespace is normalised before matching.
    migration("001.sql", "CREATE TABLE\npublic.split_tbl (\n  id uuid\n);\n");
    migration(
      "002.sql",
      "CREATE TABLE\nIF NOT EXISTS\npublic.split_ine (id uuid);\n",
    );
    snapshot('CREATE TABLE IF NOT EXISTS "public"."other" (id uuid);\n');

    const r = run("");

    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/- split_tbl/);
    expect(r.stderr).toMatch(/- split_ine/);
  });

  it("passes split-across-lines creates once the snapshot carries them", () => {
    migration("001.sql", "CREATE TABLE\npublic.split_tbl (\n  id uuid\n);\n");
    snapshot('CREATE TABLE IF NOT EXISTS "public"."split_tbl" (id uuid);\n');

    const r = run("");

    expect(r.status).toBe(0);
  });

  it("ignores a DROP TABLE inside a block comment", () => {
    // Regression: a /* DROP TABLE foo; */ must not count as a real drop, or a
    // table still created after all migrations could go missing from the
    // snapshot undetected.
    migration("001.sql", "CREATE TABLE foo (id uuid);\n/* DROP TABLE foo; */\n");
    snapshot('CREATE TABLE IF NOT EXISTS "public"."other" (id uuid);\n');

    const r = run("");

    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/- foo/);
  });

  it("keeps file boundaries when one file ends with a comment and no trailing newline", () => {
    // Regression: `cat`-ing files together let a trailing `--` comment with no
    // final newline swallow the first line of the next file. Comments are
    // stripped per file, so bbb (first statement of file 2) is still seen.
    migration("001.sql", "CREATE TABLE aaa (id uuid); -- trailing note no newline");
    migration("002.sql", "CREATE TABLE bbb (id uuid);\n");
    snapshot('CREATE TABLE IF NOT EXISTS "public"."aaa" (id uuid);\n');

    const r = run("");

    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/- bbb/);
  });

  it("drops every target of a multi-table DROP TABLE", () => {
    // Regression: `DROP TABLE foo, bar` must drop both, or a snapshot that
    // correctly omits bar would be reported as drift.
    migration(
      "001.sql",
      "CREATE TABLE foo (id uuid);\nCREATE TABLE bar (id uuid);\nDROP TABLE foo, bar CASCADE;\n",
    );
    migration("002.sql", "CREATE TABLE keep (id uuid);\n");
    snapshot('CREATE TABLE IF NOT EXISTS "public"."keep" (id uuid);\n');

    const r = run("");

    expect(r.status).toBe(0);
  });

  it("recognises a persistent CREATE UNLOGGED TABLE", () => {
    // Unlogged tables are persistent schema objects and belong in the snapshot.
    migration("001.sql", "CREATE UNLOGGED TABLE public.cache (id uuid);\n");
    snapshot('CREATE TABLE IF NOT EXISTS "public"."other" (id uuid);\n');

    const r = run("");

    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/- cache/);
  });

  it("terminates statements at each file boundary even without a trailing semicolon", () => {
    // Regression: migrations are applied separately, so a file whose last
    // statement omits the optional `;` must not merge into the next file's first
    // statement under the `awk -v RS=';'` split. Here file 1 has no trailing `;`.
    migration("001.sql", "CREATE TABLE aaa (id uuid)");
    migration("002.sql", "CREATE TABLE bbb (id uuid);\n");
    snapshot('CREATE TABLE IF NOT EXISTS "public"."aaa" (id uuid);\n');

    const r = run("");

    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/- bbb/);
  });

  it("fails a stale allowlist entry that is now present in the snapshot (ratchet)", () => {
    migration("001.sql", "create table public.foo (id uuid);\n");
    snapshot('CREATE TABLE IF NOT EXISTS "public"."foo" (id uuid);\n');

    const r = run("foo");

    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/Stale schema-snapshot allowlist/);
    expect(r.stderr).toMatch(/- foo/);
  });

  it("ignores a CREATE TABLE that appears only inside a -- comment", () => {
    migration(
      "001.sql",
      "create table public.foo (id uuid);\n-- create table ghost (id uuid) will be added later\n",
    );
    snapshot('CREATE TABLE IF NOT EXISTS "public"."foo" (id uuid);\n');

    const r = run("");

    expect(r.status).toBe(0);
  });

  it("normalises schema-qualified and quoted names on both sides", () => {
    // Migration uses a bare name; snapshot uses "schema"."name". Both must
    // reduce to the same base identifier, so this is in sync, not drift.
    migration("001.sql", "CREATE TABLE billing_customers (id uuid);\n");
    snapshot('CREATE TABLE IF NOT EXISTS "public"."billing_customers" (id uuid);\n');

    const r = run("");

    expect(r.status).toBe(0);
  });
});
