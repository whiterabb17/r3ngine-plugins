const BASE = '/api/plugins/compliance_assessment';

function getCsrfToken(): string {
  return document.cookie.split('; ')
    .find(row => row.startsWith('csrftoken='))?.split('=')[1] ?? '';
}

async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${endpoint}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': getCsrfToken(),
      ...(options.headers ?? {}),
    },
    ...options,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  if (res.status === 204) return {} as T;
  return res.json() as Promise<T>;
}

export interface ComplianceAssessmentSummary {
  id: number;
  scan_history: number;
  framework: string;
  status: string;
  pass_count: number;
  fail_count: number;
  partial_count: number;
  manual_count: number;
  compliance_score: number | null;
  html_report_path: string;
  pdf_report_path: string;
  attestation_path: string;
  created_at: string;
  completed_at: string | null;
}

export interface Evidence {
  id: number;
  evidence_type: string;
  evidence_id: number | null;
  description: string;
  detail: Record<string, unknown>;
}

export interface ControlResult {
  id: number;
  control_id: string;
  control_name: string;
  description: string;
  section: string;
  result: 'PASS' | 'FAIL' | 'PARTIAL' | 'MANUAL';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'MANUAL';
  static_remediation: string;
  ai_remediation: string;
  ai_enriched_at: string | null;
  evidence: Evidence[];
}

export const fetchAssessmentsByScan = (scanId: number) =>
  apiFetch<{ results?: ComplianceAssessmentSummary[] } | ComplianceAssessmentSummary[]>(
    `/assessments/?scan_id=${scanId}`
  ).then((d) => (Array.isArray(d) ? d : (d as { results?: ComplianceAssessmentSummary[] }).results ?? []));

export const fetchAssessmentDetail = (assessmentId: number) =>
  apiFetch<ComplianceAssessmentSummary & { controls: ControlResult[] }>(`/assessments/${assessmentId}/`);

export const fetchControlsByAssessment = (assessmentId: number) =>
  apiFetch<{ results?: ControlResult[] } | ControlResult[]>(
    `/controls/?assessment_id=${assessmentId}`
  ).then((d) => (Array.isArray(d) ? d : (d as { results?: ControlResult[] }).results ?? []));

export const enrichControlWithAI = (controlId: number) =>
  apiFetch<{ ai_remediation: string }>(`/controls/${controlId}/enrich/`, { method: 'POST' });

export const reportDownloadUrl = (assessmentId: number, format: 'html' | 'pdf' | 'attestation') =>
  `${BASE}/assessments/${assessmentId}/download/${format}/`;
