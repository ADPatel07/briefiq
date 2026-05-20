import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { LiveSummary } from '../../briefiq.models';

@Component({
  selector: 'app-live-summary',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './live-summary.html',
})
export class LiveSummaryComponent {
  @Input({ required: true }) summary!: LiveSummary;
}
