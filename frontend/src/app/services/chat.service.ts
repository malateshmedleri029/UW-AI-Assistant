import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { ChatEvent } from '../models/chat.model';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private apiUrl = `${environment.apiUrl}/api/chat`;

  sendMessage(policyRef: string, message: string, sessionId?: string): Observable<ChatEvent> {
    const subject = new Subject<ChatEvent>();

    fetch(this.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        policy_ref: policyRef,
        message: message,
        session_id: sessionId || null,
      }),
    })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';

        const processStream = (): Promise<void> => {
          return reader.read().then(({ done, value }) => {
            if (done) {
              subject.complete();
              return;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed.startsWith('data:')) {
                const jsonStr = trimmed.slice(5).trim();
                if (jsonStr) {
                  try {
                    const data = JSON.parse(jsonStr);
                    subject.next(data as ChatEvent);
                  } catch {
                    // skip malformed JSON
                  }
                }
              }
            }

            return processStream();
          });
        };

        return processStream();
      })
      .catch((err) => {
        subject.error(err);
      });

    return subject.asObservable();
  }
}
