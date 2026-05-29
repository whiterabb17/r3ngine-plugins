# Active Directory Plugin — Configuration

## `manifest.yaml`

```yaml
name: "Active Directory Intelligence"
version: "1.0.0"
description: "Enterprise Active Directory assessment, identity intelligence, and exposure management via Temporal workflows."
runtime:
  run after: "standalone"
temporal:
  workflows:
    - "backend.temporal_exports.ADAssessmentWorkflow"
  activities:
    - "backend.temporal_exports.initialize_assessment_activity"
    - "backend.temporal_exports.run_dns_discovery_activity"
    - "backend.temporal_exports.run_cert_discovery_activity"
    - "backend.temporal_exports.run_trust_analysis_activity"
    - "backend.temporal_exports.run_exposure_correlation_activity"
    - "backend.temporal_exports.run_neo4j_sync_activity"
    - "backend.temporal_exports.finalize_assessment_activity"
    - "backend.temporal_exports.run_ingestion_activity"
ui:
  menu_item: "Active Directory"
  menu_path: "/p/active-directory"
  entry_export: "ADDashboardPage"
```

## `tools.yaml`

```yaml
tools:
  - name: dig
    description: "DNS lookup utility"
    binary: dig
  - name: nslookup
    description: "DNS name server lookup"
    binary: nslookup
```

---

## Per-Assessment Config

The `config` field in an `ADAssessment` allows overriding defaults for a specific assessment:

```json
{
  "confidence_threshold": 0.6,
  "enable_neo4j_sync": false,
  "cert_transparency_limit": 200
}
```

| Key | Default | Description |
|---|---|---|
| `enable_neo4j_sync` | `true` | Whether to sync results to Neo4j |
| `cert_transparency_limit` | `100` | Max cert records to process from crt.sh |
