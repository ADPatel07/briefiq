import { config as loadEnv } from 'dotenv';
import { existsSync } from 'node:fs';
import type {
  AnswerRecord,
  ApiErrorResponse,
  BriefAnalysis,
  FollowUpQuestion,
  LiveSummary,
  PrdRequest,
  PrdResponse,
  ProjectPrd,
} from './briefiq.models';
import {
  applyClientClarificationPenalty,
  buildFallbackPrd,
  createEmptySummary,
  createTooShortAnalysis,
  ensureClientClarifications,
  isBriefTooShort,
  toBullets,
} from './briefiq-utils.js';

const localEnvResult = loadEnv({ path: '.env.local', quiet: true });
const rootEnvResult = loadEnv({ path: '.env', quiet: true });
const minFollowUpQuestions = 2;
const maxFollowUpQuestions = 6;
const defaultGeminiModel = 'gemini-2.5-flash-lite';

type JsonObject = Record<string, unknown>;

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
}

class GeminiConfigError extends Error {}

export class BriefiqApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: string,
  ) {
    super(message);
    this.name = 'BriefiqApiError';
  }
}

export function getBriefiqEnvironmentStatus(): JsonObject {
  return {
    cwd: process.cwd(),
    envLocalExists: existsSync('.env.local'),
    envExists: existsSync('.env'),
    envLocalLoaded: hasParsedEnv(localEnvResult.parsed),
    envLoaded: hasParsedEnv(rootEnvResult.parsed),
    hasGeminiApiKey: Boolean(process.env['GEMINI_API_KEY']),
    geminiModel: process.env['GEMINI_MODEL'] || defaultGeminiModel,
    geminiTimeoutMs: process.env['GEMINI_TIMEOUT_MS'] || '25000',
  };
}

export async function analyzeBriefPayload(payload: unknown): Promise<BriefAnalysis> {
  const startedAt = Date.now();
  const brief = readString(readRecord(payload)['brief']).trim();
  console.info('[BriefIQ][Server] POST /api/briefiq/analyze received', {
    briefLength: brief.length,
  });

  if (!brief) {
    console.warn('[BriefIQ][Server] analyze rejected: empty brief');
    throw new BriefiqApiError(400, 'Paste a client brief before starting.');
  }

  if (isBriefTooShort(brief)) {
    console.info('[BriefIQ][Server] analyze handled locally: brief too short', {
      elapsedMs: Date.now() - startedAt,
    });
    return createTooShortAnalysis(brief);
  }

  try {
    const generated = await callGeminiStructured<unknown>(buildAnalyzePrompt(brief), analyzeSchema);
    const analysis = sanitizeAnalysis(generated);

    console.info('[BriefIQ][Server] analyze completed', {
      elapsedMs: Date.now() - startedAt,
      projectType: analysis.projectType,
      hasFirstQuestion: Boolean(analysis.firstQuestion),
    });
    return analysis;
  } catch (error) {
    console.error('[BriefIQ][Server] analyze failed', describeError(error));
    throw toGeminiApiError(error, 'Could not analyze the brief with Gemini.');
  }
}

export async function generatePrdPayload(payload: unknown): Promise<PrdResponse> {
  const startedAt = Date.now();
  const request = sanitizePrdRequest(payload);
  console.info('[BriefIQ][Server] POST /api/briefiq/prd received', {
    answerCount: request.answers.length,
    assumptionCount: request.assumptions.length,
    openQuestionCount: request.openQuestions.length,
  });

  if (!request.brief || request.answers.length === 0) {
    console.warn('[BriefIQ][Server] prd rejected: Q&A incomplete');
    throw new BriefiqApiError(400, 'Complete the Q&A flow before generating a PRD.');
  }

  try {
    const fallbackPrd = buildFallbackPrd(request);
    const generated = await callGeminiStructured<unknown>(
      buildPrdPrompt(request, fallbackPrd),
      prdSchema,
    );
    const prd = sanitizePrd(generated, fallbackPrd);

    console.info('[BriefIQ][Server] prd completed', {
      elapsedMs: Date.now() - startedAt,
      projectName: prd.projectName,
      confidenceScore: prd.sections.confidenceScore.score,
    });
    return { prd };
  } catch (error) {
    console.error('[BriefIQ][Server] prd failed', describeError(error));
    throw toGeminiApiError(error, 'Could not build the PRD with Gemini.');
  }
}

export function toBriefiqApiErrorResponse(error: unknown): {
  status: number;
  payload: ApiErrorResponse;
} {
  if (error instanceof BriefiqApiError) {
    return {
      status: error.status,
      payload: error.details
        ? { message: error.message, details: error.details }
        : { message: error.message },
    };
  }

  console.error('[BriefIQ][Server] unexpected API error', describeError(error));
  return {
    status: 500,
    payload: { message: 'Unexpected BriefIQ server error.' },
  };
}

async function callGeminiStructured<T>(prompt: string, schema: JsonObject): Promise<T> {
  const apiKey = process.env['GEMINI_API_KEY'];
  const model = process.env['GEMINI_MODEL'] || defaultGeminiModel;
  const timeoutMs = readPositiveInteger(process.env['GEMINI_TIMEOUT_MS'], 25000);

  if (!apiKey) {
    console.error('[BriefIQ][Gemini] missing GEMINI_API_KEY', {
      envLocalExists: existsSync('.env.local'),
      envExists: existsSync('.env'),
      envLocalLoaded: hasParsedEnv(localEnvResult.parsed),
    });
    throw new GeminiConfigError('Set GEMINI_API_KEY before using the AI workflow.');
  }

  console.info('[BriefIQ][Gemini] request started', {
    model,
    timeoutMs,
    promptLength: prompt.length,
    schemaKeys: Object.keys(readRecord(schema['properties'])),
    hasGeminiApiKey: true,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  const startedAt = Date.now();

  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.35,
            responseMimeType: 'application/json',
            responseJsonSchema: schema,
          },
        }),
      },
    );
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[BriefIQ][Gemini] request timed out', {
        elapsedMs: Date.now() - startedAt,
        timeoutMs,
      });
      throw new Error(`Gemini request timed out after ${Math.round(timeoutMs / 1000)} seconds.`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[BriefIQ][Gemini] request failed', {
      elapsedMs: Date.now() - startedAt,
      status: response.status,
      statusText: response.statusText,
      body: errorText,
    });
    throw new Error(errorText || `Gemini returned HTTP ${response.status}.`);
  }

  const geminiPayload = (await response.json()) as GeminiResponse;
  const text =
    geminiPayload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || '')
      .join('')
      .trim() || '';

  if (!text) {
    throw new Error('Gemini returned an empty response.');
  }

  console.info('[BriefIQ][Gemini] request completed', {
    elapsedMs: Date.now() - startedAt,
    responseLength: text.length,
  });

  return JSON.parse(text) as T;
}

function buildAnalyzePrompt(brief: string): string {
  return `You are BriefIQ, an expert freelancer intake assistant.
Analyze this client brief and prepare the first adaptive follow-up question.
Rules:
- Do not generate the PRD yet.
- Decide the number of follow-up questions from the brief's actual gaps.
- Ask ${minFollowUpQuestions}-${maxFollowUpQuestions} total follow-up questions across the Q&A flow.
- Use fewer questions for detailed briefs and more questions only when major build blockers remain unclear.
- Prioritize the most important missing decisions for estimation: users and roles, MVP boundaries, core workflow, data, integrations, permissions, payments, timeline, budget, and success criteria.
- Do not ask about details that are already clear in the brief.
- The server has already rejected briefs that are too short, so canStart must be true.
- Return short bullet-ready strings, not long paragraphs.
- Extract project type, known facts, missing areas, likely features, assumptions, and open questions.
- Return a questions array containing only the needed adaptive follow-up questions.
- Every question must include 2-3 concise answerOptions.
- firstQuestion must be the same object as questions[0].

Client brief:
${brief}`;
}

function buildPrdPrompt(request: PrdRequest, fallbackPrd: ProjectPrd): string {
  return `You are BriefIQ generating the final MVP PRD after the Q&A is complete.
Return exactly the requested JSON structure and no extra sections.
Rules:
- Use short, professional bullets only.
- Write a developer-ready implementation handoff, not a marketing summary.
- Answer every known scope question directly in the relevant section.
- Put unresolved decisions in Client Clarifications Before Implementation so the user knows exactly what to confirm with the client before building.
- Client Clarifications Before Implementation must always include final client sign-off items, even when the Q&A is mostly complete.
- Suggested Next Steps must not repeat the client clarification bullets; focus on actions after sign-off.
- Include only these sections: Client Clarifications Before Implementation, Project Summary, Target Users and Roles, Core Features, MVP Scope, Out of Scope, Key Assumptions, Open Questions, Effort and Complexity, Confidence Score, Suggested Next Steps.
- Effort complexity must be Low, Medium, or High with 2-3 bullet reasons.
- Use this exact confidence score and explanation: ${fallbackPrd.sections.confidenceScore.score}% - ${fallbackPrd.sections.confidenceScore.explanation}
- Missing timeline or budget belongs in open questions and client clarifications.

Context JSON:
${JSON.stringify(request, null, 2)}`;
}

export function sanitizeAnalysis(value: unknown): BriefAnalysis {
  const record = readRecord(value);
  const projectType = readString(record['projectType'], 'Unknown');
  const projectName = readString(record['projectName'], 'Client Project');
  const summary = sanitizeSummary(record['summary'], projectType, projectName);
  const canStart = true;
  const questions = sanitizeQuestions(record['questions'], record['firstQuestion']);
  const firstQuestion = questions[0] ?? null;

  return {
    canStart,
    message: readString(record['message'], canStart ? 'Ready for follow-up questions.' : ''),
    projectName,
    projectType,
    knownFacts: toBullets(readStringArray(record['knownFacts'])),
    missingAreas: toBullets(readStringArray(record['missingAreas'])),
    summary,
    questions,
    firstQuestion,
  };
}

function sanitizePrdRequest(value: unknown): PrdRequest {
  const record = readRecord(value);
  const analysis = sanitizeAnalysis(record['analysis']);
  const answers = readAnswers(record['answers']);

  return {
    brief: readString(record['brief']),
    analysis,
    answers,
    summary: sanitizeSummary(record['summary'], analysis.projectType, analysis.projectName),
    assumptions: toBullets(readStringArray(record['assumptions']), []),
    openQuestions: toBullets(readStringArray(record['openQuestions']), []),
  };
}

export function sanitizePrd(value: unknown, fallback: ProjectPrd): ProjectPrd {
  const record = readRecord(value);
  const sections = readRecord(record['sections']);
  const generatedEffort = readRecord(sections['effortAndComplexity']);
  const clientClarifications = ensureClientClarifications(
    toBullets(
      readStringArray(sections['clientClarifications']),
      fallback.sections.clientClarifications,
    ),
  );
  const confidenceScore = applyClientClarificationPenalty(
    fallback.sections.confidenceScore,
    clientClarifications,
  );

  return {
    projectName: readString(record['projectName'], fallback.projectName),
    sections: {
      clientClarifications,
      projectSummary: toBullets(
        readStringArray(sections['projectSummary']),
        fallback.sections.projectSummary,
      ),
      targetUsersAndRoles: toBullets(
        readStringArray(sections['targetUsersAndRoles']),
        fallback.sections.targetUsersAndRoles,
      ),
      coreFeatures: toBullets(
        readStringArray(sections['coreFeatures']),
        fallback.sections.coreFeatures,
      ),
      mvpScope: toBullets(readStringArray(sections['mvpScope']), fallback.sections.mvpScope),
      outOfScope: toBullets(readStringArray(sections['outOfScope']), fallback.sections.outOfScope),
      keyAssumptions: toBullets(
        readStringArray(sections['keyAssumptions']),
        fallback.sections.keyAssumptions,
      ),
      openQuestions: toBullets(
        readStringArray(sections['openQuestions']),
        fallback.sections.openQuestions,
      ),
      effortAndComplexity: {
        complexity: readComplexity(
          generatedEffort['complexity'],
          fallback.sections.effortAndComplexity.complexity,
        ),
        timeline: readString(
          generatedEffort['timeline'],
          fallback.sections.effortAndComplexity.timeline,
        ),
        reasons: toBullets(
          readStringArray(generatedEffort['reasons']),
          fallback.sections.effortAndComplexity.reasons,
        ).slice(0, 3),
      },
      confidenceScore,
      suggestedNextSteps: toBullets(
        readStringArray(sections['suggestedNextSteps']),
        fallback.sections.suggestedNextSteps,
      ),
    },
  };
}

function sanitizeSummary(
  value: unknown,
  fallbackType = 'Unknown',
  fallbackName = 'Client Project',
): LiveSummary {
  const record = readRecord(value);
  const summary = createEmptySummary(
    readString(record['projectType'], fallbackType),
    readString(record['projectName'], fallbackName),
  );

  summary.knownFacts = toBullets(readStringArray(record['knownFacts']));
  summary.likelyFeatures = toBullets(readStringArray(record['likelyFeatures']));
  summary.missingDetails = toBullets(readStringArray(record['missingDetails']));
  summary.assumptions = toBullets(readStringArray(record['assumptions']), []);
  summary.openQuestions = toBullets(readStringArray(record['openQuestions']), []);

  return summary;
}

function sanitizeQuestion(
  value: unknown,
  currentNumber: number,
  questionTotal: number,
): FollowUpQuestion {
  const record = readRecord(value);

  return {
    id: readString(record['id'], `q${currentNumber}`),
    question: readString(
      record['question'],
      currentNumber === 1
        ? 'Who are the main users, and what should they be able to do first?'
        : 'What is the next most important detail the client should confirm?',
    ),
    reason: readString(
      record['reason'],
      'This helps reduce estimation risk before writing the PRD.',
    ),
    answerOptions: toBullets(
      readStringArray(record['answerOptions']),
      defaultAnswerOptions(currentNumber, questionTotal),
    ).slice(0, 3),
    currentNumber,
    totalQuestions: questionTotal,
  };
}

function sanitizeQuestions(value: unknown, firstQuestion: unknown): FollowUpQuestion[] {
  const rawQuestions = collectQuestionInputs(value, firstQuestion).slice(0, maxFollowUpQuestions);
  const questionTotal = Math.min(
    maxFollowUpQuestions,
    Math.max(rawQuestions.length, minFollowUpQuestions),
  );
  const questions = rawQuestions
    .slice(0, questionTotal)
    .map((item, index) => sanitizeQuestion(item, index + 1, questionTotal));

  while (questions.length < questionTotal) {
    questions.push(sanitizeQuestion({}, questions.length + 1, questionTotal));
  }

  return questions;
}

function collectQuestionInputs(value: unknown, firstQuestion: unknown): unknown[] {
  const candidates = Array.isArray(value) ? [...value] : [];

  if (candidates.length === 0) {
    candidates.push(firstQuestion);
  }

  const questions = candidates.filter(isQuestionInput);

  return questions.length > 0 ? questions : [firstQuestion].filter(isQuestionInput);
}

function isQuestionInput(item: unknown): boolean {
  return (
    item !== null &&
    typeof item === 'object' &&
    !Array.isArray(item) &&
    readString(readRecord(item)['question']).trim().length > 0
  );
}

function readAnswers(value: unknown): AnswerRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item, index) => {
    const record = readRecord(item);

    return {
      questionId: readString(record['questionId'], `q${index + 1}`),
      question: readString(record['question']),
      answer: readString(record['answer']),
      wasSkipped: readBoolean(record['wasSkipped'], false),
      assumption: readString(record['assumption']),
    };
  });
}

function toGeminiApiError(error: unknown, fallback: string): BriefiqApiError {
  if (error instanceof GeminiConfigError) {
    return new BriefiqApiError(503, error.message);
  }

  return new BriefiqApiError(502, fallback, error instanceof Error ? error.message : undefined);
}

function describeError(error: unknown): { name: string; message: string } {
  return error instanceof Error
    ? { name: error.name, message: error.message }
    : { name: 'UnknownError', message: String(error) };
}

function hasParsedEnv(parsed: Record<string, string> | undefined): boolean {
  return Boolean(parsed && Object.keys(parsed).length > 0);
}

function readRecord(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {};
}

function readString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function readPositiveInteger(value: unknown, fallback: number): number {
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function readComplexity(
  value: unknown,
  fallback: 'Low' | 'Medium' | 'High',
): 'Low' | 'Medium' | 'High' {
  return value === 'Low' || value === 'Medium' || value === 'High' ? value : fallback;
}

function defaultAnswerOptions(
  questionNumber: number,
  questionTotal = minFollowUpQuestions,
): string[] {
  if (questionNumber === 1) {
    return ['Customers only', 'Customers and admins', 'Customers and providers'];
  }

  if (questionNumber === questionTotal) {
    return ['Ready to generate PRD', 'Mark as open question', 'Use your assumption'];
  }

  return ['Keep it simple', 'Include in MVP', 'Not sure yet'];
}

const stringArraySchema = {
  type: 'array',
  items: { type: 'string' },
} satisfies JsonObject;

const questionSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    question: { type: 'string' },
    reason: { type: 'string' },
    answerOptions: stringArraySchema,
    currentNumber: { type: 'integer' },
    totalQuestions: { type: 'integer' },
  },
  required: ['id', 'question', 'reason', 'answerOptions', 'currentNumber', 'totalQuestions'],
} satisfies JsonObject;

const summarySchema = {
  type: 'object',
  properties: {
    projectName: { type: 'string' },
    projectType: { type: 'string' },
    knownFacts: stringArraySchema,
    likelyFeatures: stringArraySchema,
    missingDetails: stringArraySchema,
    assumptions: stringArraySchema,
    openQuestions: stringArraySchema,
  },
  required: [
    'projectName',
    'projectType',
    'knownFacts',
    'likelyFeatures',
    'missingDetails',
    'assumptions',
    'openQuestions',
  ],
} satisfies JsonObject;

const analyzeSchema = {
  type: 'object',
  properties: {
    canStart: { type: 'boolean' },
    message: { type: 'string' },
    projectName: { type: 'string' },
    projectType: { type: 'string' },
    knownFacts: stringArraySchema,
    missingAreas: stringArraySchema,
    summary: summarySchema,
    questions: {
      type: 'array',
      items: questionSchema,
    },
    firstQuestion: { type: ['object', 'null'], properties: questionSchema.properties },
  },
  required: [
    'canStart',
    'message',
    'projectName',
    'projectType',
    'knownFacts',
    'missingAreas',
    'summary',
    'questions',
    'firstQuestion',
  ],
} satisfies JsonObject;

const prdSchema = {
  type: 'object',
  properties: {
    projectName: { type: 'string' },
    sections: {
      type: 'object',
      properties: {
        clientClarifications: stringArraySchema,
        projectSummary: stringArraySchema,
        targetUsersAndRoles: stringArraySchema,
        coreFeatures: stringArraySchema,
        mvpScope: stringArraySchema,
        outOfScope: stringArraySchema,
        keyAssumptions: stringArraySchema,
        openQuestions: stringArraySchema,
        effortAndComplexity: {
          type: 'object',
          properties: {
            complexity: { type: 'string', enum: ['Low', 'Medium', 'High'] },
            timeline: { type: 'string' },
            reasons: stringArraySchema,
          },
          required: ['complexity', 'timeline', 'reasons'],
        },
        confidenceScore: {
          type: 'object',
          properties: {
            score: { type: 'integer' },
            explanation: { type: 'string' },
          },
          required: ['score', 'explanation'],
        },
        suggestedNextSteps: stringArraySchema,
      },
      required: [
        'clientClarifications',
        'projectSummary',
        'targetUsersAndRoles',
        'coreFeatures',
        'mvpScope',
        'outOfScope',
        'keyAssumptions',
        'openQuestions',
        'effortAndComplexity',
        'confidenceScore',
        'suggestedNextSteps',
      ],
    },
  },
  required: ['projectName', 'sections'],
} satisfies JsonObject;
