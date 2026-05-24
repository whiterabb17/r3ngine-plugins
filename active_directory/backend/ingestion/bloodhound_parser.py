import json
import logging
import os
from typing import Dict, List

logger = logging.getLogger(__name__)


class BloodHoundParser:
    """
    Parses BloodHound v4/v5 JSON export files into normalised entity dicts.

    BloodHound wraps data in {"data": [...], "meta": {...}}. Each entry has
    a "Properties" dict and type-specific relationship arrays (Members, Sessions, etc.)
    """

    @staticmethod
    def _props(entry: dict) -> dict:
        return entry.get('Properties', {})

    @classmethod
    def parse_users(cls, raw_users: List[dict]) -> List[dict]:
        results = []
        for entry in raw_users:
            try:
                props = cls._props(entry)
                name = props.get('name', '')
                sam = name.split('@')[0] if '@' in name else name
                results.append({
                    'sam_account_name': sam,
                    'display_name': props.get('displayname', sam),
                    'email': props.get('email', ''),
                    'enabled': props.get('enabled', True),
                    'admin_count': 1 if props.get('admincount') else 0,
                    'password_never_expires': props.get('pwdneverexpires', False),
                    'last_logon': str(props.get('lastlogon', '')),
                    'sid': props.get('objectid', ''),
                    'domain': props.get('domain', ''),
                    'primary_group_sid': entry.get('PrimaryGroupSid', ''),
                })
            except Exception as exc:
                logger.warning(f"[BH] Failed to parse user: {exc}")
        return results

    @classmethod
    def parse_groups(cls, raw_groups: List[dict]) -> List[dict]:
        results = []
        for entry in raw_groups:
            try:
                props = cls._props(entry)
                name = props.get('name', '').split('@')[0]
                sid = props.get('objectid', '')
                sid_rid = sid.split('-')[-1] if sid else ''
                admin_rids = {'512', '519', '544', '518'}
                admin_names = {
                    'domain admins', 'enterprise admins', 'schema admins',
                    'administrators',
                }
                is_admin = (
                    sid_rid in admin_rids
                    or name.lower() in admin_names
                    or props.get('admincount', False)
                )
                members = [
                    {'sid': m.get('MemberId'), 'type': m.get('MemberType')}
                    for m in entry.get('Members', [])
                ]
                results.append({
                    'name': name,
                    'sam_account_name': name,
                    'sid': sid,
                    'domain': props.get('domain', ''),
                    'admin_group': is_admin,
                    'member_count': len(members),
                    'members': members,
                })
            except Exception as exc:
                logger.warning(f"[BH] Failed to parse group: {exc}")
        return results

    @classmethod
    def parse_computers(cls, raw_computers: List[dict]) -> List[dict]:
        results = []
        for entry in raw_computers:
            try:
                props = cls._props(entry)
                name = props.get('name', '').split('.')[0].upper()
                results.append({
                    'name': name,
                    'fqdn': props.get('name', ''),
                    'os': props.get('operatingsystem', ''),
                    'os_version': '',
                    'enabled': props.get('enabled', True),
                    'last_logon': str(props.get('lastlogontimestamp', '')),
                    'sid': props.get('objectid', ''),
                    'domain': props.get('domain', ''),
                })
            except Exception as exc:
                logger.warning(f"[BH] Failed to parse computer: {exc}")
        return results

    @classmethod
    def parse_domains(cls, raw_domains: List[dict]) -> List[dict]:
        results = []
        for entry in raw_domains:
            try:
                props = cls._props(entry)
                results.append({
                    'fqdn': props.get('name', ''),
                    'name': props.get('name', '').split('.')[0],
                    'sid': props.get('objectid', ''),
                    'forest_root': props.get('isforestroot', props.get('isroot', False)),
                    'functional_level': str(props.get('functionallevel', '')),
                    'trusts': entry.get('Trusts', []),
                })
            except Exception as exc:
                logger.warning(f"[BH] Failed to parse domain: {exc}")
        return results

    @classmethod
    def ingest_from_directory(
            cls, directory: str, assessment_id: int,
            db_write: bool = True) -> Dict:
        summary = {'users': 0, 'groups': 0, 'computers': 0, 'domains': 0}

        parser_map = {
            'users.json': ('users', cls.parse_users),
            'groups.json': ('groups', cls.parse_groups),
            'computers.json': ('computers', cls.parse_computers),
            'domains.json': ('domains', cls.parse_domains),
        }

        parsed = {}
        for filename, (key, parser_fn) in parser_map.items():
            filepath = os.path.join(directory, filename)
            if os.path.exists(filepath):
                try:
                    with open(filepath, 'r') as f:
                        raw = json.load(f)
                    entries = raw.get('data', raw) if isinstance(raw, dict) else raw
                    parsed[key] = parser_fn(entries)
                    summary[key] = len(parsed[key])
                except Exception as exc:
                    logger.error(f"[BH] Failed to parse {filename}: {exc}")
            else:
                parsed[key] = []

        if db_write and assessment_id:
            cls._write_to_graph(assessment_id, parsed)

        return summary

    @classmethod
    def _write_to_graph(cls, assessment_id: int, parsed: dict) -> None:
        try:
            from ..graph.manager import ADGraphManager
            with ADGraphManager() as mgr:
                for domain in parsed.get('domains', []):
                    mgr.upsert_domain({**domain, 'assessment_id': assessment_id})
                for user in parsed.get('users', []):
                    mgr.upsert_user({**user, 'assessment_id': assessment_id})
                for group in parsed.get('groups', []):
                    mgr.upsert_group({**group, 'assessment_id': assessment_id})
                    for member in group.get('members', []):
                        if member['sid'] and member['type']:
                            label_map = {
                                'User': 'ADUser',
                                'Computer': 'ADComputer',
                                'Group': 'ADGroup',
                            }
                            label = label_map.get(member['type'])
                            if label:
                                try:
                                    mgr.create_membership_relationship(
                                        member['sid'], label,
                                        group['sid'], assessment_id)
                                except Exception as exc:
                                    logger.warning(f"[BH] Membership edge skipped (sid={member['sid']}): {exc}")
                for computer in parsed.get('computers', []):
                    mgr.upsert_computer({**computer, 'assessment_id': assessment_id})
        except Exception as exc:
            logger.error(f"[BH] Graph write failed: {exc}")
