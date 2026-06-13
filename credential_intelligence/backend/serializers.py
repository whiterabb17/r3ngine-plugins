from rest_framework import serializers
from .models import CredentialTask, DiscoveredCredential, HashCrackingTask, CrackedHash

class DiscoveredCredentialSerializer(serializers.ModelSerializer):
    class Meta:
        model = DiscoveredCredential
        fields = '__all__'

class CredentialTaskSerializer(serializers.ModelSerializer):
    discovered_credentials = DiscoveredCredentialSerializer(many=True, read_only=True)
    
    class Meta:
        model = CredentialTask
        fields = '__all__'


class CrackedHashSerializer(serializers.ModelSerializer):
    class Meta:
        model = CrackedHash
        fields = '__all__'


class HashCrackingTaskSerializer(serializers.ModelSerializer):
    cracked_hashes = CrackedHashSerializer(many=True, read_only=True)

    class Meta:
        model = HashCrackingTask
        fields = '__all__'
