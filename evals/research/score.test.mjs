// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { readFile, mkdtemp, rm, writeFile, symlink, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const paths = ['cases/openai-london.v1.json', 'examples/openai-london-illustrative.v1.json', 'labels/openai-london-illustrative.v1.json'];
const originals = await Promise.all(paths.map(async p => JSON.parse(await readFile(join(root, p), 'utf8'))));
const canonical = x => JSON.stringify(x && typeof x === 'object' ? Array.isArray(x) ? x.map(v => JSON.parse(canonical(v))) : Object.fromEntries(Object.keys(x).sort().map(k => [k, JSON.parse(canonical(x[k]))])) : typeof x === 'string' ? x.replace(/\r\n?/g, '\n') : x);
const hash = s => createHash('sha256').update(s).digest('hex');
function seal(x) { delete x.sha256; x.sha256 = hash(canonical(x)); }
function bind(d) {
  d.cases.forEach(seal);
  d.outputs.forEach(o => { const c = d.cases.find(c => c.caseId === o.caseId); if (c) o.caseSha256 = c.sha256; seal(o); });
  d.annotations.forEach(a => { const o = d.outputs.find(o => o.outputId === a.outputId); if (o) a.outputSha256 = o.sha256; seal(a); });
  return d;
}
function data() { const [c, o, a] = structuredClone(originals); return { cases: [c], outputs: [o], annotations: [a] }; }
function twoCases() {
  const d = data(); const second = data();
  second.cases[0].caseId = second.cases[0].lineage.upstreamCaseId = 'EVAL-AAA-secondary';
  second.outputs[0].caseId = second.annotations[0].caseId = second.cases[0].caseId;
  second.outputs[0].outputId = second.annotations[0].outputId = 'secondary-output';
  for (const key of ['cases', 'outputs', 'annotations']) d[key].push(second[key][0]);
  return d;
}
const rating = (value, raterId = 'reviewer-human', dimension = 'evidenceGrounding') => ({ dimension, value, raterId, authorType: 'human', independence: 'independent', reviewedAt: '2026-11-09', rubricVersion: '0.3.0', reason: 'Declared human assessment' });
const humanOwner = (id = 'reviewer-human', independence = 'independent') => ({ id, authorType: 'human', independence, reviewedAt: '2026-11-09' });
// Dynamic import keeps the pre-implementation run observable as missing behavior.
const evaluate = async d => (await import('./score.mjs')).evaluate(d);
const reject = async (mutate, message) => { const { evaluate: score } = await import('./score.mjs'); const d = data(); mutate(d); expect(() => score(bind(d))).toThrow(message); };
const temp = [];
afterEach(async () => { for (const p of temp.splice(0)) await rm(p, { recursive: true, force: true }); });

describe('offline snapshot integrity', () => {
  it('binds valid pasted-JD citations without requiring a ledger URL', async () => {
    const r = await evaluate(data());
    expect(r.checks.planReferenceIntegrity).toBe('pass');
    expect(r.findings).toEqual([expect.objectContaining({ type: 'unsupported_interview_history', path: 'stageRoadmap[0].whyLikely' })]);
    expect(r.counts.cases).toBe(1);
    expect(r.provenance.outputs[0].authoredBy).toBe(originals[1].authoredBy);
    expect(r.provenance.annotations[0].owner.authorType).toBe('model');
    expect(r.humanReview.status).toBe('N/A');
  });
  it('rejects unresolved citation IDs', () => reject(d => { d.outputs[0].plan.stageRoadmap[0].evidenceIds = ['ev-99']; }, /unresolved citation/));
  it('rejects fabricated prose citations', () => reject(d => { d.outputs[0].plan.questionPlan.coreMustPractice[0].reason += ' https://glassdoor.example/fake'; }, /unregistered URL/));
  it('rejects fabricated citations with an uppercase URL scheme', () => reject(d => { d.outputs[0].plan.questionPlan.coreMustPractice[0].reason += ' [source](HTTPS://glassdoor.example/fake)'; }, /unregistered URL/));
  it('resolves a registered citation with case-insensitive scheme and host', async () => {
    const d = data(); d.outputs[0].plan.questionPlan.coreMustPractice[0].reason += ' HTTPS://OPENAI.COM/careers/applied-ai-architect-large-enterprise-london-uk/';
    expect((await evaluate(bind(d))).checks.planReferenceIntegrity).toBe('pass');
  });
  it('rejects rewritten official-job URLs', () => reject(d => { d.cases[0].sourceRecords[0].url = 'https://openai.com/careers/other/'; }, /London source identity/));
  it('rejects changed job-description binding', () => reject(d => { d.cases[0].input.jobDescription += ' Extra claim'; }, /job description/));
  it('rejects mismatched inline excerpts', () => reject(d => { d.outputs[0].plan.internalEvidenceLog[0].excerpt = 'Different posting'; }, /ledger.*binding/));
  it.each([
    ['sourceLabel', 'Glassdoor London interview report'],
    ['title', 'OpenAI confirms four interview rounds'],
    ['platform', 'Glassdoor'],
    ['relevance', 'low'],
    ['trustWeight', 'low'],
  ])('rejects changed native pasted-JD metadata: %s', (key, value) => reject(d => { d.outputs[0].plan.internalEvidenceLog[0][key] = value; }, /ledger metadata binding/));
  it('binds long pasted text with the native 699-code-unit ellipsis rule', async () => {
    const d = data(); const c = d.cases[0]; const passage = { id: 'test-long', text: 'An architecture practice topic. '.repeat(35) }; passage.sha256 = hash(passage.text);
    c.sourceRecords[0].passages.push(passage); c.input.jobDescription = c.sourceRecords[0].passages.map(p => p.text).join('\n'); c.jobDescriptionSha256 = hash(c.input.jobDescription);
    const compact = c.input.jobDescription.replace(/\s+/g, ' ').trim(); const e = d.outputs[0].plan.internalEvidenceLog[0]; e.excerpt = e.snippet = compact.slice(0, 699).trim() + '…';
    expect((await evaluate(bind(d))).checks.planReferenceIntegrity).toBe('pass');
  });
  it('rejects duplicate ledger IDs', () => reject(d => { d.outputs[0].plan.internalEvidenceLog.push(structuredClone(d.outputs[0].plan.internalEvidenceLog[0])); }, /duplicate.*ledger/));
  it('rejects extra official job sources', () => reject(d => { d.cases[0].sourceRecords.push({ ...d.cases[0].sourceRecords[0], id: 'S99' }); }, /exactly one/));
  it('rejects stale hashes', async () => { const d = data(); d.outputs[0].plan.stageRoadmap[0].whyLikely += '!'; await expect(evaluate(d)).rejects.toThrow(/hash mismatch/); });
  it('rejects missing case IDs', () => reject(d => { delete d.cases[0].caseId; }, /caseId/));
  it.each(['cases', 'outputs', 'annotations'])('rejects duplicate records in %s', key => reject(d => { d[key].push(structuredClone(d[key][0])); }, /duplicate/));
  it.each(['outputs', 'annotations'])('rejects missing records in %s', key => reject(d => { d[key] = []; }, /missing/));
  it('rejects unknown output cases', () => reject(d => { d.outputs[0].caseId = 'unknown'; }, /unknown case/));
  it('rejects unknown annotation outputs', () => reject(d => { d.annotations[0].outputId = 'unknown'; }, /unknown output/));
  it('rejects empty corpora rather than implying perfect metrics', async () => { await expect(evaluate({ cases: [], outputs: [], annotations: [] })).rejects.toThrow(/empty/); });
  it('reports missing interview ground truth and empty human denominators as N/A', async () => {
    const r = await evaluate(data());
    for (const m of Object.values(r.metrics)) expect(m).toEqual(expect.objectContaining({ status: 'N/A', value: null }));
    for (const m of Object.values(r.humanReview.scores)) expect(m).toEqual(expect.objectContaining({ status: 'N/A', value: null, count: 0 }));
  });
  it('requires an explicit declaration of unavailable ground truth', () => reject(d => { delete d.cases[0].interviewGroundTruth; }, /missing interviewGroundTruth/));
  it('reports contradictory factual claims as findings without quality failure', async () => {
    const d = data(); d.annotations[0].judgments[4].supportDecision = 'contradicted';
    const r = await evaluate(bind(d));
    expect(r.status).toBe('evaluated');
    expect(r.findings).toContainEqual(expect.objectContaining({ type: 'contradicted_claim' }));
  });
  it('does not accept role evidence as supported interview history', () => reject(d => {
    Object.assign(d.annotations[0].judgments[1], { supportDecision: 'supported', evidenceSourceIds: ['S02'], passageIds: ['S02-C06'] });
  }, /interview ground truth/));
  it('does not use missing interview ground truth as evidence of nonexistence', () => reject(d => {
    Object.assign(d.annotations[0].judgments[1], { supportDecision: 'contradicted', evidenceSourceIds: ['S02'], passageIds: ['S02-C06'] });
  }, /interview ground truth/));
  it('rejects unsupported factual claims mislabeled not applicable', () => reject(d => { d.annotations[0].judgments[1].supportDecision = 'not_applicable'; }, /not_applicable/));
  it('rejects missing annotations on claim-bearing paths', () => reject(d => { d.annotations[0].judgments.pop(); }, /unannotated/));
  it('rejects nonexistent judgment paths', () => reject(d => { d.annotations[0].judgments[0].path = '__proto__.polluted'; }, /unknown judgment path/));
  it('rejects duplicate judgment paths', () => reject(d => { d.annotations[0].judgments.push(structuredClone(d.annotations[0].judgments[0])); }, /duplicate.*path/));
  it('rejects unknown evidence passages', () => reject(d => { d.annotations[0].judgments[4].passageIds = ['fake']; }, /passage/));
  it('rejects missing annotation ownership', () => reject(d => { delete d.annotations[0].owner; }, /owner/));
  it('rejects fabricated independence', () => reject(d => { d.annotations[0].owner.independence = 'independent'; }, /independen/));
  it.each([-1, 5, 1.5, '4', null])('rejects out-of-contract human score %s', value => reject(d => {
    d.annotations[0].humanScores = [{ dimension: 'roleRelevance', value, raterId: 'independent-human-1', authorType: 'human', independence: 'independent', reviewedAt: '2026-11-09', rubricVersion: '0.3.0', reason: 'Human rationale' }];
  }, /score/));
  it('accepts declared independent human scores descriptively, with no gate', async () => {
    const d = data(); d.annotations[0].humanScores = [{ dimension: 'roleRelevance', value: 3, raterId: 'independent-human-1', authorType: 'human', independence: 'independent', reviewedAt: '2026-11-09', rubricVersion: '0.3.0', reason: 'Explicit human assessment' }];
    const r = await evaluate(bind(d)); expect(r.humanReview.scores.roleRelevance.value).toBe(3); expect(r.humanReview.scores.roleRelevance.count).toBe(1); expect(r).not.toHaveProperty('passed');
  });
  it('rejects model-authored human scores', () => reject(d => { d.annotations[0].humanScores = [{ dimension: 'roleRelevance', value: 4, raterId: 'model', authorType: 'model' }]; }, /human score/));
  it('withholds disputed human aggregates pending adjudication and preserves raw ratings', async () => {
    const d = data(); d.annotations[0].humanScores = [0, 4].map((value, i) => ({ dimension: 'roleRelevance', value, raterId: `human-${i}`, authorType: 'human', independence: 'independent', reviewedAt: '2026-11-09', rubricVersion: '0.3.0', reason: 'Declared human assessment' }));
    const r = await evaluate(bind(d)); expect(r.humanReview.scores.roleRelevance).toEqual(expect.objectContaining({ value: null, count: 2, status: 'requires_adjudication' }));
    expect(r.humanReview.records.map(s => s.value).sort()).toEqual([0, 4]);
  });
  it('allows a descriptive mean when human ratings differ by at most one point', async () => {
    const d = data(); d.annotations[0].humanScores = [3, 4].map((value, i) => ({ dimension: 'roleRelevance', value, raterId: `human-${i}`, authorType: 'human', independence: 'independent', reviewedAt: '2026-11-09', rubricVersion: '0.3.0', reason: 'Declared human assessment' }));
    expect((await evaluate(bind(d))).humanReview.scores.roleRelevance).toEqual({ value: 3.5, count: 2, status: 'descriptive_only' });
  });
  it.each(['claimType', 'match', 'relevant', 'specific'])('rejects self-grading field %s', key => reject(d => { d.outputs[0].plan.questionPlan.coreMustPractice[0][key] = true; }, /self-grading|unknown field/));
  it('rejects missing real-run provenance without upgrading illustrative outputs', () => reject(d => { d.outputs[0].claimLevel = 'captured_prepio'; }, /real-run provenance/));
  it('rejects illustrative outputs claiming execution', () => reject(d => { d.outputs[0].runMetadata.prepioExecuted = true; }, /illustrative provenance/));
  it('rejects non-string source commit values', () => reject(d => { d.outputs[0].runMetadata.sourceCommit = [d.outputs[0].runMetadata.sourceCommit]; }, /sourceCommit/));
  it('rejects malformed native plan enums', () => reject(d => { d.outputs[0].plan.stageRoadmap[0].confidence = 'very high'; }, /confidence/));
  it('rejects prose injected into unannotated summary metadata', () => reject(d => { d.outputs[0].plan.summary.industryFocus = 'OpenAI always asks these questions'; }, /industryFocus/));
  it('rejects reviews predating the constructed output', () => reject(d => { d.annotations[0].owner.reviewedAt = '2026-11-01'; }, /predates/));
  it('rejects outputs predating source capture', () => reject(d => { d.outputs[0].runMetadata.createdAt = '2026-11-01'; }, /predates/));
  it('rejects missing run metadata', () => reject(d => { delete d.outputs[0].runMetadata; }, /runMetadata/));
  it('rejects malformed records without a raw TypeError', async () => {
    const { evaluate: score } = await import('./score.mjs');
    for (const v of [null, {}, [], { cases: [null], outputs: [], annotations: [] }]) expect(() => score(v)).toThrow(/dataset|caseId/);
  });
  it('normalizes LF for hashes while preserving content', async () => {
    const d = JSON.parse(JSON.stringify(data()).replaceAll('\\n', '\\r\\n'));
    expect(await evaluate(d)).toEqual(await evaluate(data()));
  });
});

describe('human review consistency', () => {
  it('rejects the audit regression: a known model redeclared as a human rater', () => reject(d => {
    d.annotations[0].owner.id = 'known-model';
    d.annotations[0].humanScores = [rating(4, 'known-model')];
  }, /identity.*known-model.*model.*human/i));

  it('rejects cross-case type conflicts identically regardless of input order', async () => {
    const { evaluate: score } = await import('./score.mjs'); const d = twoCases();
    d.annotations[1].owner.id = 'cross-case-model';
    d.annotations[0].humanScores = [rating(4, 'cross-case-model')]; bind(d);
    const message = x => { try { score(x); } catch (e) { return e.message; } throw new Error('Expected an identity validation error'); };
    const error = message(d);
    expect(error).toMatch(/identity.*cross-case-model/i);
    expect(error).toContain(d.outputs[0].outputId); expect(error).toContain(d.outputs[1].outputId);
    for (const key of ['cases', 'outputs', 'annotations']) d[key].reverse();
    expect(message(d)).toBe(error);
  });

  it('includes typed source-review identities in consistency checks', () => reject(d => {
    d.cases[0].sourceRecords[0].sourceReview.authoredBy = 'source-model';
    d.annotations[0].humanScores = [rating(4, 'source-model')];
  }, /identity.*source-model/i));

  it('reconciles contradictory types even when no human score is supplied', async () => {
    const { evaluate: score } = await import('./score.mjs'); const d = twoCases();
    d.cases[0].sourceRecords[0].sourceReview.authoredBy = 'contradictory-reviewer';
    d.annotations[1].owner = humanOwner('contradictory-reviewer');
    expect(() => score(bind(d))).toThrow(/identity.*contradictory-reviewer/i);
  });

  it('rejects a same-author human rating even with a different output-author label', () => reject(d => {
    d.annotations[0].owner = humanOwner('human-author-alias', 'same_author');
    d.annotations[0].humanScores = [rating(3, 'human-author-alias', 'roleRelevance')];
  }, /human-author-alias.*same_author.*openai-london-illustrative-v1/i));

  it('identifies a self-rating by its rater and output', () => reject(d => {
    d.annotations[0].owner = humanOwner(d.outputs[0].authoredBy, 'same_author');
    d.annotations[0].humanScores = [rating(3, d.outputs[0].authoredBy, 'roleRelevance')];
  }, /independence.*Codex.*openai-london-illustrative-v1/i));

  it('allows a human author to independently review a different output', async () => {
    const d = twoCases(); d.outputs[0].authoredBy = 'human-author';
    d.annotations[0].owner = humanOwner('human-author', 'same_author');
    d.annotations[1].owner = humanOwner('human-author');
    d.annotations[1].humanScores = [rating(3, 'human-author', 'roleRelevance')];
    const result = await evaluate(bind(d));
    expect(result.humanReview.scores.roleRelevance).toEqual({ status: 'descriptive_only', value: 3, count: 1 });
    for (const key of ['cases', 'outputs', 'annotations']) d[key].reverse();
    expect(await evaluate(d)).toEqual(result);
  });

  it.each([1, 2, 3, 4])('withholds EG=%s contradicted by the same independent human review', async value => {
    const d = data(); d.annotations[0].owner = humanOwner();
    d.outputs[0].plan.stageRoadmap[0].whyLikely = 'According to the Glassdoor London 2026 interview report, OpenAI always uses four architecture interview rounds for this London role.';
    d.annotations[0].humanScores = [rating(value), rating(3, 'reviewer-human', 'roleRelevance')];
    const r = await evaluate(bind(d));
    expect(r.findings[0].type).toBe('unsupported_interview_history');
    expect(r.humanReview.scores.evidenceGrounding).toEqual(expect.objectContaining({ status: 'requires_adjudication', value: null, count: 1, disputedOutputs: [d.outputs[0].outputId] }));
    expect(r.humanReview.records).toContainEqual(expect.objectContaining(rating(value)));
    expect(r.humanReview.scores.roleRelevance.value).toBe(3);
    expect(r.humanReview.adjudicationIssues).toEqual([expect.objectContaining({ type: 'grounding_finding_conflict', dimension: 'evidenceGrounding', outputId: d.outputs[0].outputId, raterIds: ['reviewer-human'], findingPaths: ['stageRoadmap[0].whyLikely'], reason: expect.any(String) })]);
    const { markdown } = await import('./score.mjs');
    expect(markdown(r)).toContain(r.humanReview.adjudicationIssues[0].reason);
    expect(markdown(r)).toContain('N/A (requires adjudication)');
  });

  it('withholds the whole dimension across cases when another human reviewer disagrees', async () => {
    const d = twoCases(); d.annotations[0].owner = humanOwner('finding-reviewer');
    d.annotations[0].humanScores = [rating(4, 'other-rater')];
    d.annotations[1].humanScores = [rating(3, 'control-rater')];
    const r = await evaluate(bind(d));
    expect(r.humanReview.scores.evidenceGrounding).toEqual(expect.objectContaining({ status: 'requires_adjudication', value: null, count: 2, disputedOutputs: [d.outputs[0].outputId] }));
    expect(r.humanReview.adjudicationIssues[0].raterIds).toEqual(['other-rater']);
  });

  it('allows EG=0 with an independent human unsupported-history finding', async () => {
    const d = data(); d.annotations[0].owner = humanOwner(); d.annotations[0].humanScores = [rating(0)];
    const r = await evaluate(bind(d));
    expect(r.humanReview.scores.evidenceGrounding).toEqual({ status: 'descriptive_only', value: 0, count: 1 });
    expect(r.humanReview.adjudicationIssues).toEqual([]);
  });

  it.each(['model', 'human'])('does not upgrade a non-independent %s annotation into a human grounding conflict', async authorType => {
    const d = data(); d.annotations[0].owner = { ...humanOwner('non-independent', 'unknown'), authorType };
    d.annotations[0].humanScores = [rating(4)];
    const r = await evaluate(bind(d));
    expect(r.humanReview.scores.evidenceGrounding.value).toBe(4);
    expect(r.humanReview.adjudicationIssues).toEqual([]);
    expect(r.findings).toHaveLength(1);
  });

  it('keeps a consistent positive grounding control descriptive', async () => {
    const d = data(); d.annotations[0].owner = humanOwner();
    d.outputs[0].plan.stageRoadmap[0].whyLikely = 'Suggested architecture practice; the actual interview process is unknown.';
    Object.assign(d.annotations[0].judgments[1], { claimType: 'suggested_practice', presentation: 'hypothetical', supportDecision: 'not_applicable' });
    d.annotations[0].humanScores = [rating(4)];
    const r = await evaluate(bind(d));
    expect(r.humanReview.scores.evidenceGrounding.value).toBe(4); expect(r.humanReview.adjudicationIssues).toEqual([]);
  });

  it('explains numeric disputes without treating model findings as human confirmations', async () => {
    const d = data(); d.annotations[0].humanScores = [rating(0, 'human-a'), rating(4, 'human-b')];
    const r = await evaluate(bind(d));
    expect(r.humanReview.adjudicationIssues).toEqual([expect.objectContaining({ type: 'rating_disagreement', dimension: 'evidenceGrounding', outputId: d.outputs[0].outputId, raterIds: ['human-a', 'human-b'], findingPaths: [] })]);
  });
});

describe('evaluator provenance', () => {
  it('reports schema v2 with fingerprints of actual scorer and rubric bytes', async () => {
    const r = await evaluate(data());
    expect(r.schemaVersion).toBe(2);
    expect(r.provenance.evaluator).toEqual({ scorerSha256: hash(await readFile(join(root, 'score.mjs'))), rubricVersion: '0.3.0', rubricSha256: hash(await readFile(join(root, 'rubric.v0.3.0.md'))) });
    expect(r.counts).toEqual(expect.objectContaining({ annotatedClaimPaths: 7, findings: 1 }));
    expect(r.humanReview.adjudicationIssues).toEqual([]);
  });
  it('rejects the audit lineage probe even after resealing the snapshots', () => reject(d => {
    d.cases[0].lineage.rubricSha256 = 'a'.repeat(64);
  }, /rubric.*hash mismatch/i));
});

describe('CLI', () => {
  const run = args => spawnSync(process.execPath, [join(root, 'score.mjs'), ...args], { encoding: 'utf8' });
  const args = out => paths.flatMap((p, i) => [['--case', '--output', '--labels'][i], join(root, p)]).concat('--out', out);
  it('requires explicit arguments and rejects unknown or repeated options', () => {
    for (const a of [[], ['--production'], ['--case', 'a', '--case', 'b']]) expect(run(a).status).toBe(2);
  });
  it('emits byte-identical JSON and Markdown with findings and exits zero', async () => {
    const p = await mkdtemp(join(tmpdir(), 'prepio-eval-test-')); temp.push(p);
    for (const name of ['a', 'b']) { const result = run(args(join(p, name))); expect(result.stderr).toBe(''); expect(result.status).toBe(0); }
    for (const name of ['results.json', 'summary.md']) expect(await readFile(join(p, 'a', name), 'utf8')).toBe(await readFile(join(p, 'b', name), 'utf8'));
    const report = await readFile(join(p, 'a', 'summary.md'), 'utf8'); expect(report).toContain('DEMONSTRATION_ONLY'); expect(report).toContain('N/A'); expect(report).not.toContain('%');
  });
  it('archives exact input bytes and replays from a relocated self-contained bundle', async () => {
    const p = await mkdtemp(join(tmpdir(), 'prepio-eval-test-')); temp.push(p);
    const caseBytes = Buffer.from(JSON.stringify([originals[0]], null, 4).replace(/\n/g, '\r\n') + '\r\n');
    await writeFile(join(p, 'case.json'), caseBytes);
    const a = args(join(p, 'original')); a[1] = join(p, 'case.json');
    const first = run(a); expect(first.stderr).toBe(''); expect(first.status).toBe(0);
    await rename(join(p, 'original'), join(p, 'relocated'));
    const bundle = join(p, 'relocated');
    expect(await readFile(join(bundle, 'inputs/cases.json'))).toEqual(caseBytes);
    for (const [archived, original] of [['inputs/outputs.json', paths[1]], ['inputs/annotations.json', paths[2]], ['score.mjs', 'score.mjs'], ['rubric.v0.3.0.md', 'rubric.v0.3.0.md']]) {
      expect(await readFile(join(bundle, archived))).toEqual(await readFile(join(root, original)));
    }
    const replay = spawnSync(process.execPath, ['score.mjs', '--case', 'inputs/cases.json', '--output', 'inputs/outputs.json', '--labels', 'inputs/annotations.json', '--out', '../replayed'], { cwd: bundle, encoding: 'utf8' });
    expect(replay.stderr).toBe(''); expect(replay.status).toBe(0);
    for (const name of ['results.json', 'summary.md']) expect(await readFile(join(bundle, name))).toEqual(await readFile(join(p, 'replayed', name)));
  });
  it('runs when the scorer is invoked through a symlink', async () => {
    const p = await mkdtemp(join(tmpdir(), 'prepio-eval-test-')); temp.push(p);
    await symlink(join(root, 'score.mjs'), join(p, 'alias.mjs'));
    const result = spawnSync(process.execPath, [join(p, 'alias.mjs'), ...args(join(p, 'report'))], { encoding: 'utf8' });
    expect(result.stderr).toBe(''); expect(result.status).toBe(0);
    expect(JSON.parse(await readFile(join(p, 'report/results.json'), 'utf8')).counts.findings).toBe(1);
  });
  it.each(['changed', 'missing'])('rejects a %s bundled rubric with a structured error', async state => {
    const p = await mkdtemp(join(tmpdir(), 'prepio-eval-test-')); temp.push(p);
    await writeFile(join(p, 'score.mjs'), await readFile(join(root, 'score.mjs')));
    if (state === 'changed') await writeFile(join(p, 'rubric.v0.3.0.md'), Buffer.concat([await readFile(join(root, 'rubric.v0.3.0.md')), Buffer.from('\nModified rubric.\n')]));
    const result = spawnSync(process.execPath, [join(p, 'score.mjs'), ...args(join(p, 'report'))], { encoding: 'utf8' });
    expect(result.status).toBe(2);
    expect(JSON.parse(result.stderr)).toEqual(expect.objectContaining({ status: 'error', message: expect.stringMatching(state === 'changed' ? /rubric.*hash mismatch/i : /bundled.*rubric/i) }));
    await expect(readFile(join(p, 'report/results.json'))).rejects.toMatchObject({ code: 'ENOENT' });
  });
  it('fingerprints a changed scorer from its actual bytes', async () => {
    const p = await mkdtemp(join(tmpdir(), 'prepio-eval-test-')); temp.push(p);
    const bytes = Buffer.concat([await readFile(join(root, 'score.mjs')), Buffer.from('\n// Distinct implementation artifact.\n')]);
    await writeFile(join(p, 'score.mjs'), bytes);
    await writeFile(join(p, 'rubric.v0.3.0.md'), await readFile(join(root, 'rubric.v0.3.0.md')));
    const result = spawnSync(process.execPath, [join(p, 'score.mjs'), ...args(join(p, 'report'))], { encoding: 'utf8' });
    expect(result.stderr).toBe(''); expect(result.status).toBe(0);
    expect(JSON.parse(await readFile(join(p, 'report/results.json'), 'utf8')).provenance.evaluator.scorerSha256).toBe(hash(bytes));
  });
  it('rejects existing output destinations, including symlinks to inputs', async () => {
    const p = await mkdtemp(join(tmpdir(), 'prepio-eval-test-')); temp.push(p);
    await symlink(root, join(p, 'alias')); expect(run(args(join(p, 'alias'))).status).toBe(2);
    expect(run(args(join(root, 'cases'))).status).toBe(2);
    expect(await readFile(join(root, paths[0]), 'utf8')).toContain('EVAL-AAA-02');
  });
  it('reports malformed JSON clearly with machine-readable stderr', async () => {
    const p = await mkdtemp(join(tmpdir(), 'prepio-eval-test-')); temp.push(p); await writeFile(join(p, 'bad.json'), '{');
    const a = args(join(p, 'report')); a[1] = join(p, 'bad.json'); const r = run(a);
    expect(r.status).toBe(2); expect(JSON.parse(r.stderr)).toEqual(expect.objectContaining({ status: 'error', message: expect.stringMatching(/JSON/) }));
  });
});
