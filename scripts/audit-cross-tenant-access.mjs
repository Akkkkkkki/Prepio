#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";
import process from "node:process";

const TABLES = [
  { name: "searches", key: "id" },
  { name: "search_artifacts", key: "id" },
  { name: "interview_stages", key: "id" },
  { name: "interview_questions", key: "id" },
  { name: "prep_plans", key: "id" },
  { name: "practice_sessions", key: "id" },
  { name: "practice_answers", key: "id" },
  { name: "user_question_flags", key: "id" },
  { name: "answer_feedback", key: "id" },
  { name: "resumes", key: "id" },
  { name: "candidate_profiles", key: "user_id" },
  { name: "profile_imports", key: "id" },
  { name: "billing_customers", key: "user_id" },
  { name: "billing_subscriptions", key: "user_id" },
];

const BUCKETS = ["practice-audio", "resume-files"];

export const classifyReplay = ({ sourceError, sourceIds, replayError, replayRows }) => {
  if (sourceError) return "inconclusive";
  if (sourceIds.length === 0) return "not_tested";
  if (replayError) return "inconclusive";
  return replayRows.length === 0 ? "protected" : "leak";
};

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};

const clientFor = (url, anonKey, token) => createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { Authorization: `Bearer ${token}` } },
});

const formatError = (error) => error ? `${error.code ?? "error"}: ${error.message}` : "";

async function auditTable(owner, attacker, { name, key }) {
  const source = await owner.from(name).select(key).limit(200);
  const sourceIds = (source.data ?? []).map((row) => row[key]).filter(Boolean);
  if (source.error || sourceIds.length === 0) {
    return {
      target: `table:${name}`,
      status: classifyReplay({ sourceError: source.error, sourceIds, replayRows: [] }),
      evidence: source.error ? `Account A enumeration failed (${formatError(source.error)})` : "Account A has no fixture rows",
    };
  }

  const replay = await attacker.from(name).select(key).in(key, sourceIds);
  const replayRows = replay.data ?? [];
  return {
    target: `table:${name}`,
    status: classifyReplay({ sourceError: null, sourceIds, replayError: replay.error, replayRows }),
    evidence: replay.error
      ? `Account B replay failed (${formatError(replay.error)})`
      : `B returned ${replayRows.length}/${sourceIds.length} A row(s)`,
  };
}

async function auditBucket(owner, attacker, bucket, ownerId) {
  const listing = await owner.storage.from(bucket).list(ownerId, { limit: 100 });
  if (listing.error) {
    return [{ target: `storage:${bucket}`, status: "inconclusive", evidence: `Account A listing failed (${formatError(listing.error)})` }];
  }

  const paths = (listing.data ?? []).filter((item) => item.id).map((item) => `${ownerId}/${item.name}`);
  if (paths.length === 0) {
    return [{ target: `storage:${bucket}`, status: "not_tested", evidence: "Account A has no fixture objects" }];
  }

  const results = [];
  for (const path of paths) {
    const download = await attacker.storage.from(bucket).download(path);
    results.push({
      target: `storage:${bucket}:download`,
      status: download.error ? "protected" : "leak",
      evidence: download.error ? `B denied A path ${path}` : `B downloaded A path ${path}`,
    });
    const signed = await attacker.storage.from(bucket).createSignedUrl(path, 60);
    results.push({
      target: `storage:${bucket}:signed-url`,
      status: signed.error ? "protected" : "leak",
      evidence: signed.error ? `B denied signed URL for ${path}` : `B created a 60-second signed URL for ${path}`,
    });
  }
  return results;
}

export const toMarkdown = (results) => {
  const rows = results.map(({ target, status, evidence }) =>
    `| ${target.replaceAll("|", "\\|")} | ${status} | ${evidence.replaceAll("|", "\\|")} |`);
  return [
    "# Cross-tenant access audit",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "| Target | Result | Evidence |",
    "|---|---|---|",
    ...rows,
    "",
    "`protected` means B could not read A's resource. `not_tested` means account A lacked the required fixture. `inconclusive` means the audit setup or schema did not permit the check.",
  ].join("\n");
};

async function main() {
  const url = required("SUPABASE_URL");
  const anonKey = required("SUPABASE_ANON_KEY");
  const tokenA = required("AUDIT_USER_A_JWT");
  const tokenB = required("AUDIT_USER_B_JWT");
  const owner = clientFor(url, anonKey, tokenA);
  const attacker = clientFor(url, anonKey, tokenB);
  const [userA, userB] = await Promise.all([owner.auth.getUser(tokenA), attacker.auth.getUser(tokenB)]);
  if (userA.error || !userA.data.user) throw new Error(`Account A token rejected: ${formatError(userA.error)}`);
  if (userB.error || !userB.data.user) throw new Error(`Account B token rejected: ${formatError(userB.error)}`);
  if (userA.data.user.id === userB.data.user.id) throw new Error("Audit accounts must be different users");

  const results = [];
  for (const table of TABLES) results.push(await auditTable(owner, attacker, table));
  for (const bucket of BUCKETS) results.push(...await auditBucket(owner, attacker, bucket, userA.data.user.id));
  results.push({
    target: "guest-preview-claim",
    status: "not_applicable",
    evidence: "The current research preview is a shared, non-PII cache and implements no guest-to-user claim operation.",
  });
  results.push({
    target: "deleted-resume-object-cleanup",
    status: "not_tested",
    evidence: "Intentionally non-mutating; verify deletion separately with a disposable non-production resume fixture.",
  });
  results.push({
    target: "edge-function-direct-id-replay",
    status: "not_tested",
    evidence: "Intentionally excludes mutating and model-backed invocations; run those separately against disposable non-production fixtures.",
  });

  console.log(toMarkdown(results));
  if (results.some((result) => result.status === "leak")) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 2;
  });
}
