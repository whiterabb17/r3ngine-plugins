from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('active_directory_backend', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='adassessment',
            name='created_by',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='ad_assessments',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
