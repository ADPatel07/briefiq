import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { ProjectPrd } from '../../briefiq.models';
import { formatPrdPrintableHtml, formatPrdReadme, sanitizeFileName } from '../../briefiq-utils';

interface TocSection {
  id: string;
  label: string;
}

@Component({
  selector: 'app-prd-output',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './prd-output.html',
})
export class PrdOutputComponent {
  @Input({ required: true }) prd!: ProjectPrd;
  @Output() startOver = new EventEmitter<void>();

  public readonly sectionsList: TocSection[] = [
    { id: 'readiness', label: 'Build Readiness' },
    { id: 'client-clarifications', label: 'Client Sign-off' },
    { id: 'summary', label: 'Project Summary' },
    { id: 'users', label: 'Users & Roles' },
    { id: 'features', label: 'Core Features' },
    { id: 'mvp', label: 'MVP Scope' },
    { id: 'out-of-scope', label: 'Post-MVP' },
    { id: 'assumptions', label: 'Assumptions' },
    { id: 'scoping-factors', label: 'Scoping Factors' },
    { id: 'next-steps', label: 'Next Steps' },
  ];

  public activeSectionId = 'readiness';

  public get readinessLabel(): string {
    const score = this.prd.sections.confidenceScore.score;

    if (score >= 80) {
      return 'Ready to estimate';
    }

    if (score >= 60) {
      return 'Needs client confirmation';
    }

    return 'High clarification needed';
  }

  public scrollToSection(id: string): void {
    this.activeSectionId = id;
    const element = document.getElementById(id);

    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  public downloadReadme(): void {
    const readme = formatPrdReadme(this.prd);
    this.downloadText(
      readme,
      `${sanitizeFileName(this.prd.projectName)}-README.md`,
      'text/markdown;charset=utf-8',
    );
  }

  public exportPdf(): void {
    if (typeof window === 'undefined') {
      return;
    }

    const printWindow = window.open('', '_blank');

    if (!printWindow) {
      return;
    }

    printWindow.opener = null;
    printWindow.document.open();
    printWindow.document.write(formatPrdPrintableHtml(this.prd));
    printWindow.document.close();
    printWindow.focus();
    printWindow.setTimeout(() => printWindow.print(), 250);
  }

  private downloadText(content: string, fileName: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }
}
