from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsAssessmentOwnerOrAdmin(BasePermission):
    """Allow access if the user is staff/superuser or owns the assessment."""

    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        if request.user.is_staff or request.user.is_superuser:
            return True
        return obj.created_by_id == request.user.id or obj.created_by is None
