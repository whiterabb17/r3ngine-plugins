import logging
from datetime import timedelta

from temporalio import activity, workflow
from django.utils import timezone

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Activity: Phase 1 — Raw Import from Burp Suite
# ---------------------------------------------------------------------------

@activity.defn
def run_burp_import_activity(params: dict) -> dict:
    """
    Phase 1: Pull all issues from Burp Suite REST API and save as BurpIssue records.

    This activity is deliberately kept simple — it only writes to the plugin's
    own BurpIssue table and never touches core r3ngine models. This mirrors
    the Tier 6 pattern in r3ngine where raw assessment results are saved first.

    If an issue already exists (matched by burp_serial_number), it is updated
    in-place rather than duplicated.

    Args:
        params (dict): {
            "sync_log_id": int,      # BurpSyncLog.id to update with results
            "scan_history_id": int,  # Optional r3ngine ScanHistory to associate
            "task_id": str,          # Optional specific Burp task_id to import from
        }

    Returns:
        dict: {"imported": int, "skipped": int, "sync_log_id": int}
    """
    from .models import BurpSuiteConfig, BurpIssue, BurpSyncLog, BURP_SEVERITY_MAP
    from .burp_client import BurpSuiteClient

    sync_log_id = params.get("sync_log_id")
    scan_history_id = params.get("scan_history_id")
    task_id = params.get("task_id")

    logger.info(
        f"run_burp_import_activity: starting (sync_log_id={sync_log_id}, "
        f"scan_history_id={scan_history_id}, task_id={task_id})"
    )

    # Update sync log to running state
    sync_log = None
    if sync_log_id:
        try:
            sync_log = BurpSyncLog.objects.get(id=sync_log_id)
            sync_log.status = "running"
            sync_log.save(update_fields=["status"])
        except BurpSyncLog.DoesNotExist:
            logger.warning(f"run_burp_import_activity: BurpSyncLog {sync_log_id} not found")

    # Load config and create client
    config = BurpSuiteConfig.get()
    client = BurpSuiteClient(api_url=config.api_url, api_key=config.api_key)

    # Fetch issues — either from a specific task or from all tasks
    try:
        if task_id:
            raw_issues = client.get_scan_issues(str(task_id))
        else:
            raw_issues = client.get_all_issues()
    except Exception as e:
        logger.error(f"run_burp_import_activity: failed to fetch issues: {e}")
        if sync_log:
            sync_log.status = "failed"
            sync_log.error_message = str(e)
            sync_log.completed_at = timezone.now()
            sync_log.save(update_fields=["status", "error_message", "completed_at"])
        raise

    imported_count = 0
    skipped_count = 0

    # Parse severity filter from config
    allowed_severities = set()
    for sev_str in config.severity_filter.split(","):
        sev_str = sev_str.strip().lower()
        if sev_str in BURP_SEVERITY_MAP:
            allowed_severities.add(BURP_SEVERITY_MAP[sev_str])

    for raw_issue in raw_issues:
        # Map Burp severity string → r3ngine integer
        burp_severity_str = raw_issue.get("severity", "information").lower()
        severity_int = BURP_SEVERITY_MAP.get(burp_severity_str, 0)

        # Apply severity filter if configured
        if allowed_severities and severity_int not in allowed_severities:
            skipped_count += 1
            continue

        serial_number = str(raw_issue.get("serial_number", ""))
        if not serial_number:
            # Skip issues with no serial number — can't deduplicate
            skipped_count += 1
            continue

        # Upsert BurpIssue by serial number
        try:
            issue, created = BurpIssue.objects.update_or_create(
                burp_serial_number=serial_number,
                defaults={
                    "burp_issue_type_id": raw_issue.get("type_index", 0),
                    "name": raw_issue.get("name", "Unknown Issue")[:500],
                    "severity": severity_int,
                    "confidence": raw_issue.get("confidence", "")[:50],
                    "host": raw_issue.get("host", "")[:500],
                    "path": raw_issue.get("path", "")[:2000],
                    "issue_detail": raw_issue.get("issue_detail", "") or "",
                    "issue_background": raw_issue.get("issue_background", "") or "",
                    "remediation_detail": raw_issue.get("remediation_detail", "") or "",
                    "remediation_background": raw_issue.get("remediation_background", "") or "",
                    "scan_history_id": scan_history_id,
                    # Reset correlation state on re-import so Phase 2 re-runs
                    "is_correlated": False,
                    "linked_vulnerability_id": None,
                    "raw_data": raw_issue,
                },
            )
            if created:
                imported_count += 1
            else:
                # Existing issue updated — still counts as imported
                imported_count += 1
        except Exception as e:
            logger.warning(
                f"run_burp_import_activity: failed to upsert issue {serial_number}: {e}"
            )
            skipped_count += 1

    # Finalise sync log
    if sync_log:
        sync_log.issues_imported = imported_count
        sync_log.issues_skipped = skipped_count
        sync_log.status = "completed"
        sync_log.completed_at = timezone.now()
        sync_log.save(update_fields=[
            "issues_imported", "issues_skipped", "status", "completed_at"
        ])

    # Update config last_synced timestamp
    config.last_synced = timezone.now()
    config.save(update_fields=["last_synced"])

    logger.info(
        f"run_burp_import_activity: done "
        f"(imported={imported_count}, skipped={skipped_count})"
    )
    return {"imported": imported_count, "skipped": skipped_count, "sync_log_id": sync_log_id}


# ---------------------------------------------------------------------------
# Activity: Phase 2 — Correlate BurpIssues to r3ngine Vulnerabilities
# ---------------------------------------------------------------------------

@activity.defn
def run_burp_correlate_activity(params: dict) -> dict:
    """
    Phase 2: Match BurpIssue records to existing r3ngine Subdomain/EndPoint
    records and create linked startScan.Vulnerability rows.

    This mirrors r3ngine's own CorrelateVulnerabilitiesActivity (Tier 7).
    Only issues with is_correlated=False are processed.

    Matching logic:
        1. Extract hostname from BurpIssue.host (strip https:// prefix)
        2. Find matching Subdomain by name (case-insensitive)
        3. Optionally find matching EndPoint by http_url containing the path
        4. Create or update startScan.Vulnerability with type="Burp Suite"
        5. Set BurpIssue.linked_vulnerability_id and is_correlated=True

    Unmatched issues (no known Subdomain) are still marked is_correlated=True
    but keep linked_vulnerability_id=None — they appear in the Unmatched filter.

    Args:
        params (dict): {
            "sync_log_id": int,      # BurpSyncLog.id to update
            "scan_history_id": int,  # Optional: restrict to issues from this scan
        }

    Returns:
        dict: {"correlated": int, "unmatched": int, "sync_log_id": int}
    """
    from .models import BurpIssue, BurpSyncLog

    # Import r3ngine core models
    from startScan.models import Subdomain, EndPoint, Vulnerability

    sync_log_id = params.get("sync_log_id")
    scan_history_id = params.get("scan_history_id")

    logger.info(
        f"run_burp_correlate_activity: starting (sync_log_id={sync_log_id}, "
        f"scan_history_id={scan_history_id})"
    )

    # Load pending issues (not yet correlated)
    pending_qs = BurpIssue.objects.filter(is_correlated=False)
    if scan_history_id:
        pending_qs = pending_qs.filter(scan_history_id=scan_history_id)

    correlated_count = 0
    unmatched_count = 0

    for issue in pending_qs:
        try:
            # Strip protocol prefix to get bare hostname for matching
            host_raw = issue.host.strip()
            for prefix in ("https://", "http://"):
                if host_raw.startswith(prefix):
                    host_raw = host_raw[len(prefix):]
            # Strip trailing slash and port for bare hostname comparison
            bare_host = host_raw.rstrip("/").split(":")[0]

            # Find matching Subdomain
            subdomain = None
            subdomain_qs = Subdomain.objects.filter(name__iexact=bare_host)
            if scan_history_id:
                # Prefer subdomain from the same scan if possible
                scan_match = subdomain_qs.filter(scan_history_id=scan_history_id).first()
                subdomain = scan_match or subdomain_qs.first()
            else:
                subdomain = subdomain_qs.first()

            if not subdomain:
                # No matching subdomain — mark correlated but unlinked
                issue.is_correlated = True
                issue.save(update_fields=["is_correlated"])
                unmatched_count += 1
                logger.debug(
                    f"run_burp_correlate_activity: no subdomain match for "
                    f"host='{bare_host}' (issue {issue.id})"
                )
                continue

            # Find matching EndPoint (optional — best effort)
            endpoint = None
            if issue.path:
                ep_qs = EndPoint.objects.filter(
                    subdomain=subdomain,
                    http_url__icontains=issue.path.split("?")[0],  # ignore query params
                )
                endpoint = ep_qs.first()

            # Build http_url for the Vulnerability record
            http_url = endpoint.http_url if endpoint else issue.full_url

            # Create or update the Vulnerability record
            vuln, created = Vulnerability.objects.get_or_create(
                type="Burp Suite",
                name=issue.name,
                subdomain=subdomain,
                defaults={
                    "source": "Burp Suite",
                    "severity": issue.severity,
                    "description": issue.issue_detail or issue.issue_background or "",
                    "remediation": issue.remediation_detail or issue.remediation_background or "",
                    "http_url": http_url,
                    "endpoint": endpoint,
                    "target_domain": subdomain.target_domain,
                    "scan_history": subdomain.scan_history,
                    "discovered_date": timezone.now(),
                    "open_status": True,
                },
            )

            # Link the BurpIssue to the Vulnerability
            issue.linked_vulnerability_id = vuln.id
            issue.linked_subdomain_id = subdomain.id
            issue.linked_endpoint_id = endpoint.id if endpoint else None
            issue.is_correlated = True
            issue.save(update_fields=[
                "linked_vulnerability_id",
                "linked_subdomain_id",
                "linked_endpoint_id",
                "is_correlated",
            ])
            correlated_count += 1

            logger.debug(
                f"run_burp_correlate_activity: issue {issue.id} → "
                f"Vulnerability {vuln.id} (subdomain={subdomain.name}, "
                f"created={created})"
            )

        except Exception as e:
            logger.error(
                f"run_burp_correlate_activity: error on issue {issue.id}: {e}"
            )
            # Don't abort — continue processing remaining issues
            continue

    # Update sync log with correlation results
    if sync_log_id:
        try:
            sync_log = BurpSyncLog.objects.get(id=sync_log_id)
            sync_log.issues_correlated = correlated_count
            sync_log.issues_unmatched = unmatched_count
            # Only mark fully completed if this is the last phase
            sync_log.status = "completed"
            sync_log.completed_at = timezone.now()
            sync_log.save(update_fields=[
                "issues_correlated", "issues_unmatched", "status", "completed_at"
            ])
        except BurpSyncLog.DoesNotExist:
            pass

    logger.info(
        f"run_burp_correlate_activity: done "
        f"(correlated={correlated_count}, unmatched={unmatched_count})"
    )
    return {
        "correlated": correlated_count,
        "unmatched": unmatched_count,
        "sync_log_id": sync_log_id,
    }


# ---------------------------------------------------------------------------
# Activity: Push r3ngine Targets to Burp Suite Scope
# ---------------------------------------------------------------------------

@activity.defn
def run_burp_push_activity(params: dict) -> dict:
    """
    Push r3ngine discovered subdomains and endpoints to Burp Suite's target scope.

    Reads Subdomain and EndPoint records from r3ngine and sends their http_urls
    to the Burp Suite REST API via PUT /v0.1/target/scope.

    Args:
        params (dict): {
            "sync_log_id": int,      # BurpSyncLog.id to update
            "scan_history_id": int,  # Optional: restrict to subdomains from this scan
        }

    Returns:
        dict: {"pushed": int, "sync_log_id": int}
    """
    from .models import BurpSuiteConfig, BurpSyncLog
    from .burp_client import BurpSuiteClient
    from startScan.models import Subdomain

    sync_log_id = params.get("sync_log_id")
    scan_history_id = params.get("scan_history_id")

    logger.info(
        f"run_burp_push_activity: starting (sync_log_id={sync_log_id}, "
        f"scan_history_id={scan_history_id})"
    )

    config = BurpSuiteConfig.get()
    client = BurpSuiteClient(api_url=config.api_url, api_key=config.api_key)

    # Build list of URLs to push
    subdomain_qs = Subdomain.objects.exclude(http_url__isnull=True).exclude(http_url="")
    if scan_history_id:
        subdomain_qs = subdomain_qs.filter(scan_history_id=scan_history_id)

    urls = list(subdomain_qs.values_list("http_url", flat=True).distinct())
    pushed_count = 0

    if urls:
        # Push in batches of 100 to avoid oversized requests
        batch_size = 100
        for i in range(0, len(urls), batch_size):
            batch = urls[i: i + batch_size]
            success = client.add_to_scope(batch)
            if success:
                pushed_count += len(batch)
            else:
                logger.warning(
                    f"run_burp_push_activity: batch {i//batch_size + 1} failed to push"
                )

    # Finalise sync log
    if sync_log_id:
        try:
            sync_log = BurpSyncLog.objects.get(id=sync_log_id)
            sync_log.targets_pushed = pushed_count
            sync_log.status = "completed"
            sync_log.completed_at = timezone.now()
            sync_log.save(update_fields=["targets_pushed", "status", "completed_at"])
        except BurpSyncLog.DoesNotExist:
            pass

    logger.info(f"run_burp_push_activity: done (pushed={pushed_count})")
    return {"pushed": pushed_count, "sync_log_id": sync_log_id}


# ---------------------------------------------------------------------------
# Workflows
# ---------------------------------------------------------------------------

@workflow.defn
class BurpSuiteWorkflow:
    """
    Full bidirectional Burp Suite sync workflow.

    Chains Phase 1 (import) → Phase 2 (correlate) sequentially.
    Phase 2 runs regardless of Phase 1's partial success — even if only some
    issues were imported, the correlator will process what is available.

    Total workflow timeout: 1 hour.
    """

    @workflow.run
    async def run(self, payload: dict) -> dict:
        """
        Execute the two-phase Burp Suite import workflow.

        Args:
            payload (dict): {
                "sync_log_id": int,
                "scan_history_id": int | None,
                "task_id": str | None,
            }
        """
        # Phase 1: Import raw issues from Burp Suite
        import_result = await workflow.execute_activity(
            run_burp_import_activity,
            payload,
            start_to_close_timeout=timedelta(minutes=30),
        )

        # Phase 2: Correlate imported issues to r3ngine models
        correlate_result = await workflow.execute_activity(
            run_burp_correlate_activity,
            payload,
            start_to_close_timeout=timedelta(minutes=15),
        )

        return {
            "import": import_result,
            "correlate": correlate_result,
        }


@workflow.defn
class BurpPushWorkflow:
    """
    Standalone push-to-Burp-scope workflow.

    Sends r3ngine discovered subdomains to Burp Suite's target scope.
    Can be triggered independently via POST /sync/push/.
    """

    @workflow.run
    async def run(self, payload: dict) -> dict:
        """
        Execute the Burp Suite scope push workflow.

        Args:
            payload (dict): {
                "sync_log_id": int,
                "scan_history_id": int | None,
            }
        """
        result = await workflow.execute_activity(
            run_burp_push_activity,
            payload,
            start_to_close_timeout=timedelta(minutes=15),
        )
        return result
