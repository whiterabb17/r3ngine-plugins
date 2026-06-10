from rest_framework import serializers
try:
    from plugins_data.metasploit_integration.backend.models import MetasploitWorkspace, MetasploitTask, MetasploitFinding
except ImportError:
    from .models import MetasploitWorkspace, MetasploitTask, MetasploitFinding

class MetasploitWorkspaceSerializer(serializers.ModelSerializer):
    class Meta:
        model = MetasploitWorkspace
        fields = '__all__'

class MetasploitFindingSerializer(serializers.ModelSerializer):
    class Meta:
        model = MetasploitFinding
        fields = '__all__'

class MetasploitTaskSerializer(serializers.ModelSerializer):
    findings = MetasploitFindingSerializer(many=True, read_only=True)
    
    class Meta:
        model = MetasploitTask
        fields = '__all__'
        read_only_fields = ('status', 'raw_output', 'started_at', 'completed_at', 'error_message')
