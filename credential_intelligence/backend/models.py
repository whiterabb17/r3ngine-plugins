from django.db import models
from startScan.models import ScanHistory
from targetApp.models import Domain
from .fields import EncryptedCharField

class CredentialTask(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('running', 'Running'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    )

    scan_history = models.ForeignKey(ScanHistory, on_delete=models.CASCADE, null=True, blank=True)
    target_domain = models.ForeignKey(Domain, on_delete=models.CASCADE, null=True, blank=True)
    
    name = models.CharField(max_length=255)
    tool = models.CharField(max_length=50) # brutus, netexec, kerbrute, hashcat
    protocol = models.CharField(max_length=50, null=True, blank=True)
    target = models.CharField(max_length=255)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    # Configuration
    wordlist_user = models.CharField(max_length=255, null=True, blank=True)
    wordlist_pass = models.CharField(max_length=255, null=True, blank=True)
    threads = models.IntegerField(default=5)
    additional_flags = models.CharField(max_length=255, null=True, blank=True)
    
    # Results tracking
    credentials_found = models.IntegerField(default=0)
    raw_output_path = models.CharField(max_length=512, null=True, blank=True)
    error_message = models.TextField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.tool} on {self.target} ({self.status})"

    class Meta:
        app_label = 'credential_intelligence_backend'
        db_table = 'plugin_credential_intelligence_task'


class DiscoveredCredential(models.Model):
    task = models.ForeignKey(CredentialTask, on_delete=models.CASCADE, related_name='discovered_credentials')
    
    username = models.CharField(max_length=255)
    password = EncryptedCharField(max_length=512, null=True, blank=True)
    hash_value = EncryptedCharField(max_length=512, null=True, blank=True)
    
    service = models.CharField(max_length=50) # http, smb, ssh, rdp
    port = models.IntegerField(null=True, blank=True)
    
    is_valid = models.BooleanField(default=True)
    discovered_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.username}:***@{self.service}"

    class Meta:
        app_label = 'credential_intelligence_backend'
        db_table = 'plugin_credential_intelligence_discovered_credential'


class HashCrackingTask(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('running', 'Running'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    )
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=255)
    hash_type = models.IntegerField(default=1000) # -m parameter (e.g. 1000, 5600, 1800)
    attack_mode = models.IntegerField(default=0) # -a parameter (e.g. 0, 3, 6)
    hashes_txt = models.TextField(help_text="Newline-separated hashes to crack", default="")
    
    # Configuration
    wordlist = models.CharField(max_length=255, null=True, blank=True)
    custom_rules = models.CharField(max_length=255, null=True, blank=True) # -r rules
    mask = models.CharField(max_length=255, null=True, blank=True) # mask for -a 3
    workload_profile = models.IntegerField(default=2) # -w parameter (1, 2, 3, 4)
    additional_flags = models.CharField(max_length=255, null=True, blank=True)
    
    # Charsets
    custom_charset1 = models.CharField(max_length=255, null=True, blank=True)
    custom_charset2 = models.CharField(max_length=255, null=True, blank=True)
    custom_charset3 = models.CharField(max_length=255, null=True, blank=True)
    custom_charset4 = models.CharField(max_length=255, null=True, blank=True)
    
    # Increment Mode
    increment = models.BooleanField(default=False)
    increment_min = models.IntegerField(default=1)
    increment_max = models.IntegerField(default=15)
    
    # Performance / Mode Flags
    optimized_kernels = models.BooleanField(default=False)
    enable_username = models.BooleanField(default=False)
    force = models.BooleanField(default=True)
    
    # Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    gpu_status = models.CharField(max_length=100, default='unknown')
    container_id = models.CharField(max_length=128, null=True, blank=True)
    error_log = models.TextField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Hashcat Task: {self.name} ({self.status})"

    class Meta:
        app_label = 'credential_intelligence_backend'
        db_table = 'plugin_credential_intelligence_cracking_task'


class CrackedHash(models.Model):
    task = models.ForeignKey(HashCrackingTask, on_delete=models.CASCADE, related_name='cracked_hashes')
    raw_hash = models.CharField(max_length=1024)
    plaintext = EncryptedCharField(max_length=512)
    discovered_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.raw_hash[:10]}...:{self.plaintext}"

    class Meta:
        app_label = 'credential_intelligence_backend'
        db_table = 'plugin_credential_intelligence_cracked_hash'
