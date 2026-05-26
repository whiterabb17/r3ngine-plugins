# r3ngine-plugins/active_directory/backend/serializers.py
from rest_framework import serializers
from .models import ADAssessment, ADDomain, ADTrust, ADExposure, ADFinding, ADGraphSnapshot


class ADDomainSerializer(serializers.ModelSerializer):
    class Meta:
        model = ADDomain
        fields = [
            'id', 'name', 'fqdn', 'sid', 'forest_root', 'functional_level',
            'dc_count', 'user_count', 'group_count', 'computer_count',
            'neo4j_node_id', 'discovered_at', 'metadata',
        ]
        read_only_fields = ['id', 'discovered_at', 'neo4j_node_id']


class ADTrustSerializer(serializers.ModelSerializer):
    source_domain_fqdn = serializers.CharField(
        source='source_domain.fqdn', read_only=True)

    class Meta:
        model = ADTrust
        fields = [
            'id', 'source_domain', 'source_domain_fqdn', 'target_domain_name',
            'direction', 'trust_type', 'is_transitive', 'is_selective_auth',
            'risk_score', 'metadata',
        ]
        read_only_fields = ['id', 'source_domain_fqdn']


class ADExposureSerializer(serializers.ModelSerializer):
    correlated_domain_fqdn = serializers.CharField(
        source='correlated_domain.fqdn', read_only=True,
        allow_null=True, required=False)

    class Meta:
        model = ADExposure
        fields = [
            'id', 'hostname', 'ip_address', 'port', 'exposure_type',
            'correlated_domain', 'correlated_domain_fqdn', 'risk_score',
            'evidence', 'discovered_at',
        ]
        read_only_fields = ['id', 'correlated_domain_fqdn', 'discovered_at']


class ADFindingSerializer(serializers.ModelSerializer):
    class Meta:
        model = ADFinding
        fields = [
            'id', 'title', 'description', 'severity', 'status',
            'finding_type', 'affected_object', 'evidence', 'remediation',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class ADGraphSnapshotSerializer(serializers.ModelSerializer):
    class Meta:
        model = ADGraphSnapshot
        fields = ['id', 'snapshot_type', 'graph_data', 'created_at']
        read_only_fields = ['id', 'created_at']


class ADAssessmentListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views — no nested data."""
    domain_count = serializers.SerializerMethodField()
    finding_count = serializers.SerializerMethodField()
    exposure_count = serializers.SerializerMethodField()

    class Meta:
        model = ADAssessment
        fields = [
            'id', 'name', 'target_domain', 'status', 'workflow_id',
            'created_at', 'started_at', 'completed_at',
            'domain_count', 'finding_count', 'exposure_count', 'created_by',
        ]

    def get_domain_count(self, obj):
        return obj.domains.count()

    def get_finding_count(self, obj):
        return obj.findings.count()

    def get_exposure_count(self, obj):
        return obj.exposures.count()


class ADAssessmentDetailSerializer(serializers.ModelSerializer):
    """Full serializer with nested summaries for the detail view."""
    domains = ADDomainSerializer(many=True, read_only=True)
    finding_summary = serializers.SerializerMethodField()
    exposure_summary = serializers.SerializerMethodField()

    class Meta:
        model = ADAssessment
        fields = [
            'id', 'name', 'target_domain', 'status', 'workflow_id',
            'created_at', 'started_at', 'completed_at', 'error_message',
            'config', 'progress', 'created_by', 'domains', 'finding_summary', 'exposure_summary',
        ]

    def get_finding_summary(self, obj):
        from django.db.models import Count
        return dict(
            obj.findings.values('severity').annotate(count=Count('id'))
            .values_list('severity', 'count')
        )

    def get_exposure_summary(self, obj):
        from django.db.models import Count
        return dict(
            obj.exposures.values('exposure_type').annotate(count=Count('id'))
            .values_list('exposure_type', 'count')
        )


class ADAssessmentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ADAssessment
        fields = ['name', 'target_domain', 'config']
