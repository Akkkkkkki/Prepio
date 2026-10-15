import { describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const script = resolve(process.cwd(), "scripts/deploy-frozen-functions.mjs");
const dirtySentinel = resolve(process.cwd(), ".freeze-deploy-dirty-sentinel");
const currentCommit = () => execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const run = (...args: string[]) =>
  spawnSync(process.execPath, [script, ...args], {
    encoding: "utf8",
    env: { ...process.env, PREPIO_DEPLOY_COMMIT: "unreviewed" },
  });
const runWithReviewedCommit = (...args: string[]) =>
  spawnSync(process.execPath, [script, ...args], {
    encoding: "utf8",
    env: { ...process.env, PREPIO_DEPLOY_COMMIT: currentCommit() },
  });

describe("freeze deployment command", () => {
  it("defaults to a dry run containing only five explicitly named functions", () => {
    const result = run();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Dry run only");
    expect(result.stdout.match(/^supabase functions deploy /gm)).toHaveLength(5);
    expect(result.stdout).toContain("deploy interview-research --project-ref vjwrirrqprjzdorignlz");
    expect(result.stdout).not.toContain("deploy --project-ref");
  });

  it("dry-runs only the named manifest function for single-function deploys", () => {
    const result = run("company-research");
    expect(result.status).toBe(0);
    expect(result.stdout.match(/^supabase functions deploy /gm)).toHaveLength(1);
    expect(result.stdout).toContain("deploy company-research --project-ref vjwrirrqprjzdorignlz");
    expect(result.stdout).not.toContain("deploy interview-research --project-ref");
  });

  it.each(["research-preview", "answer-feedback", "create-checkout-session", "create-portal-session", "stripe-webhook", "profile-import", "practice-audio-transcribe", "--prune"])("rejects %s", name => {
    const result = run(name);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Not in the freeze manifest");
    expect(result.stdout).not.toContain("supabase functions deploy");
  });
  it("refuses execution without the exact reviewed commit", () => {
    const result = run("--execute");
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("PREPIO_DEPLOY_COMMIT");
    expect(result.stdout).not.toContain("supabase functions deploy");
  });

  it("refuses execution from a dirty checkout even at the reviewed commit", () => {
    try {
      writeFileSync(dirtySentinel, "dirty\n");
      const result = runWithReviewedCommit("--execute", "company-research");
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("dirty checkout");
      expect(result.stdout).not.toContain("supabase functions deploy");
    } finally {
      rmSync(dirtySentinel, { force: true });
    }
  });
});
