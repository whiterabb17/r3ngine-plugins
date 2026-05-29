# Active Directory Plugin — Overview

## Purpose

The **Active Directory (AD) Intelligence** plugin provides enterprise Active Directory assessment, identity intelligence, and exposure management capabilities for contracted penetration testing and consulting engagements.

It discovers, analyses, and visualizes AD infrastructure from an external vantage point — without requiring domain credentials — using DNS discovery, certificate transparency logs, trust relationship analysis, and graph-based correlation.

---

## Key Capabilities

| Capability | Description |
|---|---|
| **DNS Discovery** | Resolves SRV records (`_ldap._tcp`, `_kerberos._tcp`, `_gc._tcp`) to enumerate domain controllers |
| **Certificate Transparency** | Queries `crt.sh` for AD-related certificates (ADFS, Exchange, OWA, VPN, LDAP) |
| **Trust Analysis** | Scores domain trust relationships by risk factors (transitivity, direction, selective auth) |
| **Exposure Correlation** | Correlates internet-facing services with AD infrastructure patterns |
| **Neo4j Graph Sync** | Syncs discovered data to Neo4j for graph-based identity intelligence |
| **Data Ingestion** | Processes BloodHound, LDAP dump, and custom JSON files for offline AD data enrichment |
| **Real-time Progress** | Streams assessment progress to the frontend via Redis Streams and WebSockets |

---

## Architecture

```
POST /api/plugins/active_directory/assessments/{id}/start/
        │
        ▼
 ADAssessmentViewSet.start_assessment()
        │
        ▼  Temporal client
 ADAssessmentWorkflow (python-orchestrator-queue)
        │
        ├─ Phase 1: initialize_assessment_activity
        ├─ Phase 2: run_dns_discovery_activity
        ├─ Phase 3: run_cert_discovery_activity
        ├─ Phase 4: run_trust_analysis_activity
        ├─ Phase 5: run_exposure_correlation_activity
        ├─ Phase 6: run_neo4j_sync_activity
        └─ Phase 7: finalize_assessment_activity
                │
                └─ Each phase streams progress events to Redis Stream
                         │
                         └─ WebSocket consumer → Frontend real-time updates
```

---

## Integration with r3ngine

### `manifest.yaml`

```yaml
runtime:
  run after: "standalone"
```

The AD plugin is **completely independent** of the main scan pipeline. It is never injected into a `MasterScanWorkflow`. Instead, assessments are started manually via the plugin's own REST API.

### Real-time Updates

Each Temporal activity sends progress events to a Redis Stream keyed as `ad:assessment:{assessment_id}`. The WebSocket consumer (`backend/consumers.py`) reads from this stream and pushes events to connected frontend clients.

### Neo4j Integration

The plugin uses the core `reNgine.utils.graph.Neo4jManager` to sync discovered AD nodes and relationships to the shared Neo4j graph database.

---

## Scope and Limitations

- **Phase 1 (Current):** External reconnaissance only — DNS, certificate transparency, trust scoring from existing DB records, and exposure correlation.
- **Phase 2 (Planned):** BloodHound/LDAP data ingestion, full graph schema, credential-based DC enumeration.
- The plugin does not interact with AD via LDAP or Kerberos by default — it is designed for external assessment without credentials.
- BloodHound data can be uploaded via the ingestion API to enrich the assessment with credential-based discovery results.
