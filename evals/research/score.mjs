import { createHash } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROLE = 'Applied AI Architect, Large Enterprise';
const URL = 'https://openai.com/careers/applied-ai-architect-large-enterprise-london-uk/';
const PRIORITY = ['high', 'medium', 'low'];
const DIMENSIONS = ['roleRelevance', 'evidenceGrounding', 'prioritization', 'handlingUncertainty', 'practicalUsefulness'];
const TIERS = ['coreMustPractice', 'likelyFollowUps', 'extraDepth'];
const POSITIONING = ['strengthsToLeanOn', 'weakSpotsToAddress', 'storyCoverageGaps', 'mismatchRisks'];
const INTERVIEW_CLAIM_TYPES = ['interview_process_claim', 'reported_interview_question'];
// These paths assert that an interview stage exists, is likely or covers given content, whatever label an annotation gives them.
const STAGE_CLAIM_PATH = /^stageRoadmap\[\d+\]\.(?:stageName|whyLikely|(?:whatItTests|questionThemes)\[\d+\])$/;
// Preserved rubric v0.3.0 ceilings for evidence grounding. Critical: an unsupported
// employer-specific interview claim stated as fact is CF2/CF3 (EG 0); a contradicted
// employer-specific claim cannot meet EG 3–4, which need every such statement supported.
const FINDING_POLICY = {
  unsupported_interview_history: { severity: 'critical', maxGrounding: 0 },
  contradicted_claim: { severity: 'critical', maxGrounding: 2 },
  unsupported_claim: { severity: 'minor', maxGrounding: 2 },
};
const REQUIRED_RATERS = 2; // rubric §4.3: two human raters score each run independently
// Screening lexicons are review prompts, never semantic proof (rubric §4.1, D3/D6/D8).
const SCREENS = [
  ['interview_history_wording', /\b(?:always|typically|usually|normally|generally)\s+(?:asks?|uses?|runs?|includes?|involves?|requires?|has|have|lasts?|consists?)\b|\b(?:\d+|two|three|four|five|six|seven|eight)[\s-]+(?:[\w-]+\s+){0,3}(?:rounds?|interviews?|interviewers?|stages?|loops?)\b|\bthere (?:will be|is|are) (?:an? |the )?(?:[\w-]+\s+){0,4}(?:rounds?|interviews?|stages?|panels?|loops?)\b|\byou will (?:meet|face|be interviewed|be asked)\b|\bthe (?:exact|real|actual) (?:interview )?questions?\b|\b(?:final|onsite|on-site) (?:round|interview|loop)s?\b/i],
  ['candidate_report_wording', /\bcandidates? (?:reports?|reported|say|said|mention(?:ed)?|describe[sd]?|shared?)\b|\b(?:according to|as reported (?:on|by)|reported (?:on|by)|reviews? (?:on|from)|posts? on|threads? on)\s+(?:the\s+)?(?:glassdoor|blind|teamblind|reddit|indeed|linkedin|leetcode|comparably|fishbowl)\b|\b(?:glassdoor|teamblind|leetcode)\b|\binterview (?:reports?|reviews?|experiences?)\b|\b(?:a|my|one) (?:friend|colleague|recruiter|contact|former employee) (?:said|says|told|mentioned|reports?)\b/i],
];
const HTTP_URL = /https?:\/\/[^\s<>"'\])]+/gi;
// Non-http(s) references: other schemes, protocol-relative, www hosts and bare domains on common TLDs.
const OTHER_REFERENCE = /(?:[a-z][a-z0-9+.-]*:\/\/|(?<![\w:/.-])\/\/|\bwww\.)[^\s<>"'\])]+|(?<![\w@/.-])(?:[a-z0-9-]+\.)+(?:com|org|net|io|ai|fyi|uk|dev|app|example)\b(?:\/[^\s<>"'\])]*)?/gi;
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const sortedUnique = values => [...new Set(values)].sort(compare);
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
// Exact-string identity checks are trivially aliased; compare a normalised key and keep the declared text.
const idKey = v => v.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
const flat = text => text.replace(/\s+/g, ' ').trim();
function date(v, name) { str(v, name); requireThat(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}Z)?$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().startsWith(v.slice(0, 10)), `${name}: invalid date`); }
// A date-only value covers its whole UTC day; a timestamp is a single instant.
const span = v => { const start = Date.parse(v); return v.length === 10 ? [start, start + 86399999] : [start, start]; };
function notAfterAsOf(v, name, ctx) {
  if (ctx.asOf === null) return;
  const [earliest, latest] = span(v); const limit = Date.parse(ctx.asOf);
  requireThat(earliest <= limit, `${name} is later than the evaluation as-of timestamp ${ctx.asOf}`);
  if (latest > limit) ctx.chronologyNotes.push({ comparison: `${name} <= evaluation as-of`, value: v, precision: 'date_only', reason: 'Date-only value on the as-of day; whether it precedes the as-of time cannot be verified.' });
}
// Rejects a certain inversion at full precision. An order that a date-only value leaves undecidable is recorded, not passed silently.
function ordered(earlier, later, message, note, ctx) {
  const [earliest, earlierEnd] = span(earlier); const [laterStart, latest] = span(later);
  requireThat(earliest <= latest, message);
  if (earlierEnd > laterStart) ctx.chronologyNotes.push({ ...note, precision: 'date_only', reason: 'Same UTC day with a date-only value; order within the day cannot be verified.' });
}
function asOfOption(options) {
  requireThat(options !== null && typeof options === 'object' && !Array.isArray(options) && Object.keys(options).every(k => k === 'asOf'), 'options: expected { asOf }');
  if (options.asOf === undefined || options.asOf === null) return null;
  requireThat(typeof options.asOf === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(options.asOf), 'as-of: expected a full UTC timestamp YYYY-MM-DDTHH:MM:SSZ');
  date(options.asOf, 'as-of'); return options.asOf;
}
function digest(v, name) { requireThat(typeof v === 'string' && /^[a-f0-9]{64}$/.test(v), `${name}: invalid SHA-256`); }
function normalize(v) {
  if (typeof v === 'string') return v.replace(/\r\n?/g, '\n');
  if (Array.isArray(v)) return v.map(normalize);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map(k => [k, normalize(v[k])]));
  return v;
}
export const canonical = v => JSON.stringify(normalize(v));
export const sha256 = s => createHash('sha256').update(s.replace(/\r\n?/g, '\n'), 'utf8').digest('hex');
const byteSha256 = bytes => createHash('sha256').update(bytes).digest('hex');

// Capture the exact artifacts once, separately from record calculation. Retain
// load errors so the CLI can report them with its usual JSON/exit-2 contract.
function loadBundledArtifacts() {
  try {
    const scorer = readFileSync(fileURLToPath(import.meta.url));
    const rubric = readFileSync(new globalThis.URL('rubric.v0.3.0.md', import.meta.url));
    return { scorer, rubric, provenance: { scorerSha256: byteSha256(scorer), rubricVersion: '0.3.0', rubricSha256: byteSha256(rubric) } };
  } catch (error) {
    return { error: `Cannot read bundled scorer/rubric: ${error.code ?? error.message}` };
  }
}
const bundledArtifacts = loadBundledArtifacts();
function requireBundledArtifacts() {
  requireThat(!bundledArtifacts.error, bundledArtifacts.error);
  return bundledArtifacts;
}
function checkHash(record, name) {
  digest(record.sha256, name);
  const { sha256: expected, ...body } = record;
  requireThat(expected === sha256(canonical(body)), `${name}: hash mismatch`);
  requireThat(record.schemaVersion === 1, `${name}: unsupported schemaVersion`);
}
// Exact compactText semantics from main's evidence-ledger.ts; no application import.
function compact(text) { const s = text.replace(/\s+/g, ' ').trim(); return s.length <= 700 ? s : `${s.slice(0, 699).trim()}…`; }

function validateCase(c, evaluator, ctx) {
  shape(c, ['schemaVersion', 'fixtureVersion', 'caseId', 'variantId', 'lineage', 'input', 'jobDescriptionSha256', 'sourceRecords', 'interviewGroundTruth', 'sha256'], 'case');
  str(c.fixtureVersion, 'fixtureVersion'); str(c.variantId, 'variantId');
  shape(c.lineage, ['fixtureId', 'packageVersion', 'upstreamCaseId', 'adaptation', 'opportunityFixtureSha256', 'sourceRegisterSha256', 'rubricSha256'], 'lineage');
  for (const [key, value] of Object.entries(c.lineage)) str(value, `lineage.${key}`);
  for (const key of ['opportunityFixtureSha256', 'sourceRegisterSha256', 'rubricSha256']) digest(c.lineage[key], key);
  requireThat(c.lineage.rubricSha256 === evaluator.rubricSha256, `case ${c.caseId}: rubric lineage hash mismatch with bundled rubric`);
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
  date(s.capturedAt, 'source.capturedAt'); notAfterAsOf(s.capturedAt, 'source.capturedAt', ctx); str(s.captureMethod, 'captureMethod'); digest(s.originalSnapshotSha256, 'originalSnapshotSha256');
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

function validatePlan(o, c, s, ctx) {
  shape(o, ['schemaVersion', 'caseId', 'variantId', 'fixtureVersion', 'caseSha256', 'outputId', 'claimLevel', 'authoredBy', 'fixtureCompleteness', 'runMetadata', 'plan', 'sha256'], 'output');
  requireThat(o.claimLevel === 'illustrative', 'missing real-run provenance: Phase A accepts illustrative snapshots only; captured runs need a separately approved capture/full-plan validator');
  requireThat(o.caseSha256 === c.sha256 && o.variantId === c.variantId && o.fixtureVersion === c.fixtureVersion, 'output case/variant/version binding mismatch');
  str(o.authoredBy, 'authoredBy'); requireThat(o.fixtureCompleteness === 'illustrative_excerpt', 'Phase A requires illustrative_excerpt');
  shape(o.runMetadata, ['runId', 'prepioExecuted', 'sourceCommit', 'createdAt', 'method'], 'runMetadata');
  requireThat(o.runMetadata.runId === null && o.runMetadata.prepioExecuted === false, 'inconsistent illustrative provenance');
  requireThat(typeof o.runMetadata.sourceCommit === 'string' && /^[a-f0-9]{40}$/.test(o.runMetadata.sourceCommit), 'runMetadata.sourceCommit must be full source-context SHA');
  date(o.runMetadata.createdAt, 'runMetadata.createdAt'); str(o.runMetadata.method, 'runMetadata.method');
  notAfterAsOf(o.runMetadata.createdAt, 'runMetadata.createdAt', ctx);
  ordered(s.capturedAt, o.runMetadata.createdAt, 'output predates source capture', { comparison: 'output createdAt >= source capturedAt', caseId: c.caseId, outputId: o.outputId }, ctx);
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
  // Deterministic rubric findings for a posting-only run. They are reported, not rejected:
  // a plan that overstates its evidence is a valid record with a quality finding.
  const deterministic = []; const stagePredictions = []; let resolvedCitations = 0;
  const flag = (path, type, rubricChecks, caps, reason) => deterministic.push({ caseId: c.caseId, outputId: o.outputId, path, type, rubricChecks, caps, reason });
  const claim = (v, path) => { str(v, path); targets.set(path, v); };
  const claims = (v, path) => arr(v, path).forEach((x, i) => claim(x, `${path}[${i}]`));
  const p = o.plan;
  shape(p, ['summary', 'assessmentSignals', 'stageRoadmap', 'prepPriorities', 'candidatePositioning', 'practiceSequence', 'questionPlan', 'internalEvidenceLog'], 'plan');
  shape(p.summary, ['company', 'roleName', 'industryFocus', 'level', 'overallConfidence', 'weakSignalCase'], 'summary');
  requireThat(p.summary.company === c.input.company && p.summary.roleName === c.input.role && p.summary.level === c.input.level, 'plan/input identity mismatch');
  requireThat(p.summary.industryFocus === 'tech', 'industryFocus must be tech for this London case'); member(p.summary.overallConfidence, PRIORITY, 'overallConfidence'); requireThat(typeof p.summary.weakSignalCase === 'boolean', 'weakSignalCase must be boolean');
  if (p.summary.overallConfidence !== 'low') flag('summary.overallConfidence', 'overall_confidence_exceeds_evidence', ['D5'], { handlingUncertainty: 1 }, 'Overall confidence is above low although the run holds no interview-process evidence (rubric D5).');
  if (!p.summary.weakSignalCase) flag('summary.weakSignalCase', 'weak_signal_not_declared', ['D5'], { handlingUncertainty: 1 }, 'A posting-only run is a weak-signal case and must say so (rubric D5).');
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
      requireThat(ledger.has(id), `unresolved citation ${id} at ${name}`); requireThat(!seen.has(id), `duplicate citation at ${name}`); seen.add(id); resolvedCitations += 1;
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
    // Phase A holds no interview ground truth, so every stage is a prediction from the role.
    stagePredictions.push({ caseId: c.caseId, outputId: o.outputId, path: base, basis: 'role_informed_prediction', verifiedInterviewHistory: false, confidence: v.confidence, citedEvidenceIds: v.evidenceIds });
    const caps = { evidenceGrounding: 1, handlingUncertainty: 1 };
    if (v.confidence !== 'low') flag(`${base}.confidence`, 'stage_confidence_exceeds_evidence', ['D4', 'D5'], caps, 'Stage confidence is above low although the run holds no interview-process evidence (rubric D4, D5).');
    if (v.evidenceIds.length) flag(`${base}.evidenceIds`, 'posting_cited_as_stage_evidence', ['D4', 'D5'], caps, 'The stage cites only the job posting. A posting describes the job, not the interview; the citation resolves but is not stage evidence (rubric D4, D5).');
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
  return { targets, deterministic, stagePredictions, resolvedCitations, registeredUrls: allowedUrls };
}

// Keyword screening over claim-bearing text. A hit asks for human review; a miss proves nothing.
function screen(targets, registeredUrls, jobDescription) {
  const registered = new Set([...registeredUrls].flatMap(u => { const x = new globalThis.URL(u); return [x.host, x.host + x.pathname, (x.host + x.pathname).replace(/\/$/, '')]; }));
  const frozen = flat(jobDescription); const hits = [];
  for (const [path, text] of targets) {
    const withoutHttp = text.replace(HTTP_URL, ' '); // http(s) URLs are already checked against the registry
    for (const reference of sortedUnique([...withoutHttp.matchAll(OTHER_REFERENCE)].map(m => m[0].replace(/[.,;:!?]+$/, '')))) {
      if (!registered.has(reference.toLowerCase())) hits.push({ path, signal: 'unregistered_source_reference', match: reference });
    }
    const prose = withoutHttp.replace(OTHER_REFERENCE, ' ');
    for (const [signal, pattern] of SCREENS) { const m = prose.match(pattern); if (m) hits.push({ path, signal, match: flat(m[0]) }); }
    for (const m of text.matchAll(/["“]([^"“”]+)["”]/g)) {
      const quoted = flat(m[1]);
      if (quoted.split(' ').length >= 6 && !frozen.includes(quoted)) { hits.push({ path, signal: 'unverified_quotation', match: quoted }); break; }
    }
  }
  return hits;
}

const annotationBasis = owner => owner.authorType === 'model' ? 'unverified_model_annotation' : owner.independence === 'independent' ? 'declared_independent_human_annotation' : 'unverified_non_independent_annotation';

function validateAnnotations(a, o, c, targets, passages, ctx) {
  shape(a, ['schemaVersion', 'caseId', 'variantId', 'outputId', 'outputSha256', 'rubricVersion', 'owner', 'judgments', 'humanScores', 'sha256'], 'annotations');
  requireThat(a.caseId === c.caseId && a.variantId === c.variantId && a.outputSha256 === o.sha256, 'annotation case/output hash binding mismatch');
  requireThat(a.rubricVersion === 'evidence-integrity-v1', 'unsupported annotation rubricVersion');
  shape(a.owner, ['id', 'authorType', 'independence', 'reviewedAt'], 'owner'); str(a.owner.id, 'owner.id'); date(a.owner.reviewedAt, 'owner.reviewedAt');
  notAfterAsOf(a.owner.reviewedAt, 'owner.reviewedAt', ctx);
  ordered(o.runMetadata.createdAt, a.owner.reviewedAt, 'annotation review predates output', { comparison: 'annotation reviewedAt >= output createdAt', caseId: c.caseId, outputId: o.outputId }, ctx);
  member(a.owner.authorType, ['human', 'model'], 'owner.authorType'); member(a.owner.independence, ['independent', 'same_author', 'unknown'], 'owner.independence');
  requireThat(a.owner.independence !== 'independent' || (a.owner.authorType === 'human' && idKey(a.owner.id) !== idKey(o.authoredBy)), 'invalid independence assertion');
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
    // Enforced on the plan path as well as the label, so relabelling a stage claim cannot make the posting support it.
    if (STAGE_CLAIM_PATH.test(j.path) || INTERVIEW_CLAIM_TYPES.includes(j.claimType)) requireThat(!['supported', 'contradicted'].includes(j.supportDecision), 'missing interview ground truth: job posting cannot establish or refute interview history');
    requireThat(!(j.presentation === 'factual' && j.supportDecision === 'not_applicable'), 'factual claim cannot use not_applicable');
  }
  for (const path of targets.keys()) requireThat(judgments.has(path), `unannotated claim-bearing path: ${path}`);
  const scores = new Set();
  for (const score of arr(a.humanScores, 'humanScores')) {
    shape(score, ['dimension', 'value', 'raterId', 'authorType', 'independence', 'reviewedAt', 'rubricVersion', 'reason'], 'human score');
    member(score.dimension, DIMENSIONS, 'human score dimension'); requireThat(Number.isInteger(score.value) && score.value >= 0 && score.value <= 4, 'human score must be an integer in 0–4');
    str(score.raterId, 'human score raterId'); date(score.reviewedAt, 'human score reviewedAt'); str(score.reason, 'human score reason');
    notAfterAsOf(score.reviewedAt, 'human score reviewedAt', ctx);
    ordered(o.runMetadata.createdAt, score.reviewedAt, 'human score review predates output', { comparison: 'human score reviewedAt >= output createdAt', caseId: c.caseId, outputId: o.outputId, raterId: score.raterId, dimension: score.dimension }, ctx);
    requireThat(score.authorType === 'human' && score.independence === 'independent' && score.rubricVersion === '0.3.0', 'human score needs declared independent human ownership and rubric 0.3.0');
    const key = `${score.dimension}:${idKey(score.raterId)}`; requireThat(!scores.has(key), 'duplicate human score'); scores.add(key);
  }
  // "Checked" support is limited to a claim of four or more words that appears verbatim in a cited frozen passage; everything else is the annotator's word.
  const verbatim = j => { const text = flat(targets.get(j.path)); return text.split(' ').length >= 4 && j.passageIds.some(id => flat(passages.get(id).text).includes(text)); };
  const supportBasis = j => !['supported', 'contradicted'].includes(j.supportDecision) ? 'not_claimed' : j.supportDecision === 'supported' && verbatim(j) ? 'verbatim_passage_match' : 'annotation_only';
  return [...judgments.values()].map(j => ({ caseId: c.caseId, outputId: o.outputId, annotationOwner: a.owner, annotationBasis: annotationBasis(a.owner), supportBasis: supportBasis(j), ...j }));
}

const na = reason => ({ status: 'N/A', value: null, reason });
function validateReviewerIdentities(cases, outputs, annotations) {
  const declarations = [];
  for (const c of cases.values()) for (const s of c.sourceRecords) {
    declarations.push({ id: s.sourceReview.authoredBy, type: s.sourceReview.authorType, record: `case ${c.caseId} source ${s.id} review` });
  }
  for (const a of annotations.values()) {
    declarations.push({ id: a.owner.id, type: a.owner.authorType, record: `output ${a.outputId} annotation owner` });
    for (const score of a.humanScores) declarations.push({ id: score.raterId, type: score.authorType, record: `output ${a.outputId} ${score.dimension} rating` });
  }
  const identities = new Map();
  declarations.sort((a, b) => compare(canonical(a), canonical(b)));
  for (const declaration of declarations) {
    const known = identities.get(idKey(declaration.id));
    requireThat(!known || known.type === declaration.type, `identity ${declaration.id}: conflicting model/human declarations: ${known?.record} (${known?.type}); ${declaration.record} (${declaration.type})`);
    if (!known) identities.set(idKey(declaration.id), declaration);
  }
  for (const a of [...annotations.values()].sort((a, b) => compare(a.outputId, b.outputId))) {
    const o = outputs.get(a.outputId);
    for (const score of [...a.humanScores].sort((a, b) => compare(canonical(a), canonical(b)))) {
      requireThat(idKey(score.raterId) !== idKey(o.authoredBy), `independence conflict: rater ${score.raterId} authored output ${o.outputId}`);
      requireThat(!(idKey(score.raterId) === idKey(a.owner.id) && a.owner.independence !== 'independent'), `independence conflict: rater ${score.raterId} is the annotation owner declaring ${a.owner.independence} for output ${o.outputId}`);
    }
  }
}

function humanAdjudicationIssues(records, findings, deterministic, warnings) {
  const groups = new Map();
  for (const score of records) {
    const key = canonical([score.outputId, score.dimension]);
    const group = groups.get(key) ?? []; group.push(score); groups.set(key, group);
  }
  const issues = []; const raters = scores => sortedUnique(scores.map(s => s.raterId));
  for (const scores of groups.values()) {
    const { outputId, dimension } = scores[0];
    const values = scores.map(s => s.value);
    if (Math.max(...values) - Math.min(...values) > 1) issues.push({
      type: 'rating_disagreement', dimension, outputId, raterIds: raters(scores), findingPaths: [],
      reason: 'Human ratings for the same output differ by more than one point; rubric requires adjudication. Raw ratings are retained.',
    });
    // Rubric caps from deterministic plan findings (D4: EG ≤ 1; D5: HU ≤ 1).
    const capping = deterministic.filter(f => f.outputId === outputId && Object.hasOwn(f.caps, dimension));
    const cap = Math.min(...capping.map(f => f.caps[dimension])); const overCap = scores.filter(s => s.value > cap);
    if (overCap.length) issues.push({
      type: 'rating_exceeds_rubric_cap', dimension, outputId, cap, raterIds: raters(overCap), findingPaths: sortedUnique(capping.map(f => f.path)),
      reason: `Ratings exceed the rubric cap of ${cap} set by deterministic plan findings; rubric requires adjudication. Raw ratings and findings are retained.`,
    });
    if (dimension !== 'evidenceGrounding') continue;
    // Any annotated finding counts, whoever owns the annotation: an unverified finding is an
    // unresolved conflict to adjudicate, and is reported as such rather than as confirmation.
    const exceeds = (s, f) => s.value > FINDING_POLICY[f.type].maxGrounding;
    for (const severity of ['critical', 'minor']) {
      const conflicting = findings.filter(f => f.outputId === outputId && f.severity === severity && scores.some(s => exceeds(s, f)));
      if (!conflicting.length) continue;
      const bases = sortedUnique(conflicting.map(f => f.annotationBasis));
      issues.push({
        type: 'grounding_finding_conflict', severity, findingBasis: bases, dimension, outputId,
        raterIds: raters(scores.filter(s => conflicting.some(f => exceeds(s, f)))), findingPaths: sortedUnique(conflicting.map(f => f.path)),
        reason: `${severity === 'critical'
          ? 'Evidence-grounding ratings above the rubric ceiling conflict with a critical factual-grounding finding (unsupported factual interview history or a contradicted employer-specific claim)'
          : 'Evidence-grounding ratings of 3 or 4 conflict with a minor finding of an unsupported factual claim'}; rubric requires adjudication. Raw ratings and findings are retained. ${bases.every(b => b === 'declared_independent_human_annotation')
          ? 'Finding basis: declared independent human annotation.'
          : 'Finding basis includes an unverified annotation: this is an unresolved conflict, not a human confirmation.'}`,
      });
    }
    const unreviewed = warnings.filter(w => w.outputId === outputId && w.review === 'unreviewed'); const high = scores.filter(s => s.value >= 3);
    if (unreviewed.length && high.length) issues.push({
      type: 'unreviewed_screening_signal', dimension, outputId, raterIds: raters(high), findingPaths: sortedUnique(unreviewed.map(w => w.path)),
      reason: 'Evidence-grounding ratings of 3 or 4 coexist with a screening signal that no declared independent human has judged. A screening signal is a keyword match, not semantic proof; it needs human adjudication. Raw ratings are retained.',
    });
  }
  return issues.sort((a, b) => compare(canonical(a), canonical(b)));
}

const mean = values => values.reduce((sum, v) => sum + v, 0) / values.length;
// A trusted aggregate needs two declared independent human raters for every eligible output.
// Ratings carried in a model-owned snapshot are kept as raw records but are not counted.
function humanCoverage(records, issues, outputs) {
  const eligible = records.filter(s => s.custody === 'human_owned_snapshot');
  const cell = (o, dimension) => {
    const all = records.filter(s => s.outputId === o.outputId && s.dimension === dimension); const counted = eligible.filter(s => all.includes(s));
    const disputed = issues.some(issue => issue.outputId === o.outputId && issue.dimension === dimension);
    const eligibleRaters = new Set(counted.map(s => idKey(s.raterId))).size;
    const status = disputed ? 'requires_adjudication' : eligibleRaters < REQUIRED_RATERS ? 'N/A' : 'descriptive_only';
    return { caseId: o.caseId, outputId: o.outputId, dimension, ratings: all.length, eligibleRaters, status, value: status === 'descriptive_only' ? mean(counted.map(s => s.value)) : null };
  };
  const scores = Object.fromEntries(DIMENSIONS.map(dimension => {
    const count = records.filter(s => s.dimension === dimension).length;
    if (!count) return [dimension, { ...na('No independent human ratings supplied.'), count: 0 }];
    const dimensionIssues = issues.filter(issue => issue.dimension === dimension);
    const disputed = sortedUnique(dimensionIssues.map(issue => issue.outputId));
    if (disputed.length) return [dimension, { status: 'requires_adjudication', value: null, count, disputedOutputs: disputed, reason: sortedUnique(dimensionIssues.map(issue => issue.reason)).join(' ') }];
    const cells = outputs.map(o => cell(o, dimension));
    const missing = cells.filter(c => c.eligibleRaters < REQUIRED_RATERS).map(({ caseId, outputId, eligibleRaters }) => ({ caseId, outputId, eligibleRaters }));
    if (missing.length) return [dimension, {
      ...na(`Incomplete coverage: a trusted aggregate needs two declared independent human raters for every eligible output.${records.some(s => s.dimension === dimension && s.custody === 'model_owned_snapshot') ? ' Ratings carried in a model-owned snapshot are retained but not counted as human ratings.' : ''}`),
      count, eligibleOutputs: outputs.length, coveredOutputs: outputs.length - missing.length, missing,
    }];
    // Outputs weigh equally, so an output with more raters cannot dominate the mean.
    return [dimension, { status: 'descriptive_only', count, value: mean(cells.map(c => c.value)) }];
  }));
  const perOutput = outputs.flatMap(o => DIMENSIONS.map(dimension => cell(o, dimension))).filter(c => c.ratings > 0)
    .sort((a, b) => compare(canonical([a.outputId, a.dimension]), canonical([b.outputId, b.dimension])));
  const coverage = {
    eligibleOutputs: outputs.length,
    unratedOutputs: outputs.filter(o => !eligible.some(s => s.outputId === o.outputId)).map(o => ({ caseId: o.caseId, outputId: o.outputId })),
    unratedDimensions: DIMENSIONS.filter(dimension => !eligible.some(s => s.dimension === dimension)).sort(compare),
  };
  const status = !records.length ? 'N/A' : issues.length ? 'requires_adjudication' : Object.values(scores).some(s => s.status !== 'descriptive_only') ? 'incomplete_coverage' : 'declared_human_ratings';
  return { status, scores, coverage, perOutput };
}
export function evaluate(dataset, options = {}) {
  return evaluateRecords(dataset, requireBundledArtifacts().provenance, asOfOption(options));
}

function evaluateRecords(dataset, evaluator, asOf) {
  const d = normalize(dataset); shape(d, ['cases', 'outputs', 'annotations'], 'dataset');
  const cases = unique(d.cases, 'caseId', 'caseId'); requireThat(cases.size > 0, 'empty evaluation corpus');
  const outputs = unique(d.outputs, 'outputId', 'outputId'); const annotations = unique(d.annotations, 'outputId', 'annotation outputId');
  const byCase = unique(d.outputs, 'caseId', 'output caseId');
  for (const o of outputs.values()) requireThat(cases.has(o.caseId), `unknown case: ${o.caseId}`);
  for (const id of cases.keys()) requireThat(byCase.has(id), `missing output for ${id}`);
  for (const a of annotations.values()) requireThat(outputs.has(a.outputId), `unknown output: ${a.outputId}`);
  const ctx = { asOf, chronologyNotes: [] };
  const judgments = []; const findings = []; const allScores = []; const deterministicFindings = []; const stagePredictions = []; const screeningWarnings = [];
  let resolvedCitations = 0;
  for (const c of [...cases.values()].sort((a, b) => compare(a.caseId, b.caseId))) {
    checkHash(c, 'case'); const { source, passages } = validateCase(c, evaluator, ctx);
    const o = byCase.get(c.caseId); requireThat(o, `missing output for ${c.caseId}`); checkHash(o, 'output');
    const plan = validatePlan(o, c, source, ctx);
    const a = annotations.get(o.outputId); requireThat(a, `missing annotations for ${o.outputId}`); checkHash(a, 'annotations');
    judgments.push(...validateAnnotations(a, o, c, plan.targets, passages, ctx));
    deterministicFindings.push(...plan.deterministic); stagePredictions.push(...plan.stagePredictions); resolvedCitations += plan.resolvedCitations;
    screeningWarnings.push(...screen(plan.targets, plan.registeredUrls, c.input.jobDescription).map(hit => ({ caseId: c.caseId, outputId: o.outputId, ...hit })));
    // Custody is the snapshot owner's declared type: a model-owned record cannot vouch for human ratings.
    allScores.push(...a.humanScores.map(score => ({ caseId: c.caseId, outputId: o.outputId, custody: a.owner.authorType === 'model' ? 'model_owned_snapshot' : 'human_owned_snapshot', ...score })));
  }
  validateReviewerIdentities(cases, outputs, annotations);
  const byPath = (a, b) => compare(canonical([a.caseId, a.path, a.type ?? a.signal ?? '']), canonical([b.caseId, b.path, b.type ?? b.signal ?? '']));
  judgments.sort(byPath); deterministicFindings.sort(byPath); stagePredictions.sort(byPath);
  for (const j of judgments) {
    let type;
    if (j.supportDecision === 'contradicted') type = 'contradicted_claim';
    else if (j.presentation === 'factual' && j.supportDecision === 'insufficient_evidence') type = STAGE_CLAIM_PATH.test(j.path) || INTERVIEW_CLAIM_TYPES.includes(j.claimType) ? 'unsupported_interview_history' : 'unsupported_claim';
    if (type) findings.push({ caseId: j.caseId, outputId: j.outputId, path: j.path, type, severity: FINDING_POLICY[type].severity, annotationBasis: j.annotationBasis, annotationOwner: j.annotationOwner, reason: j.reason });
  }
  for (const w of screeningWarnings) {
    const judgment = judgments.find(j => j.outputId === w.outputId && j.path === w.path);
    w.review = findings.some(f => f.outputId === w.outputId && f.path === w.path) ? 'covered_by_finding'
      : judgment.annotationBasis === 'declared_independent_human_annotation' ? 'reviewed_by_declared_independent_human' : 'unreviewed';
  }
  screeningWarnings.sort(byPath);
  const metricReason = 'Phase A is illustrative; no actual Prepio execution, verified interview ground truth, or execution telemetry.';
  const adjudicationIssues = humanAdjudicationIssues(allScores, findings, deterministicFindings, screeningWarnings);
  const sortBy = (values, field) => [...values].sort((a, b) => compare(a[field], b[field]));
  const human = humanCoverage(allScores, adjudicationIssues, sortBy(outputs.values(), 'outputId'));
  const bases = sortedUnique([...annotations.values()].map(a => annotationBasis(a.owner)));
  const supported = judgments.filter(j => j.presentation === 'factual' && j.supportDecision === 'supported');
  return normalize({
    schemaVersion: 3, status: 'evaluated', claimLevel: 'illustrative', reportTitle: 'Illustrative OpenAI evidence-integrity report — DEMONSTRATION_ONLY',
    checks: {
      hashAndCaseIdentity: 'pass', planReferenceIntegrity: 'pass', labelTargetIntegrity: 'pass', sourceHashInternalConsistency: 'pass',
      sourceAuthenticity: 'not_evaluated', semanticClaimSupport: 'not_evaluated',
      chronology: ctx.chronologyNotes.length ? 'date_precision_only' : 'pass', futureDates: asOf === null ? 'not_evaluated' : 'pass',
    },
    checkScope: {
      planReferenceIntegrity: 'Reference existence: every cited evidence, passage and plan-path ID resolves to a supplied record. A resolved reference does not establish that the source supports the claim.',
      sourceHashInternalConsistency: 'Internal consistency only: the supplied records match the hashes stored beside them. Anyone who edits a record can reseal it, so this is not source authentication.',
      sourceAuthenticity: 'Not evaluated: original captures are not bundled and nothing is fetched.',
      semanticClaimSupport: 'Not evaluated by the scorer: whether evidence supports a claim comes only from annotations, whose basis is reported under semanticReview.',
      chronology: 'Timestamps are compared at full precision. date_precision_only means a date-only value left a same-day order unverifiable; see chronologyNotes.',
      futureDates: 'Record dates are checked against the supplied as-of timestamp only; the scorer never reads the clock.',
    },
    chronologyNotes: ctx.chronologyNotes.sort((a, b) => compare(canonical(a), canonical(b))),
    semanticReview: {
      basis: bases.length === 1 ? bases[0] : 'mixed',
      verification: 'Annotation ownership is self-declared metadata. The scorer verifies only verbatim passage matches; every other support decision is the annotator\'s unverified judgment.',
      outputs: sortBy(annotations.values(), 'outputId').map(a => ({ outputId: a.outputId, annotationBasis: annotationBasis(a.owner) })),
    },
    counts: {
      cases: cases.size, outputs: outputs.size, annotatedClaimPaths: judgments.length,
      annotationSupportedClaims: supported.length, verbatimCheckedSupportedClaims: supported.filter(j => j.supportBasis === 'verbatim_passage_match').length,
      unresolvedClaimPaths: judgments.filter(j => j.presentation === 'ambiguous').length,
      findings: findings.length, criticalFindings: findings.filter(f => f.severity === 'critical').length, minorFindings: findings.filter(f => f.severity === 'minor').length,
      deterministicFindings: deterministicFindings.length, screeningWarnings: screeningWarnings.length, unreviewedScreeningWarnings: screeningWarnings.filter(w => w.review === 'unreviewed').length,
      resolvedCitations, roleInformedPredictedStages: stagePredictions.length, externallyVerifiedInterviewStages: 0,
    },
    findings, deterministicFindings, screeningWarnings, stagePredictions, judgments,
    metrics: Object.fromEntries(['top5HitRate', 'citationPrecision', 'stageAccuracy', 'degradedRunRate', 'latency', 'tokens', 'estimatedCost', 'tavilyUsage'].map(k => [k, na(metricReason)])),
    humanReview: {
      status: human.status, verification: 'Ownership is declared metadata; the evaluator cannot authenticate raters or verify semantic judgments.',
      identityVerification: 'self_declared_unauthenticated', requiredIndependentRatersPerOutput: REQUIRED_RATERS, scope: 'illustrative_excerpt_only',
      scores: human.scores, coverage: human.coverage, perOutput: human.perOutput, adjudicationIssues, records: allScores.sort((a, b) => compare(canonical(a), canonical(b))),
    },
    provenance: {
      evaluator, evaluation: { asOf },
      cases: sortBy(cases.values(), 'caseId').map(c => ({ caseId: c.caseId, variantId: c.variantId, fixtureVersion: c.fixtureVersion, sha256: c.sha256, jobDescriptionSha256: c.jobDescriptionSha256, lineage: c.lineage, sourceRecords: c.sourceRecords })),
      outputs: sortBy(outputs.values(), 'outputId').map(({ plan: _plan, ...o }) => o),
      annotations: sortBy(annotations.values(), 'outputId').map(({ judgments: _judgments, humanScores: _scores, ...a }) => a),
    },
    limitations: [
      'Counts reflect supplied annotations on a constructed example, not measured model performance.',
      'Source hashes establish internal consistency of the frozen excerpt, not source authenticity or currentness. A fabricated passage that is resealed into a case is not detected. Original capture hashes are lineage only; original full captures are not bundled.',
      'No independent human source verification, reviewer calibration, real Prepio run, baseline, quality gate, or production measurement is established.',
      'Annotator and rater identities are self-declared and unauthenticated; "declared independent human" is provenance metadata, not proof. Exact-match aliases are normalised; other aliases are not detected.',
      'Screening warnings are keyword heuristics over English prose. A hit is a prompt for human review; a miss is not evidence that a claim is supported.',
      'Corpus selection is not enforced: duplicate or cherry-picked cases are counted as supplied. Human ratings describe an illustrative excerpt only.',
      'Phase A accepts this London JD-only excerpt contract; full captured plans and the broader seven-run suite are outside this harness.',
    ],
  });
}

const md = value => String(value).replace(/[|`\\]/g, '\\$&').replace(/\r?\n/g, ' ');
const list = (items, render) => items.map(render).join('\n') || '- None';
export function markdown(r) {
  const c = r.counts; const h = r.humanReview;
  const scoreCell = v => v.status === 'requires_adjudication' ? 'N/A (requires adjudication)' : v.status === 'N/A' && v.count ? 'N/A (incomplete coverage)' : v.value ?? 'N/A';
  return `# ${r.reportTitle}

Status: ${r.status}. Record and reference integrity checks passed. Semantic claim support was not verified by the evaluator; findings rest on annotations (basis: ${r.semanticReview.basis}).

${c.cases} case(s); ${c.annotatedClaimPaths} annotated claim paths; ${c.findings} finding(s) from annotations (${c.criticalFindings} critical, ${c.minorFindings} minor); ${c.deterministicFindings} deterministic rubric finding(s); ${c.screeningWarnings} screening warning(s), ${c.unreviewedScreeningWarnings} unreviewed; ${c.unresolvedClaimPaths} unresolved (ambiguous) claim path(s). Counts reflect annotations, not verified model quality.

${r.provenance.cases.map(x => `Case: ${md(x.caseId)} / ${md(x.variantId)}; snapshot ${x.sha256}.`).join('\n')}

${r.provenance.outputs.map(o => `Output: ${md(o.outputId)}; authored by ${md(o.authoredBy)}; Prepio executed: false.\n\nSource-context commit: ${o.runMetadata.sourceCommit} (not an execution trace).`).join('\n')}

${r.provenance.annotations.map(a => `Annotation owner: ${md(a.owner.id)}; ${a.owner.authorType}; independence: ${a.owner.independence}; reviewed ${a.owner.reviewedAt}. Identity is self-declared.`).join('\n')}

Evaluation as-of: ${r.provenance.evaluation.asOf ?? 'not supplied (future-date check not evaluated)'}.

Scorer SHA-256 (raw bytes): ${r.provenance.evaluator.scorerSha256}.

Rubric ${r.provenance.evaluator.rubricVersion} SHA-256 (raw bytes): ${r.provenance.evaluator.rubricSha256}.

| Check | Result |
|---|---|
| Reference existence (${c.resolvedCitations} citation(s) resolve) | ${r.checks.planReferenceIntegrity} |
| Source hash internal consistency | ${r.checks.sourceHashInternalConsistency} |
| Source authenticity | ${r.checks.sourceAuthenticity} |
| Semantic claim support | ${r.checks.semanticClaimSupport} |
| Chronology | ${r.checks.chronology} |
| Future dates | ${r.checks.futureDates} |

A resolved reference shows that the cited record exists; it does not establish that the source supports the claim. Source hashes show internal consistency of the supplied records, not authenticity. Of ${c.annotationSupportedClaims} factual claim(s) annotated as supported, ${c.verbatimCheckedSupportedClaims} appear verbatim in a cited passage; any others depend on the annotation alone.

Chronology notes (orders a date-only value leaves unverifiable):

${list(r.chronologyNotes, n => `- ${md(n.comparison)}: ${md(n.reason)}`)}

Findings from annotations:

${list(r.findings, f => `- ${md(f.caseId)} / ${md(f.path)}: ${f.type} [${f.severity}; ${f.annotationBasis}] (${md(f.reason)})`)}

Deterministic rubric findings:

${list(r.deterministicFindings, f => `- ${md(f.caseId)} / ${md(f.path)}: ${f.type}; rubric ${f.rubricChecks.join(', ')}; caps ${Object.entries(f.caps).map(([k, v]) => `${k} at most ${v}`).join(', ')}. ${md(f.reason)}`)}

Screening warnings (keyword matches for human review, not semantic proof):

${list(r.screeningWarnings, w => `- ${md(w.caseId)} / ${md(w.path)}: ${w.signal} on "${md(w.match)}"; ${w.review}`)}

Stages: ${c.roleInformedPredictedStages} role-informed predicted stage(s); ${c.externallyVerifiedInterviewStages} externally verified interview-history stage(s). No interview ground truth is supplied, so no stage is verified history.

| Performance metric | Value |
|---|---|
${Object.keys(r.metrics).map(k => `| ${k} | N/A |`).join('\n')}

No actual Prepio run, verified interview ground truth or execution telemetry is supplied.

| Human dimension | Descriptive score on an illustrative excerpt (0–4) | Ratings |
|---|---:|---:|
${Object.entries(h.scores).map(([k, v]) => `| ${k} | ${scoreCell(v)} | ${v.count} |`).join('\n')}

Human review status: ${h.status}. An aggregate needs ${h.requiredIndependentRatersPerOutput} declared independent human raters for every eligible output; rater identity is self-declared and unauthenticated.

Missing coverage:

${list(Object.entries(h.scores).flatMap(([k, v]) => (v.missing ?? []).map(m => `- ${k}: ${md(m.caseId)} / ${md(m.outputId)} has ${m.eligibleRaters} eligible rater(s)`)), x => x)}

Adjudication issues:

${list(h.adjudicationIssues, issue => `- ${md(issue.outputId)} / ${issue.dimension}; ${issue.type}; raters: ${issue.raterIds.map(md).join(', ')}; finding paths: ${issue.findingPaths.map(md).join(', ') || 'none'}. ${md(issue.reason)}`)}

${h.verification}

${r.limitations.map(x => `- ${x}`).join('\n')}
`;
}

async function main(args) {
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]; requireThat(['--case', '--output', '--labels', '--out', '--as-of'].includes(key), `Unknown option ${key}`);
    requireThat(!Object.hasOwn(options, key), `Repeated option ${key}`); str(args[i + 1], key);
    requireThat(!args[i + 1].startsWith('--'), `Missing value for ${key}`); options[key] = key === '--as-of' ? args[i + 1] : resolve(args[i + 1]);
  }
  requireThat(['--case', '--output', '--labels', '--out'].every(key => Object.hasOwn(options, key)), 'Usage: node score.mjs --case CASE.json --output OUTPUT.json --labels LABELS.json --out NEW_DIRECTORY [--as-of YYYY-MM-DDTHH:MM:SSZ]');
  const load = async path => {
    try {
      const bytes = await readFile(path); const parsed = JSON.parse(bytes.toString('utf8'));
      return { bytes, records: Array.isArray(parsed) ? parsed : [parsed] };
    } catch (e) { fail(`Cannot read JSON ${basename(path)}: ${e.code ?? 'invalid JSON'}`); }
  };
  const [cases, outputs, annotations] = await Promise.all([load(options['--case']), load(options['--output']), load(options['--labels'])]);
  const result = evaluate({ cases: cases.records, outputs: outputs.records, annotations: annotations.records }, { asOf: options['--as-of'] });
  const json = `${JSON.stringify(result, null, 2)}\n`; const summary = markdown(result);
  const bundle = requireBundledArtifacts();
  // A new directory and exclusive files prevent overwrite through aliases/symlinks.
  await mkdir(options['--out']);
  await mkdir(resolve(options['--out'], 'inputs'));
  for (const [name, bytes] of [['inputs/cases.json', cases.bytes], ['inputs/outputs.json', outputs.bytes], ['inputs/annotations.json', annotations.bytes], ['score.mjs', bundle.scorer], ['rubric.v0.3.0.md', bundle.rubric]]) {
    await writeFile(resolve(options['--out'], name), bytes, { flag: 'wx' });
  }
  await writeFile(resolve(options['--out'], 'results.json'), json, { flag: 'wx' });
  await writeFile(resolve(options['--out'], 'summary.md'), summary, { flag: 'wx' });
  process.stdout.write(summary);
}
function isDirectInvocation() {
  try { return !!process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url); }
  catch { return false; } // Imported modules may run under virtual entry points.
}
if (isDirectInvocation()) {
  try { await main(process.argv.slice(2)); }
  catch (error) { process.stderr.write(`${JSON.stringify({ status: 'error', message: error.message })}\n`); process.exitCode = 2; }
}
