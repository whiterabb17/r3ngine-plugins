# Compliance Assessment Plugin — Overview

## Purpose

The **Compliance Assessment** plugin analyses all data collected during an r3ngine scan and maps it to regulatory compliance frameworks. It runs at the end of the assessment pipeline (Tier 7), after vulnerability correlation, CVE enrichment, risk scoring, and attack path modelling have completed, so the full picture of the target environment is available before any compliance judgement is made.

Because most assessments are conducted remotely without direct system access, the plugin works entirely from scan artefacts — discovered vulnerabilities, open ports and services, HTTP security headers, TLS configuration, DNS records, technology fingerprints, and APME attack paths — to infer a compliance posture for each supported framework. Controls that cannot be assessed from remote scan data are flagged explicitly as **Requires Manual Assessment** so auditors know exactly where to focus follow-up activities.

---

## What the Plugin Produces

| Output | Description |
|---|---|
| **Compliance assessment record** | Per-scan record linking each framework control to a pass / fail / partial / manual result |
| **Evidence links** | Every control result links directly to the scan findings that support it |
| **Remediation guidance** | Per-control remediation steps generated from finding context |
| **Compliance report** | Framework-structured HTML report stored in `MEDIA_ROOT` for download |
| **Signed attestation** | SHA-256 signed artefact suitable for inclusion in client delivery packages |
| **Dashboard** | Interactive frontend showing control heatmaps, evidence drill-down, and gap analysis per framework |

---

## How It Integrates

```
MasterScanWorkflow
  ├─ Tier 1 → Tier 6  (scan pipeline)
  └─ Tier 7 post-processing
       ├─ CorrelateVulnerabilitiesActivity
       ├─ EnrichScanCVEsActivity
       ├─ CalculateRiskScoresActivity
       ├─ GenerateImpactAssessmentActivity
       ├─ SyncGraphActivity
       ├─ RunAPMEActivity
       └─ [Plugin dispatch — tier_7]
            └─ ComplianceAssessmentWorkflow   ← this plugin
```

The plugin reads from the existing Django ORM models (`Vulnerability`, `Subdomain`, `EndPoint`, `IpAddress`, `Port`, `ScanHistory`) and the Neo4j graph. It does not modify any core scan data; it only writes to its own plugin models and `MEDIA_ROOT`.

---

## Remote Assessment Approach

Direct-access tools (Lynis, OpenSCAP, Chef InSpec) are not used in the default flow because they require SSH or agent-level access to the target system. Instead, the plugin applies a **rule engine** that maps remote scan evidence to compliance controls with an explicit **evidence confidence level** per control:

| Confidence | Meaning |
|---|---|
| `HIGH` | Direct tool finding maps unambiguously to the control (e.g., a Nuclei SQLi finding → PCI-DSS Req 6.3 FAIL) |
| `MEDIUM` | Inferred from indirect evidence (e.g., no HSTS header → likely encryption gap) |
| `LOW` | Weak or circumstantial signal only |
| `MANUAL` | Cannot be assessed from remote scan data — auditor action required |

---

## Supported Frameworks

The table below reflects implementation status. As each framework is fully implemented, its status is updated here.

| Framework | Version | Status |
|---|---|---|
| PCI-DSS | 4.0 | `Planned` |
| HIPAA | Technical Safeguards | `Planned` |
| NIST SP 800-53 | Rev 5 | `Planned` |
| CIS Controls | v8 | `Planned` |
| ISO 27001 | 2022 | `Planned` |
| SOC 2 | Type II (Security TSC) | `Planned` |
