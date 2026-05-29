# Active Directory Plugin — Backend API

## Base URL

All plugin endpoints are mounted at:
```
/api/plugins/active_directory/
```

---

## Authentication

All endpoints require a valid JWT Bearer token.

---

## `ADAssessmentViewSet`

Standard DRF ModelViewSet with custom actions.

| Method | URL | Description |
|---|---|---|
| GET | `/assessments/` | List all AD assessments |
| POST | `/assessments/` | Create a new assessment |
| GET | `/assessments/{id}/` | Get assessment detail |
| PUT/PATCH | `/assessments/{id}/` | Update assessment |
| DELETE | `/assessments/{id}/` | Delete assessment |
| POST | `/assessments/{id}/start/` | Start the assessment workflow |
| POST | `/assessments/{id}/cancel/` | Cancel a running assessment |
| GET | `/assessments/{id}/report/` | Get assessment report |
| POST | `/assessments/{id}/ingest/` | Upload BloodHound/LDAP data |

---

## Endpoints

### POST `/assessments/{id}/start/`

Starts the `ADAssessmentWorkflow` in Temporal.

**Success Response:** `202 Accepted`
```json
{
  "workflow_id": "ad-assessment-42",
  "assessment_id": 42,
  "status": "RUNNING"
}
```

**Error Response:** `400 Bad Request`
```json
{ "error": "Assessment is already running" }
```

---

### POST `/assessments/{id}/cancel/`

Cancels a running assessment by sending a Temporal cancellation signal.

**Success Response:** `200 OK`
```json
{ "status": "CANCELLED" }
```

---

### POST `/assessments/{id}/ingest/`

Ingests a BloodHound, LDAP dump, or custom JSON file for offline data enrichment.

**Request:** `multipart/form-data`
- `file`: The data file (JSON/zip)
- `format`: One of `bloodhound`, `ldap_dump`, `custom`

**Success Response:** `202 Accepted`
```json
{
  "workflow_id": "ad-ingest-42-a1b2c3",
  "status": "processing"
}
```

---

## Data Models

### `ADAssessment`

| Field | Type | Description |
|---|---|---|
| `id` | AutoField | Primary key |
| `target_domain` | CharField | Target domain FQDN |
| `status` | CharField | `PENDING`, `RUNNING`, `COMPLETED`, `FAILED`, `CANCELLED` |
| `workflow_id` | CharField | Temporal workflow ID |
| `config` | JSONField | Per-assessment config overrides |
| `started_at` | DateTimeField | When the workflow started |
| `completed_at` | DateTimeField | When the workflow finished |
| `scan_history` | ForeignKey | Associated core scan (optional) |

### `ADDomain`

| Field | Type | Description |
|---|---|---|
| `id` | AutoField | Primary key |
| `assessment` | ForeignKey | Parent assessment |
| `fqdn` | CharField | Fully qualified domain name |
| `name` | CharField | Short name |
| `is_forest_root` | BooleanField | Whether this DC is the forest root |
| `dc_role` | CharField | `DC`, `GC`, `KDC`, `LDAP` |
| `ip_address` | GenericIPAddressField | Resolved IP |
| `dc_count` | IntegerField | Domain controller count |
| `user_count` | IntegerField | Estimated user count |

### `ADTrust`

| Field | Type | Description |
|---|---|---|
| `id` | AutoField | Primary key |
| `assessment` | ForeignKey | Parent assessment |
| `source_domain` | CharField | Source domain FQDN |
| `target_domain` | CharField | Target domain FQDN |
| `trust_type` | CharField | `PARENT_CHILD`, `FOREST`, `EXTERNAL`, `REALM` |
| `direction` | CharField | `INBOUND`, `OUTBOUND`, `BIDIRECTIONAL` |
| `is_transitive` | BooleanField | Whether the trust is transitive |
| `is_selective_auth` | BooleanField | Selective authentication enabled |
| `risk_score` | IntegerField | Computed risk score (0-100) |

### `ADExposure`

| Field | Type | Description |
|---|---|---|
| `id` | AutoField | Primary key |
| `assessment` | ForeignKey | Parent assessment |
| `exposure_type` | CharField | `ADFS`, `OWA`, `EXCHANGE`, `VPN`, `LDAP`, etc. |
| `host` | CharField | Exposed hostname |
| `risk_score` | FloatField | Risk score (0.0-100.0) |
| `source` | CharField | Discovery source (`cert_transparency`, `dns`, etc.) |
