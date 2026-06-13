# Offline Cracking Architectural Diagram

The diagram below shows the interaction flow between the frontend UI, Django views, the Docker SDK, the host daemon, and the containerized Hashcat instances.

```mermaid
sequenceDiagram
    participant UI as Plugin UI (React)
    participant API as Plugin View (Django)
    participant SDK as Docker SDK (Python)
    participant Host as Docker Daemon
    participant Container as GPU Hashcat Container

    UI->>API: POST /api/plugins/credential_intelligence/cracking/ (params & hashes)
    API->>API: Validate parameters (RBAC: IsPenetrationTester)
    API->>SDK: docker.from_env()
    API->>SDK: Check GPU capabilities
    API->>Host: Run container (with GPU device requests if available)
    Host->>Container: Spawn hashcat container (bind mount wordlist & hashes)
    API->>UI: Response (cracking task ID)
    loop Every 5 seconds
        UI->>API: GET /api/plugins/credential_intelligence/cracking/{id}/status/
        API->>SDK: Query container logs/status
        SDK->>API: Container output
        API->>UI: Status (live progress, cracked count)
    end
    Container->>Host: Crack completed / terminated
    API->>API: Parse hashcat output file & save plaintexts using EncryptedCharField
    API->>Host: Remove container
```

## Security Controls

1. **Parameter Sanitization**: No raw shell strings are passed to the container. All configurable Hashcat command-line parameters (workload, attack mode, charsets, increment configurations) are mapped directly via Python lists to avoid shell injection.
2. **Access Control**: Creation and control of cracking tasks are restricted to the `IsPenetrationTester` role. Results containing cracked cleartext credentials require the `IsAuditor` role to retrieve.
3. **Container Sandbox**: The Hashcat container runs as a non-root processes, using CPU/Memory constraints to prevent host DoS.
