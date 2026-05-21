import type { PrdRequest } from './briefiq.models';
import { buildFallbackPrd } from './briefiq-utils';
import { sanitizeAnalysis, sanitizePrd } from './briefiq-ai.server';

describe('analysis question sanitization', () => {
  it('preserves the dynamic number of useful follow-up questions', () => {
    const analysis = sanitizeAnalysis(createAnalysisPayload(3));

    expect(analysis.questions).toHaveLength(3);
    expect(analysis.firstQuestion?.totalQuestions).toBe(3);
    expect(analysis.questions.map((question) => question.totalQuestions)).toEqual([3, 3, 3]);
  });

  it('caps very long question lists at six', () => {
    const analysis = sanitizeAnalysis(createAnalysisPayload(8));

    expect(analysis.questions).toHaveLength(6);
    expect(analysis.questions.at(-1)?.currentNumber).toBe(6);
    expect(analysis.questions.at(-1)?.totalQuestions).toBe(6);
  });

  it('creates the minimum fallback set when Gemini returns no valid questions', () => {
    const analysis = sanitizeAnalysis({
      ...createAnalysisPayload(0),
      firstQuestion: null,
      questions: [],
    });

    expect(analysis.questions).toHaveLength(2);
    expect(analysis.firstQuestion?.totalQuestions).toBe(2);
  });
});

describe('PRD sanitization', () => {
  it('keeps before-implementation sign-off items with generated client clarifications', () => {
    const prd = sanitizePrd(
      {
        projectName: 'Cleaner Booking',
        sections: {
          clientClarifications: ['Confirm cleaner cancellation policy.'],
          projectSummary: ['Customers book cleaners.'],
          targetUsersAndRoles: ['Customers and cleaners.'],
          coreFeatures: ['Booking calendar.'],
          mvpScope: ['Booking and cleaner acceptance.'],
          outOfScope: ['Native mobile apps.'],
          keyAssumptions: [],
          openQuestions: [],
          effortAndComplexity: {
            complexity: 'Medium',
            timeline: '4-6 weeks',
            reasons: ['Marketplace workflow requires role-specific states.'],
          },
          confidenceScore: {
            score: 100,
            explanation: 'Generated score should not override fallback.',
          },
          suggestedNextSteps: ['Review with client.'],
        },
      },
      buildFallbackPrd(createPrdRequest()),
    );

    expect(prd.sections.clientClarifications).toContain('Confirm cleaner cancellation policy.');
    expect(prd.sections.clientClarifications).toContain(
      'Confirm final MVP scope and acceptance criteria with the client before implementation.',
    );
    expect(prd.sections.clientClarifications).toContain(
      'Confirm timeline, budget, and approval owner before starting the build.',
    );
    expect(prd.sections.confidenceScore.score).toBe(88);
    expect(prd.sections.confidenceScore.explanation).toContain(
      '3 before-implementation clarifications',
    );
  });
});

function createAnalysisPayload(questionCount: number): Record<string, unknown> {
  const questions = Array.from({ length: questionCount }, (_, index) => ({
    id: `q${index + 1}`,
    question: `Missing decision ${index + 1}?`,
    reason: 'This affects the MVP estimate.',
    answerOptions: ['Option A', 'Option B', 'Not sure yet'],
    currentNumber: index + 1,
    totalQuestions: questionCount,
  }));

  return {
    canStart: true,
    message: 'Ready.',
    projectName: 'Cleaner Booking',
    projectType: 'Marketplace app',
    knownFacts: ['Customers book cleaners.'],
    missingAreas: ['MVP boundaries'],
    summary: {
      projectName: 'Cleaner Booking',
      projectType: 'Marketplace app',
      knownFacts: ['Customers book cleaners.'],
      likelyFeatures: ['Booking calendar'],
      missingDetails: ['MVP boundaries'],
      assumptions: [],
      openQuestions: ['Confirm MVP boundaries.'],
    },
    questions,
    firstQuestion: questions[0] ?? null,
  };
}

function createPrdRequest(): PrdRequest {
  const analysis = sanitizeAnalysis(createAnalysisPayload(3));

  return {
    brief: 'Build a cleaner booking marketplace.',
    analysis,
    answers: [
      {
        questionId: 'q1',
        question: 'Who are the users?',
        answer: 'Customers and cleaners.',
        wasSkipped: false,
        assumption: '',
      },
      {
        questionId: 'q2',
        question: 'What is the MVP workflow?',
        answer: 'Customers book and cleaners accept jobs.',
        wasSkipped: false,
        assumption: '',
      },
      {
        questionId: 'q3',
        question: 'How should payment work?',
        answer: 'Stripe card payment.',
        wasSkipped: false,
        assumption: '',
      },
    ],
    summary: analysis.summary,
    assumptions: [],
    openQuestions: [],
  };
}
