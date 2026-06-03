from django.db import models
from django.utils import timezone


# ---------------------------------------------------------------------------
# Severity mapping: Burp Suite string → r3ngine integer severity
# Matches the NUCLEI_SEVERITY_MAP convention used throughout r3ngine.
# ---------------------------------------------------------------------------
BURP_SEVERITY_MAP = {
    "information": 0,   # r3ngine: INFO
    "info": 0,
    "low": 1,           # r3ngine: LOW
    "medium": 2,        # r3ngine: MEDIUM
    "high": 3,          # r3ngine: HIGH
    "critical": 4,      # r3ngine: CRITICAL
}

# Choices for BurpSyncLog.sync_type
SYNC_TYPE_CHOICES = [
    ("import", "Import from Burp"),
    ("correlate", "Correlate Issues"),
    ("push", "Push to Burp Scope"),
    ("full", "Full Bidirectional Sync"),
]

# Choices for BurpSyncLog.status
SYNC_STATUS_CHOICES = [
    ("pending", "Pending"),
    ("running", "Running"),
    ("completed", "Completed"),
    ("failed", "Failed"),
    ("partial", "Partial"),
]


class BurpSuiteConfig(models.Model):
    """
    Singleton configuration model for the Burp Suite integration plugin.

    Stores all connection settings and sync preferences. Retrieved via the
    class method `get()`, which mirrors the pattern used by NetlasAPIKey and
    OpenAiAPIKey in rengine-ng (get_or_create on pk=1).

    db_table: plugin_burpsuite_integration_config
    """

    api_url = models.CharField(
        max_length=500,
        default="http://host.docker.internal:1337",
        help_text=(
            "Burp Suite REST API URL. "
            "Use host.docker.internal from inside Docker containers, "
            "or the host machine's LAN IP."
        ),
    )
    api_key = models.CharField(
        max_length=500,
        blank=True,
        default="",
        help_text="Burp Suite REST API key (if configured in Burp User options).",
    )
    auto_import_enabled = models.BooleanField(
        default=False,
        help_text="Automatically import Burp findings after each vulnerability scan.",
    )
    auto_push_enabled = models.BooleanField(
        default=False,
        help_text="Automatically push new subdomains/endpoints to Burp scope.",
    )
    severity_filter = models.CharField(
        max_length=100,
        default="low,medium,high,critical",
        help_text=(
            "Comma-separated Burp severity levels to import. "
            "Valid values: information,low,medium,high,critical"
        ),
    )
    last_synced = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Timestamp of the most recent successful sync operation.",
    )

    class Meta:
        app_label = "burpsuite_integration_backend"
        db_table = "plugin_burpsuite_integration_config"
        verbose_name = "Burp Suite Config"

    @classmethod
    def get(cls):
        """
        Return the singleton BurpSuiteConfig instance, creating it if missing.

        Mirrors the pattern of NetlasAPIKey.objects.first() in rengine-ng;
        here we use get_or_create(pk=1) so there is always exactly one row.
        """
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return f"Burp Suite Config ({self.api_url})"


class BurpIssue(models.Model):
    """
    A single imported Burp Suite scan issue / finding.

    Phase 1 (`run_burp_import_activity`) creates rows here from Burp's REST API
    without touching any core r3ngine tables.

    Phase 2 (`run_burp_correlate_activity`) matches each BurpIssue to an
    existing `startScan.Subdomain` / `EndPoint` and creates a corresponding
    `startScan.Vulnerability` record. On success, `linked_vulnerability_id` is
    set and `is_correlated` is flipped to True.

    Unmatched issues (no known subdomain in r3ngine) keep `is_correlated=True`
    but `linked_vulnerability_id=None`. These appear in the "Unmatched Only"
    filter in the Issues tab and can be manually matched via the UI.

    db_table: plugin_burpsuite_integration_issue
    """

    # ------------------------------------------------------------------
    # Burp-side identifiers
    # ------------------------------------------------------------------
    burp_issue_type_id = models.BigIntegerField(
        help_text="Burp's numeric issue type ID (e.g. 2097930 for Reflected XSS).",
    )
    burp_serial_number = models.CharField(
        max_length=200,
        unique=True,
        help_text=(
            "Burp's unique serial number for this issue. "
            "Used for deduplication across repeated syncs."
        ),
    )

    # ------------------------------------------------------------------
    # Core issue data
    # ------------------------------------------------------------------
    name = models.CharField(max_length=500, help_text="Issue name as reported by Burp.")
    severity = models.IntegerField(
        help_text="r3ngine severity integer: 0=info, 1=low, 2=medium, 3=high, 4=critical.",
    )
    confidence = models.CharField(
        max_length=50,
        blank=True,
        default="",
        help_text="Burp confidence level: certain / firm / tentative.",
    )
    host = models.CharField(
        max_length=500,
        blank=True,
        default="",
        help_text="Target hostname (e.g. 'example.com' or 'https://example.com').",
    )
    path = models.CharField(
        max_length=2000,
        blank=True,
        default="",
        help_text="Vulnerable URL path (e.g. '/login?next=...').",
    )

    # ------------------------------------------------------------------
    # Burp detail fields (HTML allowed — Burp returns HTML descriptions)
    # ------------------------------------------------------------------
    issue_detail = models.TextField(
        blank=True,
        default="",
        help_text="Issue-specific detail from Burp (may contain HTML).",
    )
    issue_background = models.TextField(
        blank=True,
        default="",
        help_text="General background description for the issue type.",
    )
    remediation_detail = models.TextField(
        blank=True,
        default="",
        help_text="Specific remediation advice from Burp.",
    )
    remediation_background = models.TextField(
        blank=True,
        default="",
        help_text="General remediation background for this issue type.",
    )

    # ------------------------------------------------------------------
    # r3ngine cross-references (IntegerFields to avoid cross-app FK
    # migration complexity — the same pattern used in other plugins)
    # ------------------------------------------------------------------
    scan_history_id = models.IntegerField(
        null=True,
        blank=True,
        help_text="r3ngine ScanHistory.id if this import was tied to a scan.",
    )
    linked_vulnerability_id = models.IntegerField(
        null=True,
        blank=True,
        help_text=(
            "r3ngine startScan.Vulnerability.id created by Phase 2 correlation. "
            "Null if not yet correlated or if no matching subdomain was found."
        ),
    )
    linked_subdomain_id = models.IntegerField(
        null=True,
        blank=True,
        help_text="r3ngine Subdomain.id matched during correlation.",
    )
    linked_endpoint_id = models.IntegerField(
        null=True,
        blank=True,
        help_text="r3ngine EndPoint.id matched during correlation (optional).",
    )

    # ------------------------------------------------------------------
    # Correlation state
    # ------------------------------------------------------------------
    is_correlated = models.BooleanField(
        default=False,
        db_index=True,
        help_text=(
            "True once Phase 2 has attempted correlation for this issue. "
            "Unmatched issues will have is_correlated=True with linked_vulnerability_id=None."
        ),
    )

    imported_at = models.DateTimeField(
        default=timezone.now,
        help_text="Timestamp when this issue was first imported from Burp.",
    )
    raw_data = models.JSONField(
        default=dict,
        blank=True,
        help_text="Full raw JSON payload from the Burp REST API for this issue.",
    )

    class Meta:
        app_label = "burpsuite_integration_backend"
        db_table = "plugin_burpsuite_integration_issue"
        ordering = ["-imported_at", "-severity"]
        verbose_name = "Burp Issue"
        verbose_name_plural = "Burp Issues"

    def __str__(self):
        sev_labels = {0: "INFO", 1: "LOW", 2: "MEDIUM", 3: "HIGH", 4: "CRITICAL"}
        sev = sev_labels.get(self.severity, str(self.severity))
        return f"[{sev}] {self.name} @ {self.host}{self.path}"

    @property
    def full_url(self):
        """Reconstruct the full URL from host + path fields."""
        host = self.host.rstrip("/")
        path = self.path if self.path.startswith("/") else f"/{self.path}"
        return f"{host}{path}"

    @property
    def is_unmatched(self):
        """True if Phase 2 ran but could not link this issue to a Vulnerability."""
        return self.is_correlated and self.linked_vulnerability_id is None


class BurpSyncLog(models.Model):
    """
    Records each sync / import / push operation with Burp Suite.

    One row is created at the start of each Temporal workflow activity and
    updated on completion. Displayed in the 'Sync Logs' tab of the plugin UI.

    db_table: plugin_burpsuite_integration_sync_log
    """

    sync_type = models.CharField(
        max_length=20,
        choices=SYNC_TYPE_CHOICES,
        default="import",
        help_text="Type of operation: import / correlate / push / full.",
    )
    status = models.CharField(
        max_length=20,
        choices=SYNC_STATUS_CHOICES,
        default="pending",
        help_text="Current status of this sync operation.",
    )
    scan_history_id = models.IntegerField(
        null=True,
        blank=True,
        help_text="r3ngine ScanHistory.id if this sync was tied to a specific scan.",
    )
    workflow_id = models.CharField(
        max_length=200,
        blank=True,
        default="",
        help_text="Temporal workflow execution ID for traceability.",
    )

    # Result counts
    issues_imported = models.IntegerField(
        default=0,
        help_text="Number of BurpIssue records created or updated during this sync.",
    )
    issues_correlated = models.IntegerField(
        default=0,
        help_text="Number of issues successfully linked to r3ngine Vulnerabilities.",
    )
    issues_unmatched = models.IntegerField(
        default=0,
        help_text="Number of issues that could not be matched to any r3ngine subdomain.",
    )
    issues_skipped = models.IntegerField(
        default=0,
        help_text="Number of duplicate issues skipped (already in DB).",
    )
    targets_pushed = models.IntegerField(
        default=0,
        help_text="Number of URLs pushed to Burp Suite scope.",
    )
    error_message = models.TextField(
        blank=True,
        default="",
        help_text="Error message if this sync operation failed.",
    )

    started_at = models.DateTimeField(
        default=timezone.now,
        help_text="When this operation started.",
    )
    completed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When this operation completed (success or failure).",
    )

    class Meta:
        app_label = "burpsuite_integration_backend"
        db_table = "plugin_burpsuite_integration_sync_log"
        ordering = ["-started_at"]
        verbose_name = "Burp Sync Log"
        verbose_name_plural = "Burp Sync Logs"

    def __str__(self):
        return f"BurpSync [{self.sync_type}] [{self.status}] @ {self.started_at:%Y-%m-%d %H:%M}"

    @property
    def duration_seconds(self):
        """Return duration in seconds if the sync has completed."""
        if self.completed_at and self.started_at:
            return (self.completed_at - self.started_at).total_seconds()
        return None
