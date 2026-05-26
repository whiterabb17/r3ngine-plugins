from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('active_directory_backend', '0002_adassessment_created_by'),
    ]

    operations = [
        migrations.CreateModel(
            name='ADEvidenceLog',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('action', models.CharField(max_length=100)),
                ('detail', models.JSONField(default=dict)),
                ('timestamp', models.DateTimeField(default=django.utils.timezone.now)),
                ('assessment', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='evidence_logs',
                    to='active_directory_backend.adassessment',
                )),
                ('actor', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='+',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'db_table': 'plugin_ad_evidence_log',
                'ordering': ['-timestamp'],
            },
        ),
    ]
