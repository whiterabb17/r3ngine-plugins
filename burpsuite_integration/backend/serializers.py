from rest_framework import serializers
from .models import BurpSuiteConfig, BurpIssue, BurpSyncLog, BURP_SEVERITY_MAP


class BurpSuiteConfigSerializer(serializers.ModelSerializer):
    """
    Serializer for the BurpSuiteConfig singleton model.

    Used by BurpSuiteConfigView (GET/PUT). The api_key field is write-only
    in GET responses to avoid leaking it in API responses — it is blanked
    out and only the presence indicator is returned.
    """

    # Return a masked indicator instead of the raw key on GET
    api_key = serializers.SerializerMethodField(read_only=False)
    api_key_input = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
        source="api_key",
        help_text="Supply to update the API key. Omit to leave unchanged.",
    )

    class Meta:
        model = BurpSuiteConfig
        fields = [
            "id",
            "api_url",
            "api_key",
            "api_key_input",
            "auto_import_enabled",
            "auto_push_enabled",
            "severity_filter",
            "last_synced",
        ]

    def get_api_key(self, obj):
        """Return masked key indicator — never expose the raw value."""
        if obj.api_key:
            return "***configured***"
        return ""


class BurpSuiteConfigUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer for PUT requests to update BurpSuiteConfig.

    api_key can be supplied to update or cleared by sending an empty string.
    """

    class Meta:
        model = BurpSuiteConfig
        fields = [
            "api_url",
            "api_key",
            "auto_import_enabled",
            "auto_push_enabled",
            "severity_filter",
        ]


class BurpIssueSerializer(serializers.ModelSerializer):
    """
    Serializer for BurpIssue records — used in the Issues tab DataGrid.

    Includes computed fields:
    - full_url: host + path combined
    - is_unmatched: True when correlated but no vulnerability was linked
    - severity_label: human-readable severity string
    """

    full_url = serializers.SerializerMethodField()
    is_unmatched = serializers.SerializerMethodField()
    severity_label = serializers.SerializerMethodField()

    class Meta:
        model = BurpIssue
        fields = [
            "id",
            "burp_issue_type_id",
            "burp_serial_number",
            "name",
            "severity",
            "severity_label",
            "confidence",
            "host",
            "path",
            "full_url",
            "issue_detail",
            "issue_background",
            "remediation_detail",
            "remediation_background",
            "scan_history_id",
            "linked_vulnerability_id",
            "linked_subdomain_id",
            "linked_endpoint_id",
            "is_correlated",
            "is_unmatched",
            "imported_at",
        ]
        # raw_data excluded by default to keep responses lean

    def get_full_url(self, obj):
        """Return the full URL string reconstructed from host + path."""
        return obj.full_url

    def get_is_unmatched(self, obj):
        """Return True if Phase 2 ran but found no matching subdomain."""
        return obj.is_unmatched

    def get_severity_label(self, obj):
        """Return human-readable severity label from integer."""
        labels = {0: "Info", 1: "Low", 2: "Medium", 3: "High", 4: "Critical"}
        return labels.get(obj.severity, "Unknown")


class BurpSyncLogSerializer(serializers.ModelSerializer):
    """
    Serializer for BurpSyncLog records — used in the Sync Logs tab timeline.

    Includes the computed duration_seconds field.
    """

    duration_seconds = serializers.SerializerMethodField()

    class Meta:
        model = BurpSyncLog
        fields = [
            "id",
            "sync_type",
            "status",
            "scan_history_id",
            "workflow_id",
            "issues_imported",
            "issues_correlated",
            "issues_unmatched",
            "issues_skipped",
            "targets_pushed",
            "error_message",
            "started_at",
            "completed_at",
            "duration_seconds",
        ]

    def get_duration_seconds(self, obj):
        """Return the operation duration in seconds (None if not completed)."""
        return obj.duration_seconds
