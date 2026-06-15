from django.db import models
from django.utils import timezone


class ComplianceAssessment(models.Model):
    FRAMEWORK_CHOICES = [
        ('pci_dss_4', 'PCI-DSS 4.0'),
        ('hipaa', 'HIPAA Technical Safeguards'),
        ('nist_800_53', 'NIST SP 800-53 Rev 5'),
        ('cis_v8', 'CIS Controls v8'),
        ('iso_27001', 'ISO 27001:2022'),
        ('soc2', 'SOC 2 Type II'),
    ]
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('RUNNING', 'Running'),
        ('COMPLETE', 'Complete'),
        ('FAILED', 'Failed'),
    ]

    scan_history = models.ForeignKey(
        'startScan.ScanHistory',
        on_delete=models.CASCADE,
        related_name='compliance_assessments',
    )
    framework = models.CharField(max_length=32, choices=FRAMEWORK_CHOICES)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default='PENDING')
    pass_count = models.IntegerField(default=0)
    fail_count = models.IntegerField(default=0)
    partial_count = models.IntegerField(default=0)
    manual_count = models.IntegerField(default=0)
    compliance_score = models.FloatField(null=True, blank=True)
    html_report_path = models.CharField(max_length=500, blank=True)
    pdf_report_path = models.CharField(max_length=500, blank=True)
    attestation_path = models.CharField(max_length=500, blank=True)
    attestation_hash = models.CharField(max_length=64, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        app_label = 'compliance_assessment_backend'
        db_table = 'plugin_compliance_assessment_assessment'
        unique_together = [('scan_history', 'framework')]

    def __str__(self):
        return f'{self.get_framework_display()} — scan {self.scan_history_id} [{self.status}]'

    def update_counts(self):
        """Recalculate pass/fail/partial/manual counts and compliance_score from ControlResult rows."""
        from django.db.models import Count
        counts = self.controls.values('result').annotate(n=Count('id'))
        mapping = {row['result']: row['n'] for row in counts}
        self.pass_count = mapping.get('PASS', 0)
        self.fail_count = mapping.get('FAIL', 0)
        self.partial_count = mapping.get('PARTIAL', 0)
        self.manual_count = mapping.get('MANUAL', 0)
        scoreable = self.pass_count + self.fail_count + self.partial_count
        self.compliance_score = round(self.pass_count / scoreable * 100, 1) if scoreable else None


class ControlResult(models.Model):
    RESULT_CHOICES = [
        ('PASS', 'Pass'),
        ('FAIL', 'Fail'),
        ('PARTIAL', 'Partial'),
        ('MANUAL', 'Requires Manual Assessment'),
    ]
    CONFIDENCE_CHOICES = [
        ('HIGH', 'High'),
        ('MEDIUM', 'Medium'),
        ('LOW', 'Low'),
        ('MANUAL', 'Manual'),
    ]

    assessment = models.ForeignKey(
        ComplianceAssessment,
        on_delete=models.CASCADE,
        related_name='controls',
    )
    control_id = models.CharField(max_length=64)
    control_name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    section = models.CharField(max_length=128)
    result = models.CharField(max_length=16, choices=RESULT_CHOICES)
    confidence = models.CharField(max_length=16, choices=CONFIDENCE_CHOICES)
    static_remediation = models.TextField(blank=True)
    ai_remediation = models.TextField(blank=True)
    ai_enriched_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        app_label = 'compliance_assessment_backend'
        db_table = 'plugin_compliance_assessment_control_result'
        unique_together = [('assessment', 'control_id')]

    def __str__(self):
        return f'{self.control_id} [{self.result}]'


class ComplianceEvidence(models.Model):
    EVIDENCE_TYPE_CHOICES = [
        ('VULNERABILITY', 'Vulnerability'),
        ('ENDPOINT', 'Endpoint'),
        ('PORT', 'Port'),
        ('DNS', 'DNS'),
        ('TLS', 'TLS'),
        ('HEADER', 'HTTP Header'),
    ]

    control_result = models.ForeignKey(
        ControlResult,
        on_delete=models.CASCADE,
        related_name='evidence',
    )
    evidence_type = models.CharField(max_length=16, choices=EVIDENCE_TYPE_CHOICES)
    evidence_id = models.IntegerField(null=True, blank=True)
    description = models.TextField()
    detail = models.JSONField(default=dict, blank=True)

    class Meta:
        app_label = 'compliance_assessment_backend'
        db_table = 'plugin_compliance_assessment_evidence'
