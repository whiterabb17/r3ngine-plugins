from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ComplianceAssessmentViewSet, ControlResultViewSet

router = DefaultRouter()
router.register('assessments', ComplianceAssessmentViewSet, basename='compliance-assessment')
router.register('controls', ControlResultViewSet, basename='compliance-control')

urlpatterns = [
    path('', include(router.urls)),
]
