from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('compliance_assessment_backend', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='controlresult',
            name='description',
            field=models.TextField(blank=True, default=''),
            preserve_default=False,
        ),
    ]
