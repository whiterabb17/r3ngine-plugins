# r3ngine-plugins/active_directory/backend/temporal_exports.py
import asyncio
import json
import logging
from datetime import timedelta
from typing import Optional

from temporalio import activity, workflow
from temporalio.common import RetryPolicy

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _send_ws_update(assessment_id: int, event_type: str, data: dict) -> None:
    """Write a progress event to the Redis stream for this assessment."""
    import redis
    from django.conf import settings
    r = redis.StrictRedis(
        host=settings.REDIS_HOST, port=settings.REDIS_PORT, db=0)
    stream_key = f"ad:assessment:{assessment_id}"
    payload = json.dumps({'type': event_type, **data})
    r.xadd(stream_key, {'data': payload}, maxlen=500)


def _set_assessment_status(assessment_id: int, status: str,
                            error: Optional[str] = None) -> None:
    from django.utils import timezone
    from .models import ADAssessment
    update = {'status': status}
    if status == 'RUNNING':
        update['started_at'] = timezone.now()
    elif status in ('COMPLETED', 'FAILED', 'CANCELLED'):
        update['completed_at'] = timezone.now()
    if error:
        update['error_message'] = error
    ADAssessment.objects.filter(pk=assessment_id).update(**update)


# ---------------------------------------------------------------------------
# Activities
# ---------------------------------------------------------------------------

@activity.defn
def initialize_assessment_activity(params: dict) -> dict:
    """Mark assessment as RUNNING and emit the first WebSocket event."""
    assessment_id = params['assessment_id']
    _set_assessment_status(assessment_id, 'RUNNING')
    _send_ws_update(assessment_id, 'assessment_started', {
        'assessment_id': assessment_id,
        'message': 'Assessment initialised',
        'phase': 'initialization',
    })
    return {'status': 'initialized'}


@activity.defn
def run_dns_discovery_activity(params: dict) -> dict:
    """
    DNS-based discovery of AD infrastructure indicators.

    Resolves SRV records (_ldap._tcp, _kerberos._tcp, _gc._tcp) against
    the target domain to enumerate domain controllers and service endpoints.
    Returns a list of discovered DC hostnames and their roles.
    """
    assessment_id = params['assessment_id']
    target_domain = params['target_domain']

    _send_ws_update(assessment_id, 'phase_started', {
        'phase': 'dns_discovery',
        'message': f'Starting DNS discovery for {target_domain}',
    })

    import socket
    discovered = []

    srv_records = [
        f'_ldap._tcp.{target_domain}',
        f'_kerberos._tcp.{target_domain}',
        f'_gc._tcp.{target_domain}',
        f'_ldap._tcp.dc._msdcs.{target_domain}',
    ]

    for record in srv_records:
        try:
            results = socket.getaddrinfo(record, None)
            for res in results:
                hostname = res[4][0]
                if hostname not in [d['hostname'] for d in discovered]:
                    discovered.append({
                        'hostname': hostname,
                        'record': record,
                        'role': _infer_role_from_srv(record),
                    })
        except (socket.gaierror, socket.herror):
            pass

    from .models import ADAssessment, ADDomain
    try:
        assessment = ADAssessment.objects.get(pk=assessment_id)
        for dc in discovered:
            ADDomain.objects.get_or_create(
                assessment=assessment,
                fqdn=dc['hostname'],
                defaults={
                    'name': dc['hostname'].split('.')[0],
                    'metadata': {'srv_record': dc['record'], 'role': dc['role']},
                }
            )
    except Exception as e:
        logger.error(f"[AD DNS] Failed to persist domains: {e}")

    _send_ws_update(assessment_id, 'phase_completed', {
        'phase': 'dns_discovery',
        'discovered_count': len(discovered),
        'message': f'DNS discovery complete: {len(discovered)} hosts found',
    })

    return {'discovered': discovered, 'count': len(discovered)}


def _infer_role_from_srv(record: str) -> str:
    if '_gc._tcp' in record:
        return 'Global Catalog'
    if '_kerberos._tcp' in record:
        return 'KDC'
    if '_ldap._tcp.dc._msdcs' in record:
        return 'Domain Controller'
    return 'LDAP'


@activity.defn
def run_cert_discovery_activity(params: dict) -> dict:
    """
    Certificate transparency log enumeration for AD infrastructure indicators.

    Queries crt.sh for certificates matching the target domain and its
    common AD service patterns (ADFS, Exchange, OWA, VPN).
    """
    assessment_id = params['assessment_id']
    target_domain = params['target_domain']

    _send_ws_update(assessment_id, 'phase_started', {
        'phase': 'cert_discovery',
        'message': f'Enumerating certificate transparency logs for {target_domain}',
    })

    import requests
    findings = []

    try:
        resp = requests.get(
            f'https://crt.sh/?q=%.{target_domain}&output=json',
            timeout=30
        )
        if resp.status_code == 200:
            entries = resp.json()
            ad_keywords = ['adfs', 'owa', 'exchange', 'mail', 'vpn', 'ldap',
                           'dc', 'dc01', 'dc02', 'domain']
            for entry in entries:
                name = entry.get('name_value', '')
                for keyword in ad_keywords:
                    if keyword in name.lower():
                        findings.append({
                            'name': name,
                            'issuer': entry.get('issuer_name', ''),
                            'not_after': entry.get('not_after', ''),
                            'matched_keyword': keyword,
                        })
                        break
    except Exception as e:
        logger.warning(f"[AD Cert] crt.sh query failed: {e}")

    _send_ws_update(assessment_id, 'phase_completed', {
        'phase': 'cert_discovery',
        'finding_count': len(findings),
        'message': f'Certificate discovery complete: {len(findings)} indicators',
    })

    return {'cert_findings': findings, 'count': len(findings)}


@activity.defn
def run_trust_analysis_activity(params: dict) -> dict:
    """
    Analyse trust relationships from discovered domain data.

    Processes trust records in the DB and computes risk scores.
    Full ingestion from BloodHound/LDAP data added in Phase 2.
    """
    assessment_id = params['assessment_id']

    _send_ws_update(assessment_id, 'phase_started', {
        'phase': 'trust_analysis',
        'message': 'Analysing domain trust relationships',
    })

    from .models import ADTrust
    trusts = ADTrust.objects.filter(assessment_id=assessment_id)
    risk_updates = []

    for trust in trusts:
        score = 0.0
        if trust.is_transitive:
            score += 30.0
        if trust.direction == 'BIDIRECTIONAL':
            score += 25.0
        if trust.trust_type == 'FOREST':
            score += 20.0
        if not trust.is_selective_auth:
            score += 15.0
        trust.risk_score = min(score, 100.0)
        trust.save(update_fields=['risk_score'])
        risk_updates.append({'trust_id': trust.id, 'risk_score': trust.risk_score})

    _send_ws_update(assessment_id, 'phase_completed', {
        'phase': 'trust_analysis',
        'trust_count': len(risk_updates),
        'message': f'Trust analysis complete: {len(risk_updates)} trusts scored',
    })

    return {'trust_risk_updates': risk_updates}


@activity.defn
def run_exposure_correlation_activity(params: dict) -> dict:
    """
    Correlate internet-facing services with identity infrastructure.

    Resolves hostnames from cert/DNS discovery against known AD service
    patterns and creates ADExposure records.
    """
    assessment_id = params['assessment_id']
    target_domain = params['target_domain']
    dns_result = params.get('dns_result', {})
    cert_result = params.get('cert_result', {})

    _send_ws_update(assessment_id, 'phase_started', {
        'phase': 'exposure_correlation',
        'message': 'Correlating external exposures with identity infrastructure',
    })

    from .models import ADAssessment, ADExposure

    exposure_patterns = {
        'adfs': 'ADFS',
        'owa': 'OWA',
        'exchange': 'EXCHANGE',
        'mail': 'EXCHANGE',
        'vpn': 'VPN',
        'ldap': 'LDAP',
        'rdp': 'RDP',
        'winrm': 'WINRM',
    }

    created_count = 0
    try:
        assessment = ADAssessment.objects.get(pk=assessment_id)
        cert_findings = cert_result.get('cert_findings', [])

        for finding in cert_findings:
            name = finding['name'].lower()
            for keyword, etype in exposure_patterns.items():
                if keyword in name:
                    exp, created = ADExposure.objects.get_or_create(
                        assessment=assessment,
                        hostname=finding['name'],
                        exposure_type=etype,
                        defaults={
                            'evidence': {
                                'source': 'cert_transparency',
                                'issuer': finding.get('issuer', ''),
                                'not_after': finding.get('not_after', ''),
                            },
                            'risk_score': 50.0,
                        }
                    )
                    if created:
                        created_count += 1
                    break
    except Exception as e:
        logger.error(f"[AD Exposure] Correlation failed: {e}")

    _send_ws_update(assessment_id, 'phase_completed', {
        'phase': 'exposure_correlation',
        'exposure_count': created_count,
        'message': f'Exposure correlation complete: {created_count} new exposures',
    })

    return {'exposures_created': created_count}


@activity.defn
def run_neo4j_sync_activity(params: dict) -> dict:
    """
    Sync assessment data to Neo4j for graph intelligence.

    Creates ADDomain nodes and AD_EXPOSES relationships.
    Full graph schema implemented in Phase 2.
    """
    assessment_id = params['assessment_id']

    _send_ws_update(assessment_id, 'phase_started', {
        'phase': 'neo4j_sync',
        'message': 'Syncing assessment data to graph database',
    })

    try:
        from reNgine.graph_utils import Neo4jManager
        from .models import ADDomain

        manager = Neo4jManager()
        domains = ADDomain.objects.filter(assessment_id=assessment_id)
        node_count = 0

        with manager.driver.session() as session:
            for domain in domains:
                result = session.run(
                    """
                    MERGE (d:ADDomain {fqdn: $fqdn, assessment_id: $aid})
                    SET d.name = $name, d.forest_root = $forest_root,
                        d.dc_count = $dc_count, d.user_count = $user_count
                    RETURN id(d) as node_id
                    """,
                    fqdn=domain.fqdn or domain.name,
                    aid=assessment_id,
                    name=domain.name,
                    forest_root=domain.forest_root,
                    dc_count=domain.dc_count,
                    user_count=domain.user_count,
                )
                record = result.single()
                if record:
                    domain.neo4j_node_id = str(record['node_id'])
                    domain.save(update_fields=['neo4j_node_id'])
                    node_count += 1

        manager.driver.close()
    except Exception as e:
        logger.warning(f"[AD Neo4j] Sync failed (non-fatal): {e}")
        node_count = 0

    _send_ws_update(assessment_id, 'phase_completed', {
        'phase': 'neo4j_sync',
        'node_count': node_count,
        'message': f'Graph sync complete: {node_count} nodes',
    })

    return {'nodes_synced': node_count}


@activity.defn
def finalize_assessment_activity(params: dict) -> dict:
    """Mark the assessment terminal state and emit the final WebSocket event."""
    assessment_id = params['assessment_id']
    status = params.get('status', 'COMPLETED')
    error = params.get('error')

    _set_assessment_status(assessment_id, status, error)
    _send_ws_update(assessment_id, 'assessment_finished', {
        'assessment_id': assessment_id,
        'status': status,
        'message': f'Assessment {status.lower()}',
    })

    return {'final_status': status}


# ---------------------------------------------------------------------------
# Workflow
# ---------------------------------------------------------------------------

_RETRY_STANDARD = RetryPolicy(
    maximum_attempts=2,
    initial_interval=timedelta(minutes=1),
    backoff_coefficient=2.0,
    maximum_interval=timedelta(minutes=10),
)


@workflow.defn(name="ADAssessmentWorkflow")
class ADAssessmentWorkflow:
    """
    Isolated AD assessment orchestration workflow.

    Not injected into MasterScanWorkflow. Started independently via
    POST /api/plugins/active_directory/assessments/{id}/start/

    Phase sequence:
      1. Initialize -> 2. DNS discovery -> 3. Cert discovery ->
      4. Trust analysis -> 5. Exposure correlation -> 6. Neo4j sync ->
      7. Finalize
    """

    @workflow.run
    async def run(self, payload: dict) -> dict:
        assessment_id = payload['assessment_id']
        target_domain = payload['target_domain']
        config = payload.get('config', {})

        try:
            await workflow.execute_activity(
                initialize_assessment_activity,
                {'assessment_id': assessment_id},
                start_to_close_timeout=timedelta(minutes=2),
                retry_policy=_RETRY_STANDARD,
            )

            dns_result = await workflow.execute_activity(
                run_dns_discovery_activity,
                {'assessment_id': assessment_id, 'target_domain': target_domain},
                start_to_close_timeout=timedelta(minutes=30),
                retry_policy=_RETRY_STANDARD,
            )

            cert_result = await workflow.execute_activity(
                run_cert_discovery_activity,
                {'assessment_id': assessment_id, 'target_domain': target_domain},
                start_to_close_timeout=timedelta(minutes=15),
                retry_policy=_RETRY_STANDARD,
            )

            await workflow.execute_activity(
                run_trust_analysis_activity,
                {'assessment_id': assessment_id},
                start_to_close_timeout=timedelta(hours=1),
                retry_policy=_RETRY_STANDARD,
            )

            await workflow.execute_activity(
                run_exposure_correlation_activity,
                {
                    'assessment_id': assessment_id,
                    'target_domain': target_domain,
                    'dns_result': dns_result,
                    'cert_result': cert_result,
                },
                start_to_close_timeout=timedelta(hours=1),
                retry_policy=_RETRY_STANDARD,
            )

            await workflow.execute_activity(
                run_neo4j_sync_activity,
                {'assessment_id': assessment_id},
                start_to_close_timeout=timedelta(minutes=30),
                retry_policy=_RETRY_STANDARD,
            )

            return await workflow.execute_activity(
                finalize_assessment_activity,
                {'assessment_id': assessment_id, 'status': 'COMPLETED'},
                start_to_close_timeout=timedelta(minutes=5),
                retry_policy=_RETRY_STANDARD,
            )

        except Exception as exc:
            await workflow.execute_activity(
                finalize_assessment_activity,
                {
                    'assessment_id': assessment_id,
                    'status': 'FAILED',
                    'error': str(exc),
                },
                start_to_close_timeout=timedelta(minutes=5),
                retry_policy=RetryPolicy(maximum_attempts=1),
            )
            raise
