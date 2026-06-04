from rest_framework import serializers
from .models import CredentialTask, DiscoveredCredential

class DiscoveredCredentialSerializer(serializers.ModelSerializer):
    class Meta:
        model = DiscoveredCredential
        fields = '__all__'

class CredentialTaskSerializer(serializers.ModelSerializer):
    discovered_credentials = DiscoveredCredentialSerializer(many=True, read_only=True)
    
    class Meta:
        model = CredentialTask
        fields = '__all__'
