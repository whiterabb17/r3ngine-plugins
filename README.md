# reNgine v3 Plugin Development Guide

reNgine v3 introduces a modular, stealth-focused plugin architecture. This allows developers to extend the platform's reconnaissance and validation capabilities without modifying the core codebase.

## 📁 Plugin Anatomy

A reNgine plugin is a ZIP archive containing a specific folder structure and configuration files:

```text
my-awesome-plugin/
├── manifest.yaml           # Core identity and sequencing
├── tools.yaml              # (Optional) Binary tool dependencies
├── my_engine.yaml          # (Optional) Engine Type fixtures
├── backend/                # Backend logic (Celery tasks, logic)
│   ├── tasks.py            # Main entry point for Celery
│   └── ...
├── ui/                     # (Optional) Frontend components
│   ├── MyComponent.js      # React component (ESM)
│   └── VulnerabilityTable.js # (Optional) Override for core UI
└── resources/                # (Optional) Any other resources for the plugin
```

---

## 📄 The Manifest (`manifest.yaml`)

The `manifest.yaml` is the source of truth for your plugin. It defines the identity, where it attaches to the scan pipeline, and UI configuration.

```yaml
name: "Exploit Readiness Layer"
version: "1.0.0"
description: "Validated vulnerability confirmation using sandboxed tools."
runtime:
  run after: "VulnerabilityScan"  # Sequencing: Before or After a core step
ui:
  components:
    - name: "ERL Summary"
      type: "TargetDashboard"     # Slot name to inject into
      file: "ERLSummary.js"
  overrides:
    - name: "VulnerabilityTable"  # Core component name to override
      file: "VulnerabilityTable.js"
```

### Sequencing Anchors
Plugins can attach to the following core steps:
- `SubdomainDiscovery`
- `PortScan`
- `FetchURL`
- `VulnerabilityScan`
- `Reporting`

---

## 🛠️ Tool Dependencies (`tools.yaml`)

If your plugin requires external binaries (like `sqlmap` or `XSStrike`), define them in `tools.yaml`. reNgine will automatically handle their installation and health checks in the background.

```yaml
tools:
  - name: "sqlmap"
    binary: "sqlmap"
    install_type: "pip3"
    install_command: "pip3 install sqlmap"
    validation_command: "sqlmap --version"
  - name: "XSStrike"
    binary: "python3 /usr/src/app/plugins_data/exploit-readiness-layer/tools/XSStrike/xsstrike.py"
    install_type: "git"
    install_command: "mkdir -p tools && git clone --depth 1 https://github.com/s0md3v/XSStrike.git tools/XSStrike && pip3 install -r tools/XSStrike/requirements.txt"
    validation_command: "python3 tools/XSStrike/xsstrike.py --version"
```

> [!IMPORTANT]
> Tools are installed into the `plugins_data/<plugin-slug>/` directory on the worker container. Use relative paths in your tasks.

---

## ⚙️ Scan Engine Integration (`*_engine.yaml`)

Plugins can provide custom engine templates. Any file ending in `_engine.yaml` is treated as a Django fixture and ingested upon installation.

### Dedicated `erl` Block
To keep configurations clean, ERL-related settings should use the dedicated `erl` block:

```yaml
- fields:
    engine_name: "Exploit Readiness Scan"
    yaml_configuration: |
      subdomain_discovery: { 'uses_tools': ['subfinder'], 'threads': 30 }
      vulnerability_scan: { 'run_nuclei': true, 'severities': ['high', 'critical'] }
      erl: {
        'enabled': true,
        'use_tools': ['sqlmap', 'XSStrike'],
        'confidence_threshold': 0.5
      }
  model: scanEngine.enginetype
```

---

## 🖥️ Frontend Extensions

reNgine uses a **Slot & Override** system for UI extensibility.

### 1. UI Components (Slots)
You can inject components into predefined "slots" throughout the dashboard. Core components use `<PluginSlot name="SlotName" />` to render these.

**Common Slots:**
- `TargetDashboard`
- `ScanDetailHeader`
- `VulnerabilityActionMenu`

### 2. UI Overrides
Overrides allow you to completely replace a core reNgine component with your own. This is useful for custom data visualizations or specialized tables.

**How it works:**
1. Identify the component name in the reNgine frontend (e.g., `VulnerabilityTable`).
2. Add the override to your `manifest.yaml`.
3. Provide an ESM-compatible JavaScript file in your `ui/` folder.

```javascript
// ui/MyCustomComponent.js
import React from 'react';

const MyCustomComponent = ({ context }) => {
  return <div className="tactical-panel">Plugin Content</div>;
};

export default MyCustomComponent;
```

---

## 🚀 Development Workflow

1. **Develop Local**: Create your plugin folder inside `r3ngine-plugins/`.
2. **Backend Logic**: Use the `SubprocessExecutor` for executing your plugin tools to ensure they respect reNgine's OpSec and Proxy settings.
3. **Pack**: `zip -r my-plugin.zip .` (inside your plugin folder).
4. **Upload**: Use the "Plugin Inventory" page in the reNgine UI to upload and enable your plugin.
5. **Verify**: Check the worker logs (`docker logs -f rengine-worker`) for tool installation progress.

---

> [!TIP]
> Always check `reNgine.opsec_utils` in the backend for reusable stealth and proxy management utilities when building your adapters.
