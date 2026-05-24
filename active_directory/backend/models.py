# r3ngine-plugins/active_directory/backend/models.py
from django.db import models
from django.utils import timezone


class ADAssessment(models.Model):
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('RUNNING', 'Running'),
        ('PAUSED', 'Paused'),
        ('COMPLETED', 'Completed'),
        ('FAILED', 'Failed'),
        ('CANCELLED', 'Cancelled'),
    ]
    name = models.CharField(max_length=255)
    target_domain = models.CharField(max_length=500)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    workflow_id = models.CharField(max_length=500, blank=True, null=True,
                                   help_text="Temporal workflow execution ID")
    created_at = models.DateTimeField(default=timezone.now)
    started_at = models.DateTimeField(blank=True, null=True)
    completed_at = models.DateTimeField(blank=True, null=True)
    error_message = models.TextField(blank=True, null=True)
    config = models.JSONField(default=dict, help_text="Assessment configuration")
    progress = models.JSONField(default=dict, help_text="Current phase progress map")

    class Meta:
        db_table = 'plugin_ad_assessment'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} [{self.status}]"


class ADDomain(models.Model):
    assessment = models.ForeignKey(
        ADAssessment, on_delete=models.CASCADE, related_name='domains')
    name = models.CharField(max_length=500)
    fqdn = models.CharField(max_length=500, blank=True, null=True)
    sid = models.CharField(max_length=100, blank=True, null=True)
    forest_root = models.BooleanField(default=False)
    functional_level = models.CharField(max_length=100, blank=True, null=True)
    dc_count = models.IntegerField(default=0)
    user_count = models.IntegerField(default=0)
    group_count = models.IntegerField(default=0)
    computer_count = models.IntegerField(default=0)
    neo4j_node_id = models.CharField(max_length=255, blank=True, null=True)
    discovered_at = models.DateTimeField(default=timezone.now)
    metadata = models.JSONField(default=dict)

    class Meta:
        db_table = 'plugin_ad_domain'
        unique_together = ['assessment', 'fqdn']

    def __str__(self):
        return self.fqdn or self.name


class ADTrust(models.Model):
    DIRECTION_CHOICES = [
        ('INBOUND', 'Inbound'),
        ('OUTBOUND', 'Outbound'),
        ('BIDIRECTIONAL', 'Bidirectional'),
    ]
    TYPE_CHOICES = [
        ('PARENT_CHILD', 'Parent-Child'),
        ('CROSS_LINK', 'Cross-Link'),
        ('EXTERNAL', 'External'),
        ('FOREST', 'Forest'),
        ('REALM', 'Realm'),
    ]
    assessment = models.ForeignKey(
        ADAssessment, on_delete=models.CASCADE, related_name='trusts')
    source_domain = models.ForeignKey(
        ADDomain, on_delete=models.CASCADE, related_name='outbound_trusts')
    target_domain_name = models.CharField(max_length=500)
    direction = models.CharField(max_length=20, choices=DIRECTION_CHOICES)
    trust_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    is_transitive = models.BooleanField(default=False)
    is_selective_auth = models.BooleanField(default=False)
    risk_score = models.FloatField(default=0.0)
    metadata = models.JSONField(default=dict)

    class Meta:
        db_table = 'plugin_ad_trust'

    def __str__(self):
        return f"{self.source_domain} → {self.target_domain_name} ({self.direction})"


class ADExposure(models.Model):
    TYPE_CHOICES = [
        ('VPN', 'VPN Gateway'),
        ('OWA', 'Outlook Web Access'),
        ('ADFS', 'ADFS'),
        ('EXCHANGE', 'Exchange Server'),
        ('WINRM', 'WinRM'),
        ('SMB', 'SMB'),
        ('LDAP', 'LDAP'),
        ('KERBEROS', 'Kerberos'),
        ('RDP', 'Remote Desktop'),
        ('OTHER', 'Other'),
    ]
    assessment = models.ForeignKey(
        ADAssessment, on_delete=models.CASCADE, related_name='exposures')
    hostname = models.CharField(max_length=500)
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    port = models.IntegerField(blank=True, null=True)
    exposure_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    correlated_domain = models.ForeignKey(
        ADDomain, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='exposures')
    risk_score = models.FloatField(default=0.0)
    evidence = models.JSONField(default=dict)
    discovered_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'plugin_ad_exposure'
        ordering = ['-risk_score']

    def __str__(self):
        return f"{self.exposure_type}: {self.hostname}"


class ADFinding(models.Model):
    SEVERITY_CHOICES = [
        ('CRITICAL', 'Critical'),
        ('HIGH', 'High'),
        ('MEDIUM', 'Medium'),
        ('LOW', 'Low'),
        ('INFO', 'Info'),
    ]
    STATUS_CHOICES = [
        ('OPEN', 'Open'),
        ('ACKNOWLEDGED', 'Acknowledged'),
        ('RESOLVED', 'Resolved'),
    ]
    assessment = models.ForeignKey(
        ADAssessment, on_delete=models.CASCADE, related_name='findings')
    title = models.CharField(max_length=500)
    description = models.TextField()
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='OPEN')
    finding_type = models.CharField(max_length=100)
    affected_object = models.CharField(max_length=500, blank=True, null=True)
    evidence = models.JSONField(default=dict)
    remediation = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'plugin_ad_finding'
        ordering = ['severity', '-created_at']

    def __str__(self):
        return f"[{self.severity}] {self.title}"


class ADGraphSnapshot(models.Model):
    assessment = models.ForeignKey(
        ADAssessment, on_delete=models.CASCADE, related_name='graph_snapshots')
    snapshot_type = models.CharField(max_length=100,
                                     help_text="e.g. 'trust_map', 'exposure_paths'")
    graph_data = models.JSONField(default=dict,
                                  help_text="Cytoscape-compatible node/edge payload")
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'plugin_ad_graph_snapshot'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.snapshot_type} @ {self.created_at:%Y-%m-%d %H:%M}"
