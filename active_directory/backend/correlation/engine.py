import logging
import socket
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

_HOSTNAME_PATTERN_MAP = {
    'adfs': 'ADFS',
    'sts': 'ADFS',
    'federation': 'ADFS',
    'owa': 'OWA',
    'webmail': 'OWA',
    'exchange': 'EXCHANGE',
    'mail': 'EXCHANGE',
    'autodiscover': 'EXCHANGE',
    'vpn': 'VPN',
    'remote': 'VPN',
    'sslvpn': 'VPN',
    'rdweb': 'RDP',
    'rdgateway': 'RDP',
    'rds': 'RDP',
    'winrm': 'WINRM',
    'wsman': 'WINRM',
    'ldap': 'LDAP',
    'kerberos': 'KERBEROS',
    'krb': 'KERBEROS',
}

_BASE_SCORES = {
    'ADFS': 85.0,
    'OWA': 75.0,
    'EXCHANGE': 70.0,
    'VPN': 80.0,
    'WINRM': 65.0,
    'SMB': 60.0,
    'LDAP': 55.0,
    'KERBEROS': 70.0,
    'RDP': 60.0,
    'OTHER': 20.0,
}


class ExposureCorrelationEngine:
    """
    Classifies hostnames as identity-infrastructure service types and
    scores their risk based on exposure context.
    """

    @staticmethod
    def classify_hostname(hostname: str) -> str:
        """Return the exposure type for a given hostname."""
        lower = hostname.lower()
        for keyword, etype in _HOSTNAME_PATTERN_MAP.items():
            if keyword in lower:
                return etype
        return 'OTHER'

    @staticmethod
    def score_exposure(
            exposure_type: str,
            is_internet_facing: bool,
            has_domain_correlation: bool,
            port: Optional[int] = None) -> float:
        """
        Compute a risk score 0-100 for an exposed service.

        Base score per service type, +10 if internet-facing,
        +10 if correlated to an AD domain, +5 for default ports.
        """
        score = _BASE_SCORES.get(exposure_type, 20.0)
        if is_internet_facing:
            score += 10.0
        if has_domain_correlation:
            score += 10.0
        default_ports = {443, 80, 389, 636, 445, 88, 5985, 5986, 3389}
        if port and port in default_ports:
            score += 5.0
        return min(score, 100.0)

    @classmethod
    def correlate_hostname_to_domain(
            cls, hostname: str, domains: List[str]) -> Optional[str]:
        """
        Find the best matching AD domain for a hostname via suffix match.

        Returns the FQDN of the matched domain or None.
        """
        lower_host = hostname.lower()
        best = None
        best_len = 0
        for domain in domains:
            domain_lower = domain.lower()
            if lower_host.endswith('.' + domain_lower) or lower_host == domain_lower:
                if len(domain_lower) > best_len:
                    best = domain
                    best_len = len(domain_lower)
        return best

    @classmethod
    def resolve_ip(cls, hostname: str) -> Optional[str]:
        """Attempt to resolve a hostname to an IP address."""
        try:
            return socket.gethostbyname(hostname)
        except (socket.gaierror, socket.herror):
            return None

    @classmethod
    def run_full_correlation(
            cls, assessment_id: int,
            hostnames: List[str]) -> Dict:
        """
        Run full correlation pass for a list of hostnames against an assessment's
        known domains. Creates/updates ADExposure records and Neo4j exposure nodes.
        """
        from ..models import ADAssessment, ADDomain, ADExposure

        try:
            assessment = ADAssessment.objects.get(pk=assessment_id)
        except ADAssessment.DoesNotExist:
            return {'error': f'Assessment {assessment_id} not found'}

        known_domains = list(
            ADDomain.objects.filter(assessment=assessment)
            .values_list('fqdn', flat=True)
        )

        results = []
        for hostname in hostnames:
            etype = cls.classify_hostname(hostname)
            correlated_fqdn = cls.correlate_hostname_to_domain(
                hostname, known_domains)
            ip = cls.resolve_ip(hostname)
            score = cls.score_exposure(
                etype,
                is_internet_facing=True,
                has_domain_correlation=correlated_fqdn is not None,
            )

            correlated_domain = None
            if correlated_fqdn:
                correlated_domain = ADDomain.objects.filter(
                    assessment=assessment, fqdn=correlated_fqdn).first()

            exposure, created = ADExposure.objects.update_or_create(
                assessment=assessment,
                hostname=hostname,
                exposure_type=etype,
                defaults={
                    'ip_address': ip,
                    'correlated_domain': correlated_domain,
                    'risk_score': score,
                    'evidence': {
                        'source': 'correlation_engine',
                        'classified_type': etype,
                        'correlated_domain': correlated_fqdn,
                    },
                }
            )

            try:
                from ..graph.manager import ADGraphManager
                with ADGraphManager() as mgr:
                    mgr.upsert_exposure({
                        'hostname': hostname,
                        'ip_address': ip or '',
                        'exposure_type': etype,
                        'risk_score': score,
                        'assessment_id': assessment_id,
                    })
                    if correlated_fqdn:
                        mgr.create_exposure_link(hostname, correlated_fqdn, assessment_id)
            except Exception as exc:
                logger.warning(f"[Correlation] Graph write failed for {hostname}: {exc}")

            results.append({
                'hostname': hostname,
                'type': etype,
                'score': score,
                'correlated_domain': correlated_fqdn,
                'created': created,
            })

        return {'results': results, 'count': len(results)}
