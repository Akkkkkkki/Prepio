// @vitest-environment node
// Regressions for findings F1–F8 of the 2026-11-15 audit of PR #396 head e8bcf14.
// Helpers mirror adversarial.test.mjs; every evaluation pins its corpus with a manifest unless a test passes one.
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
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
const manifestOf = d => d.outputs.map(o => ({ caseId: o.caseId, outputId: o.outputId, outputSha256: o.sha256 }));
const run = (d, options = {}) => { try { bind(d); return { threw: false, report: score(d, { manifest: manifestOf(d), ...options }) }; } catch (error) { return { threw: true, message: error.message }; } };
const report = (d, options) => { const outcome = run(d, options); if (outcome.threw) throw new Error(`unexpected rejection: ${outcome.message}`); return outcome.report; };
const rejects = (d, pattern, options) => { const outcome = run(d, options); expect(outcome.threw ? outcome.message : 'evaluated').toMatch(pattern); };
const issuesOf = (r, type) => r.humanReview.adjudicationIssues.filter(issue => issue.type === type);
const GLASSDOOR = 'According to the Glassdoor London 2026 interview report, OpenAI always uses four architecture interview rounds for this London role.';

const FAB = 'OpenAI always uses four architecture interview rounds for this London role.';
const WHY = 'prepPriorities[0].whyItMatters';
const allFours = () => DIMS.flatMap(dimension => pair(4, dimension));
const grounding = r => r.humanReview.scores.evidenceGrounding;
// F1 input: the fabricated claim off the stage paths, labelled as a posting-supported role requirement by a declared human.
function relabelled(decisions) {
  const d = wellFormed(); d.outputs[0].plan.prepPriorities[0].whyItMatters = FAB; d.annotations[0].humanScores = allFours();
  if (decisions) { d.annotations[0].schemaVersion = 2; d.annotations[0].screeningDecisions = decisions; }
  return d;
}
const decision = (value, signal = 'interview_history_wording', path = WHY) => ({ path, signal, decision: value, reason: `Declared reviewer decision: ${value}` });

describe('F1/F3 interview-history claims off the stage paths', () => {
  it('F1 withholds the grounding aggregate until a human decides the screening warning', () => {
    const r = report(relabelled());
    expect(r.screeningWarnings).toContainEqual(expect.objectContaining({ path: WHY, signal: 'interview_history_wording', review: 'unreviewed' }));
    expect(grounding(r)).toEqual(expect.objectContaining({ status: 'requires_adjudication', value: null }));
    expect(issuesOf(r, 'unreviewed_screening_signal')).toHaveLength(1);
  });

  it('F1 a confirmed decision creates a critical finding whatever the claim type and path say', () => {
    const r = report(relabelled([decision('confirmed')]));
    expect(r.findings).toContainEqual(expect.objectContaining({ path: WHY, type: 'confirmed_screening_failure', severity: 'critical' }));
    expect(issuesOf(r, 'grounding_finding_conflict')).toEqual([expect.objectContaining({ severity: 'critical', findingPaths: [WHY] })]);
    const zero = relabelled([decision('confirmed')]); zero.annotations[0].humanScores = pair(0);
    expect(grounding(report(zero))).toEqual(expect.objectContaining({ status: 'descriptive_only', value: 0 }));
  });

  it('F1 a false-positive decision is counted but rendered with its reason, never silently', () => {
    const r = report(relabelled([decision('false_positive')]));
    expect(r.screeningWarnings).toContainEqual(expect.objectContaining({ path: WHY, review: 'decided_false_positive', decisionReason: 'Declared reviewer decision: false_positive' }));
    expect(grounding(r)).toEqual(expect.objectContaining({ status: 'descriptive_only', value: 4 }));
    expect(markdown(r)).toMatch(/decided_false_positive \(Declared reviewer decision: false_positive\)/);
  });

  it('rejects a decision that matches no warning, a duplicate decision and decisions without a declared independent human owner', () => {
    rejects(relabelled([decision('false_positive', 'candidate_report_wording')]), /screening decision without a matching warning/);
    rejects(relabelled([decision('false_positive'), decision('confirmed')]), /duplicate screening decision/);
    const model = data(); model.annotations[0].schemaVersion = 2; model.annotations[0].screeningDecisions = [decision('false_positive', 'interview_history_wording', 'stageRoadmap[0].whyLikely')];
    rejects(model, /screening decisions need a declared independent human annotation/);
  });

  it('control: schema 2 with no decisions and the unchanged schema 1 fixtures are both accepted', () => {
    const d = data(); d.annotations[0].schemaVersion = 2; d.annotations[0].screeningDecisions = [];
    expect(report(d).counts.findings).toBe(1);
    expect(report(data()).counts.findings).toBe(1);
  });

  it('F3 a minor finding does not cover the warning, so grounding 2 is not reported beside undecided interview-history wording', () => {
    const d = relabelled(); d.annotations[0].humanScores = pair(2);
    Object.assign(d.annotations[0].judgments[4], { claimType: 'other', supportDecision: 'insufficient_evidence', evidenceSourceIds: [], passageIds: [] });
    const r = report(d);
    expect(r.findings).toEqual([expect.objectContaining({ path: WHY, type: 'unsupported_claim', severity: 'minor' })]);
    expect(r.screeningWarnings).toContainEqual(expect.objectContaining({ path: WHY, review: 'unreviewed' }));
    expect(grounding(r)).toEqual(expect.objectContaining({ status: 'requires_adjudication', value: null }));
  });
});

describe('F2 ratings and unresolved labels', () => {
  it('does not count ratings under a human annotation that is not declared independent', () => {
    const d = wellFormed(); d.annotations[0].owner = humanOwner('annotator-human', 'unknown'); d.annotations[0].humanScores = allFours();
    const r = report(d);
    expect(grounding(r)).toEqual(expect.objectContaining({ status: 'N/A', value: null }));
    expect(r.humanReview.status).toBe('incomplete_coverage');
  });

  it('withholds grounding 3–4 while any claim is labelled ambiguous', () => {
    const d = wellFormed(); d.annotations[0].humanScores = allFours();
    Object.assign(d.annotations[0].judgments[4], { presentation: 'ambiguous', supportDecision: 'insufficient_evidence', evidenceSourceIds: [], passageIds: [] });
    const r = report(d);
    expect(issuesOf(r, 'unresolved_claim_label')).toEqual([expect.objectContaining({ findingPaths: [WHY] })]);
    expect(grounding(r).status).toBe('requires_adjudication');
  });
});

describe('F4 honest labels on stage paths', () => {
  const TESTS = 'stageRoadmap[0].whatItTests[0]';
  const judgment = (path, over) => ({ path, claimType: 'role_requirement', presentation: 'factual', supportDecision: 'supported', evidenceSourceIds: ['S02'], passageIds: ['S02-C01'], reason: 'Declared human judgment', ...over });
  it('F4a accepts a verbatim posting sentence as a supported role requirement in what a stage tests', () => {
    const d = wellFormed(); d.outputs[0].plan.stageRoadmap[0].whatItTests = [originals[0].sourceRecords[0].passages[1].text];
    d.annotations[0].judgments.push(judgment(TESTS));
    const r = report(d);
    expect(r.findings).toEqual([]);
    expect(r.judgments.find(j => j.path === TESTS).supportBasis).toBe('verbatim_passage_match');
  });

  it('control: a non-verbatim stage claim still cannot be supported by the posting', () => {
    const d = wellFormed(); d.outputs[0].plan.stageRoadmap[0].whatItTests = ['OpenAI tests architecture design in a dedicated onsite round.'];
    d.annotations[0].judgments.push(judgment(TESTS));
    rejects(d, /job posting cannot establish or refute interview history/);
  });

  it('F4c accepts an honest disclosure on a stage path without an interview-history finding', () => {
    const d = wellFormed(); d.outputs[0].plan.stageRoadmap[0].whyLikely = 'No verified source describes the interview process for this role.';
    Object.assign(d.annotations[0].judgments[1], { claimType: 'uncertainty_disclosure', presentation: 'factual', supportDecision: 'not_applicable' });
    const r = report(d);
    expect(r.findings).toEqual([]);
    expect(r.counts.uncertaintyDisclosures).toBe(1);
  });

  it('an uncertainty disclosure cannot carry a support decision', () => {
    const d = wellFormed(); Object.assign(d.annotations[0].judgments[4], { claimType: 'uncertainty_disclosure' });
    rejects(d, /uncertainty_disclosure must use not_applicable/);
  });
});

describe('F5 unregistered URLs and corpus omissions', () => {
  const REASON = 'questionPlan.coreMustPractice[0].reason';
  it('scores an output citing an unregistered URL and flags it for a decision', () => {
    const d = wellFormed(); d.outputs[0].plan.questionPlan.coreMustPractice[0].reason += ' See https://www.glassdoor.com/Interview/openai-london.';
    d.annotations[0].humanScores = allFours();
    const r = report(d);
    expect(r.screeningWarnings).toContainEqual(expect.objectContaining({ path: REASON, signal: 'unregistered_source_reference', match: 'https://www.glassdoor.com/Interview/openai-london', review: 'unreviewed' }));
    expect(grounding(r).status).toBe('requires_adjudication');
  });

  // Rubric D3 carve-out: repeating an invented URL to warn the user away from it is not CF1; the flag is adjudicated.
  const WARN_AWAY = ' Do not rely on https://fabricated.example/fake: it is an invented URL, not a source.';
  const urlDecision = value => [{ path: REASON, signal: 'unregistered_source_reference', decision: value, reason: `Declared reviewer decision: ${value}` }];
  function warnAway(decisions) {
    const d = wellFormed(); d.outputs[0].plan.questionPlan.coreMustPractice[0].reason += WARN_AWAY; d.annotations[0].humanScores = pair(4);
    if (decisions) { d.annotations[0].schemaVersion = 2; d.annotations[0].screeningDecisions = decisions; }
    return d;
  }
  it('an undecided reserved-domain URL blocks grounding above 0 without an automatic finding', () => {
    const r = report(warnAway());
    expect(r.deterministicFindings).toEqual([]);
    expect(issuesOf(r, 'unreviewed_screening_signal')).toHaveLength(1);
    expect(grounding(r).status).toBe('requires_adjudication');
  });

  it('(Codex P2) an acceptable decision resolves a URL the plan only warns against', () => {
    const r = report(warnAway(urlDecision('acceptable')));
    expect(r.humanReview.adjudicationIssues).toEqual([]);
    expect(grounding(r)).toEqual(expect.objectContaining({ status: 'descriptive_only', value: 4 }));
  });

  it('a confirmed decision on a fabricated URL is a critical finding with ceiling 0', () => {
    const r = report(warnAway(urlDecision('confirmed')));
    expect(r.findings).toEqual([expect.objectContaining({ path: REASON, type: 'confirmed_screening_failure', severity: 'critical' })]);
    expect(issuesOf(r, 'grounding_finding_conflict')).toHaveLength(1);
  });

  it('(Codex P2) a contradicted-claim finding, whose ceiling is 2, does not cover undecided warnings on its path', () => {
    const d = wellFormed(); d.annotations[0].humanScores = pair(2);
    d.outputs[0].plan.prepPriorities[0].whyItMatters = 'The posting says "candidates must pass four architecture interview rounds in London first", see https://fabricated.example/report';
    Object.assign(d.annotations[0].judgments[4], { supportDecision: 'contradicted' });
    const r = report(d);
    expect(r.findings).toEqual([expect.objectContaining({ path: WHY, type: 'contradicted_claim' })]);
    expect(r.screeningWarnings.filter(w => w.path === WHY).map(w => w.review)).toEqual(expect.arrayContaining(['unreviewed']));
    expect(r.screeningWarnings.some(w => w.path === WHY && w.review === 'covered_by_finding')).toBe(false);
    expect(grounding(r)).toEqual(expect.objectContaining({ status: 'requires_adjudication', value: null }));
  });

  it('control: the registered posting URL is not flagged', () => {
    const d = wellFormed(); d.outputs[0].plan.questionPlan.coreMustPractice[0].reason += ` See ${originals[0].sourceRecords[0].url}.`;
    expect(report(d).screeningWarnings.filter(w => w.path === REASON)).toEqual([]);
  });

  it('shows an output dropped from a pinned corpus and withholds every aggregate', () => {
    const full = twoCases(); wellFormed(full, 0); wellFormed(full, 1); bind(full); const manifest = manifestOf(full);
    const d = wellFormed(); d.annotations[0].humanScores = allFours();
    const r = report(d, { manifest });
    expect(r.checks.corpusCompleteness).toBe('incomplete');
    expect(r.corpus).toEqual(expect.objectContaining({ expected: 2, evaluated: 1, missing: [expect.objectContaining({ caseId: 'EVAL-AAA-secondary', outputId: 'secondary-output' })], unexpected: [] }));
    expect(grounding(r)).toEqual(expect.objectContaining({ status: 'N/A', value: null, reason: expect.stringMatching(/corpus/i) }));
    expect(markdown(r)).toMatch(/Missing from the pinned corpus:\n\n- EVAL-AAA-secondary \/ secondary-output/);
  });

  it('reports an unpinned corpus as not evaluated and gives no aggregate', () => {
    const d = wellFormed(); d.annotations[0].humanScores = allFours();
    const r = report(d, { manifest: null });
    expect(r.checks.corpusCompleteness).toBe('not_evaluated');
    expect(grounding(r)).toEqual(expect.objectContaining({ status: 'N/A', value: null }));
    expect(r.humanReview.status).toBe('corpus_not_pinned');
  });

  it('lists an output that the manifest does not expect, and rejects a malformed manifest', () => {
    const d = wellFormed(); const r = report(d, { manifest: [] });
    expect(r.corpus.unexpected).toEqual([expect.objectContaining({ outputId: OUTPUT })]);
    expect(r.checks.corpusCompleteness).toBe('incomplete');
    rejects(wellFormed(), /manifest/, { manifest: [{ caseId: CASE }] });
  });
});

describe('F6 rater conflicts', () => {
  it('adjudicates a split over whether a critical failure exists instead of averaging 0 and 1', () => {
    const d = data(); d.annotations[0].owner = humanOwner(); d.outputs[0].plan.stageRoadmap[0].evidenceIds = [];
    d.annotations[0].humanScores = [rating(0, 'rater-a'), rating(1, 'rater-b')];
    const r = report(d);
    expect(issuesOf(r, 'critical_failure_disagreement')).toEqual([expect.objectContaining({ raterIds: ['rater-a', 'rater-b'] })]);
    expect(grounding(r)).toEqual(expect.objectContaining({ status: 'requires_adjudication', value: null }));
  });

  it('adjudicates grounding 0 when no critical finding is on record for the output', () => {
    const d = wellFormed(); d.annotations[0].humanScores = pair(0);
    const r = report(d);
    expect(r.findings).toEqual([]);
    expect(issuesOf(r, 'rating_implies_unrecorded_critical_failure')).toHaveLength(1);
  });

  it('states critical findings beside the human review status', () => {
    const d = data(); d.annotations[0].owner = humanOwner(); d.outputs[0].plan.stageRoadmap[0].evidenceIds = [];
    d.annotations[0].humanScores = DIMS.flatMap(dimension => pair(dimension === 'evidenceGrounding' ? 0 : 4, dimension));
    const r = report(d);
    expect(r.humanReview.adjudicationIssues).toEqual([]);
    expect(markdown(r)).toMatch(/Human review status: declared_human_ratings\. 1 critical finding\(s\) are on record for the rated outputs/);
  });
});

describe('F7 Markdown coverage', () => {
  it('lists an unrated output even when another output is disputed', () => {
    const d = twoCases(); wellFormed(d, 0); wellFormed(d, 1); d.annotations[0].humanScores = [rating(4, 'rater-a'), rating(1, 'rater-b')];
    const r = report(d);
    expect(grounding(r)).toEqual(expect.objectContaining({ status: 'requires_adjudication', missing: [expect.objectContaining({ outputId: 'secondary-output', eligibleRaters: 0 })] }));
    const text = markdown(r);
    expect(text).toMatch(/- evidenceGrounding: EVAL-AAA-secondary \/ secondary-output has 0 eligible rater\(s\)/);
    expect(text).toMatch(/Unrated outputs:\n\n- EVAL-AAA-secondary \/ secondary-output/);
  });
});

describe('F8 identity and screening hygiene', () => {
  it.each([['zero-width space', 'rater-​a'], ['soft hyphen', 'rater­-a']])('rejects a second rater manufactured with a %s', (_name, alias) => {
    const d = wellFormed(); d.annotations[0].humanScores = [rating(4, 'rater-a'), rating(4, alias)];
    rejects(d, /duplicate human score/);
  });

  it.each(['gpt-6', 'claude-fable-5-2 (LLM grader)', 'codex-reviewer'])('rejects a human declaration under a model-like identity: %s', id => {
    const d = wellFormed(); d.annotations[0].humanScores = [rating(4, 'rater-a'), rating(4, id)];
    rejects(d, /names a model/);
  });

  it.each(['Prepare for a 2026 interview by reviewing the posting.', 'Enterprise customers typically have several stakeholders.'])('does not raise interview-history wording for: %s', text => {
    const d = wellFormed(); d.outputs[0].plan.prepPriorities[0].whyItMatters = text;
    Object.assign(d.annotations[0].judgments[4], { claimType: 'suggested_practice', presentation: 'hypothetical', supportDecision: 'not_applicable' });
    expect(report(d).screeningWarnings.filter(w => w.signal === 'interview_history_wording')).toEqual([]);
  });

  it('flags a fabricated quotation in curly single quotes', () => {
    const d = wellFormed(); d.outputs[0].plan.prepPriorities[0].whyItMatters = 'The posting says ‘candidates must pass four architecture interview rounds in London first’.';
    expect(report(d).screeningWarnings).toContainEqual(expect.objectContaining({ path: WHY, signal: 'unverified_quotation' }));
  });

  it('(Codex P2) still flags a fabricated double-quoted quotation that contains an apostrophe', () => {
    const d = wellFormed(); d.outputs[0].plan.prepPriorities[0].whyItMatters = 'The posting says "You’ll design secure systems across multiple cloud providers".';
    expect(report(d).screeningWarnings).toContainEqual(expect.objectContaining({ path: WHY, signal: 'unverified_quotation', match: 'You’ll design secure systems across multiple cloud providers' }));
  });

  it('reports schema 4 and pins the approved rubric bytes', () => {
    const r = report(data());
    expect(r.schemaVersion).toBe(4);
    expect(r.provenance.evaluator.rubricSha256).toBe('26ab37cab025eff0220e8915deb7545089f94c5a5743b8e6399dd8f4c87450a6');
  });
});
