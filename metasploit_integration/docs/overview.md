# Metasploit Integration User Guide

Welcome to the Metasploit Integration plugin for r3ngine. This tool bridges the gap between passive reconnaissance and active exploitation by providing a deeply integrated, isolated environment to run Metasploit Framework capabilities.

## Overview

The plugin operates completely independent of the core r3ngine vulnerability pipeline, ensuring that aggressive scanning or exploitation tasks do not disrupt normal system operations. It provides two main modes of interaction:

1. **Automated Template Scans**: Schedule and execute predefined modules in the background.
2. **Interactive Console**: Gain direct, two-way terminal access to a live Metasploit session directly from your browser.

---

## 1. Automated Template Scans

The Dashboard allows you to quickly launch automated Metasploit tasks. This is ideal for bulk scanning or repetitive validation tasks (e.g., verifying an SMB vulnerability across a large subnet).

### Launching a Task

1. Navigate to the **Metasploit Dashboard**.
2. Locate the **Launch Automated Template** card.
3. Enter your **Target (RHOSTS)**. This can be a single IP, a CIDR range, or a hostname.
4. Specify the **Module Name** (e.g., `auxiliary/scanner/portscan/tcp` or `exploit/windows/smb/ms17_010_eternalblue`).
5. Click **Launch Scan**.

### How it Works
When launched, the r3ngine Temporal orchestrator spins up a stateless Docker container (`metasploitframework/metasploit-framework`). It generates a `.rc` resource script, executes the module non-interactively, and captures the complete output for you to review later in the **Recent Automated Tasks** table.

---

## 2. Interactive Console

For tasks requiring nuance, pivoting, or complex exploit configuration, the Interactive Console is your best friend.

### Accessing the Console
1. Navigate to the **Interactive Console** tab.
2. Upon opening the tab, the backend securely authenticates your session and spins up a dedicated pseudo-terminal (PTY) attached to a fresh Metasploit Docker container.
3. You will be greeted with the classic `msf6 >` prompt.

### Features
*   **Full TTY Support**: The console supports syntax highlighting, auto-completion (Tab), and history (Up/Down arrows) just like a native terminal.
*   **Secure Connection**: The connection operates over an authenticated WebSocket (`wss://`). If your session expires or you lack administrative privileges, the connection drops immediately.

### Best Practices
*   **Resource Management**: Interactive sessions are ephemeral. If you close your browser tab or disconnect, the underlying Docker container will automatically terminate to save server resources.
*   **Use Automated Tasks for Long Runs**: Do not use the Interactive Console for multi-hour port scans; use the Automated Template launcher so the Temporal orchestrator can track it properly.

---

## 3. Security & Access Control

Metasploit provides severe offensive capabilities. To ensure safe operation within your r3ngine instance:

*   **Role-Based Access**: Only users with `Admin` or designated `Pentester` roles can view this plugin, launch tasks, or open interactive consoles.
*   **Network Boundaries**: The plugin container executes within the r3ngine Docker network. Ensure your outbound network ACLs appropriately restrict the container's access if you intend to exploit external targets.

## Troubleshooting

*   **Console says "Disconnected"**: Ensure your session hasn't expired. Refresh the page to obtain a new authentication token and establish a new PTY session.
*   **Automated task stuck at PENDING**: Ensure the `r3ngine-plugin-tasks` Temporal worker is running in your stack.
*   **Module fails to run**: Check the raw task output for missing required parameters (e.g., forgetting to set `RPORT` or `LHOST`).
