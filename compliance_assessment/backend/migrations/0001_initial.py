from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('startScan', '0044_epssfeeddata'),
    ]

    operations = [
        migrations.CreateModel(
            name='ComplianceAssessment',
            fields=[
                ('id', models.AutoField(primary_key=True)),
                ('framework', models.CharField(max_length=32, choices=[
                    ('pci_dss_4', 'PCI-DSS 4.0'), ('hipaa', 'HIPAA Technical Safeguards'),
                    ('nist_800_53', 'NIST SP 800-53 Rev 5'), ('cis_v8', 'CIS Controls v8'),
                    ('iso_27001', 'ISO 27001:2022'), ('soc2', 'SOC 2 Type II'),
                ])),
                ('status', models.CharField(max_length=16, default='PENDING', choices=[
                    ('PENDING', 'Pending'), ('RUNNING', 'Running'),
                    ('COMPLETE', 'Complete'), ('FAILED', 'Failed'),
                ])),
                ('pass_count', models.IntegerField(default=0)),
                ('fail_count', models.IntegerField(default=0)),
                ('partial_count', models.IntegerField(default=0)),
                ('manual_count', models.IntegerField(default=0)),
                ('compliance_score', models.FloatField(null=True, blank=True)),
                ('html_report_path', models.CharField(max_length=500, blank=True)),
                ('pdf_report_path', models.CharField(max_length=500, blank=True)),
                ('attestation_path', models.CharField(max_length=500, blank=True)),
                ('attestation_hash', models.CharField(max_length=64, blank=True)),
                ('created_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('completed_at', models.DateTimeField(null=True, blank=True)),
                ('scan_history', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='compliance_assessments',
                    to='startScan.scanhistory',
                )),
            ],
            options={'db_table': 'plugin_compliance_assessment_assessment'},
        ),
        migrations.AlterUniqueTogether(
            name='complianceassessment',
            unique_together={('scan_history', 'framework')},
        ),
        migrations.CreateModel(
            name='ControlResult',
            fields=[
                ('id', models.AutoField(primary_key=True)),
                ('control_id', models.CharField(max_length=64)),
                ('control_name', models.CharField(max_length=255)),
                ('section', models.CharField(max_length=128)),
                ('result', models.CharField(max_length=16, choices=[
                    ('PASS', 'Pass'), ('FAIL', 'Fail'),
                    ('PARTIAL', 'Partial'), ('MANUAL', 'Requires Manual Assessment'),
                ])),
                ('confidence', models.CharField(max_length=16, choices=[
                    ('HIGH', 'High'), ('MEDIUM', 'Medium'),
                    ('LOW', 'Low'), ('MANUAL', 'Manual'),
                ])),
                ('static_remediation', models.TextField(blank=True)),
                ('ai_remediation', models.TextField(blank=True)),
                ('ai_enriched_at', models.DateTimeField(null=True, blank=True)),
                ('assessment', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='controls',
                    to='compliance_assessment_backend.complianceassessment',
                )),
            ],
            options={'db_table': 'plugin_compliance_assessment_control_result'},
        ),
        migrations.AlterUniqueTogether(
            name='controlresult',
            unique_together={('assessment', 'control_id')},
        ),
        migrations.CreateModel(
            name='ComplianceEvidence',
            fields=[
                ('id', models.AutoField(primary_key=True)),
                ('evidence_type', models.CharField(max_length=16, choices=[
                    ('VULNERABILITY', 'Vulnerability'), ('ENDPOINT', 'Endpoint'),
                    ('PORT', 'Port'), ('DNS', 'DNS'),
                    ('TLS', 'TLS'), ('HEADER', 'HTTP Header'),
                ])),
                ('evidence_id', models.IntegerField(null=True, blank=True)),
                ('description', models.TextField()),
                ('detail', models.JSONField(default=dict, blank=True)),
                ('control_result', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='evidence',
                    to='compliance_assessment_backend.controlresult',
                )),
            ],
            options={'db_table': 'plugin_compliance_assessment_evidence'},
        ),
    ]
