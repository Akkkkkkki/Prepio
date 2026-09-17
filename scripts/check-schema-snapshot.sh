#!/usr/bin/env bash
set -euo pipefail

ROOT=$(git rev-parse --show-toplevel)
cd "$ROOT"

# Drift guard for the checked-in schema snapshot.
#
# Why this exists: supabase/schema.sql is the `db:pull` snapshot presented as the
# schema of record, but nothing kept it in step with supabase/migrations/. It
# silently drifted for over three months — five tables (billing_customers,
# billing_subscriptions, billing_events, research_previews,
# research_preview_rate_limits) live in migrations but never made it into the
# snapshot — and only a manual alignment review caught it (PREPIO-173). This is
# the "guardrail worth adding" that issue calls out: a table present in a
# migration but absent from schema.sql fails CI here instead of three months
# later.
#
# This is a lightweight parser, not a full SQL engine. Per file it strips
# `/* ... */` block and `--` line comments, then splits the stream into
# statements on `;` and reads each leading `CREATE [UNLOGGED] TABLE` /
# `DROP TABLE`. Names are lowercased (Postgres folds unquoted identifiers to
# lowercase; the snapshot is lowercase too) and normalised to the unquoted base
# identifier, dropping any schema qualifier. Dropping the schema is deliberate:
# this repo creates the `ops` tables bare and later relocates them with
# `ALTER TABLE ... SET SCHEMA ops` (which this parser does not track), so a
# migration's `scraped_urls` must still match the snapshot's `ops.scraped_urls`
# — a schema-qualified identity would report false drift on exactly those. Each
# table is resolved by its LAST operation across migrations in order — a
# create → drop → re-create ends "created" and must appear in schema.sql; a
# create → drop ends "dropped" and must not — and a multi-table `DROP TABLE a, b`
# drops every listed target. Comments are stripped per file so a trailing `--`
# with no final newline cannot bleed into the next file.
#
# Known limits (out of scope for a heuristic drift guard over a controlled,
# in-repo migration corpus — none of these constructs appear in it today): it
# does not resolve ALTER/RENAME/SET SCHEMA, nested block comments, or a comment
# marker (`--`, `/*`) or `;` sitting inside a string literal or dollar-quoted
# body (telling those from real comments/terminators needs a true SQL
# tokenizer). Those remain review's job. It is deliberately cheap, in the spirit
# of the other scripts/check-*.sh gates.
#
# ALLOWLIST — tables known to be missing from the snapshot pending the freeze
# deploy (PREPIO-124) and the schema regeneration it unblocks (PREPIO-173).
# `billing_v1` is already applied in production but the snapshot predates it;
# `research_preview_cache` is genuinely pending. Both are picked up by the
# post-deploy `db:pull` in PREPIO-173, at which point each name must be removed
# from this list — the ratchet below fails if an allowlisted table has since
# appeared in schema.sql, so the list cannot rot into a permanent mute.
DEFAULT_ALLOWLIST="billing_customers billing_subscriptions billing_events research_previews research_preview_rate_limits"

# Seams so the unit test can drive the classifier against fixtures without a real
# database or the repo's own migrations.
MIGRATIONS_DIR=${SCHEMA_SNAPSHOT_MIGRATIONS_DIR:-supabase/migrations}
SCHEMA_FILE=${SCHEMA_SNAPSHOT_FILE:-supabase/schema.sql}
ALLOWLIST=${SCHEMA_SNAPSHOT_ALLOWLIST:-$DEFAULT_ALLOWLIST}

if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo "Migrations directory not found: $MIGRATIONS_DIR" >&2
  exit 1
fi
if [ ! -f "$SCHEMA_FILE" ]; then
  echo "Schema snapshot not found: $SCHEMA_FILE" >&2
  exit 1
fi

# Emit the given files' SQL with `/* ... */` block comments and `--` line
# comments removed. Done per file (perl slurps each with -0777) so a trailing
# comment or a missing final newline in one file cannot merge with the next
# file's first line; a newline is appended as an explicit boundary.
normalized_sql() {
  local f
  for f in "$@"; do
    [ -f "$f" ] || continue
    perl -0777 -pe 's{/\*.*?\*/}{ }gs; s{--[^\n]*}{}g' "$f"
    printf '\n'
  done
}

# Print the base names of tables whose LAST create/drop across the given files
# leaves them created, one per line, sorted. Whitespace is collapsed so a
# statement split across lines matches; awk splits on `;` and reads each leading
# CREATE/DROP TABLE, expanding a comma-separated DROP target list. Later
# statements overwrite earlier ones, so op[name] holds each table's final state.
tables_ending_created() {
  normalized_sql "$@" \
    | tr -s '[:space:]' ' ' \
    | awk -v RS=';' '
        {
          s = tolower($0)
          gsub(/^ +/, "", s); gsub(/ +$/, "", s)
          if (s ~ /^create( unlogged)? table( if not exists)? /) {
            sub(/^create( unlogged)? table( if not exists)? +/, "", s)
            name = s
            sub(/[ (].*/, "", name); gsub(/"/, "", name); sub(/^.*\./, "", name)
            if (name != "") op[name] = "create"
          } else if (s ~ /^drop table( if exists)? /) {
            sub(/^drop table( if exists)? +/, "", s)
            sub(/ +cascade.*/, "", s); sub(/ +restrict.*/, "", s)
            n = split(s, targets, /,/)
            for (i = 1; i <= n; i++) {
              name = targets[i]
              gsub(/^ +/, "", name); gsub(/ +$/, "", name)
              sub(/[ (].*/, "", name); gsub(/"/, "", name); sub(/^.*\./, "", name)
              if (name != "") op[name] = "drop"
            }
          }
        }
        END { for (k in op) if (op[k] == "create") print k }
      ' \
    | sort -u
}

# Emit a set as sorted, blank-free lines — the shape `comm` needs. Guards the
# empty-set case: an unquoted empty string would otherwise feed `comm` a phantom
# blank line and leak an empty "table name" into the diff.
as_set() {
  printf '%s\n' "$1" | sed '/^$/d' | sort -u
}

mapfile -t MIGRATION_FILES < <(find "$MIGRATIONS_DIR" -name '*.sql' | sort)
if (( ${#MIGRATION_FILES[@]} == 0 )); then
  echo "No migration files found under $MIGRATIONS_DIR." >&2
  exit 1
fi

# Tables the migrations end with (files are timestamp-prefixed and sorted, so
# statements resolve in migration order) versus those the snapshot carries.
expected=$(tables_ending_created "${MIGRATION_FILES[@]}")
present=$(tables_ending_created "$SCHEMA_FILE")

# The tables the migrations end with that the snapshot is missing.
missing=$(comm -23 <(as_set "$expected") <(as_set "$present"))

# Normalise the allowlist (space-, tab-, or newline-separated) to a sorted set.
allowlist_set=$(printf '%s' "$ALLOWLIST" | tr ' \t' '\n' | sed '/^$/d' | sort -u)

# Drift: a missing table that is NOT allowlisted. This is the failure the guard
# exists to catch — a migration whose table never reached schema.sql.
undocumented=$(comm -23 <(as_set "$missing") <(as_set "$allowlist_set"))

# Ratchet: an allowlisted table that is no longer missing (it made it into the
# snapshot, or its migration was removed). It must be pruned so the allowlist
# stays an accurate, shrinking record rather than a permanent mute.
stale_allow=$(comm -23 <(as_set "$allowlist_set") <(as_set "$missing"))

status=0

if [ -n "$undocumented" ]; then
  status=1
  echo "Schema snapshot drift: table(s) defined in $MIGRATIONS_DIR but absent from $SCHEMA_FILE:" >&2
  printf '  - %s\n' $undocumented >&2
  echo "Regenerate the snapshot (npm run db:pull) so it reflects the migrations, or if the table is legitimately expected to be missing add it to the allowlist in scripts/check-schema-snapshot.sh with a reason." >&2
fi

if [ -n "$stale_allow" ]; then
  status=1
  echo "Stale schema-snapshot allowlist entry(ies) — now present in $SCHEMA_FILE (or gone from migrations); remove from the allowlist in scripts/check-schema-snapshot.sh:" >&2
  printf '  - %s\n' $stale_allow >&2
fi

if (( status == 0 )); then
  allow_count=$(printf '%s\n' "$allowlist_set" | sed '/^$/d' | wc -l | tr -d ' ')
  echo "Schema snapshot in sync with migrations (${allow_count} table(s) allowlisted pending PREPIO-173 regeneration)."
fi

exit $status
