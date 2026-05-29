# Active Directory Plugin — Developer Guide

## Adding a New Discovery Phase

To add a new assessment phase (e.g., Kerberoasting detection):

### 1. Create the activity function in `temporal_exports.py`

```python
@activity.defn
async def run_kerberoasting_detection_activity(payload: dict) -> dict:
    """
    Detects potential Kerberoastable service accounts via SPN enumeration.
    
    Args:
        payload: {"assessment_id": int, "target_domain": str, "config": dict}
    
    Returns:
        dict with count of detected SPNs and list of findings.
    """
    assessment_id = payload["assessment_id"]
    target_domain = payload["target_domain"]
    
    # Implementation: DNS SPN record discovery
    # ... 
    
    await _send_ws_update(assessment_id, "finding_detected", {
        "type": "kerberoastable_spn",
        "count": len(spns)
    })
    
    return {"spns": spns, "count": len(spns)}
```

### 2. Add the phase to `ADAssessmentWorkflow.run()`

```python
# Phase 8: Kerberoasting detection
phase8_result = await workflow.execute_activity(
    "run_kerberoasting_detection_activity",
    payload,
    start_to_close_timeout=timedelta(minutes=30),
    heartbeat_timeout=timedelta(minutes=5),
    retry_policy=_RETRY_STANDARD,
    task_queue="python-orchestrator-queue",
)
```

### 3. Register in `manifest.yaml`

```yaml
temporal:
  activities:
    - "backend.temporal_exports.run_kerberoasting_detection_activity"
```

### 4. Create the Django model (if storing results)

Add to `backend/models.py`:
```python
class ADKerberoastableSPN(models.Model):
    assessment = models.ForeignKey(ADAssessment, on_delete=models.CASCADE)
    service_name = models.CharField(max_length=255)
    spn = models.CharField(max_length=500)
    discovered_at = models.DateTimeField(auto_now_add=True)
```

Run migrations:
```bash
docker-compose exec django python manage.py makemigrations active_directory
docker-compose exec django python manage.py migrate active_directory
```

---

## WebSocket Event Helper

Each activity should emit progress events via:

```python
async def _send_ws_update(assessment_id: int, event_type: str, data: dict):
    """
    Sends a real-time progress event to the Redis Stream for the assessment.
    
    Args:
        assessment_id: The ID of the ADAssessment.
        event_type: Event type string (e.g., 'phase_started', 'finding_detected').
        data: Event payload dict.
    """
    import redis
    r = redis.Redis(host=settings.REDIS_HOST, port=settings.REDIS_PORT)
    r.xadd(
        f"ad:assessment:{assessment_id}",
        {"type": event_type, "data": json.dumps(data)},
        maxlen=500,
    )
```

---

## Running the Test Suite

```bash
docker-compose exec django python manage.py test active_directory
```

---

## Ingestion Format Specs

### BloodHound JSON

Standard BloodHound `computers.json`, `users.json`, `groups.json`, `domains.json` format from SharpHound collector.

### LDAP Dump (Custom JSON)

```json
{
  "domain": "EXAMPLE.COM",
  "domain_controllers": [
    {"hostname": "DC01", "ip": "10.0.0.1", "os": "Windows Server 2019"}
  ],
  "users": [{"samaccountname": "jsmith", "enabled": true}],
  "groups": [{"name": "Domain Admins", "members": ["jsmith"]}]
}
```

### Custom JSON

Any JSON structure — the `run_ingestion_activity` will attempt to extract known fields and store the raw data.
