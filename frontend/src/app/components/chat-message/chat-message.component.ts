import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ChatMessage } from '../../models/chat.model';

@Component({
  selector: 'app-chat-message',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatTooltipModule],
  template: `
    <div class="msg" [class.user]="message.role==='user'" [class.ai]="message.role==='assistant'">
      @if (message.role === 'assistant') {
        <div class="av av-ai"><span>🥷</span></div>
      }
      <div class="bwrap">
        <div class="bubble">
          <div class="content" [innerHTML]="formatContent(message.content)"></div>
          @if (message.isStreaming && message.content) {
            <span class="cursor">|</span>
          }
        </div>
        @if (message.role === 'assistant' && !message.isStreaming && message.content) {
          <div class="actions">
            <button class="act-btn" (click)="copy(message.content)" [matTooltip]="copied ? 'Copied!' : 'Copy'">
              <mat-icon>{{ copied ? 'check' : 'content_copy' }}</mat-icon>
              <span>{{ copied ? 'Copied' : 'Copy' }}</span>
            </button>
          </div>
        }
      </div>
      @if (message.role === 'user') {
        <div class="av av-user">SM</div>
      }
    </div>
  `,
  styles: [`
    .msg { display: flex; gap: 8px; margin: 10px 0; animation: fi 0.22s ease-out; }
    @keyframes fi { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: none; } }
    .msg.user { flex-direction: row-reverse; }
    .av {
      width: 28px; height: 28px; border-radius: 7px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; font-size: 12px; font-weight: 700;
    }
    .av-ai {
      background: linear-gradient(135deg, var(--hw-surface), var(--hw-subtle));
      font-size: 14px; border: 1px solid var(--hw-subtle);
    }
    .av-user { background: var(--hw); color: white; font-size: 9.5px; letter-spacing: 0.5px; }

    .bwrap { max-width: 86%; display: flex; flex-direction: column; }
    .bubble {
      padding: 10px 13px; border-radius: 14px;
      line-height: 1.65; font-size: 13px; word-break: break-word;
    }
    .msg.user .bubble {
      background: var(--hb); color: white;
      border-bottom-right-radius: 4px;
    }
    .msg.ai .bubble {
      background: white; border: 1px solid var(--border);
      border-bottom-left-radius: 4px; color: var(--text);
      box-shadow: var(--sh-xs);
    }
    .content { white-space: pre-wrap; }
    .cursor { animation: blink 0.7s infinite; color: var(--hw); font-weight: 300; }
    @keyframes blink { 50% { opacity: 0; } }

    .actions { display: flex; gap: 3px; padding: 3px 0 0 2px; opacity: 0; transition: opacity 0.12s; }
    .msg:hover .actions { opacity: 1; }
    .act-btn {
      display: inline-flex; align-items: center; gap: 3px;
      padding: 3px 8px; border: 1px solid var(--border); border-radius: 5px;
      background: white; color: var(--text-3); font-size: 10px;
      font-family: inherit; font-weight: 500; cursor: pointer; transition: all 0.12s;
    }
    .act-btn:hover { border-color: var(--hw); color: var(--hw); background: var(--hw-surface); }
    .act-btn mat-icon { font-size: 12px; width: 12px; height: 12px; }
  `],
})
export class ChatMessageComponent {
  @Input() message!: ChatMessage;
  copied = false;

  formatContent(content: string): string {
    if (!content) return '';
    let f = content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    f = f.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>').replace(/\n/g, '<br>');
    return f;
  }

  copy(text: string): void {
    navigator.clipboard.writeText(text).then(() => { this.copied = true; setTimeout(() => this.copied = false, 2000); });
  }
}
