import { Component, ElementRef, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ChatMessageComponent } from '../chat-message/chat-message.component';
import { ChatPromptsComponent } from '../chat-prompts/chat-prompts.component';
import { ChatService } from '../../services/chat.service';
import { PolicySummary } from '../../models/policy.model';
import { ChatMessage } from '../../models/chat.model';

@Component({
  selector: 'app-chat-window',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatIconModule, MatButtonModule, MatTooltipModule,
    ChatMessageComponent, ChatPromptsComponent,
  ],
  template: `
    <div class="panel" [class.open]="!!policy">
      @if (policy) {

        <!-- Header -->
        <div class="p-header">
          <div class="p-hdr-left">
            <div class="p-badge">🥷</div>
            <div class="p-hdr-info">
              <span class="p-title">Smart Assistant</span>
              <div class="p-meta">
                <span class="ref-tag">{{ policy.policy_ref }}</span>
                <span class="type-tag" [class.r]="policy.policy_type==='referral'" [class.d]="policy.policy_type==='decline'">
                  {{ policy.policy_type === 'referral' ? 'Referral' : 'Decline' }}
                </span>
              </div>
            </div>
          </div>
          <button class="close-btn" (click)="close.emit()" matTooltip="Close">
            <span class="close-x">✕</span>
          </button>
        </div>

        <!-- Context bar -->
        <div class="ctx-bar">
          <mat-icon class="ctx-ico">business</mat-icon>
          <div class="ctx-txt">
            <span class="ctx-name">{{ policy.insured_name }}</span>
            <span class="ctx-sub">{{ policy.lob_name }} · {{ policy.broker }}</span>
          </div>
          <span class="ctx-status" [class]="'cs-' + policy.status">
            {{ policy.status === 'review' ? 'Review' : policy.status === 'in_progress' ? 'In Progress' : 'Done' }}
          </span>
        </div>

        <!-- Messages -->
        <div class="msgs" #messagesArea>
          @if (messages.length === 0) {
            <div class="welcome">
              <div class="w-ico">🥷</div>
              <h3>Hello, Sarah!</h3>
              <p>Ready to analyze <strong>{{ policy.insured_name }}</strong>. Select a prompt or type below.</p>
              <div class="w-caps">
                <div class="w-cap"><span>📋</span><span>Referral & Decline Analysis</span></div>
                <div class="w-cap"><span>📊</span><span>Re-rating & Premium History</span></div>
                <div class="w-cap"><span>✉️</span><span>Broker Email Drafting</span></div>
                <div class="w-cap"><span>🔄</span><span>Status Updates</span></div>
              </div>
            </div>
          }
          @for (msg of messages; track $index) {
            <app-chat-message [message]="msg"></app-chat-message>
          }
          @if (isStreaming && messages.length > 0 && messages[messages.length-1].content === '') {
            <div class="thinking">
              <div class="t-av">🥷</div>
              <div class="t-bub">
                <div class="t-dots"><span></span><span></span><span></span></div>
                <span class="t-txt">Analyzing policy data…</span>
              </div>
            </div>
          }
        </div>

        <!-- Prompts -->
        <div class="prompts-area" [class.hidden]="currentPrompts.length===0">
          <app-chat-prompts [prompts]="currentPrompts" (promptClicked)="onPromptClick($event)"></app-chat-prompts>
        </div>

        <!-- Input -->
        <div class="input-area">
          <div class="input-row" [class.focused]="inputFocused">
            <input class="chat-input"
                   [(ngModel)]="userInput"
                   (keydown.enter)="sendMessage()"
                   (focus)="inputFocused=true" (blur)="inputFocused=false"
                   placeholder="Ask about this policy…"
                   [disabled]="isStreaming">
            <button class="send-btn" [class.ready]="userInput.trim()&&!isStreaming"
                    (click)="sendMessage()" [disabled]="!userInput.trim()||isStreaming">
              <mat-icon>send</mat-icon>
            </button>
          </div>
          <p class="powered">🥷 Powered by Gemini 2.5 Flash · Grounded in API data</p>
        </div>

      }
    </div>
  `,
  styles: [`
    .panel {
      position: fixed; right: -520px; top: 60px; width: 520px;
      height: calc(100vh - 60px); background: var(--surface-2);
      display: flex; flex-direction: column;
      box-shadow: -4px 0 20px rgba(26,24,22,0.12);
      transition: right 0.3s cubic-bezier(0.4,0,0.2,1);
      z-index: 150; border-left: 1px solid var(--border);
    }
    .panel.open { right: 0; }

    /* Header */
    .p-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 11px 16px;
      background: linear-gradient(90deg, var(--hb) 0%, var(--hb-2) 100%);
      color: var(--text-inv); flex-shrink: 0;
      border-bottom: 2px solid var(--hw);
    }
    .p-hdr-left { display: flex; align-items: center; gap: 10px; }
    .p-badge {
      width: 34px; height: 34px; border-radius: 9px;
      background: var(--hw); border: 1px solid rgba(255,255,255,0.1);
      display: flex; align-items: center; justify-content: center;
      font-size: 17px; box-shadow: var(--sh-wine);
    }
    .p-hdr-info { display: flex; flex-direction: column; gap: 3px; }
    .p-title { font-size: 13.5px; font-weight: 600; }
    .p-meta { display: flex; align-items: center; gap: 6px; }
    .ref-tag {
      font-family: 'SF Mono','Fira Code',monospace; font-size: 10.5px;
      background: rgba(255,255,255,0.1); padding: 1px 7px; border-radius: 3px;
    }
    .type-tag {
      font-size: 9px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.5px; padding: 1px 7px; border-radius: 3px;
    }
    .type-tag.r { background: rgba(217,119,6,0.25); color: #FBBF24; }
    .type-tag.d { background: rgba(110,32,53,0.4); color: #F0A0B0; }
    .close-btn {
      width: 30px; height: 30px; border-radius: 7px; border: none;
      background: rgba(255,255,255,0.08); color: var(--text-inv);
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; transition: background 0.12s;
    }
    .close-btn:hover { background: var(--hw); }
    .close-x { font-size: 15px; font-weight: 600; line-height: 1; }

    /* Context bar */
    .ctx-bar {
      display: flex; align-items: center; gap: 9px;
      padding: 9px 16px; background: var(--surface);
      border-bottom: 1px solid var(--border-light); flex-shrink: 0;
    }
    .ctx-ico { font-size: 15px; width: 15px; height: 15px; color: var(--text-3); }
    .ctx-txt { flex: 1; display: flex; flex-direction: column; }
    .ctx-name { font-size: 12.5px; font-weight: 600; color: var(--text); }
    .ctx-sub  { font-size: 10.5px; color: var(--text-3); }
    .ctx-status { font-size: 10px; font-weight: 700; padding: 3px 9px; border-radius: var(--r-full); text-transform: uppercase; letter-spacing: 0.3px; }
    .cs-review      { background: var(--warn-bg); color: var(--warn); }
    .cs-in_progress { background: var(--info-bg); color: var(--info); }
    .cs-completed   { background: var(--success-bg); color: var(--success); }

    /* Messages */
    .msgs { flex: 1; overflow-y: auto; padding: 16px 14px; }

    /* Welcome */
    .welcome {
      display: flex; flex-direction: column; align-items: center;
      text-align: center; padding: 24px 14px 10px;
    }
    .w-ico {
      width: 60px; height: 60px; border-radius: 18px;
      background: linear-gradient(135deg, var(--hw-surface), var(--hw-subtle));
      display: flex; align-items: center; justify-content: center;
      font-size: 30px; margin-bottom: 12px;
      box-shadow: 0 4px 12px var(--hw-glow-sm); border: 1px solid var(--hw-subtle);
    }
    .welcome h3 { font-size: 17px; font-weight: 700; color: var(--text); margin: 0 0 6px; }
    .welcome p {
      font-size: 13px; color: var(--text-2); line-height: 1.6;
      margin: 0 0 16px; max-width: 340px;
    }
    .welcome strong { color: var(--hw); }
    .w-caps { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; width: 100%; max-width: 340px; }
    .w-cap {
      display: flex; align-items: center; gap: 7px;
      padding: 9px 11px; background: var(--surface);
      border: 1px solid var(--border); border-radius: var(--r-sm);
      font-size: 11px; color: var(--text-2); font-weight: 500;
    }

    /* Thinking */
    .thinking { display: flex; align-items: flex-start; gap: 7px; margin: 8px 0; }
    .t-av {
      width: 28px; height: 28px; border-radius: 7px;
      background: linear-gradient(135deg, var(--hw-surface), var(--hw-subtle));
      display: flex; align-items: center; justify-content: center;
      font-size: 14px; flex-shrink: 0; border: 1px solid var(--hw-subtle);
    }
    .t-bub {
      display: flex; align-items: center; gap: 8px;
      padding: 9px 13px; background: var(--surface);
      border: 1px solid var(--border); border-radius: 12px; border-top-left-radius: 3px;
    }
    .t-dots { display: flex; gap: 3px; }
    .t-dots span {
      width: 6px; height: 6px; border-radius: 50%; background: var(--hw);
      animation: tdot 1.3s infinite ease-in-out both;
    }
    .t-dots span:nth-child(1) { animation-delay: -0.3s; }
    .t-dots span:nth-child(2) { animation-delay: -0.15s; }
    @keyframes tdot { 0%,80%,100% { transform: scale(0.45); opacity: 0.2; } 40% { transform: scale(1); opacity: 1; } }
    .t-txt { font-size: 11px; color: var(--text-3); font-style: italic; }

    /* Prompts */
    .prompts-area {
      padding: 7px 12px; background: var(--surface);
      border-top: 1px solid var(--border-light); flex-shrink: 0;
      transition: max-height 0.2s, padding 0.2s, opacity 0.2s;
      max-height: 170px; overflow: hidden;
    }
    .prompts-area.hidden { max-height: 0; padding: 0 12px; opacity: 0; pointer-events: none; }

    /* Input */
    .input-area {
      padding: 9px 12px 11px; background: var(--surface);
      border-top: 1px solid var(--border); flex-shrink: 0;
    }
    .input-row {
      display: flex; align-items: center; gap: 6px;
      border: 1.5px solid var(--border); border-radius: var(--r-full);
      padding: 3px 4px 3px 14px; background: var(--surface-2);
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .input-row.focused { border-color: var(--hw); box-shadow: 0 0 0 3px var(--hw-glow); }
    .chat-input {
      flex: 1; border: none; outline: none; background: transparent;
      font-size: 13.5px; font-family: inherit; color: var(--text); padding: 7px 0;
    }
    .chat-input::placeholder { color: var(--text-3); }
    .chat-input:disabled { opacity: 0.5; }
    .send-btn {
      width: 34px; height: 34px; border-radius: 50%; border: none;
      background: var(--border); color: var(--text-3);
      display: flex; align-items: center; justify-content: center;
      cursor: not-allowed; transition: all 0.15s; flex-shrink: 0;
    }
    .send-btn.ready { background: var(--hw); color: white; cursor: pointer; box-shadow: var(--sh-wine); }
    .send-btn.ready:hover { background: var(--hw-dark); }
    .send-btn mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .powered { text-align: center; margin: 5px 0 0; font-size: 9.5px; color: var(--text-3); }
  `],
})
export class ChatWindowComponent implements OnChanges {
  @Input() policy: PolicySummary | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() statusUpdated = new EventEmitter<void>();
  @ViewChild('messagesArea') messagesArea!: ElementRef;

  messages: ChatMessage[] = [];
  currentPrompts: string[] = [];
  userInput = '';
  isStreaming = false;
  sessionId: string | null = null;
  inputFocused = false;

  constructor(private chatService: ChatService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['policy'] && this.policy) {
      this.messages = [];
      this.sessionId = null;
      this.setInitialPrompts();
    }
  }

  private setInitialPrompts(): void {
    if (!this.policy) return;
    this.currentPrompts = this.policy.policy_type === 'referral'
      ? ['What caused this referral?', 'Show re-rating history', 'What is the current premium?', 'Frame email to broker']
      : ['What caused this decline?', 'Show re-rating history', 'What were the premium changes?', 'Frame email to broker'];
  }

  onPromptClick(prompt: string): void { this.userInput = prompt; this.sendMessage(); }

  sendMessage(): void {
    if (!this.userInput.trim() || !this.policy || this.isStreaming) return;
    const userMsg = this.userInput.trim();
    this.messages.push({ role: 'user', content: userMsg, timestamp: new Date() });
    this.userInput = '';
    this.isStreaming = true;
    const aMsg: ChatMessage = {
      role: 'assistant', content: '', timestamp: new Date(),
      isStreaming: true,
      isEmail: /email|draft|frame/i.test(userMsg),
    };
    this.messages.push(aMsg);
    this.scrollToBottom();

    this.chatService.sendMessage(this.policy.policy_ref, userMsg, this.sessionId ?? undefined).subscribe({
      next: (ev) => {
        if (ev.session_id) this.sessionId = ev.session_id;
        switch (ev.type) {
          case 'text': aMsg.content += ev.content || ''; this.scrollToBottom(); break;
          case 'tool_call':
            if (ev.tool_name === 'update_policy_status_tool') this.statusUpdated.emit();
            break;
          case 'prompt_suggestions': if (ev.suggestions) this.currentPrompts = ev.suggestions; break;
          case 'done': aMsg.isStreaming = false; this.isStreaming = false; break;
          case 'error': aMsg.content = ev.content || '⚠️ An error occurred.'; aMsg.isStreaming = false; this.isStreaming = false; break;
        }
      },
      error: () => { aMsg.content = '⚠️ Connection error. Please try again.'; aMsg.isStreaming = false; this.isStreaming = false; },
      complete: () => { aMsg.isStreaming = false; this.isStreaming = false; },
    });
  }

  private scrollToBottom(): void {
    setTimeout(() => { if (this.messagesArea) this.messagesArea.nativeElement.scrollTop = this.messagesArea.nativeElement.scrollHeight; }, 50);
  }
}
