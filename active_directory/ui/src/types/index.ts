export interface ADAssessment {
  id: number;
  name: string;
  target_domain: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
  created_at: string;
  completed_at: string | null;
  workflow_id: string | null;
  config: Record<string, unknown>;
  findings_count?: number;
}

export interface ADFinding {
  id: number;
  title: string;
  description: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  finding_type: string;
  affected_object: string;
  remediation: string;
  evidence: Record<string, unknown>;
  created_at: string;
}

export interface ADTrust {
  id: number;
  source_domain: string;
  target_domain: string;
  trust_type: string;
  trust_direction: string;
  is_transitive: boolean;
  sid_filtering_enabled: boolean;
}

export interface ADExposure {
  id: number;
  hostname: string;
  ip_address: string | null;
  exposure_type: string;
  risk_score: number;
  is_internet_facing: boolean;
  port: number | null;
  service_banner: string;
  correlated_domain: string | null;
  created_at: string;
}

export interface CytoscapeGraph {
  nodes: Array<{ data: Record<string, unknown> }>;
  edges: Array<{ data: Record<string, unknown> }>;
}

export interface WSMessage {
  type: 'phase_started' | 'phase_completed' | 'activity_complete' | 'error';
  payload: Record<string, unknown>;
}
