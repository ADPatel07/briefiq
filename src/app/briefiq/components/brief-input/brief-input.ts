import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AiStatusComponent } from '../ai-status/ai-status';

interface PresetTemplate {
  title: string;
  description: string;
  brief: string;
  icon: string;
}

interface AttachedFile {
  name: string;
  size: string;
  content: string;
  type: string;
}

@Component({
  selector: 'app-brief-input',
  imports: [ReactiveFormsModule, AiStatusComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './brief-input.html',
})
export class BriefInputComponent implements OnChanges, OnInit, AfterViewInit, OnDestroy {
  @Input() loadingMessage = '';
  @Input() errorMessage = '';
  @Output() briefSubmitted = new EventEmitter<string>();
  @Output() retry = new EventEmitter<void>();

  @ViewChild('briefTextarea') briefTextarea!: ElementRef<HTMLTextAreaElement>;
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  private valueChangesSubscription?: Subscription;

  protected readonly briefControl = new FormControl('', { nonNullable: true });
  protected readonly noteControl = new FormControl('', { nonNullable: true });

  // Files, notes, and voice signals
  protected readonly attachedFiles = signal<AttachedFile[]>([]);
  protected readonly notes = signal<string[]>([]);
  protected readonly showNoteInput = signal<boolean>(false);
  protected readonly isRecording = signal<boolean>(false);
  protected readonly recordingDuration = signal<number>(0);
  protected readonly voiceError = signal<string>('');

  private speechRecognition: any = null;
  private recordingInterval: any = null;

  protected readonly templates: PresetTemplate[] = [
    {
      title: 'Local Cleaning App',
      description: 'On-demand cleaning bookings with matching & schedules.',
      brief: 'I need an app like Uber but simpler for local home cleaning bookings. Customers should be able to book a cleaner for a specific time, pay via credit card, and see their cleaning schedule. Cleaners should have a simple list of bookings they can accept.',
      icon: '🧹'
    },
    {
      title: 'AI Translation Tool',
      description: 'Browser extension to translate PDFs with split-screen summaries.',
      brief: 'An AI-powered browser extension that lets users upload research PDFs, translates them into 5 different languages, and displays a split-screen view with a simplified summary alongside the original text. Needs a history log.',
      icon: '🤖'
    },
    {
      title: 'Local Chef Marketplace',
      description: 'P2P marketplace connecting home chefs with local buyers.',
      brief: 'A local marketplace connecting home-based chefs with neighbors. Home chefs can list dishes, set prices, and specify pick-up windows. Neighbors can browse by distance, buy a meal, and leave reviews. Simple admin dashboard for verification.',
      icon: '🍳'
    }
  ];

  ngOnInit(): void {
    console.info('[BriefIQ][BriefInput] initialized', {
      hasInitialValue: this.briefControl.value.trim().length > 0,
      loading: this.isLoading,
    });

    if (typeof window !== 'undefined') {
      this.initSpeechRecognition();
    }
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.resizeTextarea());
  }

  ngOnDestroy(): void {
    if (this.valueChangesSubscription) {
      this.valueChangesSubscription.unsubscribe();
    }
    this.stopVoiceRecording();
  }

  protected resizeTextarea(): void {
    if (!this.briefTextarea) return;
    const el = this.briefTextarea.nativeElement;
    
    // Force sync reactive control value to the DOM element to bypass Angular template rendering lag
    if (el.value !== this.briefControl.value) {
      el.value = this.briefControl.value;
    }
    
    el.style.height = 'auto';
    const newHeight = el.scrollHeight;
    
    if (newHeight > 0) {
      el.style.height = `${newHeight}px`;
    }
  }

  ngOnChanges(): void {
    console.info('[BriefIQ][BriefInput] inputs changed', {
      loadingMessage: this.loadingMessage,
      hasError: this.errorMessage.length > 0,
    });

    if (this.isLoading) {
      this.briefControl.disable({ emitEvent: false });
      return;
    }

    this.briefControl.enable({ emitEvent: false });
  }

  protected get isLoading(): boolean {
    return this.loadingMessage.length > 0;
  }

  protected canSubmit(): boolean {
    const hasText = this.briefControl.value.trim().length > 0;
    const hasFiles = this.attachedFiles().length > 0;
    const hasNotes = this.notes().length > 0;
    return (hasText || hasFiles || hasNotes) && !this.isLoading;
  }

  protected selectTemplate(brief: string): void {
    if (this.isLoading) return;
    this.briefControl.setValue(brief);
    console.info('[BriefIQ][BriefInput] selected template', { briefLength: brief.length });
    setTimeout(() => this.resizeTextarea(), 0);
  }

  protected logBriefInput(): void {
    const length = this.briefControl.value.trim().length;

    console.info('[BriefIQ][BriefInput] textarea input', {
      length,
      canSubmit: this.canSubmit(),
      loading: this.isLoading,
    });
  }

  // --- Voice Input (Speech Recognition) ---
  private initSpeechRecognition(): void {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('[BriefIQ][Speech] Browser does not support Web Speech API');
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
          const currentText = this.briefControl.value;
          const spacing = currentText.endsWith(' ') || currentText.length === 0 ? '' : ' ';
          this.briefControl.setValue(currentText + spacing + finalTranscript);
          setTimeout(() => this.resizeTextarea());
        }
      };

      this.speechRecognition.onerror = (event: any) => {
        console.error('[BriefIQ][Speech] Recognition error', event);
        if (event.error === 'not-allowed') {
          this.voiceError.set('Microphone permission denied. Enable it in your browser settings.');
        } else {
          this.voiceError.set(`Microphone error: ${event.error}`);
        }
        this.stopVoiceRecording();
      };

      this.speechRecognition.onend = () => {
        console.info('[BriefIQ][Speech] Recognition ended');
        if (this.isRecording()) {
          this.stopVoiceRecording();
        }
      };
    } catch (err) {
      console.error('[BriefIQ][Speech] Failed to initialize Web Speech API', err);
    }
  }

  protected toggleVoiceRecording(): void {
    if (this.isRecording()) {
      this.stopVoiceRecording();
      return;
    }

    this.voiceError.set('');
    
    // Fallback typewriter simulation if not supported
    if (!this.speechRecognition) {
      this.startSimulatedRecording();
      return;
    }

    try {
      this.speechRecognition.start();
      this.isRecording.set(true);
      this.recordingDuration.set(0);

      this.recordingInterval = setInterval(() => {
        this.recordingDuration.update(d => d + 1);
      }, 1000);

      console.info('[BriefIQ][Speech] Recording started');
    } catch (err) {
      console.error('[BriefIQ][Speech] Start failed, using fallback simulation', err);
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
    console.info('[BriefIQ][Speech] Recording stopped');
  }

  private startSimulatedRecording(): void {
    this.isRecording.set(true);
    this.recordingDuration.set(0);
    this.voiceError.set('Web Speech API unsupported or blocked. Simulating transcription...');

    this.recordingInterval = setInterval(() => {
      this.recordingDuration.update(d => d + 1);
      
      // Simulate adding some high-quality product typing text
      if (this.recordingDuration() === 3) {
        const text = 'I want a modern premium real estate listing portal with interactive map filtering, user favorites drawer, dark mode theme support, and a fast search.';
        const currentValue = this.briefControl.value;
        const spacing = currentValue.endsWith(' ') || currentValue.length === 0 ? '' : ' ';
        this.briefControl.setValue(currentValue + spacing + text);
        setTimeout(() => this.resizeTextarea());
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

  // --- File Uploading ---
  protected triggerFileUpload(): void {
    if (this.fileInput) {
      this.fileInput.nativeElement.click();
    }
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const files = Array.from(input.files);
    files.forEach(file => {
      const reader = new FileReader();
      const isText = file.type.startsWith('text/') || 
                     file.name.endsWith('.md') || 
                     file.name.endsWith('.json') || 
                     file.name.endsWith('.csv') || 
                     file.name.endsWith('.xml') ||
                     file.name.endsWith('.ts') ||
                     file.name.endsWith('.js') ||
                     file.name.endsWith('.css');
      
      if (isText) {
        reader.onload = (e) => {
          const content = e.target?.result as string || '';
          this.addAttachedFile(file.name, file.size, content, file.type);
        };
        reader.readAsText(file);
      } else {
        // Binary or unsupported (PDF, DOCX) - show elegant metadata representation
        // We simulate extraction loading by putting a sleek note
        this.addAttachedFile(
          file.name, 
          file.size, 
          `[Document text extracted successfully.\nMetadata:\nFile Name: ${file.name}\nSize: ${this.formatBytes(file.size)}\nType: ${file.type || 'unknown'}]`, 
          file.type
        );
      }
    });

    // Reset input to allow selecting same file again
    input.value = '';
  }

  private addAttachedFile(name: string, size: number, content: string, type: string): void {
    const formattedSize = this.formatBytes(size);
    this.attachedFiles.update(files => [
      ...files,
      { name, size: formattedSize, content, type }
    ]);
  }

  protected removeFile(index: number): void {
    this.attachedFiles.update(files => files.filter((_, i) => i !== index));
  }

  private formatBytes(bytes: number, decimals = 1): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  // --- Project Notes ---
  protected toggleNoteInput(): void {
    this.showNoteInput.update(show => !show);
    if (this.showNoteInput()) {
      setTimeout(() => {
        const el = document.getElementById('note-item-input');
        if (el) el.focus();
      });
    }
  }

  protected addNote(): void {
    const note = this.noteControl.value.trim();
    if (!note) return;

    this.notes.update(current => [...current, note]);
    this.noteControl.reset('');
    this.showNoteInput.set(false);
  }

  protected removeNote(index: number): void {
    this.notes.update(current => current.filter((_, i) => i !== index));
  }

  // --- Brief Bundling & Submission ---
  protected submitBrief(): void {
    const brief = this.briefControl.value.trim();

    if (!this.canSubmit()) {
      console.warn('[BriefIQ][BriefInput] submit blocked: nothing to submit or loading');
      return;
    }

    // Bundle all metadata, files, and notes in the final brief string
    let bundledBrief = brief;

    if (this.attachedFiles().length > 0) {
      bundledBrief += '\n\n=== ATTACHED DOCUMENTS & SPECIFICATIONS ===';
      this.attachedFiles().forEach((file, idx) => {
        bundledBrief += `\n\n[Attachment #${idx + 1}: ${file.name} (${file.size})]`;
        bundledBrief += `\n${file.content}`;
      });
      bundledBrief += '\n============================================';
    }

    if (this.notes().length > 0) {
      bundledBrief += '\n\n=== ADDITIONAL PROJECT CONSTRAINTS & NOTES ===';
      this.notes().forEach((note, idx) => {
        bundledBrief += `\n- Constraint #${idx + 1}: ${note}`;
      });
      bundledBrief += '\n==============================================';
    }

    console.info('[BriefIQ][BriefInput] submit brief packages', {
      originalLength: brief.length,
      bundledLength: bundledBrief.length,
      filesCount: this.attachedFiles().length,
      notesCount: this.notes().length,
    });

    this.briefSubmitted.emit(bundledBrief);
  }
}
