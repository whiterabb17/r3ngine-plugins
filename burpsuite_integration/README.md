# Burp Suite Integration Plugin for r3ngine

A bidirectional [Burp Suite Professional](https://portswigger.net/burp/pro) integration plugin for [r3ngine](https://github.com/Security-Tools-Alliance/rengine-ng). Import Burp scan findings directly into r3ngine vulnerability tracking, and push reconnaissance targets back to Burp's scope.

---

## Features

- **Import Burp Findings** — Pull issues from all active Burp scan tasks into r3ngine's vulnerability database
- **Two-Phase Architecture** — Phase 1 saves raw `BurpIssue` records safely; Phase 2 correlates them to existing `Subdomain`/`EndPoint` records and creates linked `Vulnerability` entries
- **Manual Matching** — For unmatched issues (Burp scanned a target not yet in r3ngine), use the UI to manually match them to the correct subdomain/endpoint
- **Push Scope to Burp** — Send r3ngine discovered subdomains and endpoints back to Burp Suite's target scope for active scanning
- **Sync History** — Full audit log of all import/push operations with timestamps and counts
- **Re-correlate** — Run the correlation phase independently at any time from the plugin UI

---

## Requirements

- **Burp Suite Professional** (Community Edition does not include the REST API)
- Burp REST API enabled and listening (default: `http://127.0.0.1:1337`)
- r3ngine running (Docker or local)

---

## Quick Start

### 1. Enable Burp REST API

In Burp Suite Pro: **User options → Misc → REST API → Service running: ✓**

### 2. Configure the Plugin

Go to **r3ngine → Burp Suite → Settings tab**:

- **API URL**: `http://host.docker.internal:1337` (if r3ngine is in Docker on same host)
- **API Key**: Leave blank unless you configured one in Burp
- Click **Test Connection** to verify

### 3. Import Findings

Click **Import from Burp** to trigger a full import of all current Burp scan issues.

The import runs as a two-phase Temporal workflow:
1. Phase 1 — All issues saved to `BurpIssue` table
2. Phase 2 — Issues correlated to r3ngine `Subdomain`/`EndPoint`/`Vulnerability` records

### 4. Handle Unmatched Issues

Some Burp issues may scan targets not yet discovered by r3ngine. In the **Issues tab**, use the **"Unmatched Only"** filter to see them, then click **"Match Manually"** to link them to the correct subdomain.

---

## Docker Networking Note

If r3ngine runs inside Docker and Burp Suite runs on the host machine:

- Use `host.docker.internal:1337` as the API URL (works on Linux/macOS/Windows Docker Desktop)
- Or use the host's actual LAN IP address (e.g. `192.168.1.x:1337`)
- The Docker container must be able to reach the host's port 1337

---

## Severity Mapping

| Burp Severity | r3ngine Severity |
|--------------|-----------------|
| Information  | 0 (Info)        |
| Low          | 1 (Low)         |
| Medium       | 2 (Medium)      |
| High         | 3 (High)        |
| Critical     | 4 (Critical)    |

---

## Authors

Plugin implementation by **MistrHyde**, based on the [reNgine-ng](https://github.com/Security-Tools-Alliance/rengine-ng) platform by the **Security-Tools-Alliance / reNgine-ng Authors**.

## License

GPLv3 — see [LICENSE](../LICENSE)
