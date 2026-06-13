# Temporal Backend & Django Integration Guide

This guide details how to implement robust backend modules, register Temporal workflows/activities, execute safe ORM operations, and design migrations for `r3ngine` plugins.

---

## 🏗️ Naming Conventions & Registry Paths

During container initialization, the `PluginTemporalRegistry` dynamically imports your workflows and activities. The paths registered in `manifest.yaml` must follow these rules:
- **Paths**: Must be relative to the plugin's package name. The container maps the import path internally to `plugins_data.{slug}.backend.temporal_exports.<Symbol>`.
- **AppConfigs**: Define `{slug}_backend` in your Django AppConfig:
  ```python
  # backend/apps.py
  from django.apps import AppConfig

  class PluginConfig(AppConfig):
      name = "plugins_data.your_plugin.backend"
      label = "your_plugin_backend" # REQUIRED format
  ```

---

## 🔁 Workflows vs Activities: The Determinism Boundary

### 1. Workflows
Workflows orchestrate the sequence of scanning tiers and tasks. They **must be 100% deterministic**. Any execution replay of the workflow history must yield identical states.

- **❌ Forbidden in Workflows**:
  - Django ORM queries (`Model.objects.get()`).
  - Local file system reads/writes (`open('file.txt')`).
  - System clock/time calls (`datetime.now()`, `time.sleep()`).
  - Random number generators (`random.randint()`).
  - Network requests (`requests.get()`).
- **✅ Allowed in Workflows**:
  - Calling activities using `await workflow.execute_activity()`.
  - Workflow timers using `await workflow.sleep(timedelta)`.
  - Deterministic time using `workflow.now()`.
  - Loops and branch conditions based strictly on workflow arguments or activity results.

### 2. Activities
Activities perform the actual heavy lifting. They execute external scanning binaries (e.g. Nuclei, Hashcat), perform web crawling, query APIs, or write results to the database.

---

## 🔒 Safe Database Access Patterns in Activities

Because Temporal activities in `r3ngine` run asynchronously within the event loop, you must run synchronous Django ORM calls inside a thread pool executor to avoid blocking the event loop:

```python
# backend/temporal_exports.py
import asyncio
from datetime import timedelta
from temporalio import workflow, activity
from temporalio.common import RetryPolicy

@activity.defn
async def run_scan_activity(params: dict) -> dict:
    from plugins_data.your_plugin.backend.models import YourPluginRecord

    def _save_to_db():
        # Executes synchronously in the threadpool
        record = YourPluginRecord.objects.create(
            target_url=params["url"],
            result="Scan results populated here"
        )
        return record.id

    loop = asyncio.get_event_loop()
    record_id = await loop.run_in_executor(None, _save_to_db)
    return {"status": "success", "record_id": record_id}
```

---

## ⚠️ Mitigating Database Connection Leaks

When activities run long-running subprocesses (e.g., executing command-line utilities via `subprocess` or `asyncio.create_subprocess_exec`), Django database connections may sit idle and leak, eventually exhausting the database connection pool.

### The Fix
Explicitly close database connections before invoking a subprocess inside a Temporal activity. This forces Django to request a fresh connection from the pool once the process completes:

```python
@activity.defn
async def run_tool_activity(params: dict) -> dict:
    import django.db
    
    # 1. Close active database connections before spawning the process
    django.db.connection.close()
    
    # 2. Run the subprocess
    proc = await asyncio.create_subprocess_exec(
        "nmap", "-sV", params["target"],
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE
    )
    stdout, stderr = await proc.communicate()
    
    # 3. Subsequent ORM operations will automatically open a fresh connection
    ...
```

---

## 🔄 Dynamic Database Migrations

During plugin installation, `AtomicInstaller` runs migrations dynamically.

### 1. Model Configuration
Ensure all models contain `app_label` and `db_table` explicitly set to prevent Django namespace conflicts:

```python
# backend/models.py
from django.db import models

class YourPluginModel(models.Model):
    name = models.CharField(max_length=200)

    class Meta:
        app_label = "your_plugin_backend" # Must match AppConfig label
        db_table = "plugin_your_plugin_model" # Must use plugin_{slug}_ prefix
```

### 2. Execution Safety
- Migrations are run via subprocess calls to `manage.py migrate your_plugin_backend` at installation time.
- All migrations must execute outside of active Django database transactions to allow DDL operations.
- Ensure that the database connection is closed prior to the subprocess migration invocation to prevent locking tables or deadlocking with active sessions.
