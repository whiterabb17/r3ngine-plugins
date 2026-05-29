export type Severity = 'Critical' | 'High' | 'Medium' | 'Low' | 'Info' | 'Unknown';

export interface Vulnerability {
  id: number;
  name: string;
  severity: Severity;
  discovered_date: string;
  source: string | null;
  http_url: string | null;
  description: string | null;
  impact: string | null;
  remediation: string | null;
  cvss_score: number | null;
  cvss_metrics: string | null;
  curl_command: string | null;
  request: string | null;
  response: string | null;
  open_status: boolean;
  validation_status: 'unverified' | 'verified' | 'not_working' | 'patched';
  validation_confidence: number | null;
  validation_results: {
    id: number;
    validated_at: string;
    tool_name: string;
    is_safe: boolean;
    evidence: any;
    payload: string | null;
    request_dump: string | null;
    response_dump: string | null;
  }[];
  tags: { id: number; name: string }[];
  cve_ids: { id: number; name: string }[];
  cwe_ids: { id: number; name: string }[];
  scan_history: {
    id: number;
    domain: {
      name: string;
      slug: string;
    };
    completed_ago: string | null;
  };
}
export interface VulnerabilityResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Vulnerability[];
}
