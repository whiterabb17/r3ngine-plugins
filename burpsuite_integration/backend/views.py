import logging
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import BurpSuiteConfig, BurpIssue, BurpSyncLog, BURP_SEVERITY_MAP
from .serializers import (
    BurpSuiteConfigSerializer,
    BurpSuiteConfigUpdateSerializer,
    BurpIssueSerializer,
    BurpSyncLogSerializer,
)
from .burp_client import BurpSuiteClient

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helper: lazy-import core r3ngine models to avoid circular import issues
# ---------------------------------------------------------------------------

def get_subdomain_model():
    """Lazily import startScan.Subdomain to avoid app-loading order issues."""
    from startScan.models import Subdomain
    return Subdomain


def get_endpoint_model():
    """Lazily import startScan.EndPoint to avoid app-loading order issues."""
    from startScan.models import EndPoint
    return EndPoint


def get_vulnerability_model():
    """Lazily import startScan.Vulnerability to avoid app-loading order issues."""
    from startScan.models import Vulnerability
    return Vulnerability


# ---------------------------------------------------------------------------
# Config View
# ---------------------------------------------------------------------------

class BurpSuiteConfigView(APIView):
    """
    GET /api/plugins/burpsuite_integration/config/
        Return the current singleton BurpSuiteConfig. The api_key is masked.

    PUT /api/plugins/burpsuite_integration/config/
        Update configuration fields. Supply api_key to change or clear it.
    """

    def get(self, request):
        """Return the current BurpSuiteConfig singleton."""
        config = BurpSuiteConfig.get()
        serializer = BurpSuiteConfigSerializer(config)
        return Response(serializer.data)

    def put(self, request):
        """
        Update the BurpSuiteConfig singleton.

        Accepts partial updates — only the supplied fields are changed.
        """
        config = BurpSuiteConfig.get()
        serializer = BurpSuiteConfigUpdateSerializer(
            config, data=request.data, partial=True
        )
        if serializer.is_valid():
            serializer.save()
            # Return the full masked representation after saving
            return Response(BurpSuiteConfigSerializer(BurpSuiteConfig.get()).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ---------------------------------------------------------------------------
# Issues ViewSet
# ---------------------------------------------------------------------------

class BurpIssueViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for BurpIssue records.

    list    GET  /api/plugins/burpsuite_integration/issues/
    retrieve GET /api/plugins/burpsuite_integration/issues/{id}/
    match   POST /api/plugins/burpsuite_integration/issues/{id}/match/

    Supports filtering via query params:
        ?unmatched=true  — only issues where is_correlated=True but linked_vulnerability_id is null
        ?severity=3      — filter by severity integer
        ?q=<text>        — search in name and host fields
    """

    serializer_class = BurpIssueSerializer

    def get_queryset(self):
        """
        Return BurpIssue queryset with optional query param filtering.

        Query params:
            unmatched (bool): If 'true', return only issues without a linked vulnerability.
            severity (int): Filter by severity integer (0-4).
            q (str): Case-insensitive text search across name and host.
        """
        qs = BurpIssue.objects.all()

        # Filter: unmatched only
        unmatched = self.request.query_params.get("unmatched", "").lower()
        if unmatched == "true":
            qs = qs.filter(is_correlated=True, linked_vulnerability_id__isnull=True)

        # Filter: by severity
        severity = self.request.query_params.get("severity")
        if severity is not None:
            try:
                qs = qs.filter(severity=int(severity))
            except (ValueError, TypeError):
                pass

        # Filter: text search
        q = self.request.query_params.get("q", "").strip()
        if q:
            from django.db.models import Q
            qs = qs.filter(Q(name__icontains=q) | Q(host__icontains=q))

        return qs

    @action(detail=False, methods=["get"], url_path="metrics")
    def metrics(self, request):
        """
        GET /api/plugins/burpsuite_integration/issues/metrics/

        Returns aggregated metrics for imported Burp issues:
            {
                "total": int,
                "critical": int,
                "high": int,
                "medium": int,
                "low": int,
                "info": int,
                "unmatched": int
            }
        """
        from django.db.models import Count
        qs = BurpIssue.objects.all()

        # Get count per severity
        severity_counts = qs.values("severity").annotate(count=Count("id"))

        counts = {
            "total": qs.count(),
            "critical": 0,
            "high": 0,
            "medium": 0,
            "low": 0,
            "info": 0,
            "unmatched": qs.filter(is_correlated=True, linked_vulnerability_id__isnull=True).count(),
        }

        # Mappings: 0=info, 1=low, 2=medium, 3=high, 4=critical
        sev_map = {
            0: "info",
            1: "low",
            2: "medium",
            3: "high",
            4: "critical"
        }

        for item in severity_counts:
            sev = item.get("severity")
            count = item.get("count", 0)
            label = sev_map.get(sev)
            if label:
                counts[label] = count

        return Response(counts)

    @action(detail=True, methods=["post"], url_path="match")
    def match(self, request, pk=None):
        """
        POST /api/plugins/burpsuite_integration/issues/{id}/match/

        Manually match an unmatched BurpIssue to an existing r3ngine Subdomain
        and optionally an EndPoint. Creates a Vulnerability record and links
        this BurpIssue to it.

        Request body:
            {
                "subdomain_id": int,      # Required: r3ngine Subdomain.id
                "endpoint_id": int|null   # Optional: r3ngine EndPoint.id
            }

        Response:
            201: {"vulnerability_id": int, "message": "Linked successfully"}
            400: {"error": "subdomain_id is required"}
            404: {"error": "Subdomain not found"}
            409: {"error": "Issue already linked to a vulnerability"}
        """
        issue = self.get_object()

        # Check if already linked
        if issue.linked_vulnerability_id is not None:
            return Response(
                {"error": "Issue is already linked to a Vulnerability."},
                status=status.HTTP_409_CONFLICT,
            )

        subdomain_id = request.data.get("subdomain_id")
        endpoint_id = request.data.get("endpoint_id")

        if not subdomain_id:
            return Response(
                {"error": "subdomain_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Load models lazily
        Subdomain = get_subdomain_model()
        EndPoint = get_endpoint_model()
        Vulnerability = get_vulnerability_model()

        # Validate subdomain
        try:
            subdomain = Subdomain.objects.get(id=subdomain_id)
        except Subdomain.DoesNotExist:
            return Response(
                {"error": f"Subdomain with id={subdomain_id} not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Validate endpoint (optional)
        endpoint = None
        if endpoint_id:
            try:
                endpoint = EndPoint.objects.get(id=endpoint_id)
            except EndPoint.DoesNotExist:
                return Response(
                    {"error": f"EndPoint with id={endpoint_id} not found."},
                    status=status.HTTP_404_NOT_FOUND,
                )

        # Create the Vulnerability record
        try:
            # Build http_url from issue host+path or endpoint
            http_url = endpoint.http_url if endpoint else issue.full_url

            vuln, created = Vulnerability.objects.get_or_create(
                # Dedup by type + name + subdomain to avoid creating duplicates
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
                    "scan_history": (
                        subdomain.scan_history
                        if hasattr(subdomain, "scan_history")
                        else None
                    ),
                    "discovered_date": timezone.now(),
                    "open_status": True,
                },
            )

            # Update the BurpIssue to reflect the link
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

            logger.info(
                f"BurpIssue {issue.id} manually matched → Vulnerability {vuln.id} "
                f"(subdomain={subdomain.name}, created={created})"
            )

            return Response(
                {
                    "vulnerability_id": vuln.id,
                    "message": "Linked successfully",
                    "created": created,
                },
                status=status.HTTP_201_CREATED,
            )

        except Exception as e:
            logger.error(f"BurpIssue.match failed for issue {issue.id}: {e}")
            return Response(
                {"error": f"Failed to create Vulnerability: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


# ---------------------------------------------------------------------------
# Sync Log ViewSet
# ---------------------------------------------------------------------------

class BurpSyncLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only ViewSet for BurpSyncLog records.

    list    GET  /api/plugins/burpsuite_integration/sync-logs/
    retrieve GET /api/plugins/burpsuite_integration/sync-logs/{id}/

    Returns logs ordered by most recent first (handled by model Meta.ordering).
    """

    queryset = BurpSyncLog.objects.all()
    serializer_class = BurpSyncLogSerializer


# ---------------------------------------------------------------------------
# Health Check View
# ---------------------------------------------------------------------------

class BurpHealthView(APIView):
    """
    GET /api/plugins/burpsuite_integration/health/

    Performs a live connectivity check against the configured Burp Suite
    REST API and returns the result. Used by the 'Test Connection' button
    in the Settings tab.

    Response:
        {"status": "ok"|"error", "message": str, "scan_count": int}
    """

    def get(self, request):
        """Check live connectivity to Burp Suite REST API."""
        config = BurpSuiteConfig.get()
        client = BurpSuiteClient(api_url=config.api_url, api_key=config.api_key)
        result = client.health_check()
        http_status = (
            status.HTTP_200_OK
            if result.get("status") == "ok"
            else status.HTTP_503_SERVICE_UNAVAILABLE
        )
        return Response(result, status=http_status)


# ---------------------------------------------------------------------------
# Manual Sync Trigger Views
# ---------------------------------------------------------------------------

class BurpManualSyncView(APIView):
    """
    POST /api/plugins/burpsuite_integration/sync/import/

    Trigger a manual Burp Suite import (Phase 1 + Phase 2) as a Temporal
    workflow. Creates a BurpSyncLog entry and starts the BurpSuiteWorkflow.

    Request body (all optional):
        {
            "scan_history_id": int  # Associate this import with a scan
        }

    Response:
        {"message": "Import workflow started", "sync_log_id": int, "workflow_id": str}
    """

    def post(self, request):
        """Start a full import+correlate Temporal workflow."""
        scan_history_id = request.data.get("scan_history_id")

        # Create a sync log entry to track this operation
        sync_log = BurpSyncLog.objects.create(
            sync_type="full",
            status="pending",
            scan_history_id=scan_history_id,
        )

        try:
            # Import and start the Temporal workflow
            from reNgine.temporal_client import get_temporal_client_sync
            import asyncio
            from .temporal_exports import BurpSuiteWorkflow

            async def _start():
                """Async helper to start the Burp Suite Temporal workflow."""
                client = await get_temporal_client_sync()
                handle = await client.start_workflow(
                    BurpSuiteWorkflow.run,
                    {"sync_log_id": sync_log.id, "scan_history_id": scan_history_id},
                    id=f"burp-import-{sync_log.id}",
                    task_queue="default",
                )
                return handle.id

            # Run the async coroutine in a new event loop
            workflow_id = asyncio.run(_start())
            sync_log.workflow_id = workflow_id
            sync_log.status = "running"
            sync_log.save(update_fields=["workflow_id", "status"])

            return Response(
                {
                    "message": "Import workflow started",
                    "sync_log_id": sync_log.id,
                    "workflow_id": workflow_id,
                },
                status=status.HTTP_202_ACCEPTED,
            )

        except Exception as e:
            logger.error(f"BurpManualSyncView: failed to start workflow: {e}")
            sync_log.status = "failed"
            sync_log.error_message = str(e)
            sync_log.completed_at = timezone.now()
            sync_log.save(update_fields=["status", "error_message", "completed_at"])
            return Response(
                {"error": f"Failed to start import workflow: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class BurpManualPushView(APIView):
    """
    POST /api/plugins/burpsuite_integration/sync/push/

    Push r3ngine discovered subdomains and endpoints to Burp Suite's target
    scope. Runs as a Temporal workflow.

    Request body (all optional):
        {
            "scan_history_id": int  # Push only subdomains from this scan
        }

    Response:
        {"message": "Push workflow started", "sync_log_id": int, "workflow_id": str}
    """

    def post(self, request):
        """Start a push-to-Burp-scope Temporal workflow."""
        scan_history_id = request.data.get("scan_history_id")

        sync_log = BurpSyncLog.objects.create(
            sync_type="push",
            status="pending",
            scan_history_id=scan_history_id,
        )

        try:
            from reNgine.temporal_client import get_temporal_client_sync
            import asyncio
            from .temporal_exports import BurpPushWorkflow

            async def _start():
                """Async helper to start the Burp Suite push Temporal workflow."""
                client = await get_temporal_client_sync()
                handle = await client.start_workflow(
                    BurpPushWorkflow.run,
                    {"sync_log_id": sync_log.id, "scan_history_id": scan_history_id},
                    id=f"burp-push-{sync_log.id}",
                    task_queue="default",
                )
                return handle.id

            workflow_id = asyncio.run(_start())
            sync_log.workflow_id = workflow_id
            sync_log.status = "running"
            sync_log.save(update_fields=["workflow_id", "status"])

            return Response(
                {
                    "message": "Push workflow started",
                    "sync_log_id": sync_log.id,
                    "workflow_id": workflow_id,
                },
                status=status.HTTP_202_ACCEPTED,
            )

        except Exception as e:
            logger.error(f"BurpManualPushView: failed to start workflow: {e}")
            sync_log.status = "failed"
            sync_log.error_message = str(e)
            sync_log.completed_at = timezone.now()
            sync_log.save(update_fields=["status", "error_message", "completed_at"])
            return Response(
                {"error": f"Failed to start push workflow: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


# ---------------------------------------------------------------------------
# Manual Matching Search Views
# ---------------------------------------------------------------------------

class SubdomainSearchView(APIView):
    """
    GET /api/plugins/burpsuite_integration/subdomains/?q=<host>&scan_id=<id>

    Search r3ngine Subdomain records to populate the subdomain picker in the
    ManualMatchDialog. Returns up to 50 results ordered by name.

    Query params:
        q (str): Partial hostname to search (case-insensitive).
        scan_id (int): Optional ScanHistory ID to filter by.

    Response:
        [{"id": int, "name": str, "http_url": str, "http_status": int}]
    """

    def get(self, request):
        """Return matching Subdomain records for the manual match dialog picker."""
        Subdomain = get_subdomain_model()

        q = request.query_params.get("q", "").strip()
        scan_id = request.query_params.get("scan_id")

        qs = Subdomain.objects.all()

        if scan_id:
            try:
                qs = qs.filter(scan_history_id=int(scan_id))
            except (ValueError, TypeError):
                pass

        if q:
            qs = qs.filter(name__icontains=q)

        qs = qs.order_by("name")[:50]

        data = [
            {
                "id": s.id,
                "name": s.name,
                "http_url": s.http_url or "",
                "http_status": s.http_status or 0,
            }
            for s in qs
        ]
        return Response(data)


class EndpointSearchView(APIView):
    """
    GET /api/plugins/burpsuite_integration/endpoints/?subdomain=<id>&q=<path>

    Search r3ngine EndPoint records for a given subdomain to populate the
    endpoint picker in the ManualMatchDialog. Returns up to 100 results.

    Query params:
        subdomain (int): Subdomain.id to filter endpoints for. Required.
        q (str): Optional partial path to search.

    Response:
        [{"id": int, "http_url": str, "http_status": int}]
    """

    def get(self, request):
        """Return matching EndPoint records for a specific subdomain."""
        EndPoint = get_endpoint_model()

        subdomain_id = request.query_params.get("subdomain")
        q = request.query_params.get("q", "").strip()

        if not subdomain_id:
            return Response(
                {"error": "subdomain query parameter is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            qs = EndPoint.objects.filter(subdomain_id=int(subdomain_id))
        except (ValueError, TypeError):
            return Response(
                {"error": "subdomain must be an integer."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if q:
            qs = qs.filter(http_url__icontains=q)

        qs = qs.order_by("http_url")[:100]

        data = [
            {
                "id": e.id,
                "http_url": e.http_url,
                "http_status": e.http_status or 0,
            }
            for e in qs
        ]
        return Response(data)
