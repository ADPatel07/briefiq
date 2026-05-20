import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-ai-status',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ai-status.html',
})
export class AiStatusComponent {
  @Input() loadingMessage = '';
  @Input() errorMessage = '';
  @Output() retry = new EventEmitter<void>();
}
