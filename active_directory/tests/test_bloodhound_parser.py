from django.test import TestCase
from plugins_data.active_directory.backend.ingestion.bloodhound_parser import BloodHoundParser


SAMPLE_USER = {
    'Properties': {
        'name': 'alice@CORP.LOCAL',
        'objectid': 'S-1-5-21-111-222-333-1234',
        'enabled': True,
        'admincount': False,
        'pwdneverexpires': False,
        'lastlogon': 1700000000,
        'domain': 'CORP.LOCAL',
        'serviceprincipalnames': ['MSSQLSvc/sql01.corp.local:1433'],
        'dontreqpreauth': False,
    },
    'PrimaryGroupSid': 'S-1-5-21-111-222-333-513',
    'Aces': [
        {'RightName': 'GenericAll', 'PrincipalSID': 'S-1-5-21-111-222-333-512',
         'PrincipalType': 'Group', 'IsInherited': False},
        {'RightName': 'Irrelevant', 'PrincipalSID': 'S-1-5-21-111-222-333-999',
         'PrincipalType': 'Group', 'IsInherited': False},
    ],
}

SAMPLE_COMPUTER = {
    'Properties': {
        'name': 'DC01.CORP.LOCAL',
        'objectid': 'S-1-5-21-111-222-333-1001',
        'enabled': True,
        'operatingsystem': 'Windows Server 2019',
        'lastlogontimestamp': 1700000000,
        'domain': 'CORP.LOCAL',
        'unconstraineddelegation': True,
        'allowedtodelegate': ['ldap/dc02.corp.local'],
    },
}


class BloodHoundParserKerberosTest(TestCase):
    def test_parse_users_extracts_spn(self):
        users = BloodHoundParser.parse_users([SAMPLE_USER])
        self.assertEqual(len(users), 1)
        self.assertEqual(users[0]['spn'], ['MSSQLSvc/sql01.corp.local:1433'])

    def test_parse_users_kerberoastable_flag(self):
        users = BloodHoundParser.parse_users([SAMPLE_USER])
        self.assertTrue(users[0]['kerberoastable'])

    def test_parse_users_dont_req_preauth(self):
        users = BloodHoundParser.parse_users([SAMPLE_USER])
        self.assertFalse(users[0]['dont_req_preauth'])

    def test_parse_computers_unconstrained_delegation(self):
        computers = BloodHoundParser.parse_computers([SAMPLE_COMPUTER])
        self.assertEqual(len(computers), 1)
        self.assertTrue(computers[0]['unconstrained_delegation'])

    def test_parse_computers_constrained_delegation_targets(self):
        computers = BloodHoundParser.parse_computers([SAMPLE_COMPUTER])
        self.assertEqual(computers[0]['constrained_delegation_targets'], ['ldap/dc02.corp.local'])


class BloodHoundParserAcesTest(TestCase):
    def test_parse_aces_returns_mapped_rights(self):
        aces = BloodHoundParser.parse_aces(SAMPLE_USER, 'S-1-5-21-111-222-333-1234')
        self.assertEqual(len(aces), 1)
        self.assertEqual(aces[0]['right'], 'GenericAll')
        self.assertEqual(aces[0]['source_sid'], 'S-1-5-21-111-222-333-1234')
        self.assertEqual(aces[0]['target_sid'], 'S-1-5-21-111-222-333-512')
        self.assertEqual(aces[0]['target_type'], 'Group')
        self.assertFalse(aces[0]['is_inherited'])

    def test_parse_aces_empty_on_no_aces(self):
        aces = BloodHoundParser.parse_aces({}, 'S-1-1-1')
        self.assertEqual(aces, [])
