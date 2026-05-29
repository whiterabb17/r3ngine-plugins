from unittest.mock import MagicMock, patch
from django.test import TestCase


class ADGraphManagerAttackPathTest(TestCase):
    """Unit tests for attack-path query methods using a mocked Neo4j driver."""

    def _make_manager(self, records):
        mock_result = MagicMock()
        mock_result.__iter__ = MagicMock(return_value=iter(records))
        mock_session = MagicMock()
        mock_session.__enter__ = MagicMock(return_value=mock_session)
        mock_session.__exit__ = MagicMock(return_value=False)
        mock_session.run = MagicMock(return_value=mock_result)

        mock_driver = MagicMock()
        mock_driver.session = MagicMock(return_value=mock_session)

        from plugins_data.active_directory.backend.graph.manager import ADGraphManager
        with patch.object(ADGraphManager, '__init__', lambda self: None):
            mgr = ADGraphManager.__new__(ADGraphManager)
            mgr._driver = mock_driver
        return mgr, mock_session

    def _make_record(self, data):
        rec = MagicMock()
        rec.__getitem__ = lambda self, k: data[k]
        return rec

    def test_find_kerberoastable_returns_list(self):
        rec = self._make_record(
            {'sid': 'S-1-2-3', 'sam_account_name': 'alice',
             'spn': ['MSSQLSvc/sql01:1433'], 'admin_count': 0})
        mgr, _ = self._make_manager([rec])
        results = mgr.find_kerberoastable(1)
        self.assertIsInstance(results, list)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['sam_account_name'], 'alice')

    def test_find_asreproastable_returns_list(self):
        rec = self._make_record(
            {'sid': 'S-1-2-3', 'sam_account_name': 'bob', 'admin_count': 0})
        mgr, _ = self._make_manager([rec])
        results = mgr.find_asreproastable(1)
        self.assertIsInstance(results, list)
        self.assertEqual(len(results), 1)

    def test_find_unconstrained_delegation_returns_list(self):
        rec = self._make_record(
            {'sid': 'S-1-2-3', 'name': 'DC01', 'fqdn': 'dc01.corp.local',
             'delegation_targets': ['ldap/dc02']})
        mgr, _ = self._make_manager([rec])
        results = mgr.find_unconstrained_delegation(1)
        self.assertIsInstance(results, list)
        self.assertEqual(results[0]['name'], 'DC01')

    def test_find_acl_abuse_returns_list(self):
        rec = self._make_record(
            {'source_sid': 'S-1', 'source_name': 'alice',
             'edge_type': 'AD_GENERIC_ALL',
             'target_sid': 'S-2', 'target_name': 'Domain Admins',
             'target_type': 'ADGroup'})
        mgr, _ = self._make_manager([rec])
        results = mgr.find_acl_abuse(1)
        self.assertIsInstance(results, list)
        self.assertEqual(results[0]['edge_type'], 'AD_GENERIC_ALL')

    def test_find_kerberoastable_returns_empty_on_exception(self):
        from plugins_data.active_directory.backend.graph.manager import ADGraphManager
        with patch.object(ADGraphManager, '__init__', lambda self: None):
            mgr = ADGraphManager.__new__(ADGraphManager)
            broken_driver = MagicMock()
            broken_driver.session.side_effect = Exception("Neo4j down")
            mgr._driver = broken_driver
        results = mgr.find_kerberoastable(1)
        self.assertEqual(results, [])

    def test_create_acl_edge_rejects_invalid_rel(self):
        mgr, _ = self._make_manager([])
        with self.assertRaises(ValueError):
            mgr.create_acl_edge('S-1', 'S-2', 'User', 'INVALID_REL', 1)
