import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROLE = 'Applied AI Architect, Large Enterprise';
const URL = 'https://openai.com/careers/applied-ai-architect-large-enterprise-london-uk/';
const PRIORITY = ['high', 'medium', 'low'];
const DIMENSIONS = ['roleRelevance', 'evidenceGrounding', 'prioritization', 'handlingUncertainty', 'practicalUsefulness'];
const TIERS = ['coreMustPractice', 'likelyFollowUps', 'extraDepth'];
const POSITIONING = ['strengthsToLeanOn', 'weakSpotsToAddress', 'storyCoverageGaps', 'mismatchRisks'];
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const fail = message => { throw new Error(message); };
const requireThat = (condition, message) => { if (!condition) fail(message); };
const str = (v, name) => requireThat(typeof v === 'string' && v.trim().length > 0, `${name}: expected nonempty string`);
const arr = (v, name) => { requireThat(Array.isArray(v), `${name}: expected array`); return v; };
const member = (v, values, name) => requireThat(values.includes(v), `${name}: expected ${values.join('|')}`);
function shape(v, keys, name) {
  requireThat(v !== null && typeof v === 'object' && !Array.isArray(v), `${name}: expected object`);
  for (const k of keys) requireThat(Object.hasOwn(v, k), `${name}: missing ${k}`);
  for (const k of Object.keys(v)) requireThat(keys.includes(k), `${name}: unknown field ${k}`);
}
function unique(items, key, name) {
  const map = new Map();
  for (const item of arr(items, name)) {
    str(item?.[key], `${name}.${key}`);
    requireThat(!map.has(item[key]), `duplicate ${name}: ${item[key]}`);
    map.set(item[key], item);
  }
  return map;
}
function date(v, name) { str(v, name); requireThat(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}Z)?$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().startsWith(v.slice(0, 10)), `${name}: invalid date`); }
function digest(v, name) { requireThat(typeof v === 'string' && /^[a-f0-9]{64}$/.test(v), `${name}: invalid SHA-256`); }
function normalize(v) {
  if (typeof v === 'string') return v.replace(/\r\n?/g, '\n');
  if (Array.isArray(v)) return v.map(normalize);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map(k => [k, normalize(v[k])]));
  return v;
}
export const canonical = v => JSON.stringify(normalize(v));
export const sha256 = s => createHash('sha256').update(s.replace(/\r\n?/g, '\n'), 'utf8').digest('hex');
function checkHash(record, name) {
  digest(record.sha256, name);
  const { sha256: expected, ...body } = record;
  requireThat(expected === sha256(canonical(body)), `${name}: hash mismatch`);
  requireThat(record.schemaVersion === 1, `${name}: unsupported schemaVersion`);
}
// Exact compactText semantics from main's evidence-ledger.ts; no application import.
function compact(text) { const s = text.replace(/\s+/g, ' ').trim(); return s.length <= 700 ? s : `${s.slice(0, 699).trim()}…`; }

function validateCase(c) {
  shape(c, ['schemaVersion', 'fixtureVersion', 'caseId', 'variantId', 'lineage', 'input', 'jobDescriptionSha256', 'sourceRecords', 'interviewGroundTruth', 'sha256'], 'case');
  str(c.fixtureVersion, 'fixtureVersion'); str(c.variantId, 'variantId');
  shape(c.lineage, ['fixtureId', 'packageVersion', 'upstreamCaseId', 'adaptation', 'opportunityFixtureSha256', 'sourceRegisterSha256', 'rubricSha256'], 'lineage');
  for (const [key, value] of Object.entries(c.lineage)) str(value, `lineage.${key}`);
  for (const key of ['opportunityFixtureSha256', 'sourceRegisterSha256', 'rubricSha256']) digest(c.lineage[key], key);
  requireThat(c.lineage.upstreamCaseId === c.caseId, 'caseId does not match preserved upstreamCaseId');
  requireThat(c.lineage.packageVersion === '0.3.0', 'unsupported source package version');
  shape(c.input, ['company', 'role', 'country', 'level', 'jobDescription'], 'input');
  requireThat(c.input.company === 'OpenAI' && c.input.role === ROLE && c.input.country === 'United Kingdom', 'London source identity mismatch in input');
  member(c.input.level, ['junior', 'mid', 'senior_ic', 'people_manager', 'unknown'], 'input.level');
  requireThat(c.interviewGroundTruth === null, 'Phase A has no verified interview ground truth');
  requireThat(arr(c.sourceRecords, 'sourceRecords').length === 1, 'exactly one official job source required');
  const s = c.sourceRecords[0];
  shape(s, ['id', 'sourceType', 'company', 'role', 'location', 'url', 'backingUrl', 'capturedAt', 'captureMethod', 'originalSnapshotSha256', 'sourceReview', 'passages'], 'source');
  requireThat(s.id === 'S02' && s.sourceType === 'official_job' && s.company === 'OpenAI' && s.role === ROLE && s.location === 'London, UK' && s.url === URL && s.backingUrl === 'https://jobs.ashbyhq.com/openai/557dd2ec-db6c-49b1-a0aa-193007ebd5b6', 'London source identity mismatch');
  date(s.capturedAt, 'source.capturedAt'); str(s.captureMethod, 'captureMethod'); digest(s.originalSnapshotSha256, 'originalSnapshotSha256');
  shape(s.sourceReview, ['authoredBy', 'authorType', 'status'], 'sourceReview');
  str(s.sourceReview.authoredBy, 'sourceReview.authoredBy'); str(s.sourceReview.status, 'sourceReview.status'); member(s.sourceReview.authorType, ['human', 'model'], 'sourceReview.authorType');
  const passages = unique(s.passages, 'id', 'passage'); requireThat(passages.size > 0, 'missing source passages');
  for (const p of passages.values()) {
    shape(p, ['id', 'text', 'sha256'], 'passage'); str(p.text, 'passage.text'); digest(p.sha256, 'passage.sha256');
    requireThat(sha256(p.text) === p.sha256, 'passage hash mismatch');
  }
  str(c.input.jobDescription, 'job description');
  requireThat(c.jobDescriptionSha256 === sha256(c.input.jobDescription) && c.input.jobDescription === s.passages.map(p => p.text).join('\n'), 'job description hash or frozen passage binding mismatch');
  return { source: s, passages };
}

function validatePlan(o, c, s) {
  shape(o, ['schemaVersion', 'caseId', 'variantId', 'fixtureVersion', 'caseSha256', 'outputId', 'claimLevel', 'authoredBy', 'fixtureCompleteness', 'runMetadata', 'plan', 'sha256'], 'output');
  requireThat(o.claimLevel === 'illustrative', 'missing real-run provenance: Phase A accepts illustrative snapshots only; captured runs need a separately approved capture/full-plan validator');
  requireThat(o.caseSha256 === c.sha256 && o.variantId === c.variantId && o.fixtureVersion === c.fixtureVersion, 'output case/variant/version binding mismatch');
  str(o.authoredBy, 'authoredBy'); requireThat(o.fixtureCompleteness === 'illustrative_excerpt', 'Phase A requires illustrative_excerpt');
  shape(o.runMetadata, ['runId', 'prepioExecuted', 'sourceCommit', 'createdAt', 'method'], 'runMetadata');
  requireThat(o.runMetadata.runId === null && o.runMetadata.prepioExecuted === false, 'inconsistent illustrative provenance');
  requireThat(typeof o.runMetadata.sourceCommit === 'string' && /^[a-f0-9]{40}$/.test(o.runMetadata.sourceCommit), 'runMetadata.sourceCommit must be full source-context SHA');
  date(o.runMetadata.createdAt, 'runMetadata.createdAt'); str(o.runMetadata.method, 'runMetadata.method');
  requireThat(o.runMetadata.createdAt.slice(0, 10) >= s.capturedAt.slice(0, 10), 'output predates source capture');
  const targets = new Map(); const allowedUrls = new Set([s.url, s.backingUrl]);
  function scan(v) {
    if (typeof v === 'string') {
      for (const match of v.matchAll(/https?:\/\/[^\s<>"'\])]+/gi)) {
        let url;
        try { url = new globalThis.URL(match[0].replace(/[.,;:!?]+$/, '')).href; }
        catch { fail(`unregistered URL: ${match[0]}`); }
        requireThat(allowedUrls.has(url), `unregistered URL: ${match[0]}`);
      }
    } else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) {
      requireThat(!['claimType', 'match', 'relevant', 'specific'].includes(k), `self-grading field: ${k}`); scan(x);
    }
  }
  scan(o.plan);
  const claim = (v, path) => { str(v, path); targets.set(path, v); };
  const claims = (v, path) => arr(v, path).forEach((x, i) => claim(x, `${path}[${i}]`));
  const p = o.plan;
  shape(p, ['summary', 'assessmentSignals', 'stageRoadmap', 'prepPriorities', 'candidatePositioning', 'practiceSequence', 'questionPlan', 'internalEvidenceLog'], 'plan');
  shape(p.summary, ['company', 'roleName', 'industryFocus', 'level', 'overallConfidence', 'weakSignalCase'], 'summary');
  requireThat(p.summary.company === c.input.company && p.summary.roleName === c.input.role && p.summary.level === c.input.level, 'plan/input identity mismatch');
  requireThat(p.summary.industryFocus === 'tech', 'industryFocus must be tech for this London case'); member(p.summary.overallConfidence, PRIORITY, 'overallConfidence'); requireThat(typeof p.summary.weakSignalCase === 'boolean', 'weakSignalCase must be boolean');
  const ledger = unique(p.internalEvidenceLog, 'id', 'ledger'); requireThat(ledger.size === 1, 'exactly one bound official job ledger entry required');
  for (const e of ledger.values()) {
    shape(e, ['id', 'sourceType', 'sourceLabel', 'excerpt', 'url', 'relevance', 'trustWeight', 'contradictionGroup', 'title', 'platform', 'publishedDate', 'snippet'], 'ledger');
    requireThat(/^ev-[1-9]\d*$/.test(e.id), 'invalid ledger id');
    requireThat(e.sourceType === 'official_job' && (e.url === null || e.url === s.url || e.url === s.backingUrl) && e.excerpt === compact(c.input.jobDescription) && e.snippet === e.excerpt, 'ledger source/content binding mismatch');
    requireThat(e.sourceLabel === 'Pasted job description' && e.title === 'Pasted job description' && e.platform === 'user' && e.relevance === 'high' && e.trustWeight === 'high', 'ledger metadata binding mismatch: expected native pasted-JD source identity and weights');
    requireThat(e.contradictionGroup === null && e.publishedDate === null, 'unexpected ledger date/contradiction metadata');
  }
  function citations(ids, name) {
    const seen = new Set(); for (const id of arr(ids, `${name}.evidenceIds`)) {
      requireThat(ledger.has(id), `unresolved citation ${id} at ${name}`); requireThat(!seen.has(id), `duplicate citation at ${name}`); seen.add(id);
    }
  }
  arr(p.assessmentSignals, 'assessmentSignals').forEach((v, i) => {
    shape(v, ['name', 'importance', 'rationale'], 'assessmentSignal'); claim(v.name, `assessmentSignals[${i}].name`); claim(v.rationale, `assessmentSignals[${i}].rationale`); member(v.importance, PRIORITY, 'importance');
  });
  const stages = unique(p.stageRoadmap, 'stageName', 'stage name'); requireThat(stages.size > 0, 'missing stages');
  const orders = new Set();
  p.stageRoadmap.forEach((v, i) => {
    shape(v, ['stageName', 'orderIndex', 'evidenceIds', 'confidence', 'whatItTests', 'whyLikely', 'prepPriority', 'questionThemes', 'prepActions', 'lowConfidenceGuidance'], 'stage');
    const base = `stageRoadmap[${i}]`; citations(v.evidenceIds, base); member(v.confidence, PRIORITY, 'confidence'); member(v.prepPriority, PRIORITY, 'prepPriority');
    requireThat(Number.isInteger(v.orderIndex) && v.orderIndex > 0 && !orders.has(v.orderIndex), 'invalid/duplicate stage orderIndex'); orders.add(v.orderIndex);
    claim(v.stageName, `${base}.stageName`); claim(v.whyLikely, `${base}.whyLikely`);
    for (const k of ['whatItTests', 'questionThemes', 'prepActions']) claims(v[k], `${base}.${k}`);
    if (v.lowConfidenceGuidance !== null) claim(v.lowConfidenceGuidance, `${base}.lowConfidenceGuidance`);
    requireThat(v.confidence !== 'low' || v.lowConfidenceGuidance !== null, 'low confidence needs guidance');
  });
  const priorities = unique(p.prepPriorities, 'label', 'priority label');
  p.prepPriorities.forEach((v, i) => {
    shape(v, ['label', 'priority', 'whyItMatters', 'recommendedActions'], 'priority'); member(v.priority, PRIORITY, 'priority');
    claim(v.label, `prepPriorities[${i}].label`); claim(v.whyItMatters, `prepPriorities[${i}].whyItMatters`); claims(v.recommendedActions, `prepPriorities[${i}].recommendedActions`);
  });
  shape(p.candidatePositioning, POSITIONING, 'candidatePositioning');
  for (const k of POSITIONING) claims(p.candidatePositioning[k], `candidatePositioning.${k}`);
  const practiceOrders = new Set();
  arr(p.practiceSequence, 'practiceSequence').forEach((v, i) => {
    shape(v, ['orderIndex', 'title', 'objective', 'linkedStageNames', 'linkedPriorityLabels'], 'practice');
    requireThat(Number.isInteger(v.orderIndex) && v.orderIndex > 0 && !practiceOrders.has(v.orderIndex), 'invalid/duplicate practice orderIndex'); practiceOrders.add(v.orderIndex);
    claim(v.title, `practiceSequence[${i}].title`); claim(v.objective, `practiceSequence[${i}].objective`);
    for (const name of arr(v.linkedStageNames, 'linkedStageNames')) requireThat(stages.has(name), 'unknown linked stage');
    for (const name of arr(v.linkedPriorityLabels, 'linkedPriorityLabels')) requireThat(priorities.has(name), 'unknown linked priority');
  });
  shape(p.questionPlan, TIERS, 'questionPlan');
  requireThat(arr(p.questionPlan.coreMustPractice, 'coreMustPractice').length > 0, 'missing core questions');
  const questions = new Set();
  for (const tier of TIERS) arr(p.questionPlan[tier], tier).forEach((v, i) => {
    shape(v, ['question', 'stageName', 'evidenceIds', 'linkedPriority', 'difficulty', 'reason', 'answerGuidanceStatus', 'leveragesStoryId'], 'question');
    const base = `questionPlan.${tier}[${i}]`; claim(v.question, `${base}.question`); claim(v.reason, `${base}.reason`); citations(v.evidenceIds, base);
    requireThat(!questions.has(v.question), 'duplicate question'); questions.add(v.question);
    requireThat(v.stageName === null || stages.has(v.stageName), 'unknown question stage');
    member(v.linkedPriority, PRIORITY, 'linkedPriority'); member(v.difficulty, ['Easy', 'Medium', 'Hard'], 'difficulty'); member(v.answerGuidanceStatus, ['pending', 'generated'], 'answerGuidanceStatus');
    requireThat(v.leveragesStoryId === null, 'Phase A has no candidate story ground truth');
  });
  return targets;
}

function validateAnnotations(a, o, c, targets, passages) {
  shape(a, ['schemaVersion', 'caseId', 'variantId', 'outputId', 'outputSha256', 'rubricVersion', 'owner', 'judgments', 'humanScores', 'sha256'], 'annotations');
  requireThat(a.caseId === c.caseId && a.variantId === c.variantId && a.outputSha256 === o.sha256, 'annotation case/output hash binding mismatch');
  requireThat(a.rubricVersion === 'evidence-integrity-v1', 'unsupported annotation rubricVersion');
  shape(a.owner, ['id', 'authorType', 'independence', 'reviewedAt'], 'owner'); str(a.owner.id, 'owner.id'); date(a.owner.reviewedAt, 'owner.reviewedAt');
  requireThat(a.owner.reviewedAt.slice(0, 10) >= o.runMetadata.createdAt.slice(0, 10), 'annotation review predates output');
  member(a.owner.authorType, ['human', 'model'], 'owner.authorType'); member(a.owner.independence, ['independent', 'same_author', 'unknown'], 'owner.independence');
  requireThat(a.owner.independence !== 'independent' || (a.owner.authorType === 'human' && a.owner.id !== o.authoredBy), 'invalid independence assertion');
  const judgments = unique(a.judgments, 'path', 'judgment path');
  for (const j of judgments.values()) {
    shape(j, ['path', 'claimType', 'presentation', 'supportDecision', 'evidenceSourceIds', 'passageIds', 'reason'], 'judgment');
    requireThat(targets.has(j.path), `unknown judgment path: ${j.path}`);
    member(j.claimType, ['role_requirement', 'suggested_practice', 'reported_interview_question', 'interview_process_claim', 'other'], 'claimType');
    member(j.presentation, ['factual', 'hypothetical', 'ambiguous'], 'presentation');
    member(j.supportDecision, ['supported', 'contradicted', 'insufficient_evidence', 'not_applicable'], 'supportDecision'); str(j.reason, 'judgment.reason');
    const ids = arr(j.evidenceSourceIds, 'evidenceSourceIds'); const refs = arr(j.passageIds, 'passageIds');
    requireThat(new Set(ids).size === ids.length && ids.every(id => id === c.sourceRecords[0].id), 'duplicate/unknown evidence source');
    requireThat(new Set(refs).size === refs.length && refs.every(id => passages.has(id)), 'duplicate/unknown passage');
    requireThat(refs.length === 0 || ids.length > 0, 'passage missing source reference');
    if (['supported', 'contradicted'].includes(j.supportDecision)) requireThat(ids.length > 0 && refs.length > 0, 'support decision missing source passages');
    if (['interview_process_claim', 'reported_interview_question'].includes(j.claimType)) requireThat(!['supported', 'contradicted'].includes(j.supportDecision), 'missing interview ground truth: job posting cannot establish or refute interview history');
    requireThat(!(j.presentation === 'factual' && j.supportDecision === 'not_applicable'), 'factual claim cannot use not_applicable');
  }
  for (const path of targets.keys()) requireThat(judgments.has(path), `unannotated claim-bearing path: ${path}`);
  const scores = new Set();
  for (const score of arr(a.humanScores, 'humanScores')) {
    shape(score, ['dimension', 'value', 'raterId', 'authorType', 'independence', 'reviewedAt', 'rubricVersion', 'reason'], 'human score');
    member(score.dimension, DIMENSIONS, 'human score dimension'); requireThat(Number.isInteger(score.value) && score.value >= 0 && score.value <= 4, 'human score must be an integer in 0–4');
    str(score.raterId, 'human score raterId'); date(score.reviewedAt, 'human score reviewedAt'); str(score.reason, 'human score reason');
    requireThat(score.reviewedAt.slice(0, 10) >= o.runMetadata.createdAt.slice(0, 10), 'human score review predates output');
    requireThat(score.authorType === 'human' && score.independence === 'independent' && score.raterId !== o.authoredBy && score.rubricVersion === '0.3.0', 'human score needs declared independent human ownership and rubric 0.3.0');
    const key = `${score.dimension}:${score.raterId}`; requireThat(!scores.has(key), 'duplicate human score'); scores.add(key);
  }
  return [...judgments.values()].map(j => ({ caseId: c.caseId, outputId: o.outputId, annotationOwner: a.owner, ...j }));
}

const na = reason => ({ status: 'N/A', value: null, reason });
function humanScoreSummary(records) {
  return Object.fromEntries(DIMENSIONS.map(dimension => {
    const scores = records.filter(s => s.dimension === dimension);
    if (!scores.length) return [dimension, { ...na('No independent human ratings supplied.'), count: 0 }];
    const groups = new Map();
    for (const s of scores) { const group = groups.get(s.outputId) ?? []; group.push(s.value); groups.set(s.outputId, group); }
    const disputed = [...groups.entries()].filter(([, values]) => Math.max(...values) - Math.min(...values) > 1).map(([id]) => id).sort(compare);
    if (disputed.length) return [dimension, { status: 'requires_adjudication', value: null, count: scores.length, disputedOutputs: disputed, reason: 'Human ratings for the same output differ by more than one point; rubric requires adjudication. Raw ratings are retained.' }];
    return [dimension, { status: 'descriptive_only', count: scores.length, value: scores.reduce((sum, s) => sum + s.value, 0) / scores.length }];
  }));
}
export function evaluate(dataset) {
  const d = normalize(dataset); shape(d, ['cases', 'outputs', 'annotations'], 'dataset');
  const cases = unique(d.cases, 'caseId', 'caseId'); requireThat(cases.size > 0, 'empty evaluation corpus');
  const outputs = unique(d.outputs, 'outputId', 'outputId'); const annotations = unique(d.annotations, 'outputId', 'annotation outputId');
  const byCase = unique(d.outputs, 'caseId', 'output caseId');
  for (const o of outputs.values()) requireThat(cases.has(o.caseId), `unknown case: ${o.caseId}`);
  for (const id of cases.keys()) requireThat(byCase.has(id), `missing output for ${id}`);
  for (const a of annotations.values()) requireThat(outputs.has(a.outputId), `unknown output: ${a.outputId}`);
  const judgments = []; const findings = []; const allScores = [];
  for (const c of [...cases.values()].sort((a, b) => compare(a.caseId, b.caseId))) {
    checkHash(c, 'case'); const { source, passages } = validateCase(c);
    const o = byCase.get(c.caseId); requireThat(o, `missing output for ${c.caseId}`); checkHash(o, 'output');
    const targets = validatePlan(o, c, source);
    const a = annotations.get(o.outputId); requireThat(a, `missing annotations for ${o.outputId}`); checkHash(a, 'annotations');
    judgments.push(...validateAnnotations(a, o, c, targets, passages));
    allScores.push(...a.humanScores.map(score => ({ caseId: c.caseId, outputId: o.outputId, ...score })));
  }
  judgments.sort((a, b) => compare(canonical([a.caseId, a.path]), canonical([b.caseId, b.path])));
  for (const j of judgments) {
    let type;
    if (j.supportDecision === 'contradicted') type = 'contradicted_claim';
    else if (j.presentation === 'factual' && j.supportDecision === 'insufficient_evidence') type = ['interview_process_claim', 'reported_interview_question'].includes(j.claimType) ? 'unsupported_interview_history' : 'unsupported_claim';
    if (type) findings.push({ caseId: j.caseId, outputId: j.outputId, path: j.path, type, annotationOwner: j.annotationOwner, reason: j.reason });
  }
  const metricReason = 'Phase A is illustrative; no actual Prepio execution, verified interview ground truth, or execution telemetry.';
  const sortBy = (values, field) => [...values].sort((a, b) => compare(a[field], b[field]));
  return normalize({
    schemaVersion: 1, status: 'evaluated', claimLevel: 'illustrative', reportTitle: 'Illustrative OpenAI evidence-integrity report — DEMONSTRATION_ONLY',
    checks: { sourceCaptureHashes: 'pass', planReferenceIntegrity: 'pass', labelTargetIntegrity: 'pass', hashAndCaseIdentity: 'pass' },
    counts: { cases: cases.size, outputs: outputs.size, annotatedClaimPaths: judgments.length, annotationSupportedClaims: judgments.filter(j => j.supportDecision === 'supported').length, findings: findings.length },
    findings, judgments,
    metrics: Object.fromEntries(['top5HitRate', 'citationPrecision', 'stageAccuracy', 'degradedRunRate', 'latency', 'tokens', 'estimatedCost', 'tavilyUsage'].map(k => [k, na(metricReason)])),
    humanReview: { status: allScores.length ? 'declared_human_ratings' : 'N/A', verification: 'Ownership is declared metadata; the evaluator cannot authenticate raters or verify semantic judgments.', scores: humanScoreSummary(allScores), records: allScores.sort((a, b) => compare(canonical(a), canonical(b))) },
    provenance: {
      cases: sortBy(cases.values(), 'caseId').map(c => ({ caseId: c.caseId, variantId: c.variantId, fixtureVersion: c.fixtureVersion, sha256: c.sha256, jobDescriptionSha256: c.jobDescriptionSha256, lineage: c.lineage, sourceRecords: c.sourceRecords })),
      outputs: sortBy(outputs.values(), 'outputId').map(({ plan: _plan, ...o }) => o),
      annotations: sortBy(annotations.values(), 'outputId').map(({ judgments: _judgments, humanScores: _scores, ...a }) => a),
    },
    limitations: ['Counts reflect supplied annotations on a constructed example, not measured model performance.', 'Source hashes establish frozen excerpt integrity, not source authenticity or currentness. Original capture hashes are lineage only; original full captures are not bundled.', 'No independent human source verification, reviewer calibration, real Prepio run, baseline, quality gate, or production measurement is established.', 'Phase A accepts this London JD-only excerpt contract; full captured plans and the broader seven-run suite are outside this harness.'],
  });
}

const md = value => String(value).replace(/[|`\\]/g, '\\$&').replace(/\r?\n/g, ' ');
export function markdown(r) {
  return `# ${r.reportTitle}\n\nStatus: ${r.status}. All deterministic integrity checks passed.\n\n${r.counts.cases} case(s); ${r.counts.annotatedClaimPaths} annotated claim paths; ${r.counts.findings} finding(s). Counts reflect annotations, not verified model quality.\n\n${r.provenance.cases.map(c => `Case: ${md(c.caseId)} / ${md(c.variantId)}; snapshot ${c.sha256}.`).join('\n')}\n\n${r.provenance.outputs.map(o => `Output: ${md(o.outputId)}; authored by ${md(o.authoredBy)}; Prepio executed: false.\n\nSource-context commit: ${o.runMetadata.sourceCommit} (not an execution trace).`).join('\n')}\n\n${r.provenance.annotations.map(a => `Annotation owner: ${md(a.owner.id)}; ${a.owner.authorType}; independence: ${a.owner.independence}; reviewed ${a.owner.reviewedAt}.`).join('\n')}\n\nFindings:\n\n${r.findings.map(f => `- ${md(f.caseId)} / ${md(f.path)}: ${f.type} (${md(f.reason)})`).join('\n') || '- None'}\n\n| Performance metric | Value |\n|---|---|\n${Object.keys(r.metrics).map(k => `| ${k} | N/A |`).join('\n')}\n\nNo actual Prepio run, verified interview ground truth or execution telemetry is supplied.\n\n| Human dimension | Descriptive score (0–4) | Ratings |\n|---|---:|---:|\n${Object.entries(r.humanReview.scores).map(([k, v]) => `| ${k} | ${v.status === 'requires_adjudication' ? 'N/A (requires adjudication)' : v.value ?? 'N/A'} | ${v.count} |`).join('\n')}\n\n${r.humanReview.verification}\n\n${r.limitations.map(x => `- ${x}`).join('\n')}\n`;
}

async function main(args) {
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]; requireThat(['--case', '--output', '--labels', '--out'].includes(key), `Unknown option ${key}`);
    requireThat(!Object.hasOwn(options, key), `Repeated option ${key}`); str(args[i + 1], key);
    requireThat(!args[i + 1].startsWith('--'), `Missing value for ${key}`); options[key] = resolve(args[i + 1]);
  }
  requireThat(Object.keys(options).length === 4, 'Usage: node score.mjs --case CASE.json --output OUTPUT.json --labels LABELS.json --out NEW_DIRECTORY');
  const load = async path => { let parsed; try { parsed = JSON.parse(await readFile(path, 'utf8')); } catch (e) { fail(`Cannot read JSON ${basename(path)}: ${e.code ?? 'invalid JSON'}`); } return Array.isArray(parsed) ? parsed : [parsed]; };
  const [cases, outputs, annotations] = await Promise.all([load(options['--case']), load(options['--output']), load(options['--labels'])]);
  const result = evaluate({ cases, outputs, annotations }); const json = `${JSON.stringify(result, null, 2)}\n`; const summary = markdown(result);
  // A new directory and exclusive files prevent overwrite through aliases/symlinks.
  await mkdir(options['--out']);
  await writeFile(resolve(options['--out'], 'results.json'), json, { flag: 'wx' });
  await writeFile(resolve(options['--out'], 'summary.md'), summary, { flag: 'wx' });
  process.stdout.write(summary);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await main(process.argv.slice(2)); }
  catch (error) { process.stderr.write(`${JSON.stringify({ status: 'error', message: error.message })}\n`); process.exitCode = 2; }
}
