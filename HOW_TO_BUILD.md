# How to Build an r3ngine Plugin

This guide covers everything you need to author a plugin for r3ngine from scratch. The `active_directory` plugin is the canonical reference implementation — read its code alongside this guide.

---

## Table of Contents

1. [Repository Layout](#1-repository-layout)
2. [Plugin Directory Structure](#2-plugin-directory-structure)
3. [manifest.yaml](#3-manifestyaml)
4. [Backend: Django App](#4-backend-django-app)
5. [Backend: REST API](#5-backend-rest-api)
6. [Backend: Temporal Workflows & Activities](#6-backend-temporal-workflows--activities)
7. [Frontend: React + Vite Federation](#7-frontend-react--vite-federation)
8. [Testing](#8-testing)
9. [Deploying to the Container](#9-deploying-to-the-container)
10. [Checklist](#10-checklist)

---

## 1. Repository Layout

r3ngine plugins live in their own git repository at `r3ngine-plugins/`. The main application mounts plugins at runtime — no changes to `web/` are required to add a plugin.

```
r3ngine-plugins/
└── <slug>/               # e.g. active_directory
    ├── manifest.yaml
    ├── tools.yaml        # (optional) external tool definitions
    ├── backend/          # Django application
    └── ui/               # React frontend (Vite Module Federation)
```

The `<slug>` must be a valid Python package name (underscores, no hyphens).

---

## 2. Plugin Directory Structure

### Full tree example

```
active_directory/
├── manifest.yaml
├── tools.yaml
├── __init__.py
├── backend/
│   ├── __init__.py
│   ├── apps.py
│   ├── models.py
│   ├── serializers.py
│   ├── api.py
│   ├── api_urls.py
│   ├── permissions.py
│   ├── temporal_exports.py
│   ├── migrations/
│   ├── graph/
│   │   ├── schema.py
│   │   └── manager.py
│   └── ingestion/
│       └── bloodhound_parser.py
├── tests/
│   ├── __init__.py
│   └── test_*.py
└── ui/
    ├── package.json
    ├── vite.config.ts
    └── src/
        ├── index.ts
        ├── mount.tsx          # federation entry point
        ├── types/index.ts
        ├── api/
        ├── components/
        ├── pages/
        │   └── <Slug>PluginApp.tsx
        ├── hooks/
        └── store/
```

---

## 3. manifest.yaml

Every plugin must have a `manifest.yaml` at its root.

```yaml
name: "My Plugin"
description: "One-sentence description."
version: "1.0.0"

runtime:
  # "standalone" = plugin never runs as part of the main scan pipeline.
  # Set to a scan tier name (e.g. "tier_2") to hook into the scan pipeline.
  run after: "standalone"

temporal:
  workflows:
    - "backend.temporal_exports.MyWorkflow"
  activities:
    - "backend.temporal_exports.my_activity"

ui:
  menu_item: "My Plugin"          # sidebar label
  menu_path: "/p/my-plugin"       # host app route
  entry_export: "MyPluginApp"     # exported React component name
```

**Key rules:**
- `runtime.run after: "standalone"` prevents the plugin from being injected into the main Nuclei/subdomain scan pipeline.
- The `temporal` section lists every workflow class and activity function that the Temporal worker must register. Use the dotted path relative to the plugin root.
- `ui.entry_export` must match the named export in `src/index.ts`.

---

## 4. Backend: Django App

### apps.py

The app label **must** end in `_backend` to avoid clashing with the plugin slug itself:

```python
from django.apps import AppConfig

class BackendConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'plugins_data.my_plugin.backend'
    label = 'my_plugin_backend'
    verbose_name = 'My Plugin'
```

> **Why `plugins_data.*`?** The r3ngine container installs plugin source into `web/plugins_data/` at startup. Your Python import paths must match: `plugins_data.<slug>.backend.*`.

### models.py

Write standard Django models. Use `db_table` to namespace your tables:

```python
from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()

class MyRecord(models.Model):
    name = models.CharField(max_length=255)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'plugin_my_plugin_record'
```

Prefix all `db_table` values with `plugin_<slug>_` to avoid collisions with core tables.

### Migrations

Run `makemigrations` inside the container:

```bash
docker exec r3ngine-web-1 python manage.py makemigrations my_plugin_backend
docker exec r3ngine-web-1 python manage.py migrate my_plugin_backend
```

> Always check the migration dependency chain. The container may have migrations that don't exist locally (run `showmigrations my_plugin_backend` to compare).

---

## 5. Backend: REST API

### serializers.py

```python
from rest_framework import serializers
from .models import MyRecord

class MyRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = MyRecord
        fields = ['id', 'name', 'created_at']
        read_only_fields = ['created_at']
```

### api.py

Use DRF `ModelViewSet` for standard CRUD. Add custom actions with `@action`:

```python
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import MyRecord
from .serializers import MyRecordSerializer

class MyRecordViewSet(viewsets.ModelViewSet):
    serializer_class = MyRecordSerializer
    queryset = MyRecord.objects.all()

    def get_queryset(self):
        return MyRecord.objects.filter(created_by=self.request.user)

    @action(detail=True, methods=['post'], url_path='start')
    def start(self, request, pk=None):
        record = self.get_object()
        # ... kick off a Temporal workflow
        return Response({'status': 'started'})
```

For singleton config models (one row per deployment), use `APIView`:

```python
from rest_framework.views import APIView

class MyPluginConfigView(APIView):
    def get(self, request):
        from .models import MyPluginConfig
        from .serializers import MyPluginConfigSerializer
        cfg = MyPluginConfig.get()
        return Response(MyPluginConfigSerializer(cfg).data)

    def put(self, request):
        from .models import MyPluginConfig
        from .serializers import MyPluginConfigSerializer
        cfg = MyPluginConfig.get()
        ser = MyPluginConfigSerializer(cfg, data=request.data)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)
```

### api_urls.py

```python
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .api import MyRecordViewSet, MyPluginConfigView

router = DefaultRouter()
router.register(r'records', MyRecordViewSet, basename='my-plugin-record')

urlpatterns = [
    path('', include(router.urls)),
    path('config/', MyPluginConfigView.as_view(), name='my-plugin-config'),
]
```

The host app mounts plugin URLs at `/api/plugins/<slug>/`, so the full path for the config endpoint would be `/api/plugins/my_plugin/config/`.

---

## 6. Backend: Temporal Workflows & Activities

### temporal_exports.py

All Temporal classes and functions that the manifest references must be importable from `backend.temporal_exports`:

```python
from temporalio import activity, workflow
from temporalio.common import RetryPolicy
from datetime import timedelta

@activity.defn(name="my_plugin_do_work")
async def do_work_activity(record_id: int) -> dict:
    # Heavy lifting: DB writes, subprocess calls, Neo4j, etc.
    # Activities are allowed to do I/O.
    return {"status": "done"}

@workflow.defn(name="MyPluginWorkflow")
class MyPluginWorkflow:
    @workflow.run
    async def run(self, record_id: int) -> None:
        await workflow.execute_activity(
            do_work_activity,
            record_id,
            start_to_close_timeout=timedelta(minutes=30),
            retry_policy=RetryPolicy(maximum_attempts=2),
        )

# Re-export so manifest paths resolve
MyWorkflow = MyPluginWorkflow
my_activity = do_work_activity
```

**Workflow rules (enforced by Temporal's determinism checker):**
- Workflows must be **deterministic** — no `datetime.now()`, `random`, file I/O, or network calls.
- All non-deterministic work belongs in **activities**.
- Use `workflow.unsafe.imports_passed_through()` if you must import Django inside a workflow file.

### Starting a workflow from an API view

```python
from reNgine.temporal_client import TemporalClientProvider

async def _start():
    client = await TemporalClientProvider.get_client()
    handle = await client.start_workflow(
        "MyPluginWorkflow",
        record_id,
        id=f"my-plugin-{record_id}",
        task_queue="python-orchestrator-queue",
    )
    return handle.id

import asyncio
workflow_id = asyncio.run(_start())
```

---

## 7. Frontend: React + Vite Federation

Plugins use [Vite Module Federation](https://github.com/originjs/vite-plugin-federation) to ship a self-contained React app that the host mounts dynamically. No iframe — the plugin shares the host page DOM.

### package.json (minimal)

```json
{
  "name": "my-plugin-ui",
  "version": "1.0.0",
  "scripts": {
    "build": "vite build",
    "dev": "vite"
  },
  "dependencies": {
    "@mui/material": "^5",
    "@emotion/react": "^11",
    "@emotion/styled": "^11",
    "@tanstack/react-query": "^5",
    "lucide-react": "^0.400",
    "react": "^18",
    "react-dom": "^18"
  },
  "devDependencies": {
    "@originjs/vite-plugin-federation": "^1",
    "@vitejs/plugin-react": "^4",
    "vite": "^5"
  }
}
```

### vite.config.ts

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import federation from '@originjs/vite-plugin-federation';

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'my_plugin',        // must match plugin slug
      filename: 'remoteEntry.js',
      exposes: { './mount': './src/mount' },
      shared: [],               // do NOT share react — host injects globals
    }),
  ],
  build: {
    target: 'esnext',
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: { input: './src/index.ts' },
  },
});
```

> **Important:** Keep `shared: []`. The host injects `window.React` and `window.ReactDOM` as globals. Sharing via federation creates duplicate React instances which breaks hooks.

### src/mount.tsx (federation entry point)

```tsx
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { MyPluginApp } from './pages/MyPluginApp';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#00e5ff' },
    background: { default: '#0a0e1a', paper: '#0d1117' },
  },
});

const roots = new WeakMap<HTMLElement, Root>();

export function mount(el: HTMLElement, props: Record<string, unknown>): void {
  const queryClient = new QueryClient();
  const root = createRoot(el);
  roots.set(el, root);
  root.render(
    React.createElement(ThemeProvider, { theme: darkTheme },
      React.createElement(CssBaseline, null),
      React.createElement(QueryClientProvider, { client: queryClient },
        React.createElement(MyPluginApp, props as never)
      )
    )
  );
}

export function unmount(el: HTMLElement): void {
  roots.get(el)?.unmount();
  roots.delete(el);
}
```

### src/index.ts (named export for manifest)

```typescript
export { MyPluginApp } from './pages/MyPluginApp';
```

### API client (src/api/myPluginApi.ts)

All plugin API calls go through the Django backend at `/api/plugins/<slug>/`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_BASE = '/api/plugins/my_plugin/records';

function getCsrfToken(): string {
  return document.cookie.split('; ').find(r => r.startsWith('csrftoken='))?.split('=')[1] ?? '';
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
    queryKey: ['my_plugin', 'records'],
    queryFn: () => apiFetch<{ results: MyRecord[]; count: number }>(`${API_BASE}/`),
    select: (data) => data.results,
  });
}
```

Always pass `credentials: 'include'` and the `X-CSRFToken` header for mutating requests.

---

## 8. Testing

### Test file location

```
<slug>/tests/test_<module>.py
```

### Running tests in the container

```bash
docker exec r3ngine-web-1 python manage.py test plugins_data.my_plugin.tests.test_models
```

The module path is always `plugins_data.<slug>.tests.<test_module>`.

### Authentication in tests

Django middleware intercepts requests before DRF authentication runs. Use `django.test.Client` with `force_login()` — **not** `rest_framework.test.APIClient` with `force_authenticate()`:

```python
from django.test import TestCase, Client
from django.contrib.auth import get_user_model

User = get_user_model()

class MyPluginAPITest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('analyst', password='pass')
        self.client = Client()
        self.client.force_login(self.user)  # correct — not force_authenticate()
```

### Mocking external services

Mock at the module level where the import is used, not where it is defined:

```python
from unittest.mock import patch, MagicMock

@patch('plugins_data.my_plugin.backend.graph.manager.GraphDatabase')
def test_something(self, mock_db):
    mock_db.driver.return_value = MagicMock()
    # ...
```

---

## 9. Deploying to the Container

### Build the frontend

```bash
cd r3ngine-plugins/my_plugin/ui
npm install
npm run build
```

This produces `dist/` with `remoteEntry.js` and `assets/index-*.js`.

### Sync to the container

The host's `sync_plugin_ui` management command copies plugin dist files into Django's `STATIC_ROOT`:

```bash
docker exec r3ngine-web-1 python manage.py sync_plugin_ui my_plugin
```

Or copy manually for faster iteration:

```bash
docker cp dist/. r3ngine-web-1:/app/staticfiles/plugins/my_plugin/
```

### Apply migrations

```bash
docker exec r3ngine-web-1 python manage.py migrate my_plugin_backend
```

### Restart the worker (if you changed Temporal activities)

```bash
docker restart r3ngine-temporal-python-1
```

The Temporal Python worker auto-discovers plugin workflows and activities from `manifest.yaml` on startup.

---

## 10. Checklist

Use this before considering a plugin "done":

- [ ] `manifest.yaml` present with correct `name`, `runtime`, `temporal`, and `ui` sections
- [ ] `apps.py` has `label = '<slug>_backend'` and `name = 'plugins_data.<slug>.backend'`
- [ ] All `db_table` values prefixed with `plugin_<slug>_`
- [ ] Migrations generated and applied inside the container
- [ ] API URLs registered in `api_urls.py` and reachable at `/api/plugins/<slug>/`
- [ ] CSRF token sent with all mutating API calls from the frontend
- [ ] Temporal workflows are deterministic (no I/O in workflow body)
- [ ] All activities listed in `manifest.yaml` are importable from `backend.temporal_exports`
- [ ] Frontend builds with `npm run build` without errors
- [ ] `mount` and `unmount` functions exported from `src/mount.tsx`
- [ ] `ui.entry_export` in `manifest.yaml` matches the named export in `src/index.ts`
- [ ] Tests pass: `docker exec r3ngine-web-1 python manage.py test plugins_data.<slug>.tests`
- [ ] Plugin UI synced to container and accessible in the host app
