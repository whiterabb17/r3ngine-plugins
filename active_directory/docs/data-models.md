# Active Directory Plugin — Data Models

See [Backend API](backend-api.md) for the full data model field reference.

## Model Relationships

```
ADAssessment (1)
    ├─── ADDomain (*)        - Discovered domain controllers
    ├─── ADTrust (*)         - Trust relationships between domains
    └─── ADExposure (*)      - Internet-facing AD service exposures
```

## Migration Notes

- All models are under the `active_directory` app label.
- Migrations run in subprocess isolation at install time to prevent Django registry issues.
- `ADAssessment.scan_history` is a nullable ForeignKey to `startScan.ScanHistory` — allows standalone assessments not tied to a scan.
