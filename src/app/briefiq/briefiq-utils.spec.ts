import type { AnswerRecord, BriefAnalysis, LiveSummary, PrdRequest } from './briefiq.models';
import { buildFallbackPrd, calculateConfidence } from './briefiq-utils';

describe('confidence scoring', () => {
  it('keeps perfect-looking scopes below 100 until client sign-off', () => {
    const answers = createAnswers(6);
    const result = calculateConfidence(6, answers, [], []);

    expect(result.score).toBe(95);
    expect(result.explanation).toContain('final client sign-off');
  });

  it('reduces confidence while useful follow-up questions are still unanswered', () => {
    const result = calculateConfidence(4, createAnswers(2), [], []);

    expect(result.score).toBe(88);
    expect(result.explanation).toContain('2 still need input');
  });

  it('reduces confidence when before-implementation clarifications remain', () => {
    const result = calculateConfidence(
      6,
      createAnswers(6),
      [],
      [],
      [
        'Clarification 1',
        'Clarification 2',
        'Clarification 3',
        'Clarification 4',
        'Clarification 5',
        'Clarification 6',
      ],
    );

    expect(result.score).toBe(76);
    expect(result.explanation).toContain('6 before-implementation clarifications');
  });

  it('reduces confidence for skipped answers, active assumptions, and open questions', () => {
    const answers = createAnswers(6);
    answers[2] = {
      ...answers[2],
      answer: 'not sure',
      wasSkipped: true,
      assumption: 'Use a standard admin approval flow.',
    };

    const result = calculateConfidence(
      6,
      answers,
      ['Use a standard admin approval flow.'],
      ['Confirm the approval owner.'],
    );

    expect(result.score).toBe(81);
  });

  it('keeps a fallback PRD realistic when assumptions and open questions are empty', () => {
    const prd = buildFallbackPrd(createPrdRequest());

    expect(prd.sections.confidenceScore.score).toBe(92);
  });

  it('always includes before-implementation client clarification items', () => {
    const prd = buildFallbackPrd(createPrdRequest());

    expect(prd.sections.clientClarifications).toContain(
      'Confirm final MVP scope and acceptance criteria with the client before implementation.',
    );
    expect(prd.sections.clientClarifications).toContain(
      'Confirm timeline, budget, and approval owner before starting the build.',
    );
  });
});

function createAnswers(count: number): AnswerRecord[] {
  return Array.from({ length: count }, (_, index) => ({
    questionId: `q${index + 1}`,
    question: `Question ${index + 1}?`,
    answer: `Answer ${index + 1}`,
    wasSkipped: false,
    assumption: '',
  }));
}

function createPrdRequest(): PrdRequest {
  const summary: LiveSummary = {
    projectName: 'Cleaner Booking',
    projectType: 'Marketplace app',
    knownFacts: ['Customers book cleaners.'],
    likelyFeatures: ['Booking calendar', 'Cleaner job list'],
    missingDetails: [],
    assumptions: [],
    openQuestions: [],
  };
  const analysis: BriefAnalysis = {
    canStart: true,
    message: 'Ready.',
    projectName: summary.projectName,
    projectType: summary.projectType,
    knownFacts: summary.knownFacts,
    missingAreas: [],
    summary,
    questions: [],
    firstQuestion: {
      id: 'q1',
      question: 'Who are the main users?',
      reason: 'Scope users.',
      answerOptions: ['Customers and cleaners'],
      currentNumber: 1,
      totalQuestions: 6,
    },
  };

  return {
    brief: 'Build a cleaner booking marketplace.',
    analysis,
    answers: createAnswers(6),
    summary,
    assumptions: [],
    openQuestions: [],
  };
}
