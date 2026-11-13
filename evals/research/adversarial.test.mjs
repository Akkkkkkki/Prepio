// @vitest-environment node
// Validity regressions from the 2026-11-13 adversarial review of PR #396.
// Tests named "control:" pin behaviour that must not regress; tests named
// "documented limit:" pin scenarios the harness explicitly does not support.
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluate as score, markdown } from './score.mjs';

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
const DIMS = ['roleRelevance', 'evidenceGrounding', 'prioritization', 'handlingUncertainty', 'practicalUsefulness'];
const OUTPUT = originals[1].outputId; const CASE = originals[0].caseId;
const rating = (value, raterId = 'rater-a', dimension = 'evidenceGrounding', reviewedAt = '2026-11-09') => ({ dimension, value, raterId, authorType: 'human', independence: 'independent', reviewedAt, rubricVersion: '0.3.0', reason: 'Declared human assessment' });
const pair = (value, dimension = 'evidenceGrounding') => ['rater-a', 'rater-b'].map(r => rating(value, r, dimension));
const humanOwner = (id = 'annotator-human', independence = 'independent') => ({ id, authorType: 'human', independence, reviewedAt: '2026-11-09' });
// Removes the planted interview-history claim; the stage still cites the posting.
function neutralise(d, i = 0) {
  d.outputs[i].plan.stageRoadmap[0].whyLikely = 'Suggested architecture practice; the actual interview process is unknown.';
  Object.assign(d.annotations[i].judgments[1], { claimType: 'suggested_practice', presentation: 'hypothetical', supportDecision: 'not_applicable' });
  return d;
}
// A rubric-consistent JD-only plan: no planted claim, no stage citation, declared independent human annotation.
function wellFormed(d = data(), i = 0) {
  neutralise(d, i); d.outputs[i].plan.stageRoadmap[0].evidenceIds = []; d.annotations[i].owner = humanOwner();
  return d;
}
const run = (d, options) => { try { return { threw: false, report: score(bind(d), options) }; } catch (error) { return { threw: true, message: error.message }; } };
const report = (d, options) => { const outcome = run(d, options); if (outcome.threw) throw new Error(`unexpected rejection: ${outcome.message}`); return outcome.report; };
const rejects = (d, pattern, options) => { const outcome = run(d, options); expect(outcome.threw ? outcome.message : 'evaluated').toMatch(pattern); };
const issuesOf = (r, type) => r.humanReview.adjudicationIssues.filter(issue => issue.type === type);
const GLASSDOOR = 'According to the Glassdoor London 2026 interview report, OpenAI always uses four architecture interview rounds for this London role.';
const temp = [];
afterEach(async () => { for (const p of temp.splice(0)) await rm(p, { recursive: true, force: true }); });

describe('grounding conflicts and unsupported claims', () => {
  it('labels unsupported interview history and contradictions critical, other unsupported claims minor', () => {
    const d = data(); d.annotations[0].owner = humanOwner();
    d.annotations[0].judgments[4].supportDecision = 'contradicted';
    d.annotations[0].judgments[3] = { ...d.annotations[0].judgments[3], claimType: 'role_requirement', presentation: 'factual', supportDecision: 'insufficient_evidence', evidenceSourceIds: [], passageIds: [] };
    const r = report(d);
    expect(Object.fromEntries(r.findings.map(f => [f.type, f.severity]))).toEqual({ unsupported_interview_history: 'critical', contradicted_claim: 'critical', unsupported_claim: 'minor' });
    expect(r.counts).toEqual(expect.objectContaining({ findings: 3, criticalFindings: 2, minorFindings: 1 }));
  });

  it('HS1 withholds grounding 4 beside an unverified model finding of unsupported interview history, without calling it human-confirmed', () => {
    const d = data(); d.outputs[0].plan.stageRoadmap[0].evidenceIds = []; d.annotations[0].humanScores = pair(4);
    const r = report(d);
    expect(r.findings).toEqual([expect.objectContaining({ type: 'unsupported_interview_history', severity: 'critical', annotationBasis: 'unverified_model_annotation' })]);
    expect(r.humanReview.scores.evidenceGrounding).toEqual(expect.objectContaining({ status: 'requires_adjudication', value: null, count: 2 }));
    expect(r.humanReview.adjudicationIssues).toEqual([expect.objectContaining({ type: 'grounding_finding_conflict', severity: 'critical', findingBasis: ['unverified_model_annotation'], raterIds: ['rater-a', 'rater-b'], findingPaths: ['stageRoadmap[0].whyLikely'] })]);
    expect(r.humanReview.adjudicationIssues[0].reason).toMatch(/not a human confirmation/);
    expect(r.humanReview.records.map(s => s.value)).toEqual([4, 4]);
  });

  it.each([3, 4])('HS2 withholds grounding %s against a declared independent human contradicted-claim finding', value => {
    const d = wellFormed(); d.annotations[0].judgments[4].supportDecision = 'contradicted'; d.annotations[0].humanScores = pair(value);
    const r = report(d);
    expect(r.findings).toEqual([expect.objectContaining({ type: 'contradicted_claim', severity: 'critical', annotationBasis: 'declared_independent_human_annotation' })]);
    expect(r.humanReview.scores.evidenceGrounding).toEqual(expect.objectContaining({ status: 'requires_adjudication', value: null, count: 2, disputedOutputs: [OUTPUT] }));
    expect(issuesOf(r, 'grounding_finding_conflict')).toEqual([expect.objectContaining({ severity: 'critical', findingBasis: ['declared_independent_human_annotation'], findingPaths: ['prepPriorities[0].whyItMatters'] })]);
    expect(r.humanReview.records).toHaveLength(2);
  });

  it('HS3 withholds grounding 4 against a declared independent human unsupported-claim finding as a minor conflict', () => {
    const d = wellFormed(); Object.assign(d.annotations[0].judgments[4], { supportDecision: 'insufficient_evidence', evidenceSourceIds: [], passageIds: [] });
    d.annotations[0].humanScores = pair(4);
    const r = report(d);
    expect(r.findings).toEqual([expect.objectContaining({ type: 'unsupported_claim', severity: 'minor' })]);
    expect(r.humanReview.scores.evidenceGrounding.status).toBe('requires_adjudication');
    expect(issuesOf(r, 'grounding_finding_conflict')).toEqual([expect.objectContaining({ severity: 'minor' })]);
  });

  it.each(['contradicted', 'insufficient_evidence'])('control: grounding 2 stays descriptive beside a %s role claim (rubric ceiling 2)', decision => {
    const d = wellFormed(); Object.assign(d.annotations[0].judgments[4], decision === 'contradicted' ? { supportDecision: decision } : { supportDecision: decision, evidenceSourceIds: [], passageIds: [] });
    d.annotations[0].humanScores = pair(2);
    const r = report(d);
    expect(r.humanReview.scores.evidenceGrounding).toEqual({ status: 'descriptive_only', value: 2, count: 2 });
    expect(r.humanReview.adjudicationIssues).toEqual([]);
  });

  it('FC4 rejects interview history relabelled as a supported role requirement on a stage-claim path', () => {
    const d = data(); Object.assign(d.annotations[0].judgments[1], { claimType: 'role_requirement', presentation: 'factual', supportDecision: 'supported', evidenceSourceIds: ['S02'], passageIds: ['S02-C06'] });
    rejects(d, /interview ground truth/);
  });

  it('FC4 applies the same rule to what a stage is said to test', () => {
    const d = data(); const j = d.annotations[0].judgments;
    d.outputs[0].plan.stageRoadmap[0].whatItTests = ['OpenAI tests account ownership in a dedicated panel round.'];
    j.push({ path: 'stageRoadmap[0].whatItTests[0]', claimType: 'role_requirement', presentation: 'factual', supportDecision: 'supported', evidenceSourceIds: ['S02'], passageIds: ['S02-C06'], reason: 'Probe' });
    rejects(d, /interview ground truth/);
    const unsupported = data(); unsupported.outputs[0].plan.stageRoadmap[0].whatItTests = ['OpenAI tests account ownership in a dedicated panel round.'];
    unsupported.annotations[0].judgments.push({ path: 'stageRoadmap[0].whatItTests[0]', claimType: 'role_requirement', presentation: 'factual', supportDecision: 'insufficient_evidence', evidenceSourceIds: [], passageIds: [], reason: 'Probe' });
    expect(report(unsupported).findings.map(f => `${f.type}@${f.path}`)).toContain('unsupported_interview_history@stageRoadmap[0].whatItTests[0]');
  });

  it('FC4 keeps a factual stage-claim finding critical whatever claimType the annotation supplies', () => {
    const d = data(); d.annotations[0].judgments[1].claimType = 'role_requirement';
    expect(report(d).findings).toEqual([expect.objectContaining({ path: 'stageRoadmap[0].whyLikely', type: 'unsupported_interview_history', severity: 'critical' })]);
  });

  it('EP6 rejects a rater who is also the annotation owner but declares a different independence for the same output', () => {
    const d = data(); d.annotations[0].owner = humanOwner('reviewer-human', 'unknown'); d.annotations[0].humanScores = [rating(4, 'reviewer-human')];
    rejects(d, /independence conflict.*reviewer-human/);
  });

  it('CS4 counts only factual claims as annotation-supported', () => {
    const d = data(); d.annotations[0].judgments[5].supportDecision = 'supported'; // suggested_practice / hypothetical
    expect(report(d).counts.annotationSupportedClaims).toBe(1);
  });

  it('separates verbatim-checked support from annotation-only support', () => {
    const r = report(data());
    expect(r.judgments.find(j => j.path === 'prepPriorities[0].whyItMatters')).toEqual(expect.objectContaining({ supportBasis: 'verbatim_passage_match', annotationBasis: 'unverified_model_annotation' }));
    expect(r.counts.verbatimCheckedSupportedClaims).toBe(1);
    const d = data(); d.outputs[0].plan.prepPriorities[0].whyItMatters = 'The role owns technical strategy for a set of named enterprise accounts.';
    const paraphrased = report(d);
    expect(paraphrased.judgments.find(j => j.path === 'prepPriorities[0].whyItMatters').supportBasis).toBe('annotation_only');
    expect(paraphrased.counts).toEqual(expect.objectContaining({ annotationSupportedClaims: 1, verbatimCheckedSupportedClaims: 0 }));
    const fragment = data(); fragment.outputs[0].plan.prepPriorities[0].whyItMatters = 'named portfolio'; // too short to count as checked support
    expect(report(fragment).counts.verbatimCheckedSupportedClaims).toBe(0);
  });

  it('FC2 qualifies a zero-finding report that rests on same-author model annotations', () => {
    const d = data(); d.outputs[0].plan.stageRoadmap[0].whyLikely = GLASSDOOR;
    Object.assign(d.annotations[0].judgments[1], { claimType: 'suggested_practice', presentation: 'hypothetical', supportDecision: 'not_applicable' });
    const r = report(d);
    expect(r.findings).toEqual([]);
    expect(r.semanticReview).toEqual(expect.objectContaining({ basis: 'unverified_model_annotation' }));
    expect(r.checks.semanticClaimSupport).toBe('not_evaluated');
    expect(markdown(r)).not.toMatch(/All deterministic integrity checks passed/);
    expect(markdown(r)).toMatch(/Semantic claim support was not verified/);
  });

  it('FC3 counts ambiguous judgments as unresolved rather than as covered', () => {
    const d = data(); for (const j of d.annotations[0].judgments) Object.assign(j, { claimType: 'other', presentation: 'ambiguous', supportDecision: 'not_applicable', evidenceSourceIds: [], passageIds: [] });
    const r = report(d);
    expect(r.findings).toEqual([]);
    expect(r.counts.unresolvedClaimPaths).toBe(7);
  });
});

describe('rating coverage', () => {
  const incomplete = (s, count, missing) => expect(s).toEqual(expect.objectContaining({ status: 'N/A', value: null, count, missing, reason: expect.stringMatching(/two declared independent human raters/) }));

  it('RC1 returns N/A with counts and the missing output for a single-rater dimension', () => {
    const d = wellFormed(); d.annotations[0].humanScores = [rating(4, 'rater-a', 'roleRelevance')];
    const r = report(d);
    incomplete(r.humanReview.scores.roleRelevance, 1, [{ caseId: CASE, outputId: OUTPUT, eligibleRaters: 1 }]);
    expect(r.humanReview.scores.roleRelevance).toEqual(expect.objectContaining({ eligibleOutputs: 1, coveredOutputs: 0 }));
    expect(r.humanReview.records).toHaveLength(1);
  });

  it('RC2 reports unrated dimensions and an incomplete overall status', () => {
    const d = wellFormed(); d.annotations[0].humanScores = pair(4, 'roleRelevance');
    const r = report(d);
    expect(r.humanReview.status).toBe('incomplete_coverage');
    expect(r.humanReview.coverage.unratedDimensions).toEqual(DIMS.filter(x => x !== 'roleRelevance').sort());
    expect(r.humanReview.scores.roleRelevance).toEqual({ status: 'descriptive_only', value: 4, count: 2 });
  });

  it('RC3 returns N/A naming the unrated case and output instead of a dataset mean', () => {
    const d = twoCases(); wellFormed(d, 0); wellFormed(d, 1); d.annotations[0].humanScores = pair(4);
    const r = report(d);
    incomplete(r.humanReview.scores.evidenceGrounding, 2, [{ caseId: 'EVAL-AAA-secondary', outputId: 'secondary-output', eligibleRaters: 0 }]);
    expect(r.humanReview.scores.evidenceGrounding).toEqual(expect.objectContaining({ eligibleOutputs: 2, coveredOutputs: 1 }));
    expect(r.humanReview.coverage.unratedOutputs).toEqual([{ caseId: 'EVAL-AAA-secondary', outputId: 'secondary-output' }]);
  });

  it('RC4 does not turn a withheld 0-vs-4 dispute into a clean 4 when the dissenting rating is omitted', () => {
    const disputed = wellFormed(); disputed.annotations[0].humanScores = [rating(4, 'rater-a', 'roleRelevance'), rating(0, 'rater-b', 'roleRelevance')];
    expect(report(disputed).humanReview.scores.roleRelevance.status).toBe('requires_adjudication');
    const trimmed = wellFormed(); trimmed.annotations[0].humanScores = [rating(4, 'rater-a', 'roleRelevance')];
    expect(report(trimmed).humanReview.scores.roleRelevance).toEqual(expect.objectContaining({ status: 'N/A', value: null }));
  });

  it('RC5 returns N/A for dimensions a second rater did not complete', () => {
    const d = wellFormed(); d.annotations[0].humanScores = [...DIMS.map(dim => rating(4, 'rater-a', dim)), rating(4, 'rater-b', 'roleRelevance')];
    const r = report(d);
    for (const dim of DIMS.filter(x => x !== 'roleRelevance')) incomplete(r.humanReview.scores[dim], 1, [{ caseId: CASE, outputId: OUTPUT, eligibleRaters: 1 }]);
    expect(r.humanReview.scores.roleRelevance.value).toBe(4);
  });

  it('RC6 weights outputs equally and reports per-output values', () => {
    const d = twoCases(); wellFormed(d, 0); wellFormed(d, 1);
    d.annotations[0].humanScores = ['rater-a', 'rater-b', 'rater-c', 'rater-d'].map(r => rating(4, r));
    d.annotations[1].humanScores = pair(0);
    const r = report(d);
    expect(r.humanReview.scores.evidenceGrounding).toEqual({ status: 'descriptive_only', value: 2, count: 6 });
    expect(r.humanReview.perOutput).toEqual([
      expect.objectContaining({ outputId: OUTPUT, dimension: 'evidenceGrounding', eligibleRaters: 4, value: 4 }),
      expect.objectContaining({ outputId: 'secondary-output', dimension: 'evidenceGrounding', eligibleRaters: 2, value: 0 }),
    ]);
  });

  it('RC7 rejects a whitespace or case alias used to manufacture a second rater', () => {
    for (const alias of ['rater-a ', 'Rater-A']) { const d = wellFormed(); d.annotations[0].humanScores = [rating(4, 'rater-a'), rating(4, alias)]; rejects(d, /duplicate human score/); }
  });

  it.each([['trailing space', id => `${id} `], ['case change', id => id.toUpperCase()]])('EP3 rejects a trivially aliased output author declared as an independent human annotator: %s', (_name, alias) => {
    const d = data(); d.annotations[0].owner = humanOwner(alias(d.outputs[0].authoredBy));
    rejects(d, /invalid independence assertion/);
  });

  it('EP4 does not aggregate ratings carried in a model-owned snapshot and says why', () => {
    const d = data(); d.annotations[0].humanScores = pair(4, 'roleRelevance');
    const r = report(d);
    expect(r.humanReview.scores.roleRelevance).toEqual(expect.objectContaining({ status: 'N/A', value: null, count: 2, reason: expect.stringMatching(/model-owned/) }));
    expect(r.humanReview.records.map(s => s.custody)).toEqual(['model_owned_snapshot', 'model_owned_snapshot']);
    expect(r.humanReview.status).toBe('incomplete_coverage');
  });

  it('describes rater identity as self-declared provenance and the scope as an illustrative excerpt', () => {
    const d = wellFormed(); d.annotations[0].humanScores = pair(4, 'roleRelevance');
    const r = report(d);
    expect(r.humanReview).toEqual(expect.objectContaining({ identityVerification: 'self_declared_unauthenticated', requiredIndependentRatersPerOutput: 2, scope: 'illustrative_excerpt_only' }));
    expect(r.humanReview.records[0].custody).toBe('human_owned_snapshot');
    expect(markdown(r)).toMatch(/self-declared/);
  });

  it('control: complete two-rater, five-dimension agreement on a consistent output is aggregated', () => {
    const d = wellFormed(); d.annotations[0].humanScores = ['rater-a', 'rater-b'].flatMap((r, i) => DIMS.map(dim => rating(3 + i, r, dim)));
    const r = report(d);
    for (const dim of DIMS) expect(r.humanReview.scores[dim]).toEqual({ status: 'descriptive_only', value: 3.5, count: 2 });
    expect(r.humanReview.status).toBe('declared_human_ratings');
    expect(r.humanReview.adjudicationIssues).toEqual([]);
    expect(r.humanReview.coverage).toEqual(expect.objectContaining({ unratedDimensions: [], unratedOutputs: [] }));
  });

  it('control: grounding 0 beside a declared independent human unsupported-history finding stays descriptive', () => {
    const d = data(); d.annotations[0].owner = humanOwner(); d.annotations[0].humanScores = pair(0);
    expect(report(d).humanReview.scores.evidenceGrounding).toEqual({ status: 'descriptive_only', value: 0, count: 2 });
  });
});

describe('evidence, citations and stage predictions', () => {
  it('distinguishes reference existence, source integrity and semantic support in the checks', () => {
    const r = report(data());
    expect(r.checks).toEqual(expect.objectContaining({ planReferenceIntegrity: 'pass', sourceHashInternalConsistency: 'pass', sourceAuthenticity: 'not_evaluated', semanticClaimSupport: 'not_evaluated' }));
    expect(r.checks).not.toHaveProperty('sourceCaptureHashes');
    expect(r.checkScope.sourceHashInternalConsistency).toMatch(/internal consistency/i);
    expect(r.counts.resolvedCitations).toBe(2);
    expect(markdown(r)).toMatch(/does not establish that the source supports/);
  });

  it('EP2 does not treat an unverifiable original-capture hash as source authentication', () => {
    const d = data(); d.cases[0].sourceRecords[0].originalSnapshotSha256 = 'a'.repeat(64);
    expect(report(d).checks).toEqual(expect.objectContaining({ sourceHashInternalConsistency: 'pass', sourceAuthenticity: 'not_evaluated' }));
  });

  it('classifies every stage as a role-informed prediction, never as verified interview history', () => {
    const r = report(data());
    expect(r.stagePredictions).toEqual([{ caseId: CASE, outputId: OUTPUT, path: 'stageRoadmap[0]', basis: 'role_informed_prediction', verifiedInterviewHistory: false, confidence: 'low', citedEvidenceIds: ['ev-1'] }]);
    expect(r.counts).toEqual(expect.objectContaining({ roleInformedPredictedStages: 1, externallyVerifiedInterviewStages: 0 }));
  });

  it('CS3 reports the canonical stage citing the posting as its own deterministic finding, separate from annotation findings', () => {
    const r = report(data());
    expect(r.deterministicFindings).toEqual([expect.objectContaining({ path: 'stageRoadmap[0].evidenceIds', type: 'posting_cited_as_stage_evidence', rubricChecks: ['D4', 'D5'], caps: { evidenceGrounding: 1, handlingUncertainty: 1 } })]);
    expect(r.findings).toEqual([expect.objectContaining({ type: 'unsupported_interview_history' })]);
    expect(r.counts).toEqual(expect.objectContaining({ findings: 1, deterministicFindings: 1 }));
  });

  it.each(['medium', 'high'])('CS1 reports a %s-confidence stage on posting-only evidence (rubric D4/D5)', confidence => {
    const d = neutralise(data()); d.outputs[0].plan.stageRoadmap[0].confidence = confidence;
    expect(report(d).deterministicFindings.map(f => `${f.type}@${f.path}`)).toEqual(['stage_confidence_exceeds_evidence@stageRoadmap[0].confidence', 'posting_cited_as_stage_evidence@stageRoadmap[0].evidenceIds']);
  });

  it('CS2 reports high overall confidence and an undeclared weak-signal case on posting-only evidence (rubric D5)', () => {
    const d = wellFormed(); Object.assign(d.outputs[0].plan.summary, { overallConfidence: 'high', weakSignalCase: false });
    expect(report(d).deterministicFindings).toEqual([
      expect.objectContaining({ path: 'summary.overallConfidence', type: 'overall_confidence_exceeds_evidence', caps: { handlingUncertainty: 1 } }),
      expect.objectContaining({ path: 'summary.weakSignalCase', type: 'weak_signal_not_declared', caps: { handlingUncertainty: 1 } }),
    ]);
  });

  it('HS4 withholds handling-uncertainty 4 when confidence fields break the rubric cap', () => {
    const d = wellFormed(); Object.assign(d.outputs[0].plan.summary, { overallConfidence: 'high', weakSignalCase: false });
    d.annotations[0].humanScores = pair(4, 'handlingUncertainty');
    const r = report(d);
    expect(r.humanReview.scores.handlingUncertainty).toEqual(expect.objectContaining({ status: 'requires_adjudication', value: null, count: 2 }));
    expect(r.humanReview.adjudicationIssues).toEqual([expect.objectContaining({ type: 'rating_exceeds_rubric_cap', dimension: 'handlingUncertainty', cap: 1, raterIds: ['rater-a', 'rater-b'], findingPaths: ['summary.overallConfidence', 'summary.weakSignalCase'] })]);
    expect(r.humanReview.records.map(s => s.value)).toEqual([4, 4]);
  });

  it('HS5 withholds grounding 4 when a medium stage cites only the posting, and keeps grounding 1', () => {
    const d = wellFormed(); Object.assign(d.outputs[0].plan.stageRoadmap[0], { confidence: 'medium', evidenceIds: ['ev-1'] }); d.annotations[0].humanScores = pair(4);
    const r = report(d);
    expect(r.humanReview.scores.evidenceGrounding.status).toBe('requires_adjudication');
    expect(issuesOf(r, 'rating_exceeds_rubric_cap')).toEqual([expect.objectContaining({ dimension: 'evidenceGrounding', cap: 1 })]);
    const capped = wellFormed(); Object.assign(capped.outputs[0].plan.stageRoadmap[0], { confidence: 'medium', evidenceIds: ['ev-1'] }); capped.annotations[0].humanScores = pair(1);
    expect(report(capped).humanReview.scores.evidenceGrounding).toEqual({ status: 'descriptive_only', value: 1, count: 2 });
  });
});

describe('screening signals', () => {
  const REASON = 'questionPlan.coreMustPractice[0].reason';
  it.each([
    ['www host', 'www.glassdoor.com/Interview/OpenAI-Interview-Questions-E2210885.htm'],
    ['bare review-site domain', 'glassdoor.com/Interview/OpenAI-Interview-Questions-E2210885.htm'],
    ['protocol-relative', '//glassdoor.example/fake'],
    ['unsupported scheme', 'ftp://glassdoor.example/fake'],
    ['defanged scheme', 'hxxps://glassdoor.example/fake'],
  ])('FC1 warns about an unregistered source reference without an http(s) scheme: %s', (_name, reference) => {
    const d = data(); d.outputs[0].plan.questionPlan.coreMustPractice[0].reason += ` See ${reference}`;
    const r = report(d);
    expect(r.screeningWarnings).toContainEqual({ caseId: CASE, outputId: OUTPUT, path: REASON, signal: 'unregistered_source_reference', match: reference, review: 'unreviewed' });
    expect(r.counts.unreviewedScreeningWarnings).toBe(1);
  });

  it('control: an unregistered http(s) URL is still rejected and the registered posting in bare form is not flagged', () => {
    const fake = data(); fake.outputs[0].plan.questionPlan.coreMustPractice[0].reason += ' https://glassdoor.example/fake'; rejects(fake, /unregistered URL/);
    const bare = data(); bare.outputs[0].plan.questionPlan.coreMustPractice[0].reason += ' See openai.com/careers/applied-ai-architect-large-enterprise-london-uk/ and openai.com.';
    expect(report(bare).screeningWarnings.filter(w => w.path === REASON)).toEqual([]);
  });

  it('FC2 flags interview-history and candidate-report wording that the annotation labelled hypothetical', () => {
    const d = data(); d.outputs[0].plan.stageRoadmap[0].whyLikely = GLASSDOOR;
    Object.assign(d.annotations[0].judgments[1], { claimType: 'suggested_practice', presentation: 'hypothetical', supportDecision: 'not_applicable' });
    const r = report(d);
    expect(r.screeningWarnings.map(w => `${w.signal}:${w.review}`)).toEqual(['candidate_report_wording:unreviewed', 'interview_history_wording:unreviewed']);
    expect(r.screeningWarnings.every(w => w.path === 'stageRoadmap[0].whyLikely')).toBe(true);
  });

  it('withholds grounding 3+ while a screening signal is unreviewed, and reports it as screening rather than proof', () => {
    const d = data(); d.outputs[0].plan.stageRoadmap[0].whyLikely = GLASSDOOR; d.outputs[0].plan.stageRoadmap[0].evidenceIds = [];
    Object.assign(d.annotations[0].judgments[1], { claimType: 'suggested_practice', presentation: 'hypothetical', supportDecision: 'not_applicable' });
    d.annotations[0].owner = humanOwner('annotator-human', 'unknown'); d.annotations[0].humanScores = pair(4);
    const r = report(d);
    expect(r.findings).toEqual([]);
    expect(r.humanReview.scores.evidenceGrounding.status).toBe('requires_adjudication');
    expect(r.humanReview.adjudicationIssues).toEqual([expect.objectContaining({ type: 'unreviewed_screening_signal', dimension: 'evidenceGrounding', findingPaths: ['stageRoadmap[0].whyLikely'], reason: expect.stringMatching(/screening signal.*not semantic proof/i) })]);
  });

  it('control: a declared independent human judgment resolves a screening signal without creating a finding', () => {
    const d = wellFormed(); d.outputs[0].plan.stageRoadmap[0].whyLikely = 'A friend said there are four interview rounds; no supplied source confirms that, so treat it as unverified.';
    d.annotations[0].humanScores = pair(4);
    const r = report(d);
    expect(r.screeningWarnings.length).toBeGreaterThan(0);
    expect(r.screeningWarnings.every(w => w.review === 'reviewed_by_declared_independent_human')).toBe(true);
    expect(r.findings).toEqual([]);
    expect(r.humanReview.scores.evidenceGrounding).toEqual({ status: 'descriptive_only', value: 4, count: 2 });
  });

  it('FC5 flags a quotation that is not verbatim in the frozen posting, and not the canonical verbatim quotation', () => {
    const d = data(); d.outputs[0].plan.prepPriorities[0].whyItMatters = 'The posting states: "candidates must pass four architecture interview rounds in London before any offer is made".';
    expect(report(d).screeningWarnings).toContainEqual(expect.objectContaining({ path: 'prepPriorities[0].whyItMatters', signal: 'unverified_quotation' }));
    expect(report(data()).screeningWarnings.filter(w => w.signal === 'unverified_quotation')).toEqual([]);
  });

  it('control: the canonical example raises one screening signal, already covered by its annotated finding', () => {
    const r = report(data());
    expect(r.screeningWarnings).toEqual([expect.objectContaining({ path: 'stageRoadmap[0].whyLikely', signal: 'interview_history_wording', review: 'covered_by_finding' })]);
    expect(r.counts).toEqual(expect.objectContaining({ screeningWarnings: 1, unreviewedScreeningWarnings: 0 }));
  });
});

describe('temporal integrity', () => {
  const AS_OF = '2026-11-13T00:00:00Z';
  it('TP1 (Codex P2 thread) rejects a same-day chain where capture 23:00 > output 12:00 > review 01:00', () => {
    const d = data(); d.cases[0].sourceRecords[0].capturedAt = '2026-11-09T23:00:00Z';
    d.outputs[0].runMetadata.createdAt = '2026-11-09T12:00:00Z'; d.annotations[0].owner.reviewedAt = '2026-11-09T01:00:00Z';
    rejects(d, /predates/);
  });
  it('TP2 rejects an output created hours before its source capture on the same day', () => {
    const d = data(); d.outputs[0].runMetadata.createdAt = '2026-11-08T03:00:00Z'; rejects(d, /output predates source capture/);
  });
  it('TP3 rejects an annotation review hours before the output on the same day', () => {
    const d = data(); d.outputs[0].runMetadata.createdAt = '2026-11-09T18:00:00Z'; d.annotations[0].owner.reviewedAt = '2026-11-09T06:00:00Z'; rejects(d, /annotation review predates output/);
  });
  it('TP4 rejects a human rating hours before the output on the same day', () => {
    const d = wellFormed(); d.outputs[0].runMetadata.createdAt = '2026-11-09T18:00:00Z'; d.annotations[0].owner.reviewedAt = '2026-11-09T19:00:00Z';
    d.annotations[0].humanScores = [rating(3, 'rater-a', 'roleRelevance', '2026-11-09T06:00:00Z')];
    rejects(d, /human score review predates output/);
  });
  it('TP5 reports date-only precision instead of passing an undecidable same-day order', () => {
    const d = data(); d.outputs[0].runMetadata.createdAt = '2026-11-08'; // capture is 2026-11-08T12:05:00Z
    const r = report(d);
    expect(r.checks.chronology).toBe('date_precision_only');
    expect(r.chronologyNotes).toContainEqual(expect.objectContaining({ comparison: 'output createdAt >= source capturedAt', outputId: OUTPUT }));
    expect(report(data()).checks.chronology).toBe('date_precision_only'); // canonical review and output share a date-only day
  });
  it('control: fully timestamped, correctly ordered records pass chronology at full precision', () => {
    const d = data(); d.outputs[0].runMetadata.createdAt = '2026-11-08T13:00:00Z'; d.annotations[0].owner.reviewedAt = '2026-11-08T14:00:00Z';
    const r = report(d);
    expect(r.checks.chronology).toBe('pass'); expect(r.chronologyNotes).toEqual([]);
  });
  it('checks future dates only against an explicit, fixed as-of timestamp', () => {
    expect(report(data()).checks.futureDates).toBe('not_evaluated');
    expect(report(data()).provenance.evaluation).toEqual({ asOf: null });
    const r = report(data(), { asOf: AS_OF });
    expect(r.checks.futureDates).toBe('pass'); expect(r.provenance.evaluation).toEqual({ asOf: AS_OF });
    expect(report(data(), { asOf: AS_OF })).toEqual(r);
  });
  it('TP6 rejects records dated after the as-of timestamp', () => {
    const rated = wellFormed(); rated.annotations[0].humanScores = [rating(3, 'rater-a', 'roleRelevance', '2099-01-01')];
    rejects(rated, /human score reviewedAt.*later than the evaluation as-of/, { asOf: AS_OF });
    rejects(data(), /later than the evaluation as-of/, { asOf: '2026-11-08T12:00:00Z' }); // before the 12:05 capture
    const sameDay = data(); sameDay.annotations[0].owner.reviewedAt = '2026-11-13T09:00:00Z';
    rejects(sameDay, /owner.reviewedAt.*later than the evaluation as-of/, { asOf: AS_OF });
    const dateOnly = report(data(), { asOf: '2026-11-09T10:00:00Z' }); // canonical output and review are dated 2026-11-09 without a time
    expect(dateOnly.chronologyNotes).toContainEqual(expect.objectContaining({ comparison: 'runMetadata.createdAt <= evaluation as-of', precision: 'date_only' }));
  });
  it.each(['2026-11-13', 'yesterday', '2026-11-13T25:00:00Z', 20261113])('rejects malformed as-of value %s', asOf => rejects(data(), /as-of/, { asOf }));
  it.each(['2026-02-30', '2026-13-01', '2026-11-09T24:00:00Z', '2026-11-09T23:59:60Z', '2026-11-09T12:00:00+01:00', '2026-11-09 12:00:00'])('control: malformed or non-UTC date %s is rejected', value => {
    const d = data(); d.outputs[0].runMetadata.createdAt = value; rejects(d, /invalid date/);
  });
});

describe('explicitly unsupported scenarios', () => {
  it('documented limit: a fabricated passage resealed into the case is not detected; authenticity is reported as not evaluated', () => {
    const d = data(); const c = d.cases[0]; const text = 'The interview process for this role consists of four architecture rounds in London.';
    c.sourceRecords[0].passages.push({ id: 'S02-C99', text, sha256: hash(text) });
    c.input.jobDescription = c.sourceRecords[0].passages.map(p => p.text).join('\n'); c.jobDescriptionSha256 = hash(c.input.jobDescription);
    const e = d.outputs[0].plan.internalEvidenceLog[0]; e.excerpt = e.snippet = c.input.jobDescription.replace(/\s+/g, ' ').trim();
    const r = report(d);
    expect(r.checks.sourceAuthenticity).toBe('not_evaluated');
    expect(r.limitations.join(' ')).toMatch(/not source authenticity/);
  });
  it('documented limit: duplicate case content under a second case ID is counted, because corpus selection is not enforced', () => {
    const r = report(twoCases());
    expect(r.counts.cases).toBe(2);
    expect(r.limitations.join(' ')).toMatch(/corpus selection/i);
  });
  it('documented limit: millisecond-precision timestamps are rejected rather than truncated', () => {
    const d = data(); d.outputs[0].runMetadata.createdAt = '2026-11-09T12:00:00.000Z'; rejects(d, /invalid date/);
  });
  it('documented limit: a screening lexicon miss raises nothing, so an unflagged report is not evidence of support', () => {
    const d = data(); d.outputs[0].plan.stageRoadmap[0].whyLikely = 'Expect a quartet of architecture conversations, per people who went through it.';
    Object.assign(d.annotations[0].judgments[1], { claimType: 'suggested_practice', presentation: 'hypothetical', supportDecision: 'not_applicable' });
    const r = report(d);
    expect(r.screeningWarnings).toEqual([]);
    expect(r.checks.semanticClaimSupport).toBe('not_evaluated');
  });
});

describe('CLI as-of and compound regression', () => {
  const cli = args => spawnSync(process.execPath, [join(root, 'score.mjs'), ...args], { encoding: 'utf8' });
  const base = out => paths.flatMap((p, i) => [['--case', '--output', '--labels'][i], join(root, p)]).concat('--out', out);
  it('accepts --as-of, records it, replays byte-identically and rejects malformed or too-early values', async () => {
    const p = await mkdtemp(join(tmpdir(), 'prepio-eval-test-')); temp.push(p);
    for (const name of ['a', 'b']) { const result = cli([...base(join(p, name)), '--as-of', '2026-11-13T00:00:00Z']); expect(result.stderr).toBe(''); expect(result.status).toBe(0); }
    for (const name of ['results.json', 'summary.md']) expect(await readFile(join(p, 'a', name), 'utf8')).toBe(await readFile(join(p, 'b', name), 'utf8'));
    expect(JSON.parse(await readFile(join(p, 'a/results.json'), 'utf8')).provenance.evaluation.asOf).toBe('2026-11-13T00:00:00Z');
    expect(await readFile(join(p, 'a/summary.md'), 'utf8')).toMatch(/Evaluation as-of: 2026-11-13T00:00:00Z/);
    for (const asOf of ['tomorrow', '2026-11-01T00:00:00Z']) { const result = cli([...base(join(p, `bad-${asOf.length}`)), '--as-of', asOf]); expect(result.status).toBe(2); expect(JSON.parse(result.stderr).message).toMatch(/as-of/); }
  });
  it('no longer renders a clean report for fabricated interview history at high confidence with all-4 ratings', async () => {
    const p = await mkdtemp(join(tmpdir(), 'prepio-eval-test-')); temp.push(p);
    const d = data(); const stage = d.outputs[0].plan.stageRoadmap[0];
    stage.whyLikely = GLASSDOOR; stage.confidence = 'high'; Object.assign(d.outputs[0].plan.summary, { overallConfidence: 'high', weakSignalCase: false });
    Object.assign(d.annotations[0].judgments[1], { claimType: 'suggested_practice', presentation: 'hypothetical', supportDecision: 'not_applicable' });
    d.annotations[0].humanScores = ['rater-a', 'rater-b'].flatMap(r => DIMS.map(dim => rating(4, r, dim))); bind(d);
    await writeFile(join(p, 'o.json'), JSON.stringify(d.outputs[0])); await writeFile(join(p, 'a.json'), JSON.stringify(d.annotations[0]));
    const result = cli(['--case', join(root, paths[0]), '--output', join(p, 'o.json'), '--labels', join(p, 'a.json'), '--out', join(p, 'report')]);
    expect(result.stderr).toBe(''); expect(result.status).toBe(0);
    const r = JSON.parse(await readFile(join(p, 'report/results.json'), 'utf8'));
    expect(r.findings).toEqual([]); // the same-author model annotation still hides the claim
    expect(r.deterministicFindings.map(f => f.type).sort()).toEqual(['overall_confidence_exceeds_evidence', 'posting_cited_as_stage_evidence', 'stage_confidence_exceeds_evidence', 'weak_signal_not_declared']);
    expect(r.counts.unreviewedScreeningWarnings).toBe(2);
    for (const dim of DIMS) expect(r.humanReview.scores[dim].value).toBeNull();
    expect(r.humanReview.records).toHaveLength(10);
    expect(result.stdout).not.toMatch(/All deterministic integrity checks passed/);
    expect(result.stdout).toMatch(/unverified_model_annotation/);
  });
});
