from django.db import models

class MetasploitWorkspace(models.Model):
    name = models.CharField(max_length=255, unique=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = 'metasploit_integration_backend'
        db_table = 'plugin_metasploit_integration_workspace'

    def __str__(self):
        return self.name

class MetasploitTask(models.Model):
    STATUS_CHOICES = (
        ('PENDING', 'Pending'),
        ('RUNNING', 'Running'),
        ('COMPLETED', 'Completed'),
        ('FAILED', 'Failed'),
    )
    workspace = models.ForeignKey(MetasploitWorkspace, on_delete=models.CASCADE, related_name='tasks', null=True, blank=True)
    target = models.CharField(max_length=255, help_text="RHOSTS or target URL")
    module_name = models.CharField(max_length=255, help_text="e.g. auxiliary/scanner/portscan/tcp")
    parameters = models.JSONField(default=dict, help_text="Module options")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    raw_output = models.TextField(blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True)

    class Meta:
        app_label = 'metasploit_integration_backend'
        db_table = 'plugin_metasploit_integration_task'

class MetasploitFinding(models.Model):
    task = models.ForeignKey(MetasploitTask, on_delete=models.CASCADE, related_name='findings')
    host = models.CharField(max_length=255)
    finding_type = models.CharField(max_length=100)
    details = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = 'metasploit_integration_backend'
        db_table = 'plugin_metasploit_integration_finding'
