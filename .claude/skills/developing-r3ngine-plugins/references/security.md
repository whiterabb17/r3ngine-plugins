# Plugin Security & Threat Mitigation Guidelines

This guide details mandatory security architectures, input validation standards, and cryptographic requirements to ensure `r3ngine` plugins are safe from exploitation or privilege escalation.

---

## 🐳 Docker Daemon Sandbox Safety

If a plugin communicates with the host Docker daemon (e.g. using `docker.from_env()` to launch specialized scanning tools like Hashcat or Nuclei):

### 1. The Threat: Privilege Escalation
Access to `/var/run/docker.sock` is equivalent to root access on the host. An attacker who gains control of the plugin views could run container configurations that mount `/` (the host root filesystem) or run with `--privileged` status.

### 2. Mandatory Mitigations
- **Never Mount Host Root**: Only allow mounts targeting dedicated directories within `r3ngine` (e.g. `settings.RECON_DIR` or specific subfolders).
- **Reject Raw Command Strings**: Pass arguments as structured arrays to the container run config. Never format arbitrary strings directly into run commands.
- **Enforce Enums & Constraints**: Validate all options (such as severity filters, wordlist filenames, or profiles) against strict whitelists before passing them to the container.

#### ❌ Vulnerable Pattern
```python
# Raw interpolation of user input
client.containers.run(
    "hashcat/hashcat",
    command=f"hashcat -m {user_mode} {user_hashes} -w {user_workload}"
)
```

#### ✅ Secure Pattern
```python
# Enforce type constraints and structured arguments
def run_cracking_container(hash_type: int, workload_profile: int, hashes_path: str):
    # Strict validation of type values
    if hash_type not in [1000, 1800, 5600]:
        raise ValueError("Invalid hash type")
        
    if workload_profile not in [1, 2, 3, 4]:
        raise ValueError("Invalid workload profile")

    # Command passed as a list, preventing injection
    cmd = [
        "-m", str(hash_type),
        "-w", str(workload_profile),
        "/data/target_hashes.txt"
    ]
    
    client.containers.run(
        "hashcat/hashcat:latest",
        command=cmd,
        volumes={hashes_path: {'bind': '/data/target_hashes.txt', 'mode': 'ro'}},
        network_mode="none", # Isolate if network access is not required
        mem_limit="2g" # Constrain resources to prevent DoS
    )
```

---

## 🔑 REST API Authorization & RBAC

Plugins mount their endpoints under `/api/plugins/{slug}/`. You must secure all endpoints.

### 1. View Permissions
Every ViewSet or APIView must define `permission_classes`. Leaving them empty inherits Django's default (which could be open, depending on settings).

```python
# backend/views.py
from rest_framework import viewsets, permissions
from reNgine.common_func import IsPenetrationTester, IsAuditor # Core roles

class YourPluginViewSet(viewsets.ModelViewSet):
    # Ensure permission classes restrict access
    permission_classes = [permissions.IsAuthenticated, IsPenetrationTester]
```

### 2. CSRF Token Enforcement
All write/mutation endpoints (`POST`, `PUT`, `PATCH`, `DELETE`) are subject to CSRF validation.
- The React UI must fetch the token from document cookies (`csrftoken`).
- Include the token in the `X-CSRFToken` request header.

---

## 🔒 Cryptographic Encryption at Rest

If a plugin stores sensitive information (such as credentials, session tokens, API keys, or plaintexts):

- **Do Not Store Raw Plaintext**: Always encrypt sensitive data at rest.
- **Django Encrypted Fields**: Use `EncryptedCharField` or helper classes from Django cryptographic packages.

```python
# backend/models.py
from django.db import models
# Import django pgcrypto fields or custom Fernet/AES fields
from reNgine.utils.fields import EncryptedCharField 

class TargetCredential(models.Model):
    username = models.CharField(max_length=150)
    # Encrypted in the DB; decrypted on retrieval automatically
    password = EncryptedCharField(max_length=255)
    
    class Meta:
        app_label = "your_plugin_backend"
```

---

## 🚫 Command Injection & Path Traversal

When spawning local subprocesses or handling local files:

### 1. Spawning Subprocesses
- **Never** use `shell=True` in `subprocess.Popen` or `subprocess.run()`.
- Use list-based arguments.
- Prefer `asyncio.create_subprocess_exec` over synchronous subprocess wrappers.

### 2. File Path Traversal
- Attackers may provide target parameter values like `../../etc/passwd` to read or write files outside the plugin directory.
- Always resolve absolute paths using `os.path.abspath` or `Path.resolve()`.
- Ensure the resolved path falls within the boundary of allowed directories.

```python
# Safe path resolution check
import os

def validate_safe_path(base_dir: str, target_file: str) -> str:
    resolved_path = os.path.abspath(os.path.join(base_dir, target_file))
    if not resolved_path.startswith(os.path.abspath(base_dir)):
        raise PermissionError("Path Traversal Detected")
    return resolved_path
```
