# r3ngine-plugins/active_directory/backend/graph/manager.py
import logging
from typing import Any, Dict, List, Optional

from . import schema as s

logger = logging.getLogger(__name__)


class ADGraphManager:
    """
    AD-specific Neo4j graph operations.

    Wraps reNgine's Neo4jManager driver. All Cypher is isolated here.
    Callers never write Cypher directly.
    """

    def __init__(self):
        from reNgine.graph_utils import Neo4jManager
        self._core = Neo4jManager()
        self._driver = self._core.driver

    def close(self):
        try:
            self._driver.close()
        except Exception:
            pass

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
        return False

    # ------------------------------------------------------------------
    # Schema management
    # ------------------------------------------------------------------

    def ensure_schema(self) -> None:
        """Apply constraints and indexes. Safe to call repeatedly (IF NOT EXISTS)."""
        with self._driver.session() as session:
            for stmt in s.CONSTRAINT_STATEMENTS:
                try:
                    session.run(stmt)
                except Exception as exc:
                    logger.warning(f"[ADGraph] Schema statement skipped: {exc}")

    # ------------------------------------------------------------------
    # Node upserts
    # ------------------------------------------------------------------

    def upsert_domain(self, props: Dict[str, Any]) -> Optional[int]:
        """MERGE ADDomain on (fqdn, assessment_id). Returns Neo4j internal id."""
        with self._driver.session() as session:
            result = session.run(
                f"""
                MERGE (n:{s.ADDomainNode} {{fqdn: $fqdn, assessment_id: $assessment_id}})
                SET n += $props
                RETURN id(n) AS node_id
                """,
                fqdn=props['fqdn'],
                assessment_id=props['assessment_id'],
                props=props,
            )
            record = result.single()
            return record['node_id'] if record else None

    def upsert_user(self, props: Dict[str, Any]) -> Optional[int]:
        with self._driver.session() as session:
            result = session.run(
                f"""
                MERGE (n:{s.ADUserNode} {{sid: $sid, assessment_id: $assessment_id}})
                SET n += $props
                RETURN id(n) AS node_id
                """,
                sid=props.get('sid', props.get('sam_account_name', 'unknown')),
                assessment_id=props['assessment_id'],
                props=props,
            )
            record = result.single()
            return record['node_id'] if record else None

    def upsert_group(self, props: Dict[str, Any]) -> Optional[int]:
        with self._driver.session() as session:
            result = session.run(
                f"""
                MERGE (n:{s.ADGroupNode} {{sid: $sid, assessment_id: $assessment_id}})
                SET n += $props
                RETURN id(n) AS node_id
                """,
                sid=props.get('sid', props.get('name', 'unknown')),
                assessment_id=props['assessment_id'],
                props=props,
            )
            record = result.single()
            return record['node_id'] if record else None

    def upsert_computer(self, props: Dict[str, Any]) -> Optional[int]:
        with self._driver.session() as session:
            result = session.run(
                f"""
                MERGE (n:{s.ADComputerNode} {{sid: $sid, assessment_id: $assessment_id}})
                SET n += $props
                RETURN id(n) AS node_id
                """,
                sid=props.get('sid', props.get('name', 'unknown')),
                assessment_id=props['assessment_id'],
                props=props,
            )
            record = result.single()
            return record['node_id'] if record else None

    def upsert_exposure(self, props: Dict[str, Any]) -> Optional[int]:
        with self._driver.session() as session:
            result = session.run(
                f"""
                MERGE (n:{s.ADExposureNode} {{
                    hostname: $hostname, assessment_id: $assessment_id
                }})
                SET n += $props
                RETURN id(n) AS node_id
                """,
                hostname=props['hostname'],
                assessment_id=props['assessment_id'],
                props=props,
            )
            record = result.single()
            return record['node_id'] if record else None

    def upsert_finding(self, props: Dict[str, Any]) -> Optional[int]:
        with self._driver.session() as session:
            result = session.run(
                f"""
                MERGE (n:{s.ADFindingNode} {{
                    finding_id: $finding_id, assessment_id: $assessment_id
                }})
                SET n += $props
                RETURN id(n) AS node_id
                """,
                finding_id=props['finding_id'],
                assessment_id=props['assessment_id'],
                props=props,
            )
            record = result.single()
            return record['node_id'] if record else None

    # ------------------------------------------------------------------
    # Relationship creation
    # ------------------------------------------------------------------

    def create_trust_relationship(
            self, source_fqdn: str, target_fqdn: str,
            assessment_id: int, props: Optional[Dict] = None) -> None:
        """Create AD_TRUSTS between two ADDomain nodes."""
        with self._driver.session() as session:
            session.run(
                f"""
                MATCH (a:{s.ADDomainNode} {{fqdn: $src, assessment_id: $aid}})
                MATCH (b:{s.ADDomainNode} {{fqdn: $tgt, assessment_id: $aid}})
                MERGE (a)-[r:{s.AD_TRUSTS}]->(b)
                SET r += $props
                """,
                src=source_fqdn,
                tgt=target_fqdn,
                aid=assessment_id,
                props=props or {},
            )

    ALLOWED_MEMBER_LABELS = {s.ADUserNode, s.ADComputerNode, s.ADGroupNode}

    def create_membership_relationship(
            self, member_sid: str, member_label: str,
            group_sid: str, assessment_id: int) -> None:
        """Create AD_MEMBER_OF from a user/computer to a group."""
        if member_label not in self.ALLOWED_MEMBER_LABELS:
            raise ValueError(f"Invalid member_label: {member_label!r}")
        with self._driver.session() as session:
            session.run(
                f"""
                MATCH (m:{member_label} {{sid: $msid, assessment_id: $aid}})
                MATCH (g:{s.ADGroupNode} {{sid: $gsid, assessment_id: $aid}})
                MERGE (m)-[:{s.AD_MEMBER_OF}]->(g)
                """,
                msid=member_sid,
                gsid=group_sid,
                aid=assessment_id,
            )

    def create_exposure_link(
            self, exposure_hostname: str, domain_fqdn: str,
            assessment_id: int) -> None:
        """Create AD_EXPOSES between ADDomain and ADExposure."""
        with self._driver.session() as session:
            session.run(
                f"""
                MATCH (d:{s.ADDomainNode} {{fqdn: $fqdn, assessment_id: $aid}})
                MATCH (e:{s.ADExposureNode} {{hostname: $hostname, assessment_id: $aid}})
                MERGE (e)-[:{s.AD_EXPOSES}]->(d)
                """,
                fqdn=domain_fqdn,
                hostname=exposure_hostname,
                aid=assessment_id,
            )

    # ------------------------------------------------------------------
    # Graph queries
    # ------------------------------------------------------------------

    def get_domain_graph(self, assessment_id: int, limit: int = 300) -> Dict:
        """Return ADDomain nodes and AD_TRUSTS edges for Cytoscape.

        Args:
            assessment_id: The assessment to query.
            limit: Maximum number of nodes to return.  Pass 0 (or negative) to
                   return all nodes.  When the result is truncated, edges whose
                   source or target falls outside the returned node set are
                   removed automatically.
        """
        with self._driver.session() as session:
            nodes_result = session.run(
                f"MATCH (n:{s.ADDomainNode} {{assessment_id: $aid}}) "
                "RETURN id(n) AS id, n.fqdn AS fqdn, n.name AS name, "
                "n.forest_root AS forest_root, n.dc_count AS dc_count",
                aid=assessment_id,
            )
            edges_result = session.run(
                f"""
                MATCH (a:{s.ADDomainNode} {{assessment_id: $aid}})
                      -[r:{s.AD_TRUSTS}]->
                      (b:{s.ADDomainNode} {{assessment_id: $aid}})
                RETURN id(a) AS source, id(b) AS target,
                       r.direction AS direction, r.trust_type AS trust_type,
                       r.risk_score AS risk_score
                """,
                aid=assessment_id,
            )
            nodes = [
                {'data': {'id': str(r['id']), 'label': r['fqdn'] or r['name'],
                          'forest_root': r['forest_root'],
                          'dc_count': r['dc_count'], 'type': 'domain'}}
                for r in nodes_result
            ]
            edges = [
                {'data': {'id': f"e-{r['source']}-{r['target']}",
                          'source': str(r['source']), 'target': str(r['target']),
                          'direction': r['direction'],
                          'trust_type': r['trust_type'],
                          'risk_score': r['risk_score']}}
                for r in edges_result
            ]
            total_nodes = len(nodes)
            if limit > 0 and len(nodes) > limit:
                nodes = nodes[:limit]
                visible_ids = {n['data']['id'] for n in nodes}
                edges = [
                    e for e in edges
                    if e['data']['source'] in visible_ids
                    and e['data']['target'] in visible_ids
                ]
            return {
                'nodes': nodes,
                'edges': edges,
                'truncated': total_nodes > limit if limit > 0 else False,
                'total_nodes': total_nodes,
            }

    def get_exposure_paths(self, assessment_id: int) -> Dict:
        """Return exposure nodes and their links to identity infrastructure."""
        with self._driver.session() as session:
            result = session.run(
                f"""
                MATCH (e:{s.ADExposureNode} {{assessment_id: $aid}})
                OPTIONAL MATCH (e)-[r:{s.AD_EXPOSES}]->(d:{s.ADDomainNode})
                RETURN id(e) AS eid, e.hostname AS hostname,
                       e.exposure_type AS etype, e.risk_score AS risk_score,
                       id(d) AS did, d.fqdn AS domain_fqdn
                """,
                aid=assessment_id,
            )
            nodes, edges = [], []
            domain_ids = set()
            for r in result:
                eid = str(r['eid'])
                if not any(n['data']['id'] == eid for n in nodes):
                    nodes.append({'data': {
                        'id': eid, 'label': r['hostname'],
                        'type': 'exposure', 'exposure_type': r['etype'],
                        'risk_score': r['risk_score'],
                    }})
                if r['did'] is not None:
                    did = str(r['did'])
                    if did not in domain_ids:
                        domain_ids.add(did)
                        nodes.append({'data': {
                            'id': did, 'label': r['domain_fqdn'], 'type': 'domain',
                        }})
                    edges.append({'data': {
                        'id': f"ep-{eid}-{did}",
                        'source': eid, 'target': did,
                    }})
            return {'nodes': nodes, 'edges': edges}

    def get_trust_graph(self, assessment_id: int) -> Dict:
        """Alias for get_domain_graph — returns trust topology."""
        return self.get_domain_graph(assessment_id)

    def find_shortest_path(
            self, source_fqdn: str, target_fqdn: str,
            assessment_id: int) -> List[Dict]:
        """Return the shortest path between two AD nodes via any relationship."""
        with self._driver.session() as session:
            result = session.run(
                f"""
                MATCH p = shortestPath(
                    (a:{s.ADDomainNode} {{fqdn: $src, assessment_id: $aid}})-[*]->
                    (b:{s.ADDomainNode} {{fqdn: $tgt, assessment_id: $aid}})
                )
                RETURN [n in nodes(p) | {{id: id(n), label: coalesce(n.fqdn, n.name, n.hostname)}}]
                    AS path_nodes
                LIMIT 1
                """,
                src=source_fqdn,
                tgt=target_fqdn,
                aid=assessment_id,
            )
            record = result.single()
            return record['path_nodes'] if record else []
