export type PolicyType = 'referral' | 'decline';
export type PolicyStatus = 'review' | 'in_progress' | 'completed';

export interface PolicySummary {
  policy_ref: string;
  insured_name: string;
  broker: string;
  line_of_business: string;
  lob_name: string;
  policy_type: PolicyType;
  submission_date: string;
  status: PolicyStatus;
  assigned_uw: string;
}

export interface QAPair {
  question: string;
  answer: string;
  severity: string;
  flag: string;
}

export interface ReratingEvent {
  rerate_number: number;
  date: string;
  reason: string;
  premium_before: number;
  premium_after: number;
  changes: string[];
}

export interface PolicyReasons {
  policy_ref: string;
  policy_type: PolicyType;
  qa_pairs: QAPair[];
}

export interface ReratingHistory {
  policy_ref: string;
  rerate_count: number;
  current_premium: number;
  initial_premium: number;
  events: ReratingEvent[];
}

export const LOB_OPTIONS = [
  { code: 'PL', name: 'Professional Liability' },
  { code: 'DO', name: 'Directors & Officers' },
  { code: 'EO', name: 'Errors & Omissions' },
  { code: 'CY', name: 'Cyber Liability' },
  { code: 'MC', name: 'Marine Cargo' },
  { code: 'EL', name: 'Environmental Liability' },
  { code: 'AV', name: 'Aviation' },
  { code: 'XS', name: 'Excess & Surplus' },
];
