import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { PolicySummary, PolicyStatus } from '../../models/policy.model';

@Component({
  selector: 'app-policy-table',
  standalone: true,
  imports: [CommonModule, MatTableModule, MatSelectModule, MatFormFieldModule, MatIconModule, FormsModule],
  template: `
    @if (policies.length === 0) {
      <div class="empty">
        <mat-icon>search_off</mat-icon>
        <p>No policies match your criteria.</p>
      </div>
    } @else {
      <table mat-table [dataSource]="policies" class="ptable">
        <ng-container matColumnDef="policy_ref">
          <th mat-header-cell *matHeaderCellDef>Policy Ref</th>
          <td mat-cell *matCellDef="let p"><span class="ref">{{ p.policy_ref }}</span></td>
        </ng-container>
        <ng-container matColumnDef="insured_name">
          <th mat-header-cell *matHeaderCellDef>Insured</th>
          <td mat-cell *matCellDef="let p"><span class="insured">{{ p.insured_name }}</span></td>
        </ng-container>
        <ng-container matColumnDef="lob_name">
          <th mat-header-cell *matHeaderCellDef>Line of Business</th>
          <td mat-cell *matCellDef="let p" class="muted">{{ p.lob_name }}</td>
        </ng-container>
        <ng-container matColumnDef="broker">
          <th mat-header-cell *matHeaderCellDef>Broker</th>
          <td mat-cell *matCellDef="let p" class="muted">{{ p.broker }}</td>
        </ng-container>
        <ng-container matColumnDef="policy_type">
          <th mat-header-cell *matHeaderCellDef>Type</th>
          <td mat-cell *matCellDef="let p">
            <span class="badge" [class.referral]="p.policy_type==='referral'" [class.decline]="p.policy_type==='decline'">
              {{ p.policy_type === 'referral' ? 'Referral' : 'Decline' }}
            </span>
          </td>
        </ng-container>
        <ng-container matColumnDef="submission_date">
          <th mat-header-cell *matHeaderCellDef>Submitted</th>
          <td mat-cell *matCellDef="let p" class="muted date">{{ p.submission_date }}</td>
        </ng-container>
        <ng-container matColumnDef="status">
          <th mat-header-cell *matHeaderCellDef>Status</th>
          <td mat-cell *matCellDef="let p" (click)="$event.stopPropagation()">
            <mat-form-field appearance="outline" class="status-sel">
              <mat-select [value]="p.status" (selectionChange)="statusChanged.emit({policyRef:p.policy_ref,status:$event.value})">
                <mat-option value="review"><span class="dot d-rev"></span>Review</mat-option>
                <mat-option value="in_progress"><span class="dot d-prog"></span>In Progress</mat-option>
                <mat-option value="completed"><span class="dot d-done"></span>Completed</mat-option>
              </mat-select>
            </mat-form-field>
          </td>
        </ng-container>
        <ng-container matColumnDef="action">
          <th mat-header-cell *matHeaderCellDef></th>
          <td mat-cell *matCellDef="let p">
            <mat-icon class="row-arrow">chevron_right</mat-icon>
          </td>
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="cols"></tr>
        <tr mat-row *matRowDef="let row; columns: cols;"
            class="prow" [class.sel]="row.policy_ref===selectedPolicyRef"
            (click)="policySelected.emit(row)"></tr>
      </table>
    }
  `,
  styles: [`
    .ptable { width: 100%; }
    .ptable th.mat-mdc-header-cell {
      font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.7px;
      color: var(--text-3); background: var(--surface-2);
      padding: 11px 14px; border-bottom: 1px solid var(--border);
    }
    .ptable td.mat-mdc-cell {
      padding: 11px 14px; font-size: 13px; color: var(--text);
      border-bottom: 1px solid var(--border-light);
    }
    .prow { cursor: pointer; transition: background 0.1s; }
    .prow:hover { background: var(--hw-surface); }
    .prow.sel {
      background: var(--hw-subtle);
      box-shadow: inset 3px 0 0 var(--hw);
    }
    .ref {
      font-family: 'SF Mono','Fira Code',monospace;
      font-size: 12px; font-weight: 600; color: var(--hw);
    }
    .insured { font-weight: 500; }
    .muted { color: var(--text-2); }
    .date { font-size: 12px; }
    .badge {
      display: inline-block; padding: 3px 9px;
      border-radius: var(--r-full); font-size: 10px;
      font-weight: 700; letter-spacing: 0.3px; text-transform: uppercase;
    }
    .badge.referral { background: var(--warn-bg); color: var(--warn); border: 1px solid var(--warn-border); }
    .badge.decline  { background: var(--hw-surface); color: var(--hw); border: 1px solid var(--hw-subtle); }
    .status-sel { width: 130px; font-size: 12px; }
    .status-sel .mat-mdc-form-field-subscript-wrapper { display: none; }
    .dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; margin-right: 6px; vertical-align: middle; }
    .d-rev  { background: var(--warn); }
    .d-prog { background: var(--info); }
    .d-done { background: var(--success); }
    .row-arrow { font-size: 18px; width: 18px; height: 18px; color: var(--border-strong); transition: color 0.12s; }
    .prow:hover .row-arrow { color: var(--hw); }
    .empty { padding: 56px 24px; text-align: center; color: var(--text-3); }
    .empty mat-icon { font-size: 48px; width: 48px; height: 48px; opacity: 0.25; }
    .empty p { margin: 12px 0 0; font-size: 14px; }
  `],
})
export class PolicyTableComponent {
  @Input() policies: PolicySummary[] = [];
  @Input() selectedPolicyRef: string | null = null;
  @Output() policySelected = new EventEmitter<PolicySummary>();
  @Output() statusChanged = new EventEmitter<{ policyRef: string; status: PolicyStatus }>();
  cols = ['policy_ref','insured_name','lob_name','broker','policy_type','submission_date','status','action'];
}
