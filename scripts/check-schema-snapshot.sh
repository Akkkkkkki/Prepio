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
# This is a heuristic, not a SQL parser. It reads `CREATE TABLE` / `DROP TABLE`
# statements with `--` line comments stripped, normalises each name to its
# unquoted base identifier (dropping any schema qualifier), and resolves each
# table by its LAST operation across migrations in order — so a create → drop →
# re-create sequence ends "created" and must appear in schema.sql, while a
# create → drop sequence ends "dropped" and must not. (Collapsing creates and
# drops into sets got this wrong: a later re-create was cancelled by the earlier
# drop.) It cannot see ALTER/RENAME or tables created outside migrations; those
# remain review's job. It is deliberately cheap, in the spirit of the other
# scripts/check-*.sh gates.
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

# Emit the SQL from the given files with `--` line comments removed and every run
# of whitespace (newlines included) collapsed to a single space. The comment
# strip is per line and must precede the newline collapse, or a trailing comment
# would swallow the rest of the file. Collapsing newlines lets a statement
# written across lines — `CREATE TABLE\npublic.foo (...)` — match the same as a
# single-line one; grep is line-oriented, so without this it would be missed and
# silently bypass the guard.
normalized_sql() {
  cat "$@" 2>/dev/null \
    | sed -E 's/--.*$//' \
    | tr -s '[:space:]' ' '
}

# Extract table base names for a `create` or `drop` statement out of one or more
# files. Runs them through normalized_sql first (so prose like "-- create table
# foo for X" cannot be misread as a definition, and cross-line statements are
# matched), matches the keyword case-insensitively, and normalises
# `"public"."t"` / `public.t` / `t` all to `t`.
extract_tables() {
  local keyword=$1
  shift
  local raw rc
  # grep exits 1 when a keyword is simply absent (e.g. no DROP TABLE anywhere),
  # which is not an error; only exit >1 is. Run it outside `set -e`/pipefail so a
  # clean no-match does not abort the script, then re-classify the status.
  set +e
  raw=$(normalized_sql "$@" \
    | grep -ioE "${keyword} table( if (not )?exists)? +[A-Za-z0-9_.\"]+")
  rc=$?
  set -e
  if (( rc > 1 )); then
    echo "check-schema-snapshot: grep failed (exit $rc) scanning for '${keyword} table'." >&2
    return "$rc"
  fi
  [ -z "$raw" ] && return 0
  printf '%s\n' "$raw" \
    | sed -E "s/^${keyword} table( if (not )?exists)? +//I" \
    | tr -d '"' \
    | sed -E 's/.*\.//' \
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

# Walk every CREATE/DROP TABLE statement in migration order (files are
# timestamp-prefixed and sorted; lines within a file stay in order) and record
# each table's LAST operation. A table ends "created" iff its final statement is
# a create. This is order-sensitive on purpose — set arithmetic cannot tell a
# create → drop from a create → drop → re-create.
declare -A final_op
while IFS= read -r match; do
  [ -z "$match" ] && continue
  local_op=$(printf '%s' "$match" | grep -ioE '^(create|drop)' | tr '[:upper:]' '[:lower:]')
  name=$(printf '%s' "$match" \
    | sed -E 's/^(create|drop) table( if (not )?exists)? +//I' \
    | tr -d '"' \
    | sed -E 's/.*\.//')
  [ -z "$name" ] && continue
  final_op["$name"]=$local_op
done < <(
  normalized_sql "${MIGRATION_FILES[@]}" \
    | grep -ioE '(create|drop) table( if (not )?exists)? +[A-Za-z0-9_."]+' || true
)

expected=""
if (( ${#final_op[@]} > 0 )); then
  for name in "${!final_op[@]}"; do
    [ "${final_op[$name]}" = "create" ] && expected+="${name}"$'\n'
  done
fi

present=$(extract_tables create "$SCHEMA_FILE")

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
