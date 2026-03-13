export type MessageRole = 'user' | 'assistant';

export interface ChatMessage {
  role: MessageRole;
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  isEmail?: boolean;
}

export interface PromptSuggestion {
  label: string;
  message: string;
}

export interface ChatEvent {
  type: 'text' | 'tool_call' | 'prompt_suggestions' | 'done' | 'error';
  content?: string;
  tool_name?: string;
  suggestions?: string[];
  session_id?: string;
}
