import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { BriefiqApiService } from './briefiq/briefiq-api.service';
import {
  AnswerRecord,
  AppStage,
  BriefAnalysis,
  FollowUpQuestion,
  LiveSummary,
  ProjectPrd,
} from './briefiq/briefiq.models';
import { createEmptySummary, normalizeAnswerRecord } from './briefiq/briefiq-utils';
import { BriefInputComponent } from './briefiq/components/brief-input/brief-input';
import { PrdOutputComponent } from './briefiq/components/prd-output/prd-output';
import { QaScreenComponent } from './briefiq/components/qa-screen/qa-screen';
import { PrdLoaderComponent } from './briefiq/components/prd-loader/prd-loader';

@Component({
  selector: 'app-root',
  imports: [BriefInputComponent, QaScreenComponent, PrdOutputComponent, PrdLoaderComponent],
  providers: [BriefiqApiService],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly api = inject(BriefiqApiService);
  private retryAction: (() => Promise<void>) | null = null;

  protected readonly stage = signal<AppStage>('brief');
  protected readonly brief = signal('');
  protected readonly analysis = signal<BriefAnalysis | null>(null);
  protected readonly currentQuestion = signal<FollowUpQuestion | null>(null);
  protected readonly questions = signal<FollowUpQuestion[]>([]);
  protected readonly summary = signal<LiveSummary>(createEmptySummary());
  protected readonly answers = signal<AnswerRecord[]>([]);
  protected readonly assumptions = signal<string[]>([]);
  protected readonly openQuestions = signal<string[]>([]);
  protected readonly prd = signal<ProjectPrd | null>(null);
  protected readonly loadingMessage = signal('');
  protected readonly errorMessage = signal('');
  protected readonly isBusy = computed(() => this.loadingMessage().length > 0);

  protected async analyzeBrief(rawBrief: string): Promise<void> {
    console.info('[BriefIQ][App] analyzeBrief started', {
      briefLength: rawBrief.trim().length,
    });
    this.brief.set(rawBrief);
    this.retryAction = () => this.analyzeBrief(rawBrief);
    this.setLoading('Analyzing your brief...');

    try {
      const analysis = await firstValueFrom(this.api.analyzeBrief(rawBrief));
      console.info('[BriefIQ][App] analyzeBrief succeeded', {
        canStart: analysis.canStart,
        projectType: analysis.projectType,
        hasFirstQuestion: Boolean(analysis.firstQuestion),
      });

      this.analysis.set(analysis);
      this.summary.set({
        ...analysis.summary,
        assumptions: [],
      });
      this.assumptions.set([]);
      this.openQuestions.set(analysis.summary.openQuestions);

      if (!analysis.canStart || !analysis.firstQuestion) {
        this.stage.set('brief');
        this.setError(analysis.message);
        return;
      }

      this.answers.set([]);
      this.questions.set(analysis.questions);
      this.currentQuestion.set(analysis.firstQuestion);
      this.prd.set(null);
      this.stage.set('qa');
      this.clearStatus();
    } catch (error) {
      console.error('[BriefIQ][App] analyzeBrief failed', error);
      this.setError(this.readErrorMessage(error, 'Could not analyze the brief. Please try again.'));
    }
  }

  protected async submitAnswer(rawAnswer: string): Promise<void> {
    const currentQuestion = this.currentQuestion();

    if (!currentQuestion || this.isBusy()) {
      console.warn('[BriefIQ][App] submitAnswer blocked', {
        hasCurrentQuestion: Boolean(currentQuestion),
        busy: this.isBusy(),
      });
      return;
    }

    console.info('[BriefIQ][App] submitAnswer started', {
      questionId: currentQuestion.id,
      questionNumber: currentQuestion.currentNumber,
      answerLength: rawAnswer.trim().length,
    });

    const normalizedAnswer = normalizeAnswerRecord(currentQuestion, rawAnswer);
    const nextAnswers = [...this.answers(), normalizedAnswer];
    const nextAssumptions = normalizedAnswer.assumption
      ? [...this.assumptions(), normalizedAnswer.assumption]
      : this.assumptions();
    const nextOpenQuestions = normalizedAnswer.wasSkipped
      ? this.openQuestions()
      : this.openQuestions().slice(1);
    const nextQuestion = this.questions()[nextAnswers.length] ?? null;
    const nextSummary = this.createLocalSummary(nextAnswers, nextAssumptions, nextOpenQuestions);

    this.answers.set(nextAnswers);
    this.assumptions.set(nextAssumptions);
    this.openQuestions.set(nextOpenQuestions);
    this.summary.set(nextSummary);
    this.currentQuestion.set(nextQuestion);

    console.info('[BriefIQ][App] answer saved locally', {
      answerCount: nextAnswers.length,
      hasNextQuestion: Boolean(nextQuestion),
      skipped: normalizedAnswer.wasSkipped,
    });

    if (!nextQuestion) {
      await this.generatePrd(nextAnswers, nextSummary, nextAssumptions, nextOpenQuestions);
    }
  }

  protected async retryLastAction(): Promise<void> {
    if (!this.retryAction || this.isBusy()) {
      console.warn('[BriefIQ][App] retry blocked', {
        hasRetryAction: Boolean(this.retryAction),
        busy: this.isBusy(),
      });
      return;
    }

    console.info('[BriefIQ][App] retrying last action');
    await this.retryAction();
  }

  protected startOver(): void {
    this.retryAction = null;
    this.stage.set('brief');
    this.brief.set('');
    this.analysis.set(null);
    this.currentQuestion.set(null);
    this.questions.set([]);
    this.summary.set(createEmptySummary());
    this.answers.set([]);
    this.assumptions.set([]);
    this.openQuestions.set([]);
    this.prd.set(null);
    this.clearStatus();
  }

  private async generatePrd(
    answers: AnswerRecord[],
    summary: LiveSummary,
    assumptions: string[],
    openQuestions: string[],
  ): Promise<void> {
    const analysis = this.analysis();

    if (!analysis) {
      return;
    }

    this.retryAction = () => this.generatePrd(answers, summary, assumptions, openQuestions);
    console.info('[BriefIQ][App] generatePrd started', {
      answerCount: answers.length,
      assumptionCount: assumptions.length,
      openQuestionCount: openQuestions.length,
    });
    this.setLoading('Building your PRD...');

    try {
      const response = await firstValueFrom(
        this.api.generatePrd({
          brief: this.brief(),
          analysis,
          answers,
          summary,
          assumptions,
          openQuestions,
        }),
      );

      console.info('[BriefIQ][App] generatePrd succeeded', {
        projectName: response.prd.projectName,
        confidenceScore: response.prd.sections.confidenceScore.score,
      });
      this.prd.set(response.prd);
      this.stage.set('prd');
      this.clearStatus();
    } catch (error) {
      console.error('[BriefIQ][App] generatePrd failed', error);
      this.setError(this.readErrorMessage(error, 'Could not build the PRD. Please try again.'));
    }
  }

  private createLocalSummary(
    answers: AnswerRecord[],
    assumptions: string[],
    openQuestions: string[],
  ): LiveSummary {
    const currentSummary = this.summary();
    const latestAnswer = answers.at(-1);
    const latestFact =
      latestAnswer && !latestAnswer.wasSkipped
        ? `${latestAnswer.question} ${latestAnswer.answer}`
        : '';
    const filteredMissingDetails = currentSummary.missingDetails.filter(
      (detail) =>
        !answers.some((answer) =>
          answer.question.toLowerCase().includes(detail.toLowerCase().slice(0, 16)),
        ),
    );
    const missingDetails =
      latestAnswer && !latestAnswer.wasSkipped
        ? filteredMissingDetails.slice(1)
        : filteredMissingDetails;

    return {
      ...currentSummary,
      knownFacts: this.uniqueStrings([...currentSummary.knownFacts, latestFact]).slice(-8),
      missingDetails,
      assumptions,
      openQuestions,
    };
  }

  private uniqueStrings(items: string[]): string[] {
    const seen = new Set<string>();

    return items
      .map((item) => item.trim())
      .filter((item) => {
        const key = item.toLowerCase();
        const keep = item.length > 0 && !seen.has(key);
        seen.add(key);
        return keep;
      });
  }

  private setLoading(message: string): void {
    console.info('[BriefIQ][App] loading', { message });
    this.errorMessage.set('');
    this.loadingMessage.set(message);
  }

  private setError(message: string): void {
    console.error('[BriefIQ][App] error shown', { message });
    this.loadingMessage.set('');
    this.errorMessage.set(message);
  }

  private clearStatus(): void {
    console.info('[BriefIQ][App] status cleared');
    this.loadingMessage.set('');
    this.errorMessage.set('');
  }

  private readErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      const payload = error.error as { message?: string; details?: string } | null;
      return payload?.details
        ? `${payload.message || fallback} ${payload.details}`
        : payload?.message || fallback;
    }

    return fallback;
  }
}
