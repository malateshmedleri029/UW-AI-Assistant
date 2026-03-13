import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-chat-prompts',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="wrap">
      <span class="label">Suggested prompts</span>
      <div class="list">
        @for (p of prompts; track p) {
          <button class="pill" (click)="promptClicked.emit(p)">
            <mat-icon class="pill-ico">arrow_forward</mat-icon>{{ p }}
          </button>
        }
      </div>
    </div>
  `,
  styles: [`
    .wrap { padding: 5px 0; }
    .label {
      display: block; font-size: 9px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.9px;
      color: var(--text-3); margin-bottom: 5px;
    }
    .list { display: flex; flex-wrap: wrap; gap: 5px; }
    .pill {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 5px 11px; border: 1px solid var(--border);
      border-radius: var(--r-full); background: var(--surface-2);
      color: var(--text-2); font-size: 11px;
      font-family: inherit; font-weight: 500; cursor: pointer;
      transition: all 0.12s; white-space: nowrap;
    }
    .pill:hover {
      border-color: var(--hw); color: var(--hw);
      background: var(--hw-surface); box-shadow: 0 1px 4px var(--hw-glow-sm);
    }
    .pill-ico { font-size: 11px; width: 11px; height: 11px; opacity: 0.3; transition: opacity 0.12s; }
    .pill:hover .pill-ico { opacity: 1; }
  `],
})
export class ChatPromptsComponent {
  @Input() prompts: string[] = [];
  @Output() promptClicked = new EventEmitter<string>();
}
