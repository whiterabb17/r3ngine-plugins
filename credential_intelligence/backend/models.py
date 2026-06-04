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
