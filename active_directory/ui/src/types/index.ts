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

export type LayoutName = 'dagre' | 'fcose' | 'circle' | 'concentric' | 'grid';

export type WSEventType =
  | 'assessment_started'
  | 'phase_started'
  | 'phase_completed'
  | 'activity_complete'
  | 'workflow_progress'
  | 'finding_detected'
  | 'trust_discovered'
  | 'identity_discovered'
  | 'graph_updated'
  | 'correlation_completed'
  | 'error';

export interface WorkflowProgressPayload {
  phase: string;
  progress_pct: number;
  message: string;
}

export interface FindingDetectedPayload {
  finding_id: string;
  title: string;
  severity: string;
  affected_object: string;
  finding_type: string;
}

export interface TrustDiscoveredPayload {
  source_domain: string;
  target_domain: string;
  trust_type: string;
  is_transitive: boolean;
}

export interface IdentityDiscoveredPayload {
  entity_type: string;
  name: string;
  count?: number;
}

export interface GraphUpdatedPayload {
  assessment_id: number;
  node_count: number;
  edge_count: number;
}

export interface CorrelationCompletedPayload {
  exposure_count: number;
  high_risk_count: number;
}

export interface WSMessage {
  type: WSEventType;
  payload: Record<string, unknown>;
}

export interface ADReport {
  metadata: {
    report_id: string;
    target_domain: string;
    assessment_name: string;
    status: string;
    generated_at: string;
  };
  executive_summary: {
    domain_count: number;
    trust_count: number;
    exposure_count: number;
    finding_counts: Record<string, number>;
    average_trust_risk: number;
    average_exposure_risk: number;
    critical_findings: Array<{ title: string; affected_object: string; finding_type: string }>;
  };
  findings: Array<{
    title: string;
    severity: string;
    affected_object: string;
    remediation: string;
    finding_type: string;
  }>;
}
