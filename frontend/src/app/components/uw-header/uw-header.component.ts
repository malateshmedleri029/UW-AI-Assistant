import { Component, EventEmitter, Output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'app-uw-header',
  standalone: true,
  imports: [MatIconModule, MatButtonModule, MatTooltipModule],
  template: `
    <header class="header">
      <div class="header-left">
        <div class="logo-mark">🥷</div>
        <div class="brand">
          <span class="brand-name">UW Smart AI Assistant</span>
          <span class="brand-sub">Specialty Commercial Lines</span>
        </div>
      </div>
      <div class="header-right">
        <button mat-icon-button class="hdr-btn" (click)="refresh.emit()" matTooltip="Refresh policies">
          <mat-icon>refresh</mat-icon>
        </button>
        <button mat-icon-button class="hdr-btn" matTooltip="Notifications">
          <mat-icon>notifications_none</mat-icon>
        </button>
        <div class="divider"></div>
        <div class="profile">
          <div class="avatar">SM</div>
          <div class="profile-info">
            <span class="p-name">Sarah Mitchell</span>
            <span class="p-role">Senior Underwriter</span>
          </div>
        </div>
      </div>
    </header>
  `,
  styles: [`
    .header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 28px; height: 60px;
      background: linear-gradient(90deg, var(--hb) 0%, var(--hb-2) 100%);
      color: var(--text-inv);
      box-shadow: 0 1px 0 rgba(0,0,0,0.2), 0 2px 8px rgba(0,0,0,0.15);
      position: relative; z-index: 200;
    }
    .header::after {
      content: ''; position: absolute; bottom: 0; left: 0; right: 0;
      height: 2px; background: var(--hw);
    }
    .header-left { display: flex; align-items: center; gap: 12px; }
    .logo-mark {
      width: 36px; height: 36px; border-radius: 8px;
      background: var(--hw); display: flex; align-items: center; justify-content: center;
      font-size: 18px; box-shadow: var(--sh-wine);
      border: 1px solid rgba(255,255,255,0.1);
    }
    .brand { display: flex; flex-direction: column; gap: 1px; }
    .brand-name { font-size: 14.5px; font-weight: 600; letter-spacing: -0.2px; }
    .brand-sub { font-size: 10px; color: rgba(255,255,255,0.4); letter-spacing: 0.3px; }

    .header-right { display: flex; align-items: center; gap: 2px; }
    .hdr-btn { color: rgba(255,255,255,0.45); transition: color 0.15s; }
    .hdr-btn:hover { color: var(--text-inv); }
    .divider { width: 1px; height: 22px; background: rgba(255,255,255,0.08); margin: 0 10px; }

    .profile { display: flex; align-items: center; gap: 9px; }
    .avatar {
      width: 32px; height: 32px; border-radius: 50%;
      background: var(--hw); display: flex; align-items: center; justify-content: center;
      font-size: 10.5px; font-weight: 700; letter-spacing: 0.5px;
      box-shadow: var(--sh-wine);
    }
    .profile-info { display: flex; flex-direction: column; }
    .p-name { font-size: 12.5px; font-weight: 500; }
    .p-role { font-size: 10px; color: rgba(255,255,255,0.4); }
  `],
})
export class UwHeaderComponent {
  @Output() refresh = new EventEmitter<void>();
}
