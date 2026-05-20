import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnDestroy, OnInit, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

interface ScopingMilestone {
  label: string;
  subtext: string;
  stepNumber: number;
}

@Component({
  selector: 'app-prd-loader',
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './prd-loader.html',
})
export class PrdLoaderComponent implements OnInit, OnDestroy {
  @Input() loadingMessage = 'Building your PRD...';
  @Input() errorMessage = '';
  @Output() retry = new EventEmitter<void>();
  @Output() startOver = new EventEmitter<void>();

  // High-end technical/creative scoping messages
  private readonly creativeMessages: string[] = [
    'Synthesizing scoping details and user preferences...',
    'Resolving architectural layers and technical stack boundaries...',
    'Extracting functional specifications for the core MVP...',
    'Delineating high-priority features from the backlog...',
    'Drafting developer-ready user stories and system boundaries...',
    'Formulating system role matrices and security parameters...',
    'Evaluating complexity ratings and effort estimation milestones...',
    'Calculating project confidence index and risk factors...',
    'Compiling your comprehensive Product Requirement Document...',
    'Finalizing layout structures and document export templates...',
  ];

  protected readonly milestones: ScopingMilestone[] = [
    { stepNumber: 1, label: 'Response Scoping', subtext: 'Answers consolidated and verified' },
    { stepNumber: 2, label: 'Architecture Mapping', subtext: 'Tech stack and system roles resolved' },
    { stepNumber: 3, label: 'Boundary Clarification', subtext: 'MVP features prioritized, backlog deferred' },
    { stepNumber: 4, label: 'Confidence & Risk Matrix', subtext: 'Scoping certainty indexed and reviewed' },
    { stepNumber: 5, label: 'Document Generation', subtext: 'Compiling structured developer-ready PRD' },
  ];

  protected readonly currentMessage = signal<string>(this.creativeMessages[0]);
  protected readonly currentMilestoneIndex = signal<number>(0);
  protected readonly progressPercent = signal<number>(5);

  private messageInterval: any = null;
  private milestoneInterval: any = null;

  ngOnInit(): void {
    this.startDynamicCycling();
  }

  ngOnDestroy(): void {
    this.stopDynamicCycling();
  }

  private startDynamicCycling(): void {
    let messageIndex = 0;
    // Rotate creative text every 2.5 seconds
    this.messageInterval = setInterval(() => {
      if (this.errorMessage) return;
      messageIndex = (messageIndex + 1) % this.creativeMessages.length;
      this.currentMessage.set(this.creativeMessages[messageIndex]);
    }, 2500);

    // Progress milestones and percentages dynamically
    let milestoneIdx = 0;
    this.milestoneInterval = setInterval(() => {
      if (this.errorMessage) return;

      if (milestoneIdx < this.milestones.length - 1) {
        milestoneIdx++;
        this.currentMilestoneIndex.set(milestoneIdx);
        // Smoothly increase progress bar based on active milestone
        this.progressPercent.set(Math.round((milestoneIdx / this.milestones.length) * 100));
      } else {
        // Hold at 98% during final compile phases
        this.progressPercent.set(98);
      }
    }, 3500);
  }

  private stopDynamicCycling(): void {
    if (this.messageInterval) {
      clearInterval(this.messageInterval);
      this.messageInterval = null;
    }
    if (this.milestoneInterval) {
      clearInterval(this.milestoneInterval);
      this.milestoneInterval = null;
    }
  }
}
