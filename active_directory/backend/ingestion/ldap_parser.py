import json
import logging
import os
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

_ADMIN_GROUP_SIDS = {
    '512',   # Domain Admins
    '519',   # Enterprise Admins
    '544',   # Administrators
    '518',   # Schema Admins
}

_ADMIN_GROUP_NAMES = {
    'domain admins', 'enterprise admins', 'schema admins',
    'administrators', 'account operators', 'backup operators',
}


class LDAPParser:
    """
    Parses ldapdomaindump JSON output into normalised entity dicts.

    ldapdomaindump produces:
      domain_users.json     — list of user attribute dicts
      domain_groups.json    — list of group attribute dicts
      domain_computers.json — list of computer attribute dicts
      domain_trusts.json    — list of trust attribute dicts
    """

    @staticmethod
    def _attr(entry: dict, key: str, default=None):
        """Extract first value from ldapdomaindump attribute list."""
        vals = entry.get('attributes', {}).get(key, [])
        if isinstance(vals, list) and vals:
            return vals[0]
        return vals if vals else default

    @classmethod
    def parse_users(cls, raw_users: List[dict]) -> List[dict]:
        results = []
        for entry in raw_users:
            try:
                uac = cls._attr(entry, 'userAccountControl', 512)
                enabled = bool(int(uac) & 2 == 0) if uac else True
                pwd_never = bool(int(uac) & 65536) if uac else False
                results.append({
                    'sam_account_name': cls._attr(entry, 'sAMAccountName', ''),
                    'display_name': cls._attr(entry, 'displayName', ''),
                    'email': cls._attr(entry, 'mail', ''),
                    'enabled': enabled,
                    'admin_count': int(cls._attr(entry, 'adminCount', 0) or 0),
                    'password_never_expires': pwd_never,
                    'last_logon': str(cls._attr(entry, 'lastLogon', '')),
                    'sid': cls._attr(entry, 'objectSid', ''),
                })
            except Exception as exc:
                logger.warning(f"[LDAP] Failed to parse user entry: {exc}")
        return results

    @classmethod
    def parse_groups(cls, raw_groups: List[dict]) -> List[dict]:
        results = []
        for entry in raw_groups:
            try:
                name = cls._attr(entry, 'sAMAccountName', '')
                sid = cls._attr(entry, 'objectSid', '')
                sid_rid = sid.split('-')[-1] if sid else ''
                members_raw = entry.get('attributes', {}).get('member', [])
                members = members_raw if isinstance(members_raw, list) else [members_raw]
                is_admin = (
                    sid_rid in _ADMIN_GROUP_SIDS
                    or name.lower() in _ADMIN_GROUP_NAMES
                )
                results.append({
                    'name': name,
                    'sam_account_name': name,
                    'sid': sid,
                    'admin_group': is_admin,
                    'member_count': len(members),
                    'raw_members': members,
                })
            except Exception as exc:
                logger.warning(f"[LDAP] Failed to parse group entry: {exc}")
        return results

    @classmethod
    def parse_computers(cls, raw_computers: List[dict]) -> List[dict]:
        results = []
        for entry in raw_computers:
            try:
                uac = cls._attr(entry, 'userAccountControl', 0)
                enabled = bool(int(uac) & 2 == 0) if uac else True
                results.append({
                    'name': cls._attr(entry, 'sAMAccountName', '').rstrip('$'),
                    'fqdn': cls._attr(entry, 'dNSHostName', ''),
                    'os': cls._attr(entry, 'operatingSystem', ''),
                    'os_version': cls._attr(entry, 'operatingSystemVersion', ''),
                    'enabled': enabled,
                    'last_logon': str(cls._attr(entry, 'lastLogon', '')),
                    'sid': cls._attr(entry, 'objectSid', ''),
                })
            except Exception as exc:
                logger.warning(f"[LDAP] Failed to parse computer entry: {exc}")
        return results

    @classmethod
    def parse_trusts(cls, raw_trusts: List[dict]) -> List[dict]:
        _direction_map = {0: 'DISABLED', 1: 'INBOUND', 2: 'OUTBOUND', 3: 'BIDIRECTIONAL'}
        _type_map = {1: 'CROSS_LINK', 2: 'FOREST', 3: 'EXTERNAL',
                     4: 'REALM', 5: 'FOREST', 6: 'EXTERNAL'}
        results = []
        for entry in raw_trusts:
            try:
                direction_val = int(cls._attr(entry, 'trustDirection', 3))
                type_val = int(cls._attr(entry, 'trustType', 3))
                trust_attrs = int(cls._attr(entry, 'trustAttributes', 0) or 0)
                results.append({
                    'target_domain': cls._attr(entry, 'trustPartner', ''),
                    'direction': _direction_map.get(direction_val, 'BIDIRECTIONAL'),
                    'trust_type': _type_map.get(type_val, 'EXTERNAL'),
                    'is_transitive': bool(trust_attrs & 0x8),
                    'is_selective_auth': bool(trust_attrs & 0x80),
                })
            except Exception as exc:
                logger.warning(f"[LDAP] Failed to parse trust entry: {exc}")
        return results

    @classmethod
    def ingest_from_directory(
            cls, directory: str, assessment_id: int,
            db_write: bool = True) -> Dict:
        """
        Parse all ldapdomaindump JSON files in `directory` and optionally
        write entities to Django models + Neo4j.

        Returns a summary dict with counts of each entity type.
        """
        summary = {'users': 0, 'groups': 0, 'computers': 0, 'trusts': 0}
        file_map = {
            'domain_users.json': ('users', cls.parse_users),
            'domain_groups.json': ('groups', cls.parse_groups),
            'domain_computers.json': ('computers', cls.parse_computers),
            'domain_trusts.json': ('trusts', cls.parse_trusts),
        }

        parsed = {}
        for filename, (key, parser_fn) in file_map.items():
            filepath = os.path.join(directory, filename)
            if os.path.exists(filepath):
                try:
                    with open(filepath, 'r') as f:
                        raw = json.load(f)
                    parsed[key] = parser_fn(raw)
                    summary[key] = len(parsed[key])
                except Exception as exc:
                    logger.error(f"[LDAP] Failed to parse {filename}: {exc}")
            else:
                parsed[key] = []

        if db_write and assessment_id:
            cls._write_to_db(assessment_id, parsed)
            cls._write_to_graph(assessment_id, parsed)

        return summary

    @classmethod
    def _write_to_db(cls, assessment_id: int, parsed: dict) -> None:
        from ..models import ADFinding, ADAssessment

        try:
            assessment = ADAssessment.objects.get(pk=assessment_id)
        except ADAssessment.DoesNotExist:
            logger.error(f"[LDAP] Assessment {assessment_id} not found")
            return

        for user in parsed.get('users', []):
            if user.get('admin_count', 0) > 0 and not user.get('enabled', True):
                ADFinding.objects.get_or_create(
                    assessment=assessment,
                    title=f"Disabled admin account: {user['sam_account_name']}",
                    defaults={
                        'description': (
                            f"Admin account {user['sam_account_name']} is disabled "
                            f"but has adminCount=1. Verify it cannot be re-enabled."),
                        'severity': 'LOW',
                        'finding_type': 'identity_risk',
                        'affected_object': user['sam_account_name'],
                        'evidence': user,
                    }
                )

    @classmethod
    def _write_to_graph(cls, assessment_id: int, parsed: dict) -> None:
        try:
            from ..graph.manager import ADGraphManager
            with ADGraphManager() as mgr:
                for user in parsed.get('users', []):
                    mgr.upsert_user({**user, 'assessment_id': assessment_id})
                for group in parsed.get('groups', []):
                    mgr.upsert_group({**group, 'assessment_id': assessment_id})
                for computer in parsed.get('computers', []):
                    mgr.upsert_computer({**computer, 'assessment_id': assessment_id})
        except Exception as exc:
            logger.error(f"[LDAP] Graph write failed: {exc}")
