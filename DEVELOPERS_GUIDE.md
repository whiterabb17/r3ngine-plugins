<p align="center">
<a href="https://rengine.wiki"><img src="https://raw.githubusercontent.com/whiterabb17/r3ngine/main/frontend/public/img/banner.png" height="400px" width="520px" alt=""/></a>
</p>

<p align="center">
  <h4 align="center"><strong>r3ngine Plugin Developer Guide</strong></h4>
  <h3 align="center">Building, Deploying & Registering Plugins for r3ngine v3.2.0+</h3>
</p>

<p align="center">
  <a href="#" target="_blank">
    <img src="https://img.shields.io/badge/runtime-Temporal-informational?&logo=none" alt="Runtime" />
  </a>
  &nbsp;
  <a href="#" target="_blank">
    <img src="https://img.shields.io/badge/UI-Vite%20Federation-blue?&logo=vite" alt="Vite Federation" />
  </a>
  &nbsp;
  <a href="#" target="_blank">
    <img src="https://img.shields.io/badge/backend-Django%203.2-green?&logo=django" alt="Django" />
  </a>
  &nbsp;
  <a href="https://www.gnu.org/licenses/gpl-3.0" target="_blank">
    <img src="https://img.shields.io/badge/License-GPLv3-red.svg?&logo=none" alt="License" />
  </a>
</p>

![-----------------------------------------------------](https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/aqua.png)

## Table of Contents

* [Overview](#overview)
* [Plugin Directory Structure](#plugin-directory-structure)
* [Manifest & manifest.yaml](#manifest--manifestyaml)
* [Backend Development](#backend-development)
* [Temporal Workflow Integration](#temporal-workflow-integration)
* [Pipeline Injection](#pipeline-injection)
* [Frontend Development](#frontend-development)
* [Tools Integration](#tools-integration)
* [Engine Fixture](#engine-fixture)
* [Plugin Model Reference](#plugin-model-reference)
* [Atomic Install Process](#atomic-install-process)
* [Deployment Workflow](#deployment-workflow)
* [Testing](#testing)
* [Reference: Existing Plugins](#reference-existing-plugins)

![-----------------------------------------------------](https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/aqua.png)

## Overview

r3ngine plugins are self-contained packages that extend the platform without modifying the core codebase. A plugin can:

- Add new Django models and REST API endpoints
- Register Temporal workflows and activities
- Inject tasks into the core scan pipeline at a specific step
- Serve a React UI via Vite Module Federation (loaded dynamically by `PluginPageLoader`)
- Install external security tools at container startup

Plugins live in `r3ngine-plugins/{slug}/` and are installed into the running container under `web/plugins_data/{slug}/`. The install process is fully atomic — it backs up the database and filesystem before making any changes and rolls back completely on failure.

![-----------------------------------------------------](https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/aqua.png)

## Plugin Directory Structure

r3ngine plugins live in their own git repository at `r3ngine-plugins/`. The main application mounts plugins at runtime — no changes to `web/` are required to add a plugin. The `{slug}` must be a valid Python package name (underscores, no hyphens).

### Full tree example

```
r3ngine-plugins/
└── your_plugin/                      ← plugin root, slug = "your_plugin"
    ├── manifest.yaml                 ← REQUIRED: plugin metadata & registration
    ├── tools.yaml                    ← OPTIONAL: external tool declarations
    ├── README.md                     ← documentation
    ├── backend/                      ← Django app
    │   ├── __init__.py
    │   ├── apps.py                   ← AppConfig (label = "your_plugin_backend")
    │   ├── models.py
    │   ├── serializers.py
    │   ├── views.py
    │   ├── urls.py
    │   ├── migrations/
    │   │   └── __init__.py
    │   └── temporal_exports.py       ← workflow/activity exports for Temporal registry
    ├── your_plugin_tasks.py          ← OPTIONAL: pipeline injection task function
    ├── fixtures/
    │   └── your_plugin_engine.yaml   ← OPTIONAL: scan engine YAML (auto-ingested)
    └── ui/                           ← React frontend
        ├── package.json
        ├── vite.config.ts
        ├── tsconfig.json
        └── src/
            ├── index.ts              ← bare entry (not the federation entry)
            ├── mount.tsx             ← REQUIRED: federation mount/unmount exports
            └── components/
                └── YourDashboard.tsx
```

> **Critical naming rule**: The Django app label **must** be `{slug}_backend`. All `db_table` names must be prefixed with `plugin_{slug}_`. The Python module path inside the container is always `plugins_data.{slug}.*`.

![-----------------------------------------------------](https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/aqua.png)

## Manifest & manifest.yaml

`manifest.yaml` is the single source of truth for plugin identity and registration. The installer validates this file before touching anything.

### Required Fields

```yaml
name: "Your Plugin Display Name"
slug: "your_plugin"               # must match directory name, snake_case
version: "1.0.0"
description: "What this plugin does."
author: "Your Name"
license: "GPLv3"

runtime:
  run_after: "vulnerability_scan"   # or "run before: <step>"
                                    # REQUIRED — must declare one or the other

temporal:
  workflows:
    - "backend.temporal_exports.YourWorkflow"
  activities:
    - "backend.temporal_exports.run_your_activity"

ui:
  entry: "ui/dist"                  # path to compiled frontend assets
  sidebar_label: "Your Plugin"      # label shown in r3ngine sidebar
  icon: "shield"                    # lucide-react icon name
```

**Validation rules enforced by the installer:**
- `name`, `version`, and `runtime` are all required — missing any causes an immediate rollback.
- `runtime` must contain either `run after` or `run before` (not both).
- `temporal.workflows` and `temporal.activities` are optional but must be valid Python import paths relative to `plugins_data.{slug}.` if present.

### Anchor Step Values

The `run after` / `run before` value maps to a named step in the core scan pipeline:

| Value | Pipeline Position |
|-------|------------------|
| `subdomain_discovery` | After/before Tier 1 subdomain discovery |
| `http_crawl` | After/before Tier 2 HTTP crawl |
| `vulnerability_scan` | After/before Tier 6 Nuclei vulnerability scan |
| `vulnerability_correlation` | After/before Tier 7 correlation & Neo4j sync |

![-----------------------------------------------------](https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/aqua.png)

## Backend Development

### Django App Setup

```python
# backend/apps.py
from django.apps import AppConfig

class YourPluginConfig(AppConfig):
    name = "plugins_data.your_plugin.backend"
    label = "your_plugin_backend"          # MUST follow this pattern
    verbose_name = "Your Plugin"
```

The app is auto-discovered by Django via `INSTALLED_APPS` injection from the plugin loader — you do not register it manually in `settings.py`.

> **Why `plugins_data.*`?** The r3ngine container installs plugin source into `web/plugins_data/` at startup. Your Python import paths must match this prefix.

### Models

```python
# backend/models.py
from django.db import models

class YourPluginRecord(models.Model):
    target_url   = models.URLField()
    result       = models.TextField(blank=True)
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = "your_plugin_backend"
        db_table  = "plugin_your_plugin_record"   # MUST use plugin_{slug}_ prefix
```

Prefix all `db_table` values with `plugin_{slug}_` to avoid collisions with core tables.

### REST API

```python
# backend/views.py
from rest_framework import viewsets, permissions
from .models import YourPluginRecord
from .serializers import YourPluginRecordSerializer

class YourPluginRecordViewSet(viewsets.ModelViewSet):
    queryset = YourPluginRecord.objects.all().order_by("-created_at")
    serializer_class = YourPluginRecordSerializer
    permission_classes = [permissions.IsAuthenticated]
```

```python
# backend/urls.py
from rest_framework.routers import DefaultRouter
from .views import YourPluginRecordViewSet

router = DefaultRouter()
router.register(r"records", YourPluginRecordViewSet)
urlpatterns = router.urls
```

The plugin loader mounts this at `/api/plugins/your_plugin/` automatically. You do not need to touch the core `urls.py`.

For singleton config endpoints (one row per deployment), use `APIView`:

```python
from rest_framework.views import APIView
from rest_framework.response import Response

class YourPluginConfigView(APIView):
    def get(self, request):
        from .models import YourPluginConfig
        from .serializers import YourPluginConfigSerializer
        cfg = YourPluginConfig.get()
        return Response(YourPluginConfigSerializer(cfg).data)

    def put(self, request):
        from .models import YourPluginConfig
        from .serializers import YourPluginConfigSerializer
        cfg = YourPluginConfig.get()
        ser = YourPluginConfigSerializer(cfg, data=request.data)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)
```

### Migrations

Migrations live inside `backend/migrations/`. They run automatically during atomic install via a subprocess call to `python manage.py migrate your_plugin_backend`. For local development:

```bash
docker exec r3ngine-web-1 python manage.py makemigrations your_plugin_backend
docker exec r3ngine-web-1 python manage.py migrate your_plugin_backend
```

Always check the migration dependency chain — the container may have migrations that don't exist locally (`showmigrations your_plugin_backend` to compare).

![-----------------------------------------------------](https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/aqua.png)

## Temporal Workflow Integration

### How Workflow Registration Works

When the Temporal worker starts, `PluginTemporalRegistry` discovers all enabled plugins and dynamically imports their workflow classes and activity functions.

Given `manifest.yaml`:
```yaml
temporal:
  workflows:
    - "backend.temporal_exports.YourWorkflow"
  activities:
    - "backend.temporal_exports.run_your_activity"
```

The registry prepends `plugins_data.{slug}.` to each path and uses `importlib` to resolve the class or function:

```python
# Internal registry logic (simplified from web/plugins/temporal_registry.py)
module_path = f"plugins_data.your_plugin.backend.temporal_exports"
module = importlib.import_module(module_path)
workflow_class = getattr(module, "YourWorkflow")
activity_fn    = getattr(module, "run_your_activity")
```

These are passed to the Temporal worker at startup alongside the core workflows and activities. No container restart is required for plugin discovery — the orchestrator management command reads the plugin registry on each startup.

### Writing Workflows and Activities

Create `backend/temporal_exports.py` and export exactly what `manifest.yaml` declares:

```python
# backend/temporal_exports.py
import asyncio
from datetime import timedelta
from temporalio import workflow, activity
from temporalio.common import RetryPolicy

# ── Activity ────────────────────────────────────────────────────────────────

@activity.defn
async def run_your_activity(params: dict) -> dict:
    """
    All side-effecting work goes here.
    Activities may do Django ORM calls, subprocess execution,
    external HTTP calls — anything non-deterministic.
    """
    target_url = params["url"]

    from plugins_data.your_plugin.backend.models import YourPluginRecord
    loop = asyncio.get_event_loop()
    record = await loop.run_in_executor(
        None,
        lambda: YourPluginRecord.objects.create(target_url=target_url)
    )
    return {"record_id": record.id, "status": "ok"}


# ── Workflow ─────────────────────────────────────────────────────────────────

@workflow.defn
class YourWorkflow:
    @workflow.run
    async def run(self, params: dict) -> dict:
        """
        Workflow body must be 100% deterministic.
        No I/O, no random, no datetime.now().
        Delegate all real work to activities.
        """
        result = await workflow.execute_activity(
            run_your_activity,
            params,
            start_to_close_timeout=timedelta(hours=2),
            retry_policy=RetryPolicy(maximum_attempts=3),
        )
        return result
```

### Starting a Workflow from a Django View

```python
# backend/views.py
import asyncio
from rest_framework.decorators import action
from rest_framework.response import Response
from reNgine.temporal_client import TemporalClientProvider

class YourPluginRecordViewSet(viewsets.ModelViewSet):
    # ...

    @action(detail=False, methods=["post"])
    def run(self, request):
        url = request.data.get("url")
        if not url:
            return Response({"error": "url required"}, status=400)

        async def _start():
            client = await TemporalClientProvider.get_client()
            handle = await client.start_workflow(
                "YourWorkflow",
                {"url": url},
                id=f"your-plugin-{url[:40]}",
                task_queue="python-orchestrator-queue",
            )
            return handle.id

        workflow_id = asyncio.run(_start())
        return Response({"workflow_id": workflow_id})
```

### Temporal Determinism Rules

| ✅ Allowed in Workflows | ❌ Never in Workflows |
|------------------------|----------------------|
| `await workflow.execute_activity(...)` | `datetime.now()` |
| `await workflow.sleep(timedelta(...))` | `random.random()` |
| Conditional logic, loops | Django ORM calls |
| `workflow.now()` (deterministic time) | `requests.get(...)` |
| `await workflow.wait_condition(...)` | Any filesystem I/O |

All non-deterministic work — DB writes, tool execution, external HTTP — goes in **activities**, not workflows. Use `workflow.unsafe.imports_passed_through()` if you must import Django models at the top of a workflow file.

![-----------------------------------------------------](https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/aqua.png)

## Pipeline Injection

Plugins declared with `run after: <step>` or `run before: <step>` are automatically injected into the core scan pipeline by `PluginOrchestrator.inject_tasks()`.

### How inject_tasks Works

When the scan pipeline reaches the named anchor step, the orchestrator queries all enabled plugins whose `anchor_step` matches, ordered by `order_weight`. It loads `{slug}_tasks.py` from the plugin root directory and calls the task function.

```python
# Simplified from web/plugins/orchestrator.py
plugins = Plugin.objects.filter(
    anchor_step="vulnerability_scan",
    runtime_position="AFTER",
    is_enabled=True,
).order_by("order_weight")

for plugin in plugins:
    module = importlib.import_module(f"plugins_data.{plugin.slug}.{plugin.slug}_tasks")
    fn = getattr(module, "run", None) or getattr(module, plugin.slug)
    fn(ctx)
```

### Writing a Plugin Task Function

Create `{slug}_tasks.py` in the plugin root (alongside `manifest.yaml`):

```python
# your_plugin_tasks.py

def run(ctx: dict) -> dict:
    """
    Called by PluginOrchestrator when the anchor step fires.

    ctx keys include:
      - scan_history_id: int
      - domain: str
      - engine_id: int
      - results_dir: str

    Return the ctx dict (modified or unchanged) to pass forward.
    """
    scan_history_id = ctx["scan_history_id"]
    domain = ctx["domain"]

    from plugins_data.your_plugin.backend.models import YourPluginRecord
    YourPluginRecord.objects.create(
        target_url=f"https://{domain}",
        result=f"Pipeline injection ran for scan {scan_history_id}",
    )

    return ctx
```

The function name must be either `run` or match the plugin slug exactly. The orchestrator looks for `run` first.

![-----------------------------------------------------](https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/aqua.png)

## Frontend Development

### How PluginPageLoader Works

`PluginPageLoader` is the host-side React component that dynamically loads and mounts plugin UIs. Understanding its exact behaviour is essential for writing a compatible plugin frontend.

**Step-by-step load sequence (from `frontend/src/features/plugins/components/PluginPageLoader.tsx`):**

1. Constructs the remote URL with cache-busting:
   ```
   /plugins-ui/{slug}/assets/remoteEntry.js?v={Date.now()}
   ```

2. Dynamically imports the module (native ESM `import(url)`):
   ```typescript
   const remote = await import(remoteUrl) as RemoteEntry;
   ```

3. Initialises the remote's shared scope with an empty object:
   ```typescript
   await remote.init({});
   ```

4. Fetches the `./mount` factory — **always** `./mount`, regardless of any `exportName` prop:
   ```typescript
   const factory = await remote.get('./mount');
   const { mount, unmount } = factory();
   ```

5. Mounts the plugin into the host DOM container:
   ```typescript
   mount(containerRef.current, props);
   ```

6. On teardown (navigation away or component unmount):
   ```typescript
   unmount(containerRef.current);
   ```

**Critical consequences for plugin authors:**

- Your Vite federation config **must** expose `'./mount'` (not any other name).
- Your `src/mount.tsx` **must** export two named functions: `mount(el, props)` and `unmount(el)`.
- The output filename **must** be `remoteEntry.js` — it is hardcoded on the host side.
- The `exportName` prop that `PluginPageLoader` accepts is **ignored** (renamed `_exportName` internally). Do not rely on it.

**File serving path:**

`PluginUIView` (registered at `plugins-ui/<slug>/<path>`) serves static files from `plugins_data/{slug}/ui/{path}`:

```
Request:  GET /plugins-ui/your_plugin/assets/remoteEntry.js
Resolved: plugins_data/your_plugin/ui/assets/remoteEntry.js
```

After `npm run build` produces `ui/dist/assets/remoteEntry.js`, copy the **contents** of `dist/` into `ui/` (not into `ui/dist/`):

```bash
# Correct — copies dist/ contents into ui/ directory
docker cp dist/. r3ngine-web-1:/app/plugins_data/your_plugin/ui/
# Result: /app/plugins_data/your_plugin/ui/assets/remoteEntry.js ✓

# Wrong — would require /plugins-ui/your_plugin/dist/assets/remoteEntry.js
docker cp dist r3ngine-web-1:/app/plugins_data/your_plugin/ui/dist/
```

### The mount / unmount Contract

Your `mount.tsx` **must** implement this exact interface:

```typescript
export function mount(el: HTMLElement, props: Record<string, unknown>): void
export function unmount(el: HTMLElement): void
```

- `mount` receives the host DOM element and any props passed from the sidebar.
- `mount` creates a React root and renders the plugin's React tree into `el`.
- `unmount` tears down the React root and releases all references.
- Use a `WeakMap<HTMLElement, Root>` to associate roots with DOM elements — this supports multiple simultaneous plugin instances without global state leaks.

### Vite Module Federation Setup

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import federation from '@originjs/vite-plugin-federation';

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'your_plugin',           // must match plugin slug
      filename: 'remoteEntry.js',    // REQUIRED — never change this name
      exposes: {
        './mount': './src/mount',    // REQUIRED — always exactly this key
      },
      shared: [],                    // keep empty — bundle everything
    }),
  ],
  build: {
    target: 'esnext',
    outDir: 'dist',
    emptyOutDir: true,
    cssCodeSplit: false,             // REQUIRED — ensures a single CSS file is emitted for easier dynamic loading
    chunkSizeWarningLimit: 3000,     // Suppress 500kb chunk warnings (expected since shared: [] bundles React/MUI)
    rollupOptions: {
      input: './src/index.ts',
    },
  },
});
```

> **Why `shared: []` and large chunks?** `PluginPageLoader` calls `remote.init({})` with an empty shared scope object. If your plugin declares `shared: ['react']` but the host provides no React in the shared scope, module federation will fail at runtime. Keeping `shared: []` makes each plugin fully self-contained — all dependencies bundled, no shared scope negotiation needed. This produces larger bundles (hence `chunkSizeWarningLimit: 3000`) but guarantees absolute compatibility.
> 
> **Why `cssCodeSplit: false`?** When using Module Federation without an HTML entry point, dynamic CSS chunks may fail to load natively on the host page. Forcing a single emitted CSS file prevents race conditions with dynamic styles.

### Complete mount.tsx Example

```tsx
// src/mount.tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import YourDashboard from './components/YourDashboard';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary:    { main: '#00f3ff' },   // your plugin's accent colour
    background: { default: '#07070c', paper: '#0d0d1a' },
  },
});

// WeakMap keyed by DOM element — supports multiple simultaneous mounts
const roots = new WeakMap<HTMLElement, Root>();

export function mount(el: HTMLElement, props: Record<string, unknown>): void {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000 } },
  });

  const root = createRoot(el);
  roots.set(el, root);

  root.render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={darkTheme}>
          <CssBaseline />
          <YourDashboard {...props} />
        </ThemeProvider>
      </QueryClientProvider>
    </React.StrictMode>
  );
}

export function unmount(el: HTMLElement): void {
  const root = roots.get(el);
  if (root) {
    root.unmount();
    roots.delete(el);
  }
}
```

### package.json Requirements

All runtime dependencies (React, MUI, React Query, etc.) must be in `dependencies`, **not** `peerDependencies`. Because each plugin bundle is self-contained with no shared scope, peer dependencies would never be resolved at runtime:

```json
{
  "name": "your-plugin-ui",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "build": "vite build",
    "dev":   "vite"
  },
  "dependencies": {
    "@emotion/react":          "^11",
    "@emotion/styled":         "^11",
    "@mui/material":           "^5",
    "@tanstack/react-query":   "^5",
    "lucide-react":            "^0.400.0",
    "react":                   "^18.0.0",
    "react-dom":               "^18.0.0"
  },
  "devDependencies": {
    "@originjs/vite-plugin-federation": "^1.3.6",
    "@types/react":                     "^18.0.0",
    "@types/react-dom":                 "^18.0.0",
    "@vitejs/plugin-react":             "^4.0.0",
    "typescript":                       "^5.0.0",
    "vite":                             "^5.0.0"
  }
}
```

### API Client Pattern

```typescript
// src/api/yourPluginApi.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_BASE = '/api/plugins/your_plugin';

function getCsrfToken(): string {
  return document.cookie.split('; ')
    .find(r => r.startsWith('csrftoken='))?.split('=')[1] ?? '';
}

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': getCsrfToken(),
      ...options?.headers,
    },
    ...options,
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json() as Promise<T>;
}

export function useRecords() {
  return useQuery({
    queryKey: ['your_plugin', 'records'],
    queryFn: () => apiFetch<{ results: YourRecord[]; count: number }>(`${API_BASE}/records/`),
    select: (data) => data.results,
  });
}

export function useDeleteRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiFetch(`${API_BASE}/records/${id}/`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['your_plugin', 'records'] }),
  });
}
```

Always pass `credentials: 'include'` and `X-CSRFToken` for all mutating requests (`POST`, `PUT`, `PATCH`, `DELETE`).

### Building the UI

```bash
cd your_plugin/ui
npm install
npm run build
# Produces: dist/assets/remoteEntry.js
#           dist/assets/__federation_expose_Mount-*.js
#           dist/assets/index-*.js
```

![-----------------------------------------------------](https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/aqua.png)

## Tools Integration

### tools.yaml Format

Declare external tools your plugin requires. The plugin loader installs them in a background thread during atomic install and validates them at container startup:

```yaml
# tools.yaml
tools:
  # pip3 install
  - name: "sqlmap"
    binary: "sqlmap"
    install_type: "pip3"
    install_command: "pip3 install sqlmap"
    validation_command: "sqlmap --version"

  # git clone + pip install
  - name: "XSStrike"
    binary: "python3 /usr/src/app/plugins_data/your_plugin/tools/XSStrike/xsstrike.py"
    install_type: "git"
    install_command: "mkdir -p tools && git clone --depth 1 https://github.com/s0md3v/XSStrike.git tools/XSStrike && pip3 install -r tools/XSStrike/requirements.txt"
    validation_command: "python3 tools/XSStrike/xsstrike.py --version"

  # Docker image (pulled on demand, not installed)
  - name: "sqlmap-docker"
    description: "sqlmap via Docker image"
    docker_image: "ghcr.io/sqlmapproject/sqlmap"
    command: "-u {url} --batch --random-agent"
```

`install_type` controls acquisition:
- `pip3` — runs `install_command` and expects `binary` on PATH afterwards
- `git` — clones a repository; `binary` is the full invocation path including interpreter
- `docker` — pulls the `docker_image`; no `install_command` needed

![-----------------------------------------------------](https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/aqua.png)

## Engine Fixture

Place a YAML scan engine configuration in `fixtures/your_plugin_engine.yaml`. The atomic installer automatically ingests all `*_engine.yaml` files from `fixtures/` as `EngineType` records in the database:

```yaml
# fixtures/your_plugin_engine.yaml
name: "Your Plugin Scan"
slug: "your_plugin"

your_plugin:
  enabled: true
  option_one: "value"
  option_two: 42

# Include any upstream scan tiers this engine needs:
subdomain_discovery:
  uses_tools: [subfinder]
  threads: 10
vulnerability_scan:
  run_nuclei: true
  severities: [high, critical]
```

The fixture key matching your plugin slug (e.g., `your_plugin:`) is read by your plugin's activity code via the engine configuration loader at scan time.

![-----------------------------------------------------](https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/aqua.png)

## Plugin Model Reference

The core `Plugin` Django model controls how the platform treats your plugin at runtime. The installer populates these from `manifest.yaml`:

| Field | Type | Description |
|-------|------|-------------|
| `name` | CharField | Display name |
| `slug` | SlugField | Unique identifier; matches directory name |
| `version` | CharField | Semver string |
| `description` | TextField | One-paragraph summary |
| `is_enabled` | BooleanField | Enables/disables without uninstalling |
| `anchor_step` | CharField | Pipeline step this plugin attaches to |
| `runtime_position` | CharField | `BEFORE` or `AFTER` the anchor step |
| `order_weight` | IntegerField | Tie-breaks when multiple plugins share an anchor |
| `manifest` | JSONField | Full parsed `manifest.yaml` content |
| `tools_config` | JSONField | Parsed `tools.yaml` content |
| `installed_at` | DateTimeField | First install timestamp |
| `updated_at` | DateTimeField | Most recent update timestamp |
| `icon_path` | CharField | Sidebar icon reference |

Toggling `is_enabled` immediately removes the plugin from the Temporal registry and pipeline injection — the orchestrator reads enabled plugins on each scan start.

![-----------------------------------------------------](https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/aqua.png)

## Atomic Install Process

`AtomicInstaller` (in `web/plugins/utils.py`) performs an 8-step install with full rollback on any failure:

| Step | Action | Rollback on Failure |
|------|--------|---------------------|
| 1 | `pg_dump` database backup | — |
| 2 | Filesystem backup of existing plugin directory | — |
| 3 | Create `Plugin` record in database | Delete the record |
| 4 | Move plugin files into `plugins_data/{slug}/` | Restore from FS backup |
| 5 | Run `makemigrations {slug}_backend` subprocess | Restore DB + FS |
| 6 | Run `migrate {slug}_backend` subprocess | `psql` restore from backup |
| 7 | Parse `tools.yaml`, start background tool install | Log failure; non-fatal |
| 8 | Copy `ui/dist/` contents to `plugins_data/{slug}/ui/` | Log failure; non-fatal |

Steps 7 and 8 are non-fatal — failures are logged but do not roll back the install. You will need to re-run tool installation or UI deployment manually if these steps fail.

To install a plugin from the UI, upload the plugin zip via **Settings → Plugin Marketplace → Install Plugin**.

To install during development without the marketplace:

```bash
# Copy plugin directory into container
docker cp ./your_plugin r3ngine-web-1:/app/plugins_data/your_plugin

# Register in DB and run migrations manually
docker exec r3ngine-web-1 python manage.py shell -c "
from plugins.utils import AtomicInstaller
AtomicInstaller('/app/plugins_data/your_plugin').install()
"
```

![-----------------------------------------------------](https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/aqua.png)

## Deployment Workflow

### Development Loop

**Backend changes:**

```bash
# 1. Edit backend/ files locally in r3ngine-plugins/your_plugin/

# 2. Copy changed files into the running container
docker cp backend/ r3ngine-web-1:/app/plugins_data/your_plugin/backend/

# 3. If you changed models, create and run migrations
docker exec r3ngine-web-1 python manage.py makemigrations your_plugin_backend
docker exec r3ngine-web-1 python manage.py migrate your_plugin_backend

# 4. Restart the orchestrator to pick up new activity registrations
docker restart r3ngine-temporal-python-orchestrator-1
```

**Frontend changes:**

```bash
# 1. Edit ui/src/ files locally

# 2. Build
cd your_plugin/ui
npm run build

# 3. Deploy built assets into container (copy dist/ CONTENTS into ui/)
docker cp dist/. r3ngine-web-1:/app/plugins_data/your_plugin/ui/

# 4. Hard reload the browser (PluginPageLoader cache-busts via ?v= timestamp)
```

> **sync_plugin_ui vs docker cp:** The `sync_plugin_ui` management command copies files to Django's `STATIC_ROOT` (`/app/staticfiles/plugins/{slug}/`). `PluginUIView` serves from `plugins_data/{slug}/ui/` directly. Use `docker cp dist/. container:/app/plugins_data/{slug}/ui/` for the path that `PluginPageLoader` actually reads. Use `sync_plugin_ui` only if you have an nginx rule pointing at `STATIC_ROOT` for plugin assets.

### Packaging for the Marketplace

Package your plugin as a zip archive with all files at the root (not wrapped in a subdirectory):

```bash
cd r3ngine-plugins
zip -r your_plugin_v1.0.0.zip your_plugin/
```

Upload via **Settings → Plugin Marketplace → Install Plugin**. The `AtomicInstaller` handles the rest.

![-----------------------------------------------------](https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/aqua.png)

## Testing

All plugin tests run inside the container:

```bash
docker exec r3ngine-web-1 python manage.py test plugins_data.your_plugin.tests
# Or a specific test module:
docker exec r3ngine-web-1 python manage.py test plugins_data.your_plugin.tests.test_models
```

**Authentication in tests:** Use Django's `Client` with `force_login()` — **not** DRF's `APIClient` with `force_authenticate()`. Django middleware (session, CSRF) runs before DRF auth and will reject unauthenticated requests before DRF's force_authenticate takes effect:

```python
# tests.py
from django.test import TestCase, Client
from django.contrib.auth.models import User

class YourPluginAPITests(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user("testuser", password="pass")
        self.client.force_login(self.user)   # correct

    def test_list_records(self):
        response = self.client.get("/api/plugins/your_plugin/records/")
        self.assertEqual(response.status_code, 200)

    def test_create_record(self):
        response = self.client.post(
            "/api/plugins/your_plugin/records/",
            {"target_url": "https://example.com"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201)
```

**Mocking external services:** Mock at the module level where the import is used, not where it is defined:

```python
from unittest.mock import patch, MagicMock

@patch('plugins_data.your_plugin.backend.graph.manager.GraphDatabase')
def test_neo4j_query(self, mock_db):
    mock_db.driver.return_value = MagicMock()
    response = self.client.get("/api/plugins/your_plugin/graph/")
    self.assertEqual(response.status_code, 200)
```

**CSRF in browser (not tests):** The test client bypasses CSRF automatically. In the browser, include the CSRF token in all mutating requests — see the API Client Pattern section above.

![-----------------------------------------------------](https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/aqua.png)

## Reference: Existing Plugins

The four bundled plugins are the canonical reference implementations:

| Plugin | Focus | Backend | Temporal | UI |
|--------|-------|---------|----------|----|
| `active_directory` | AD attack path analysis, Neo4j graph, BloodHound ingestion | ✓ Full | ✓ 6 activities | ✓ Full React app |
| `active_exploitation` | SQLi exploitation via sqlmap, encrypted dump storage | ✓ Full | ✓ 1 activity | ✓ Dashboard |
| `exploit_readiness_layer` | Non-destructive vuln validation (sqlmap + XSStrike) | ✓ Full | ✓ 1 activity | ✓ Dashboard |
| `burpsuite_integration` | Bidirectional Burp Suite Pro REST API sync & manual target matching | ✓ Full | ✓ 3 activities | ✓ Tabbed Dashboard + config modal |

Study `active_directory` for a complete, complex plugin with full Temporal workflows, Neo4j graph queries, WebSocket streaming, RBAC, and a multi-page React UI with router state, config modals, and attack path visualisation.

Study `burpsuite_integration` for an example of dynamic target matching and external API integrations, or `active_exploitation` / `exploit_readiness_layer` for simpler single-workflow examples with dashboard UIs.

### Checklist

Before considering a plugin ready for install:

- [ ] `manifest.yaml` present with `name`, `version`, `runtime` (and `temporal` / `ui` if used)
- [ ] `apps.py` has `label = '{slug}_backend'` and `name = 'plugins_data.{slug}.backend'`
- [ ] All `db_table` values prefixed with `plugin_{slug}_`
- [ ] Migrations generated and applied inside the container
- [ ] API URLs registered and reachable at `/api/plugins/{slug}/`
- [ ] CSRF token sent with all mutating frontend API calls
- [ ] Temporal workflows contain no I/O (determinism rule)
- [ ] All `manifest.yaml` temporal paths importable from `backend.temporal_exports`
- [ ] `vite.config.ts` exposes `'./mount': './src/mount'` with `filename: 'remoteEntry.js'`
- [ ] `mount` and `unmount` exported from `src/mount.tsx`
- [ ] All runtime deps in `dependencies` (not `peerDependencies`) in `package.json`
- [ ] Frontend builds without errors: `npm run build`
- [ ] Built assets deployed to `plugins_data/{slug}/ui/` (not `ui/dist/`)
- [ ] Tests pass: `docker exec r3ngine-web-1 python manage.py test plugins_data.{slug}.tests`

![-----------------------------------------------------](https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/aqua.png)

<p align="right"><i>Note: Parts of this guide were written or refined using AI language models.</i></p>
