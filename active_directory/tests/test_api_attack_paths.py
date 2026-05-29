from django.test import TestCase, Client
from django.contrib.auth import get_user_model
from unittest.mock import patch, MagicMock
from plugins_data.active_directory.backend.models import ADAssessment, ADPluginConfig
import json

User = get_user_model()


class AttackPathsAPITest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('analyst', password='pass')
        self.client = Client()
        self.client.force_login(self.user)
        self.assessment = ADAssessment.objects.create(
            name='Test', target_domain='corp.local', created_by=self.user)

    def test_attack_paths_invalid_category(self):
        url = f'/api/plugins/active_directory/assessments/{self.assessment.pk}/attack-paths/'
        resp = self.client.get(url, {'category': 'invalid'})
        self.assertEqual(resp.status_code, 400)

    def test_plugin_config_get(self):
        resp = self.client.get('/api/plugins/active_directory/config/')
        self.assertEqual(resp.status_code, 200)
        data = json.loads(resp.content)
        self.assertIn('max_path_length', data)

    def test_plugin_config_put(self):
        resp = self.client.put(
            '/api/plugins/active_directory/config/',
            json.dumps({'max_path_length': 7, 'neo4j_bolt_url': '', 'bloodhound_ce_url': '',
                        'default_phases': []}),
            content_type='application/json')
        self.assertEqual(resp.status_code, 200)
        data = json.loads(resp.content)
        self.assertEqual(data['max_path_length'], 7)
