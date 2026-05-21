import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { AnswerRecord, FollowUpQuestion, LiveSummary } from '../../briefiq.models';
import { calculateConfidence } from '../../briefiq-utils';
import { AiStatusComponent } from '../ai-status/ai-status';

@Component({
  selector: 'app-qa-screen',
  imports: [ReactiveFormsModule, AiStatusComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './qa-screen.html',
})
export class QaScreenComponent implements OnChanges, AfterViewInit, OnDestroy {
  @Input({ required: true }) question!: FollowUpQuestion;
  @Input({ required: true }) summary!: LiveSummary;
  @Input() answers: AnswerRecord[] = [];
  @Input() loadingMessage = '';
  @Input() errorMessage = '';
  @Output() answerSubmitted = new EventEmitter<string>();
  @Output() retry = new EventEmitter<void>();

  @ViewChild('scrollContainer') scrollContainer!: ElementRef<HTMLDivElement>;

  protected readonly answerControl = new FormControl('', { nonNullable: true });
  protected activeTab: 'facts' | 'gaps' | 'assumptions' = 'facts';

  // Voice recording states
  protected readonly isRecording = signal<boolean>(false);
  protected readonly recordingDuration = signal<number>(0);
  protected readonly voiceError = signal<string>('');

  private speechRecognition: any = null;
  private recordingInterval: any = null;

  protected get isLoading(): boolean {
    return this.loadingMessage.length > 0;
  }

  protected get confidenceScore(): number {
    const total = this.question.totalQuestions || Math.max(this.answers.length, 1);
    const assumptions = this.summary.assumptions || [];
    const openQ = this.summary.openQuestions || [];
    return calculateConfidence(total, this.answers, assumptions, openQ).score;
  }

  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      this.initSpeechRecognition();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    const questionChange = changes['question'];
    const answersChange = changes['answers'];

    if (
      questionChange &&
      !questionChange.firstChange &&
      questionChange.previousValue?.id !== questionChange.currentValue?.id
    ) {
      this.answerControl.reset('');
    }

    if (this.isLoading) {
      this.answerControl.disable({ emitEvent: false });
      return;
    }

    this.answerControl.enable({ emitEvent: false });

    // Scroll to bottom when new questions or answers are loaded
    if (questionChange || answersChange) {
      setTimeout(() => this.scrollToBottom(), 50);
    }
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.scrollToBottom(), 100);
  }

  ngOnDestroy(): void {
    this.stopVoiceRecording();
  }

  protected scrollToBottom(): void {
    if (!this.scrollContainer) return;
    const el = this.scrollContainer.nativeElement;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: 'smooth',
    });
  }

  protected progressPercent(): number {
    return Math.round((this.question.currentNumber / this.question.totalQuestions) * 100);
  }

  protected submitAnswer(): void {
    if (this.isLoading) {
      return;
    }

    this.answerSubmitted.emit(this.answerControl.value.trim());
  }

  protected submitOption(option: string): void {
    if (this.isLoading) {
      return;
    }

    this.answerControl.setValue(option);
    this.answerSubmitted.emit(option);
  }

  protected skipQuestion(): void {
    if (this.isLoading) {
      return;
    }

    this.answerSubmitted.emit('not sure');
  }

  // --- Voice Input (Speech Recognition) ---
  private initSpeechRecognition(): void {
    if (typeof window === 'undefined') return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('[BriefIQ][QA][Speech] Browser does not support Web Speech API');
      return;
    }

    try {
      this.speechRecognition = new SpeechRecognition();
      this.speechRecognition.continuous = true;
      this.speechRecognition.interimResults = true;
      this.speechRecognition.lang = 'en-US';

      this.speechRecognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        if (finalTranscript) {
          const currentText = this.answerControl.value;
          const spacing = currentText.endsWith(' ') || currentText.length === 0 ? '' : ' ';
          this.answerControl.setValue(currentText + spacing + finalTranscript);
        }
      };

      this.speechRecognition.onerror = (event: any) => {
        console.error('[BriefIQ][QA][Speech] Recognition error', event);
        if (event.error === 'not-allowed') {
          this.voiceError.set('Microphone permission denied.');
        } else {
          this.voiceError.set(`Error: ${event.error}`);
        }
        this.stopVoiceRecording();
      };

      this.speechRecognition.onend = () => {
        console.info('[BriefIQ][QA][Speech] Recognition ended');
        if (this.isRecording()) {
          this.stopVoiceRecording();
        }
      };
    } catch (err) {
      console.error('[BriefIQ][QA][Speech] Initialization failed', err);
    }
  }

  protected toggleVoiceRecording(): void {
    if (this.isRecording()) {
      this.stopVoiceRecording();
      return;
    }

    this.voiceError.set('');

    if (!this.speechRecognition) {
      this.startSimulatedRecording();
      return;
    }

    try {
      this.speechRecognition.start();
      this.isRecording.set(true);
      this.recordingDuration.set(0);

      this.recordingInterval = setInterval(() => {
        this.recordingDuration.update((d) => d + 1);
      }, 1000);

      console.info('[BriefIQ][QA][Speech] Recording started');
    } catch (err) {
      console.error('[BriefIQ][QA][Speech] Start failed, using fallback simulation', err);
      this.startSimulatedRecording();
    }
  }

  protected stopVoiceRecording(): void {
    if (this.recordingInterval) {
      clearInterval(this.recordingInterval);
      this.recordingInterval = null;
    }

    if (this.speechRecognition && this.isRecording()) {
      try {
        this.speechRecognition.stop();
      } catch (e) {}
    }

    this.isRecording.set(false);
    console.info('[BriefIQ][QA][Speech] Recording stopped');
  }

  private startSimulatedRecording(): void {
    this.isRecording.set(true);
    this.recordingDuration.set(0);
    this.voiceError.set('Speech API blocked. Simulating speech transcription...');

    this.recordingInterval = setInterval(() => {
      this.recordingDuration.update((d) => d + 1);

      if (this.recordingDuration() === 3) {
        // Generate a smart adaptive answer based on the current question
        let simulatedAnswer =
          'I think we should prioritize regular customer accounts first, and providers can use a simpler interface.';
        if (
          this.question.question.toLowerCase().includes('database') ||
          this.question.question.toLowerCase().includes('data')
        ) {
          simulatedAnswer =
            'We should use PostgreSQL for transactional safety and keep historical logs in regular tables.';
        } else if (
          this.question.question.toLowerCase().includes('payment') ||
          this.question.question.toLowerCase().includes('pay')
        ) {
          simulatedAnswer =
            'Yes, let us integrate Stripe for processing all credit card payments securely.';
        }

        const currentValue = this.answerControl.value;
        const spacing = currentValue.endsWith(' ') || currentValue.length === 0 ? '' : ' ';
        this.answerControl.setValue(currentValue + spacing + simulatedAnswer);
        this.stopVoiceRecording();
      }
    }, 1000);
  }

  protected get formattedTime(): string {
    const duration = this.recordingDuration();
    const mins = Math.floor(duration / 60);
    const secs = duration % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }
}
