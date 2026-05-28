from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('active_directory_backend', '0004_alter_adevidencelog_id'),
    ]

    operations = [
        migrations.CreateModel(
            name='ADPluginConfig',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True,
                                       serialize=False, verbose_name='ID')),
                ('neo4j_bolt_url', models.CharField(blank=True, default='', max_length=500)),
                ('max_path_length', models.IntegerField(default=10)),
                ('bloodhound_ce_url', models.CharField(blank=True, default='', max_length=500)),
                ('default_phases', models.JSONField(default=list)),
            ],
            options={
                'db_table': 'plugin_ad_config',
            },
        ),
    ]
