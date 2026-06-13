---
name: developing-r3ngine-plugins
description: Guides the developer or agent on how to structure, build, compile, and configure plugins for the r3ngine platform. Use when designing plugins, writing manifest.yaml or tools.yaml, building Vite Module Federation React UIs, configuring mount/unmount hooks, defining Temporal workflows and activities, or configuring database AppConfigs and model naming.
---

# Developing r3ngine Plugins

Custom agent skill to guide the design, structure, frontend federation, and Temporal backend orchestration of plugins for the `r3ngine` reconnaissance platform.

## When to Use

Use this skill when:
- Creating a new `r3ngine` plugin or modifying an existing one (e.g. `credential_intelligence`, `active_exploitation`, `exploit_readiness_layer`).
- Writing or troubleshooting `manifest.yaml` or `tools.yaml` configurations.
- Compiling the React UI bundle using Vite Module Federation or defining the `mount` and `unmount` entry point.
- Creating or debugging Temporal workflows and activities for scanning pipelines.
- Setting up database models, AppConfigs (`apps.py`), or migrations within a plugin.

## Core Developer Checklist

Before committing any plugin changes, verify the following:

- [ ] **Directory Name & Package Slug**: Directory and Python slug must be identical, valid Python package identifiers (snake_case only, e.g. `credential_intelligence`).
- [ ] **Django App Config**: App config label must be `{slug}_backend` (e.g. `credential_intelligence_backend`).
- [ ] **Database Table Naming**: All model tables must be prefixed with `plugin_{slug}_` (e.g. `plugin_credential_intelligence_task`).
- [ ] **Vite Module Federation**: Configured with `filename: "remoteEntry.js"`, exposing exactly `'./mount'`, and having `shared: []` (do not share React/MUI runtimes to ensure dynamic load compatibility on the host).
- [ ] **CSS Splitting**: Disabled via `cssCodeSplit: false` to bundle styles into a single file.
- [ ] **Temporal Determinism**: Workflows must be 100% deterministic (no database operations, no API requests, no local file writes, no non-deterministic time or randomness).
- [ ] **Database Connection Closures**: Enforce explicit connection closing via `django.db.connection.close()` before launching subprocesses inside activities.
- [ ] **Subprocess Migrations**: Run migrations dynamically on installation outside active transaction blocks.
- [ ] **Docker Socket & Command Sanitization**: Validate and sanitize all parameters passed to the Docker SDK or subprocess commands.
- [ ] **Data Encryption at Rest**: Encrypt all sensitive data (credentials, keys, tokens) using database encryption fields.
- [ ] **API Access Controls**: Explicitly define permission classes on all endpoints (never leave views default-open).

---

## Detailed References

For comprehensive instructions, code templates, and design patterns, refer to the following sub-guides:

### 1. [Plugin Directory Structure & Manifest](file:///d:/Repos/r3ngine/r3ngine-plugins/.claude/skills/developing-r3ngine-plugins/references/plugin-structure.md)
* Standardized directory layout.
* Manifest key specifications (`manifest.yaml`) and runtime pipeline anchors.
* External tool installation options (`tools.yaml`).

### 2. [Vite Module Federation UI](file:///d:/Repos/r3ngine/r3ngine-plugins/.claude/skills/developing-r3ngine-plugins/references/federation-ui.md)
* Configuring Vite for dynamic micro-frontend federation.
* Implementing the mount/unmount contract with clean cleanup.
* Making authenticated requests to the Django REST backend with CSRF headers.

### 3. [Temporal Backend & Django Integration](file:///d:/Repos/r3ngine/r3ngine-plugins/.claude/skills/developing-r3ngine-plugins/references/temporal-backend.md)
* Creating deterministic workflows and asynchronous side-effecting activities.
* Safe ORM interactions and preventing connection pool leaks.
* Dynamic migration setup and validation patterns.

### 4. [Plugin Security Guidelines](file:///d:/Repos/r3ngine/r3ngine-plugins/.claude/skills/developing-r3ngine-plugins/references/security.md)
* Mitigating Docker daemon privilege escalation risks.
* Restricting view endpoints with Role-Based Access Controls (RBAC).
* Enforcing encrypted fields for sensitive database records.
* Preventing path traversal and parameter injection.
