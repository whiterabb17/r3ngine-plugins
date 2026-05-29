# Active Directory Plugin — Temporal Workflow

## Overview

The AD plugin uses a 7-phase Temporal workflow that runs all assessment activities sequentially with retry policies and real-time WebSocket progress events.

---

## Workflow: `ADAssessmentWorkflow`

**Temporal name:** `"ADAssessmentWorkflow"`  
**Task queue:** `python-orchestrator-queue`

The workflow is **not injected** into `MasterScanWorkflow`. It starts independently via:
```http
POST /api/plugins/active_directory/assessments/{id}/start/
```

### Input Payload

```python
{
    "assessment_id": 1,
    "target_domain": "example.com",
    "config": {}  # Optional per-assessment config overrides
}
```

### Execution Phases

```
ADAssessmentWorkflow.run(payload)
  ├─ Phase 1: initialize_assessment_activity     (2 min timeout)
  ├─ Phase 2: run_dns_discovery_activity         (30 min timeout)
  ├─ Phase 3: run_cert_discovery_activity        (15 min timeout)
  ├─ Phase 4: run_trust_analysis_activity        (1 hour timeout)
  ├─ Phase 5: run_exposure_correlation_activity  (1 hour timeout)
  ├─ Phase 6: run_neo4j_sync_activity            (30 min timeout)
  └─ Phase 7: finalize_assessment_activity       (5 min timeout)
```

On any exception, the workflow calls `finalize_assessment_activity` with `status='FAILED'` before re-raising.

### Retry Policy

All activities use `_RETRY_STANDARD`:

```python
RetryPolicy(
    maximum_attempts=2,
    initial_interval=timedelta(minutes=1),
    backoff_coefficient=2.0,
    maximum_interval=timedelta(minutes=10),
)
```

---

## Activity Reference

### `initialize_assessment_activity`

Sets `ADAssessment.status = 'RUNNING'`, records `started_at`, and emits `assessment_started` to the Redis Stream.

---

### `run_dns_discovery_activity`

DNS-based domain controller discovery.

**Technique:** Resolves SRV records:
- `_ldap._tcp.<domain>`
- `_kerberos._tcp.<domain>`
- `_gc._tcp.<domain>`
- `_ldap._tcp.dc._msdcs.<domain>`

**Output:**
- Creates `ADDomain` records for each discovered DC.
- Emits `identity_discovered`, `workflow_progress`, `graph_updated`, `phase_completed` events.
- Returns: `{"discovered": [...], "count": N}`

**Role Inference:**

| SRV Record Pattern | Inferred Role |
|---|---|
| `_gc._tcp` | Global Catalog |
| `_kerberos._tcp` | KDC |
| `_ldap._tcp.dc._msdcs` | Domain Controller |
| *(default)* | LDAP |

---

### `run_cert_discovery_activity`

Certificate transparency log enumeration via `crt.sh`.

**Technique:** Queries `https://crt.sh/?q=%.{target_domain}&output=json` and filters results matching AD service keywords: `adfs`, `owa`, `exchange`, `mail`, `vpn`, `ldap`, `dc`, `dc01`, `dc02`, `domain`.

**Output:**
- Returns: `{"cert_findings": [...], "count": N}`
- Each finding: `{name, issuer, not_after, matched_keyword}`

---

### `run_trust_analysis_activity`

Analyses `ADTrust` records stored in the database and computes risk scores.

**Risk Scoring:**

| Factor | Score Added |
|---|---|
| `is_transitive = True` | +30 |
| `direction = 'BIDIRECTIONAL'` | +25 |
| `trust_type = 'FOREST'` | +20 |
| `is_selective_auth = False` | +15 |
| *Maximum score* | 100 |

Emits `trust_discovered` and `finding_detected` (severity=HIGH) for trusts with `is_selective_auth=False`.

---

### `run_exposure_correlation_activity`

Correlates certificate transparency findings with known AD service exposure patterns.

**Exposure Pattern Mapping:**

| Keyword | Exposure Type |
|---|---|
| `adfs` | ADFS |
| `owa` | OWA |
| `exchange`, `mail` | EXCHANGE |
| `vpn` | VPN |
| `ldap` | LDAP |
| `rdp` | RDP |
| `winrm` | WINRM |

Creates `ADExposure` records with `risk_score=50.0` baseline. Emits `finding_detected` (HIGH/MEDIUM) for exposures with `risk_score >= 70`.

---

### `run_neo4j_sync_activity`

Syncs `ADDomain` records to Neo4j as graph nodes.

**Cypher Query Used:**
```cypher
MERGE (d:ADDomain {fqdn: $fqdn, assessment_id: $aid})
SET d.name = $name, d.forest_root = $forest_root,
    d.dc_count = $dc_count, d.user_count = $user_count
RETURN id(d) as node_id
```

Uses `reNgine.utils.graph.Neo4jManager` from the core platform. Failure is non-fatal (logged as warning).

---

### `finalize_assessment_activity`

Sets `ADAssessment.status` to the terminal state (`COMPLETED`, `FAILED`, or `CANCELLED`) and records `completed_at`. Emits `assessment_finished` event.

---

### `run_ingestion_activity`

Processes an uploaded data file (BloodHound, LDAP dump, custom JSON) and syncs results to Neo4j. Called when a file is uploaded via `POST /assessments/{id}/ingest/`.

---

## WebSocket Event Types

All activities emit structured events to the Redis Stream `ad:assessment:{assessment_id}`:

| Event Type | When Emitted |
|---|---|
| `assessment_started` | Start of `initialize_assessment_activity` |
| `phase_started` | Start of each phase |
| `phase_completed` | Completion of each phase |
| `workflow_progress` | Progress percentage updates |
| `identity_discovered` | New DC or identity entity found |
| `trust_discovered` | New trust relationship found |
| `finding_detected` | High-risk finding identified |
| `correlation_completed` | Exposure correlation done |
| `graph_updated` | Neo4j graph was updated |
| `assessment_finished` | Assessment reached terminal state |
