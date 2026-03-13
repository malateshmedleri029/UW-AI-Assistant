import { Component, EventEmitter, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { LOB_OPTIONS } from '../../models/policy.model';

@Component({
  selector: 'app-policy-search',
  standalone: true,
  imports: [FormsModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatIconModule],
  template: `
    <div class="search-bar">
      <div class="search-box" [class.focused]="focused">
        <mat-icon class="s-icon">search</mat-icon>
        <input class="s-input" [(ngModel)]="searchText"
               (ngModelChange)="emit()"
               (focus)="focused=true" (blur)="focused=false"
               placeholder="Search policies, insureds or brokers…">
        @if (searchText) {
          <button class="s-clear" (click)="searchText=''; emit()">
            <mat-icon>close</mat-icon>
          </button>
        }
      </div>
      <mat-form-field appearance="outline" class="lob-select">
        <mat-label>Line of Business</mat-label>
        <mat-select [(ngModel)]="selectedLob" (ngModelChange)="emit()">
          <mat-option value="">All Lines</mat-option>
          @for (l of lobOptions; track l.code) {
            <mat-option [value]="l.code">{{ l.name }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
    </div>
  `,
  styles: [`
    .search-bar {
      display: flex; gap: 12px; padding: 18px 28px 10px; align-items: center;
    }
    .search-box {
      flex: 1; display: flex; align-items: center; gap: 10px;
      background: var(--surface); border: 1.5px solid var(--border);
      border-radius: var(--r-full); padding: 0 16px; height: 42px;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .search-box.focused {
      border-color: var(--hw); box-shadow: 0 0 0 3px var(--hw-glow-sm);
    }
    .s-icon { font-size: 18px; width: 18px; height: 18px; color: var(--text-3); }
    .s-input {
      flex: 1; border: none; outline: none; background: transparent;
      font-size: 13.5px; font-family: inherit; color: var(--text);
    }
    .s-input::placeholder { color: var(--text-3); }
    .s-clear {
      width: 22px; height: 22px; border: none; border-radius: 50%;
      background: var(--border-light); cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      color: var(--text-3); transition: background 0.12s;
    }
    .s-clear:hover { background: var(--border); }
    .s-clear mat-icon { font-size: 13px; width: 13px; height: 13px; }
    .lob-select { width: 220px; }
    .lob-select .mat-mdc-form-field-subscript-wrapper { display: none; }
  `],
})
export class PolicySearchComponent {
  @Output() filtersChanged = new EventEmitter<{ search: string; lob: string }>();
  searchText = ''; selectedLob = ''; focused = false;
  lobOptions = LOB_OPTIONS;
  emit(): void { this.filtersChanged.emit({ search: this.searchText, lob: this.selectedLob }); }
}
