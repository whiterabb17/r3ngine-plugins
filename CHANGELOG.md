# Changelog

All notable changes to the r3ngine plugins repository will be documented in this file.

## [v1.0.0] - 2026-06-03

### Added
- **Burp Suite Professional Integration (`burpsuite_integration`)**:
  - Implemented bidirectional findings import and scope sync with Burp Pro's REST API.
  - Developed full Django models for `BurpSuiteConfig`, `BurpIssue`, and `BurpSyncLog`.
  - Added REST APIs supporting `?unmatched=true` filtering, subdomain search, and endpoint search.
  - Integrated custom `@action` endpoint for manual target matching (`POST /issues/{id}/match/`).
  - Structured a two-phase Temporal workflow (`BurpSuiteWorkflow`): Phase 1 (Raw import) and Phase 2 (Target correlation & core `Vulnerability` creation).
  - Built a premium React + MUI federation panel featuring KPI summary cards, a filterable issues grid with slide-out drawer, a manual match modal, sync timelines, and an API health tester.
  - Bound a pulsing active `HealthDot` connection indicator to check REST API connection status dynamically.
  - Embedded detailed markdown user documentation directly within the plugin's build bundle.

### Fixed
- **Windows Build Compatibility**: Fixed `UnicodeEncodeError` in `build_plugins.py` by converting unicode characters (e.g. `→` to ASCII `->`) preventing package compilation failures on Windows terminals using CP1252 encodings.
- **Card UI Tag Mismatch**: Fixed a nested JSX tag mismatch in `PluginCard.tsx` preventing production builds.

---

## [v0.9.0] - 2026-05-29

### Added
- **Active Exploitation (`active_exploitation`)**:
  - Automated SQLi scans using sandboxed `sqlmap` processes.
  - Created a custom dashboard UI, encrypted database dump storage, and real-time terminal log outputs.
- **Exploit Readiness Layer (`exploit_readiness_layer`)**:
  - Validates vulnerabilities using non-destructive check modules (sqlmap + XSStrike).
  - Integrates direct verification steps in the core scanning tiers.
- **Active Directory Intelligence (`active_directory`)**:
  - Active Directory LDAP and BloodHound findings ingestion and risk-scored analytics.
  - Built a Cytoscape.js graphical topology rendering page with 5 layout configurations and live search/highlighting.
  - Added real-time WebSocket progress alerts, audit logs, and WeasyPrint PDF reports compilation.
