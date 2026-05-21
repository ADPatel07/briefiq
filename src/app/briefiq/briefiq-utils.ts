import type {
  AnswerRecord,
  BriefAnalysis,
  ConfidenceScore,
  FollowUpQuestion,
  LiveSummary,
  PrdRequest,
  ProjectPrd,
} from './briefiq.models';

const unsurePatterns = [
  /^$/,
  /^not sure\.?$/,
  /^unsure\.?$/,
  /^i'?m not sure\.?$/,
  /^i do not know\.?$/,
  /^i don't know\.?$/,
  /^you decide\.?$/,
  /^up to you\.?$/,
  /^whatever you think\.?$/,
  /^no idea\.?$/,
];

const sectionLabels = {
  clientClarifications: 'Clarify With Client Before Implementation',
  projectSummary: 'Project Summary',
  targetUsersAndRoles: 'Target Users and Roles',
  coreFeatures: 'Core Features',
  mvpScope: 'MVP Scope',
  outOfScope: 'Out of Scope',
  keyAssumptions: 'Key Assumptions',
  effortAndComplexity: 'Key Scoping Factors',
  suggestedNextSteps: 'Suggested Next Steps',
};

const maxConfidenceScore = 95;
const clientClarificationPenalty = 4;
const requiredClientClarifications = [
  'Confirm final MVP scope and acceptance criteria with the client before implementation.',
  'Confirm timeline, budget, and approval owner before starting the build.',
];

export function isSkippedAnswer(answer: string): boolean {
  const normalized = answer.trim().toLowerCase();
  return unsurePatterns.some((pattern) => pattern.test(normalized));
}

export function isBriefTooShort(brief: string): boolean {
  const normalized = brief.trim().toLowerCase();
  const words = normalized.match(/[a-z0-9]+/g) ?? [];
  const vagueBriefs = new Set([
    'i need an app',
    'need an app',
    'make an app',
    'build an app',
    'i need a website',
    'need a website',
    'make a website',
    'build a website',
  ]);

  return words.length < 6 || vagueBriefs.has(normalized.replace(/[.!?]+$/, ''));
}

export function createTooShortAnalysis(brief: string): BriefAnalysis {
  const trimmedBrief = brief.trim();

  return {
    canStart: false,
    message:
      'This brief is too short to generate useful follow-up questions. Add the product idea, audience, and one or two expected features.',
    projectName: 'Untitled Project',
    projectType: 'Unknown',
    knownFacts: trimmedBrief ? [trimmedBrief] : [],
    missingAreas: ['Product goal', 'Target users', 'Core features'],
    summary: createEmptySummary('Unknown', 'Untitled Project'),
    questions: [],
    firstQuestion: null,
  };
}

export function createEmptySummary(
  projectType = 'Unknown',
  projectName = 'Untitled Project',
): LiveSummary {
  return {
    projectName,
    projectType,
    knownFacts: [],
    likelyFeatures: [],
    missingDetails: [],
    assumptions: [],
    openQuestions: [],
  };
}

export function normalizeAnswerRecord(
  question: FollowUpQuestion,
  rawAnswer: string,
  assumption = '',
): AnswerRecord {
  const answer = rawAnswer.trim();
  const wasSkipped = isSkippedAnswer(answer);

  return {
    questionId: question.id,
    question: question.question,
    answer,
    wasSkipped,
    assumption: wasSkipped
      ? assumption || `Assumed a sensible default for: ${question.question}`
      : assumption,
  };
}

export function calculateConfidence(
  totalQuestions: number,
  answers: AnswerRecord[],
  assumptions: string[],
  openQuestions: string[],
  clientClarifications: string[] = [],
): ConfidenceScore {
  const safeTotal = Math.max(totalQuestions, answers.length, 1);
  const skippedQuestions = answers.filter((answer) => answer.wasSkipped).length;
  const unansweredQuestions = Math.max(safeTotal - answers.length, 0);
  const clientClarificationCount = clientClarifications.length;
  const rawScore =
    100 -
    (unansweredQuestions / safeTotal) * 25 -
    (skippedQuestions / safeTotal) * 35 -
    assumptions.length * 7 -
    openQuestions.length * 6 -
    clientClarificationCount * clientClarificationPenalty;
  const score = Math.max(0, Math.min(maxConfidenceScore, Math.round(rawScore)));
  const answeredQuestions = Math.max(answers.length - skippedQuestions, 0);

  const explanation =
    unansweredQuestions > 0
      ? `${answeredQuestions} of ${safeTotal} questions were answered; ${unansweredQuestions} still need input before PRD generation.`
      : clientClarificationCount > 0
        ? `${answeredQuestions} of ${safeTotal} questions were answered; ${clientClarificationCount} before-implementation clarifications still need client sign-off.`
        : skippedQuestions === 0 && assumptions.length === 0 && openQuestions.length === 0
          ? 'All follow-up questions were answered; final client sign-off is still required before implementation.'
          : `${answeredQuestions} of ${safeTotal} questions were answered; ${assumptions.length} assumptions and ${openQuestions.length} client clarifications remain.`;

  return { score, explanation };
}

export function buildFallbackPrd(request: PrdRequest): ProjectPrd {
  const totalQuestions =
    request.analysis.firstQuestion?.totalQuestions || Math.max(request.answers.length, 1);
  const clientClarifications = buildClientClarifications(request);
  const confidenceScore = calculateConfidence(
    totalQuestions,
    request.answers,
    request.assumptions,
    request.openQuestions,
    clientClarifications,
  );
  const summary = request.summary;

  return {
    projectName: summary.projectName || request.analysis.projectName || 'Client Project',
    sections: {
      clientClarifications,
      projectSummary: toBullets([
        ...summary.knownFacts,
        `${summary.projectType || request.analysis.projectType} project based on the supplied client brief.`,
      ]),
      targetUsersAndRoles: toBullets(
        summary.knownFacts.filter((fact) => /user|customer|client|admin|role/i.test(fact)),
        ['Primary users from the client brief', 'Freelancer or admin role as needed'],
      ),
      coreFeatures: toBullets(summary.likelyFeatures, ['Core workflow from the brief']),
      mvpScope: toBullets(summary.likelyFeatures, ['Validate the primary user workflow']),
      outOfScope: ['User accounts beyond MVP needs', 'Native mobile apps', 'Team collaboration'],
      keyAssumptions: toBullets(request.assumptions, ['Scope should stay focused on MVP delivery']),
      openQuestions: toBullets(request.openQuestions, ['Timeline and budget need confirmation']),
      effortAndComplexity: {
        complexity: summary.likelyFeatures.length > 5 ? 'High' : 'Medium',
        timeline: '4-6 weeks',
        reasons: toBullets(
          [
            `${summary.likelyFeatures.length || 1} core feature areas need implementation`,
            `${request.openQuestions.length} open questions remain`,
            `${request.assumptions.length} assumptions may affect scope`,
          ],
          ['MVP scope needs confirmation'],
        ).slice(0, 3),
      },
      confidenceScore,
      suggestedNextSteps: [
        'Convert approved MVP scope into a sprint backlog',
        'Estimate implementation tasks and milestones',
        'Start with the highest-risk workflow first',
      ],
    },
  };
}

export function formatPrdReadme(prd: ProjectPrd): string {
  const { sections } = prd;

  return [
    `# Verified MVP Specification: ${prd.projectName}`,
    [
      '## Build Readiness',
      `- Confidence: ${sections.confidenceScore.score}%`,
      `- Rationale: ${sections.confidenceScore.explanation}`,
      `- Complexity: ${sections.effortAndComplexity.complexity}`,
      `- Estimated timeline: ${sections.effortAndComplexity.timeline}`,
    ].join('\n'),
    formatBulletSection(sectionLabels.clientClarifications, sections.clientClarifications),
    formatBulletSection(sectionLabels.projectSummary, sections.projectSummary),
    formatBulletSection(sectionLabels.targetUsersAndRoles, sections.targetUsersAndRoles),
    formatBulletSection(sectionLabels.coreFeatures, sections.coreFeatures),
    formatBulletSection(sectionLabels.mvpScope, sections.mvpScope),
    formatBulletSection(sectionLabels.outOfScope, sections.outOfScope),
    formatBulletSection(sectionLabels.keyAssumptions, sections.keyAssumptions),
    formatBulletSection(sectionLabels.effortAndComplexity, sections.effortAndComplexity.reasons),
    formatBulletSection(sectionLabels.suggestedNextSteps, sections.suggestedNextSteps),
  ].join('\n\n');
}

export function formatPrdMarkdown(prd: ProjectPrd): string {
  return formatPrdReadme(prd);
}

export function formatPrdPrintableHtml(prd: ProjectPrd): string {
  const { sections } = prd;
  const title = escapeHtml(`${prd.projectName} MVP Specification`);

  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    `<title>${title}</title>`,
    '<style>',
    'body{margin:0;background:#f4f4f5;color:#18181b;font-family:Arial,sans-serif;line-height:1.55;}',
    'main{max-width:860px;margin:0 auto;padding:40px 32px;background:#fff;min-height:100vh;}',
    'h1{font-size:28px;line-height:1.15;margin:0;color:#09090b;}',
    'h2{font-size:17px;margin:28px 0 10px;color:#18181b;}',
    'p{margin:8px 0;color:#3f3f46;}',
    'ul{margin:8px 0 0;padding-left:20px;}',
    'li{margin:6px 0;color:#3f3f46;}',
    '.eyebrow{font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:#71717a;font-weight:700;margin-bottom:8px;}',
    '.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:24px 0;}',
    '.metric{border:1px solid #e4e4e7;border-radius:8px;padding:14px;background:#fafafa;}',
    '.label{font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#71717a;font-weight:700;}',
    '.value{display:block;margin-top:6px;font-size:22px;font-weight:700;color:#09090b;}',
    '.section{border-top:1px solid #e4e4e7;margin-top:24px;padding-top:4px;}',
    '.callout{border:1px solid #f59e0b;background:#fffbeb;border-radius:8px;padding:14px 18px;}',
    '@media print{body{background:#fff;}main{padding:0;max-width:none;}button{display:none;}@page{margin:18mm;}}',
    '</style>',
    '</head>',
    '<body>',
    '<main>',
    '<div class="eyebrow">Verified MVP Specification</div>',
    `<h1>${escapeHtml(prd.projectName)}</h1>`,
    '<p>Professional build handoff with scope, decisions, assumptions, and client sign-off items in one place.</p>',
    '<div class="grid">',
    formatMetric('Confidence', `${sections.confidenceScore.score}%`),
    formatMetric('Complexity', sections.effortAndComplexity.complexity),
    formatMetric('Timeline', sections.effortAndComplexity.timeline),
    '</div>',
    `<p><strong>Why:</strong> ${escapeHtml(sections.confidenceScore.explanation)}</p>`,
    '<section class="section callout">',
    '<h2>Clarify With Client Before Implementation</h2>',
    formatHtmlList(sections.clientClarifications),
    '</section>',
    formatHtmlSection(sectionLabels.projectSummary, sections.projectSummary),
    formatHtmlSection(sectionLabels.targetUsersAndRoles, sections.targetUsersAndRoles),
    formatHtmlSection(sectionLabels.coreFeatures, sections.coreFeatures),
    formatHtmlSection(sectionLabels.mvpScope, sections.mvpScope),
    formatHtmlSection(sectionLabels.outOfScope, sections.outOfScope),
    formatHtmlSection(sectionLabels.keyAssumptions, sections.keyAssumptions),
    formatHtmlSection(sectionLabels.effortAndComplexity, sections.effortAndComplexity.reasons),
    formatHtmlSection(sectionLabels.suggestedNextSteps, sections.suggestedNextSteps),
    '</main>',
    '</body>',
    '</html>',
  ].join('');
}

export function sanitizeFileName(name: string): string {
  const sanitized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return sanitized || 'client-project';
}

export function toBullets(items: string[], fallback: string[] = ['To be confirmed']): string[] {
  const bullets = items
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.replace(/^[-*]\s+/, ''));

  return bullets.length > 0 ? bullets.slice(0, 8) : fallback;
}

function buildClientClarifications(request: PrdRequest): string[] {
  const openQuestions = request.openQuestions.map((question) => `Confirm: ${question}`);
  const assumptions = request.assumptions.map((assumption) => `Validate assumption: ${assumption}`);

  return ensureClientClarifications([...openQuestions, ...assumptions]);
}

export function ensureClientClarifications(items: string[]): string[] {
  return uniqueBullets(
    toBullets([...items, ...requiredClientClarifications], requiredClientClarifications),
  ).slice(0, 6);
}

export function applyClientClarificationPenalty(
  confidenceScore: ConfidenceScore,
  clientClarifications: string[],
): ConfidenceScore {
  if (clientClarifications.length === 0) {
    return confidenceScore;
  }

  const maxScoreFromClarifications = Math.max(
    0,
    100 - clientClarifications.length * clientClarificationPenalty,
  );
  const score = Math.min(confidenceScore.score, maxScoreFromClarifications);
  const answeredPrefix = confidenceScore.explanation.match(
    /\d+ of \d+ questions were answered/,
  )?.[0];

  return {
    score,
    explanation: answeredPrefix
      ? `${answeredPrefix}; ${clientClarifications.length} before-implementation clarifications still need client sign-off.`
      : `${clientClarifications.length} before-implementation clarifications still need client sign-off.`,
  };
}

function uniqueBullets(items: string[]): string[] {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = item.trim().toLowerCase();
    const keep = key.length > 0 && !seen.has(key);
    seen.add(key);
    return keep;
  });
}

function formatBulletSection(label: string, bullets: string[]): string {
  return [`## ${label}`, ...toBullets(bullets).map((bullet) => `- ${bullet}`)].join('\n');
}

function formatMetric(label: string, value: string | number): string {
  return [
    '<div class="metric">',
    `<span class="label">${escapeHtml(label)}</span>`,
    `<strong class="value">${escapeHtml(String(value))}</strong>`,
    '</div>',
  ].join('');
}

function formatHtmlSection(label: string, bullets: string[]): string {
  return [
    '<section class="section">',
    `<h2>${escapeHtml(label)}</h2>`,
    formatHtmlList(bullets),
    '</section>',
  ].join('');
}

function formatHtmlList(bullets: string[]): string {
  return [
    '<ul>',
    ...toBullets(bullets).map((bullet) => `<li>${escapeHtml(bullet)}</li>`),
    '</ul>',
  ].join('');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
