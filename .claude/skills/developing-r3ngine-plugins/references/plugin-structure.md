# Plugin Directory Structure & Manifest Config

This guide outlines the standard directory layout, manifest properties (`manifest.yaml`), and tool declarations (`tools.yaml`) required for building an `r3ngine` plugin.

---

## Directory Hierarchy

Plugins reside in the `r3ngine-plugins/{slug}/` directory and must follow a self-contained structure:

```
r3ngine-plugins/
└── your_plugin/                      ← plugin root, slug = "your_plugin"
    ├── manifest.yaml                 ← REQUIRED: plugin metadata & registration
    ├── tools.yaml                    ← OPTIONAL: external tool declarations
    ├── README.md                     ← documentation
    ├── backend/                      ← Django app
    │   ├── __init__.py
    │   ├── apps.py                   ← AppConfig (label = "your_plugin_backend")
    │   ├── models.py                 ← db_table = "plugin_your_plugin_*"
    │   ├── serializers.py
    │   ├── views.py                  ← viewsets or APIViews
    │   ├── urls.py                   ← REST endpoints
    │   ├── migrations/
    │   │   └── __init__.py
    │   └── temporal_exports.py       ← workflow/activity exports for Temporal
    ├── your_plugin_tasks.py          ← OPTIONAL: pipeline injection task function
    ├── fixtures/
    │   └── your_plugin_engine.yaml   ← OPTIONAL: scan engine YAML (auto-ingested)
    └── ui/                           ← React frontend
        ├── package.json
        ├── vite.config.ts
        └── src/
            ├── mount.tsx             ← REQUIRED: federation mount/unmount exports
            └── components/
```

### ⚠️ Critical Naming & Path Constraints
- **Directory/Slug Naming**: The slug must be a valid Python package identifier (snake_case only, no hyphens allowed).
- **Django App Label**: The Django AppConfig in `backend/apps.py` **must** define `label = "{slug}_backend"`.
- **Database Tables**: All Django model tables must have `db_table` explicitly set to `plugin_{slug}_<table_name>` to avoid namespace conflicts in the host database.

---

## manifest.yaml Specification

`manifest.yaml` acts as the source of truth for plugin installation, registration, and loading. The following structure is mandatory:

```yaml
name: "Your Plugin Display Name"
slug: "your_plugin"               # must match directory name, snake_case
version: "1.0.0"
description: "Brief summary of the plugin's capabilities."
author: "Author Name"
license: "GPLv3"

runtime:
  run_after: "vulnerability_scan"   # OPTIONS: run_after or run_before

temporal:                           # Optional: Register workflows & activities
  workflows:
    - "backend.temporal_exports.YourWorkflow"
  activities:
    - "backend.temporal_exports.run_your_activity"

ui:                                 # Optional: Frontend loading details
  entry: "ui/dist"                  # Path to built assets in the plugin
  sidebar_label: "Your Plugin"      # Left sidebar text
  icon: "shield"                    # Lucide icon name (e.g. shield, activity, terminal)
```

### Runtime Anchor Steps

The `runtime.run_after` or `runtime.run_before` options hook your plugin directly into the core `MasterScanWorkflow`. The permitted anchor steps are:

| Step Name | Tier | Pipeline Position |
|:---|:---|:---|
| `subdomain_discovery` | Tier 1 | Subdomain discovery, passive/active enumeration |
| `http_crawl` | Tier 2 | Port scanning, crawler/spider runs, status probing |
| `vulnerability_scan` | Tier 6 | Nuclei vulnerability scans & brute forcing |
| `vulnerability_correlation` | Tier 7 | Vulnerability deduplication & Neo4j graph synchronization |

---

## tools.yaml Specification

If your plugin depends on external binaries or packages, declare them in `tools.yaml`. The `AtomicInstaller` will attempt to build or download these during installation:

```yaml
tools:
  # Python PIP Packages
  - name: "sqlmap"
    binary: "sqlmap"
    install_type: "pip3"
    install_command: "pip3 install sqlmap"
    validation_command: "sqlmap --version"

  # GitHub / Repositories
  - name: "XSStrike"
    binary: "python3 /usr/src/app/plugins_data/your_plugin/tools/XSStrike/xsstrike.py"
    install_type: "git"
    install_command: "mkdir -p tools && git clone --depth 1 https://github.com/s0md3v/XSStrike.git tools/XSStrike && pip3 install -r tools/XSStrike/requirements.txt"
    validation_command: "python3 tools/XSStrike/xsstrike.py --version"

  # Docker Container (Pulled and executed via host socket)
  - name: "sqlmap-docker"
    description: "sqlmap executed inside a sandbox"
    docker_image: "ghcr.io/sqlmapproject/sqlmap"
    command: "-u {url} --batch --random-agent"
```

### Key Tool Behaviors
- **pip3**: Runs pip3 install on the host container. Expects the binary to be added to system `$PATH`.
- **git**: Clones the repo to the plugin's path. The `binary` path should point directly to the execution entrypoint.
- **docker**: Pulled on demand. No installation script required. Useful for isolating binary runtimes (e.g. Hashcat, custom Go/Rust scanners).
