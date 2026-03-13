import { Component, HostListener, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTabGroup, MatTabsModule } from '@angular/material/tabs';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatIconModule } from '@angular/material/icon';
import { PolicySearchComponent } from '../../components/policy-search/policy-search.component';
import { PolicyTableComponent } from '../../components/policy-table/policy-table.component';
import { ChatWindowComponent } from '../../components/chat-window/chat-window.component';
import { PolicyService } from '../../services/policy.service';
import { PolicySummary, PolicyStatus } from '../../models/policy.model';

type StatFilter = 'all' | 'referral' | 'decline' | 'review';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule, MatTabsModule, MatProgressBarModule, MatIconModule,
    PolicySearchComponent, PolicyTableComponent, ChatWindowComponent,
  ],
  template: `
    @if (loading) {
      <mat-progress-bar mode="indeterminate" class="top-bar"></mat-progress-bar>
    }

    <app-policy-search (filtersChanged)="onFiltersChanged($event)"></app-policy-search>

    <div class="dashboard" [class.chat-open]="!!selectedPolicy">

      <!-- Stats -->
      <div class="stats">
        <button class="stat" [class.active]="activeStatFilter==='all'" (click)="onStatClick('all')">
          <div class="stat-icon si-all"><mat-icon>folder_open</mat-icon></div>
          <div class="stat-body">
            <span class="stat-num">{{ allPolicies.length }}</span>
            <span class="stat-lbl">Total Policies</span>
          </div>
        </button>
        <button class="stat" [class.active]="activeStatFilter==='referral'" (click)="onStatClick('referral')">
          <div class="stat-icon si-ref"><mat-icon>flag</mat-icon></div>
          <div class="stat-body">
            <span class="stat-num">{{ referralCount }}</span>
            <span class="stat-lbl">Referrals</span>
          </div>
        </button>
        <button class="stat stat-wine" [class.active]="activeStatFilter==='decline'" (click)="onStatClick('decline')">
          <div class="stat-icon si-dec"><mat-icon>block</mat-icon></div>
          <div class="stat-body">
            <span class="stat-num">{{ declineCount }}</span>
            <span class="stat-lbl">Declines</span>
          </div>
        </button>
        <button class="stat" [class.active]="activeStatFilter==='review'" (click)="onStatClick('review')">
          <div class="stat-icon si-rev"><mat-icon>hourglass_top</mat-icon></div>
          <div class="stat-body">
            <span class="stat-num">{{ reviewPolicies.length }}</span>
            <span class="stat-lbl">Awaiting Review</span>
          </div>
        </button>
      </div>

      <!-- Filtered flat view -->
      @if (activeStatFilter) {
        <div class="card card-active">
          <div class="card-hdr">
            <div class="hdr-left">
              <span class="hdr-title">{{ statFilterLabel }}</span>
              <span class="hdr-pill">{{ statFilteredPolicies.length }}</span>
            </div>
            <button class="pill-btn" (click)="clearStatFilter()">
              <mat-icon>close</mat-icon>Clear filter
            </button>
          </div>
          <app-policy-table
            [policies]="statFilteredPolicies"
            [selectedPolicyRef]="selectedPolicy?.policy_ref ?? null"
            (policySelected)="onPolicySelected($event)"
            (statusChanged)="onStatusChanged($event)">
          </app-policy-table>
        </div>
      }

      <!-- Tabbed view -->
      @if (!activeStatFilter) {
        <div class="card">
          <mat-tab-group #tabGroup animationDuration="180ms" class="ptabs">
            <mat-tab>
              <ng-template mat-tab-label>
                <div class="tlbl"><mat-icon>rate_review</mat-icon>Review
                  <span class="tcnt tc-rev">{{ reviewPolicies.length }}</span>
                </div>
              </ng-template>
              <app-policy-table [policies]="reviewPolicies" [selectedPolicyRef]="selectedPolicy?.policy_ref ?? null" (policySelected)="onPolicySelected($event)" (statusChanged)="onStatusChanged($event)"></app-policy-table>
            </mat-tab>
            <mat-tab>
              <ng-template mat-tab-label>
                <div class="tlbl"><mat-icon>pending_actions</mat-icon>In Progress
                  <span class="tcnt tc-prog">{{ inProgressPolicies.length }}</span>
                </div>
              </ng-template>
              <app-policy-table [policies]="inProgressPolicies" [selectedPolicyRef]="selectedPolicy?.policy_ref ?? null" (policySelected)="onPolicySelected($event)" (statusChanged)="onStatusChanged($event)"></app-policy-table>
            </mat-tab>
            <mat-tab>
              <ng-template mat-tab-label>
                <div class="tlbl"><mat-icon>check_circle_outline</mat-icon>Completed
                  <span class="tcnt tc-done">{{ completedPolicies.length }}</span>
                </div>
              </ng-template>
              <app-policy-table [policies]="completedPolicies" [selectedPolicyRef]="selectedPolicy?.policy_ref ?? null" (policySelected)="onPolicySelected($event)" (statusChanged)="onStatusChanged($event)"></app-policy-table>
            </mat-tab>
          </mat-tab-group>
        </div>
      }
    </div>

    <app-chat-window
      [policy]="selectedPolicy"
      (close)="selectedPolicy = null"
      (statusUpdated)="loadPolicies()">
    </app-chat-window>
  `,
  styles: [`
    .top-bar { position: fixed; top: 60px; left: 0; right: 0; z-index: 300; }

    .dashboard {
      padding: 0 28px 32px;
      transition: margin-right 0.3s cubic-bezier(0.4,0,0.2,1);
    }
    .dashboard.chat-open { margin-right: 520px; }

    /* Stats */
    .stats { display: grid; grid-template-columns: repeat(4,1fr); gap: 14px; margin-bottom: 20px; }
    .stat {
      display: flex; align-items: center; gap: 14px;
      background: var(--surface); border: 1px solid var(--border);
      border-radius: var(--r-lg); padding: 16px 18px;
      cursor: pointer; outline: none; font-family: inherit; text-align: left;
      box-shadow: var(--sh-xs); transition: border-color 0.2s, box-shadow 0.2s, transform 0.15s;
    }
    .stat:hover { box-shadow: var(--sh-md); transform: translateY(-1px); }
    .stat.active {
      border-color: var(--hw); border-width: 1.5px;
      box-shadow: 0 0 0 3px var(--hw-glow), var(--sh-sm);
    }
    .stat-icon {
      width: 40px; height: 40px; border-radius: var(--r-md);
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .stat-icon mat-icon { font-size: 19px; width: 19px; height: 19px; }
    .si-all { background: var(--hb); color: rgba(255,255,255,0.85); }
    .si-ref  { background: var(--warn-bg); color: var(--warn); }
    .si-dec  { background: var(--hw-surface); color: var(--hw); }
    .si-rev  { background: var(--info-bg); color: var(--info); }

    .stat.active .si-all { background: var(--hw); color: white; }
    .stat.active .si-dec { background: var(--hw); color: white; }

    .stat-body { display: flex; flex-direction: column; }
    .stat-num { font-size: 22px; font-weight: 700; line-height: 1; color: var(--text); }
    .stat-lbl { font-size: 11px; color: var(--text-2); margin-top: 3px; font-weight: 500; }

    /* Cards */
    .card {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: var(--r-lg); box-shadow: var(--sh-sm); overflow: hidden;
    }
    .card-active {
      border-color: var(--hw); border-width: 1.5px;
      animation: fadeUp 0.2s ease-out;
    }
    @keyframes fadeUp { from { opacity:0; transform: translateY(-5px); } to { opacity:1; transform: none; } }

    .card-hdr {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 18px; background: var(--hw-surface);
      border-bottom: 1px solid var(--hw-subtle);
    }
    .hdr-left { display: flex; align-items: center; gap: 8px; }
    .hdr-title { font-size: 13.5px; font-weight: 600; color: var(--text); }
    .hdr-pill {
      display: inline-block; padding: 2px 8px; border-radius: var(--r-full);
      background: var(--hw); color: white; font-size: 11px; font-weight: 700;
    }
    .pill-btn {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 5px 13px; border: 1px solid var(--border);
      border-radius: var(--r-full); background: white;
      font-size: 11.5px; font-family: inherit; font-weight: 500;
      color: var(--text-2); cursor: pointer; transition: all 0.12s;
    }
    .pill-btn:hover { border-color: var(--hw); color: var(--hw); }
    .pill-btn mat-icon { font-size: 12px; width: 12px; height: 12px; }

    /* Tabs */
    .tlbl { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 500; }
    .tlbl mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .tcnt {
      display: inline-flex; align-items: center; justify-content: center;
      min-width: 20px; height: 18px; padding: 0 6px;
      border-radius: var(--r-full); font-size: 11px; font-weight: 700;
    }
    .tc-rev  { background: var(--warn-bg);    color: var(--warn); }
    .tc-prog { background: var(--info-bg);    color: var(--info); }
    .tc-done { background: var(--success-bg); color: var(--success); }
  `],
})
export class HomeComponent implements OnInit {
  @ViewChild('tabGroup') tabGroup!: MatTabGroup;
  allPolicies: PolicySummary[] = [];
  filteredPolicies: PolicySummary[] = [];
  selectedPolicy: PolicySummary | null = null;
  loading = false;
  activeStatFilter: StatFilter | null = null;
  private searchText = '';
  private selectedLob = '';

  constructor(private policyService: PolicyService) {}
  ngOnInit(): void { this.loadPolicies(); }

  @HostListener('window:refresh-policies')
  loadPolicies(): void {
    this.loading = true;
    this.policyService.getPolicies().subscribe({
      next: (p) => { this.allPolicies = p; this.applyFilters(); this.loading = false; },
      error: () => { this.loading = false; },
    });
  }

  onStatClick(f: StatFilter): void { this.activeStatFilter = this.activeStatFilter === f ? null : f; }
  clearStatFilter(): void { this.activeStatFilter = null; }

  get statFilterLabel(): string {
    const m: Record<StatFilter, string> = { all: 'All Policies', referral: 'Referral Policies', decline: 'Decline Policies', review: 'Awaiting Review' };
    return this.activeStatFilter ? m[this.activeStatFilter] : '';
  }
  get statFilteredPolicies(): PolicySummary[] {
    switch (this.activeStatFilter) {
      case 'all': return this.filteredPolicies;
      case 'referral': return this.filteredPolicies.filter(p => p.policy_type === 'referral');
      case 'decline':  return this.filteredPolicies.filter(p => p.policy_type === 'decline');
      case 'review':   return this.filteredPolicies.filter(p => p.status === 'review');
      default: return [];
    }
  }

  onFiltersChanged(f: { search: string; lob: string }): void { this.searchText = f.search; this.selectedLob = f.lob; this.applyFilters(); }
  onPolicySelected(p: PolicySummary): void { this.selectedPolicy = p; }
  onStatusChanged(e: { policyRef: string; status: PolicyStatus }): void {
    this.policyService.updateStatus(e.policyRef, e.status).subscribe({ next: () => this.loadPolicies() });
  }

  get referralCount() { return this.allPolicies.filter(p => p.policy_type === 'referral').length; }
  get declineCount()  { return this.allPolicies.filter(p => p.policy_type === 'decline').length; }
  get reviewPolicies()     { return this.filteredPolicies.filter(p => p.status === 'review'); }
  get inProgressPolicies() { return this.filteredPolicies.filter(p => p.status === 'in_progress'); }
  get completedPolicies()  { return this.filteredPolicies.filter(p => p.status === 'completed'); }

  private applyFilters(): void {
    let r = [...this.allPolicies];
    if (this.searchText) {
      const q = this.searchText.toLowerCase();
      r = r.filter(p => p.policy_ref.toLowerCase().includes(q) || p.insured_name.toLowerCase().includes(q) || p.broker.toLowerCase().includes(q));
    }
    if (this.selectedLob) r = r.filter(p => p.line_of_business === this.selectedLob);
    this.filteredPolicies = r;
  }
}
