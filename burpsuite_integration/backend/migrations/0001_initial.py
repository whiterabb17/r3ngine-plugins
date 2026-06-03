from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):
    """
    Initial migration for the burpsuite_integration plugin.

    Creates:
        plugin_burpsuite_integration_config    — BurpSuiteConfig singleton
        plugin_burpsuite_integration_issue     — BurpIssue imported findings
        plugin_burpsuite_integration_sync_log  — BurpSyncLog operation history
    """

    initial = True

    dependencies = []

    operations = [
        # ---------------------------------------------------------------
        # BurpSuiteConfig
        # ---------------------------------------------------------------
        migrations.CreateModel(
            name="BurpSuiteConfig",
            fields=[
                (
                    "id",
                    models.AutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "api_url",
                    models.CharField(
                        default="http://host.docker.internal:1337",
                        help_text="Burp Suite REST API URL.",
                        max_length=500,
                    ),
                ),
                (
                    "api_key",
                    models.CharField(
                        blank=True,
                        default="",
                        help_text="Burp Suite REST API key (if configured).",
                        max_length=500,
                    ),
                ),
                (
                    "auto_import_enabled",
                    models.BooleanField(
                        default=False,
                        help_text="Automatically import Burp findings after each scan.",
                    ),
                ),
                (
                    "auto_push_enabled",
                    models.BooleanField(
                        default=False,
                        help_text="Automatically push new subdomains to Burp scope.",
                    ),
                ),
                (
                    "severity_filter",
                    models.CharField(
                        default="low,medium,high,critical",
                        help_text="Comma-separated severity levels to import.",
                        max_length=100,
                    ),
                ),
                (
                    "last_synced",
                    models.DateTimeField(
                        blank=True,
                        help_text="Timestamp of the most recent successful sync.",
                        null=True,
                    ),
                ),
            ],
            options={
                "verbose_name": "Burp Suite Config",
                "db_table": "plugin_burpsuite_integration_config",
            },
        ),
        # ---------------------------------------------------------------
        # BurpIssue
        # ---------------------------------------------------------------
        migrations.CreateModel(
            name="BurpIssue",
            fields=[
                (
                    "id",
                    models.AutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "burp_issue_type_id",
                    models.BigIntegerField(
                        help_text="Burp numeric issue type ID.",
                    ),
                ),
                (
                    "burp_serial_number",
                    models.CharField(
                        help_text="Burp unique serial number for deduplication.",
                        max_length=200,
                        unique=True,
                    ),
                ),
                (
                    "name",
                    models.CharField(
                        help_text="Issue name as reported by Burp.",
                        max_length=500,
                    ),
                ),
                (
                    "severity",
                    models.IntegerField(
                        help_text="r3ngine severity: 0=info,1=low,2=medium,3=high,4=critical.",
                    ),
                ),
                (
                    "confidence",
                    models.CharField(
                        blank=True,
                        default="",
                        help_text="Burp confidence level: certain/firm/tentative.",
                        max_length=50,
                    ),
                ),
                (
                    "host",
                    models.CharField(
                        blank=True,
                        default="",
                        help_text="Target hostname.",
                        max_length=500,
                    ),
                ),
                (
                    "path",
                    models.CharField(
                        blank=True,
                        default="",
                        help_text="Vulnerable URL path.",
                        max_length=2000,
                    ),
                ),
                (
                    "issue_detail",
                    models.TextField(blank=True, default=""),
                ),
                (
                    "issue_background",
                    models.TextField(blank=True, default=""),
                ),
                (
                    "remediation_detail",
                    models.TextField(blank=True, default=""),
                ),
                (
                    "remediation_background",
                    models.TextField(blank=True, default=""),
                ),
                (
                    "scan_history_id",
                    models.IntegerField(
                        blank=True,
                        help_text="r3ngine ScanHistory.id.",
                        null=True,
                    ),
                ),
                (
                    "linked_vulnerability_id",
                    models.IntegerField(
                        blank=True,
                        help_text="r3ngine Vulnerability.id if created.",
                        null=True,
                    ),
                ),
                (
                    "linked_subdomain_id",
                    models.IntegerField(
                        blank=True,
                        help_text="r3ngine Subdomain.id matched during correlation.",
                        null=True,
                    ),
                ),
                (
                    "linked_endpoint_id",
                    models.IntegerField(
                        blank=True,
                        help_text="r3ngine EndPoint.id matched during correlation.",
                        null=True,
                    ),
                ),
                (
                    "is_correlated",
                    models.BooleanField(
                        db_index=True,
                        default=False,
                        help_text="True once Phase 2 has attempted correlation.",
                    ),
                ),
                (
                    "imported_at",
                    models.DateTimeField(default=django.utils.timezone.now),
                ),
                (
                    "raw_data",
                    models.JSONField(
                        blank=True,
                        default=dict,
                        help_text="Full raw JSON from Burp REST API.",
                    ),
                ),
            ],
            options={
                "verbose_name": "Burp Issue",
                "verbose_name_plural": "Burp Issues",
                "db_table": "plugin_burpsuite_integration_issue",
                "ordering": ["-imported_at", "-severity"],
            },
        ),
        # ---------------------------------------------------------------
        # BurpSyncLog
        # ---------------------------------------------------------------
        migrations.CreateModel(
            name="BurpSyncLog",
            fields=[
                (
                    "id",
                    models.AutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "sync_type",
                    models.CharField(
                        choices=[
                            ("import", "Import from Burp"),
                            ("correlate", "Correlate Issues"),
                            ("push", "Push to Burp Scope"),
                            ("full", "Full Bidirectional Sync"),
                        ],
                        default="import",
                        max_length=20,
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("pending", "Pending"),
                            ("running", "Running"),
                            ("completed", "Completed"),
                            ("failed", "Failed"),
                            ("partial", "Partial"),
                        ],
                        default="pending",
                        max_length=20,
                    ),
                ),
                (
                    "scan_history_id",
                    models.IntegerField(blank=True, null=True),
                ),
                (
                    "workflow_id",
                    models.CharField(blank=True, default="", max_length=200),
                ),
                ("issues_imported", models.IntegerField(default=0)),
                ("issues_correlated", models.IntegerField(default=0)),
                ("issues_unmatched", models.IntegerField(default=0)),
                ("issues_skipped", models.IntegerField(default=0)),
                ("targets_pushed", models.IntegerField(default=0)),
                ("error_message", models.TextField(blank=True, default="")),
                (
                    "started_at",
                    models.DateTimeField(default=django.utils.timezone.now),
                ),
                (
                    "completed_at",
                    models.DateTimeField(blank=True, null=True),
                ),
            ],
            options={
                "verbose_name": "Burp Sync Log",
                "verbose_name_plural": "Burp Sync Logs",
                "db_table": "plugin_burpsuite_integration_sync_log",
                "ordering": ["-started_at"],
            },
        ),
    ]
