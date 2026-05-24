# r3ngine-plugins/active_directory/backend/api_urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .api import ADAssessmentViewSet

router = DefaultRouter()
router.register(r'assessments', ADAssessmentViewSet, basename='ad-assessment')

urlpatterns = [
    path('', include(router.urls)),
]
