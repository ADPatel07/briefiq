export type Complexity = 'Low' | 'Medium' | 'High';

export interface ApiErrorResponse {
  message: string;
  details?: string;
}

export interface FollowUpQuestion {
  id: string;
  question: string;
  reason: string;
  answerOptions: string[];
  currentNumber: number;
  totalQuestions: number;
}

export interface LiveSummary {
  projectName: string;
  projectType: string;
  knownFacts: string[];
  likelyFeatures: string[];
  missingDetails: string[];
  assumptions: string[];
  openQuestions: string[];
}

export interface BriefAnalysis {
  canStart: boolean;
  message: string;
  projectName: string;
  projectType: string;
  knownFacts: string[];
  missingAreas: string[];
  summary: LiveSummary;
  questions: FollowUpQuestion[];
  firstQuestion: FollowUpQuestion | null;
}

export interface AnswerRecord {
  questionId: string;
  question: string;
  answer: string;
  wasSkipped: boolean;
  assumption: string;
}

export interface AnalyzeBriefRequest {
  brief: string;
}

export interface EffortComplexity {
  complexity: Complexity;
  timeline: string;
  reasons: string[];
}

export interface ConfidenceScore {
  score: number;
  explanation: string;
}

export interface PrdSections {
  clientClarifications: string[];
  projectSummary: string[];
  targetUsersAndRoles: string[];
  coreFeatures: string[];
  mvpScope: string[];
  outOfScope: string[];
  keyAssumptions: string[];
  openQuestions: string[];
  effortAndComplexity: EffortComplexity;
  confidenceScore: ConfidenceScore;
  suggestedNextSteps: string[];
}

export interface ProjectPrd {
  projectName: string;
  sections: PrdSections;
}

export interface PrdRequest {
  brief: string;
  analysis: BriefAnalysis;
  answers: AnswerRecord[];
  summary: LiveSummary;
  assumptions: string[];
  openQuestions: string[];
}

export interface PrdResponse {
  prd: ProjectPrd;
}

export type AppStage = 'brief' | 'qa' | 'prd';
