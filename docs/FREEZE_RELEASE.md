# Frozen core release — PREPIO-27 / 124 / 170 / 173 / 30

Status: **candidate; not a verified production freeze**. Owner: Qiuyue.
Do not tag this release until every production gate below has evidence.

## Product boundary

- Guests: deterministic, fictional local sample; no research or paid-provider request.
- Existing/invited accounts: sign in, research a company/role with optional pasted CV text,
  read the plan, practice in text, save answers, Favorite / Needs-work, and History.
- Hidden and unrouted: billing, paid feedback, profile/settings, CV import, file upload,
  and voice. Existing records are preserved. No profile activation or redesign work.
- PDF/DOCX upload stays out of this candidate even though the PDF dependency upgrade has
  merged: pasted text avoids an extra parser/import acceptance surface.
- `supabase/freeze-functions.json` is the only function manifest. Shared auth rejects
  anonymous Auth users as well as missing/invalid sessions. Authenticated service-only
  helpers still reject ordinary user calls.

## Live baseline checked 2026-09-21 (read only)

Project: `vjwrirrqprjzdorignlz`. Source base: `908b8f4795616e496983bf54d404bb70924d8445`.

| Function | Deployed version before reconciliation | JWT gateway verification |
| --- | ---: | --- |
| interview-research | 11 | false; handler auth is required |
| company-research | 8 | false; handler service auth is required |
| job-analysis | 8 | false; handler service auth is required |
| cv-analysis | 9 | false; handler auth is required |
| interview-question-generator | 9 | true, plus handler service auth |

These versions predate the merged ownership/privacy fixes. No excluded function was
listed as deployed. Ten migrations were recorded, ending at
`20260515171733_security_hardening_and_resume_rpc`.
`user_question_flags` still has `UNIQUE(user_id, question_id)`, not the required
three-column key. The duplicate-group precheck for `(user_id, question_id, flag_type)`
returned zero. Repeat it during deployment; this observation is not a migration.
Production Auth settings, credential rotation, budgets, and private support requests
were not verified by this source change.

## 1. Owner security/privacy gate — PREPIO-168 + PREPIO-145

- Rotate the historical test account's exposed password through the Auth admin flow;
  revoke its sessions and review access/misuse. Do not try the exposed password.
  Password changes alone do not prove old sessions/tokens are unusable. Record the
  revocation/time window and verify access is denied after token expiry or revocation.
- Keep credentials in the owner-controlled secret store. Legacy tests require explicit
  `TEST_USER_EMAIL` / `TEST_USER_PASSWORD`; never restore fallbacks or use a real CV.
- Agree a write-free window and a private backup outside the public repository.
  Inventory affected refs, forks, PR attachments/comments and cached blob URLs. Purge
  the historical PII blobs and credential text in an isolated mirror, inspect the
  rewritten refs, and coordinate the force-push. Do not force-push from this worktree.
- PR #342 replaced ten current-tree images; their paths are listed in
  `docs/security/freeze-pii-paths.txt` as a **starting inventory**, not a complete finding.
  Include deleted/renamed images and the two removed from PR #298. Review audit captures
  of profile/new-interview pages from every dated folder. A current-tree placeholder
  does not remove the original blob from history.
- Request GitHub assistance for cached views/PR refs after rewriting, and coordinate
  fork/clone cleanup. Keep any response or exposure evidence private; record only the
  completion status here. All future acceptance accounts/data must be synthetic.

## 2. Auth and deployment gate — PREPIO-27 + PREPIO-124 + PREPIO-170

1. Turn off **Allow new users to sign up** and **Allow anonymous sign-ins** in production
   Supabase Auth. `supabase/config.toml` documents local intent; committing it does not
   apply production Auth settings. Existing accounts continue signing in. Verify a
   direct non-invited signup request fails, not just that the button is absent.
2. Invite accounts through the owner/admin flow. Allow the exact production callback
   `/auth?flow=invite`; recovery uses `/auth?flow=recovery`. The query selects password
   setup only; Supabase still requires the authenticated invitation/recovery session.
   Verify invitation acceptance and recovery before locking the release.
3. Record a recoverable database backup and current Vercel deployment. Record function
   versions and source artifacts for recovery. Do not use an old vulnerable function as
   a rollback just because it was previously deployed.
4. Inspect `supabase migration list` and compare the SQL/object definitions for these
   already-applied versions before **any** `migration repair`:

   | Local file version | Production version | Name |
   | --- | --- | --- |
   | 20260514000000 | 20260515131539 | billing_v1 |
   | 20260515150000 | 20260515171733 | security_hardening_and_resume_rpc |

   Only after equivalence is confirmed, mark the two old production IDs reverted and
   the two matching local IDs applied. These are ledger repairs, not SQL rollbacks.
   Preview the pending migration list before pushing. Review all eight pending files,
   including dormant billing/preview/profile objects, for grants and data effects;
   schema reconciliation does not authorize turning their features on.
5. Repeat the duplicate flag query, then apply the reviewed pending migrations, including
   `20260710203000_question_flags_per_type.sql`. Do not silently deduplicate user data.
6. Inspect `ALLOWED_ORIGINS`, production secrets, model configuration and provider limits.
   Keep profile story linking disabled. Deploy the reviewed commit using:

   ```bash
   npm run functions:deploy
   # Above is a dry run. It prints exactly five named deploys, helpers first.
   # Set PREPIO_DEPLOY_COMMIT to the full reviewed HEAD SHA in the operator shell.
   npm run functions:deploy -- --execute
   ```

   The wrapper refuses dirty checkouts, missing/mismatched commit acknowledgement, and
   functions outside the manifest. It stops at the first failed deploy. The single-
   function alias uses the same guard. Never run an unscoped CLI deploy or `--prune`.
   It does not repair migrations, change Auth settings or attest acceptance for you.
7. Record every returned function version and the deployment source SHA. Verify the
   forbidden functions remain absent. Verify ownership/log redaction in production;
   CI success and source hashes alone are insufficient.

## 3. Schema/types refresh — PREPIO-173

After reconciliation, generate both files from the same authoritative project with
writes paused. Discover installed CLI flags with `--help` first. Use a schema-only
`supabase db dump --linked --schema public,ops --file supabase/schema.sql` and
`supabase gen types typescript --linked --schema public,ops` for
`src/integrations/supabase/types.ts`. Write to temporary files first so failure cannot
truncate a tracked artifact. Never dump application/auth rows or secrets into Git.

`npm run db:pull` runs `supabase db pull`, which creates a migration; it does **not**
overwrite `schema.sql`. Older docs conflated the two. The snapshot last changed in
`d9cc5d1`; that fact does not prove which generation command was run. Compare all
objects with reviewed migrations, explain the missing billing tables, inspect grants,
RLS, indexes and generated types, and lower the typecheck baseline only by verified
resolved errors. Do not add a custom Bash SQL/schema guard.

## 4. One production acceptance pass — PREPIO-30

Use two synthetic invited accounts A and B, desktop and a 390px mobile viewport.
Keep private credentials and tokens out of reports, screenshots and PR comments.

| Check | Evidence required |
| --- | --- |
| Guest | Sample opens offline; zero function/provider requests; no signup/paid/voice/import controls |
| Routes | Old pricing/billing/profile/settings URLs show unavailable/404 without backend work |
| Auth | Non-invited direct signup denied; invited A sets password and signs in; protected return preserved |
| Core journey | A creates research, sees completion and plan, starts text practice, saves answer |
| Persistence | A toggles both flags on the same question; reload preserves both; History shows saved answer |
| Isolation | B and a missing/expired session cannot read A's plan/answers/flags through the Data API |
| Ownership | B using its own user ID against A's search gets the same 404 as a missing search; spoofing A's user ID gets 403; no provider/write work occurs; owned A request succeeds |
| Retry | Expired-session/failed-request state is honest; retry with a valid session works without lost text |
| Privacy | No raw CV, notes, provider response text or sensitive query terms in the new function logs |
| Parity | Vercel source SHA, all five function versions/source SHA, migrations and schema/type refresh agree |

Record rollback target, operator, timestamp, test results and any partial deployment.
Do not tag a candidate that merely passed mocks/local tests.

## 5. Spend, operations and freeze exit

- Record the actual Supabase plan/spend cap, OpenAI project budget/alerts and Tavily
  credit/usage limit, with owner notification destinations. Record numeric limits and
  dates privately; do not assume an alert is a hard cap.
- Emergency stop: disable research access or revoke the dedicated provider keys;
  confirm requests stop. Keep the static sample available where possible.
- Rollback: promote the last **security-reviewed** frontend deployment and matching
  function artifacts. Preserve forward-compatible schema; never reset production or
  blindly reverse migrations. If no safe rollback exists, stop research until fixed.
- Owner handles invitations, password recovery and account/data deletion manually.
  Verify ownership before deleting, remove related stored objects as well as rows,
  and follow the documented retention period. No new account/settings UI is needed.
- Repository schedules are removed and the implementation workflow also requires
  `PREPIO_IMPLEMENTATION_ENABLED=true` for manual use. Dependabot version PR limits
  are zero for npm and Actions; security alerts/security updates are not disabled.
  Verify their repository settings. Check external Claude/Cursor/Codex audit and
  builder schedules too; they are not controlled by the workflow file. The connected
  ChatGPT automation list contained no Prepio task on 2026-09-21.
- After all gates pass, create an annotated tag on the exact verified deployed commit
  (after any history rewrite). Record the tag, frontend deployment and backend versions
  together. Pause maintenance work; only security incidents and critical breakages reopen it.
