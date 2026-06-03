from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    BurpIssueViewSet,
    BurpSyncLogViewSet,
    BurpHealthView,
    BurpSuiteConfigView,
    BurpManualSyncView,
    BurpManualPushView,
    SubdomainSearchView,
    EndpointSearchView,
)

# Router handles standard CRUD + the custom @action match endpoint
# which will be auto-routed to: /issues/{id}/match/
router = DefaultRouter()
router.register(r"issues", BurpIssueViewSet, basename="burp-issues")
router.register(r"sync-logs", BurpSyncLogViewSet, basename="burp-sync-logs")

urlpatterns = router.urls + [
    # Singleton config — GET current config / PUT update config
    path("config/", BurpSuiteConfigView.as_view(), name="burp-config"),

    # Live connectivity test against the running Burp Suite instance
    path("health/", BurpHealthView.as_view(), name="burp-health"),

    # Manual sync triggers (start Temporal workflows)
    path("sync/import/", BurpManualSyncView.as_view(), name="burp-manual-import"),
    path("sync/push/", BurpManualPushView.as_view(), name="burp-manual-push"),

    # Manual matching: search existing r3ngine records for the match dialog
    path("subdomains/", SubdomainSearchView.as_view(), name="burp-subdomain-search"),
    path("endpoints/", EndpointSearchView.as_view(), name="burp-endpoint-search"),
    # Note: issues/{id}/match/ is registered automatically via the router
    #       from the @action decorator in BurpIssueViewSet
]
