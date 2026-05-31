"""Temporal activity and workflow for the email_security plugin."""

import logging
from datetime import timedelta

from temporalio import activity, workflow

logger = logging.getLogger(__name__)

SMTP_PORTS = [25, 587, 465, 993]


@activity.defn
def run_email_security_activity(ctx: dict) -> dict:
    """Perform email/SMTP security checks.

    DNS checks (SPF/DKIM/DMARC) always run against the root domain.
    SMTP tool checks (swaks, smtp-user-enum) only run if SMTP ports
    were found during the Tier 2 port scan.
    """
    from reNgine.common_func import save_vulnerability
    from startScan.models import ScanHistory, Subdomain
    from .email_tasks import (
        check_spf, check_dmarc, check_dkim, assess_spoofability,
        swaks_relay_test, swaks_starttls_check, smtp_user_enum,
    )

    scan_id = ctx.get('scan_history_id')
    domain_name = ctx.get('domain_name') or ctx.get('domain', '')
    activity.logger.info(f"[run_email_security_activity] scan_id={scan_id} domain={domain_name}")

    scan = ScanHistory.objects.select_related('domain').get(pk=scan_id)
    if not domain_name:
        domain_name = scan.domain.name

    findings_count = 0

    def _vuln(name, severity, description, url=None):
        nonlocal findings_count
        save_vulnerability(
            target_domain=scan.domain,
            scan_history=scan,
            name=name,
            severity=severity,
            description=description,
            http_url=url or f'smtp://{domain_name}',
            type='SMTP',
            source='email_security',
            dedup_fields=['name', 'http_url', 'scan_history'],
        )
        findings_count += 1

    # ── DNS checks (always run) ──────────────────────────────────────────────
    spf = check_spf(domain_name)
    dmarc = check_dmarc(domain_name)
    dkim = check_dkim(domain_name)

    if not spf["found"]:
        _vuln(
            'SPF Record Missing', 3,
            f'No SPF TXT record found for {domain_name}. Any host can send email '
            f'claiming to be from this domain without SPF rejection.',
        )
    elif spf["weak"]:
        _vuln(
            'SPF Weak Policy', 2,
            f'SPF record for {domain_name} uses a permissive qualifier: {spf["record"]}. '
            f'+all or ~all allows spoofed messages to pass SPF checks.',
        )

    if not dmarc["found"]:
        _vuln(
            'DMARC Record Missing', 3,
            f'No DMARC record found at _dmarc.{domain_name}. Without DMARC, receiving '
            f'mail servers have no policy-enforcement instructions for spoofed emails.',
        )
    elif dmarc["policy"] == 'none':
        _vuln(
            'DMARC Policy Not Enforced (p=none)', 2,
            f'DMARC record exists for {domain_name} but uses p=none. No messages are '
            f'quarantined or rejected; DMARC is monitoring-only.',
        )

    if not dkim["found"]:
        _vuln(
            'DKIM Record Missing', 2,
            f'No DKIM public key TXT record found for {domain_name} across common selectors. '
            f'Email authenticity cannot be cryptographically verified.',
        )

    for spoof_finding in assess_spoofability(spf, dmarc):
        _vuln(
            spoof_finding['name'],
            spoof_finding['severity'],
            spoof_finding['description'],
        )

    # ── SMTP port-aware checks (only if port scan found SMTP ports) ──────────
    smtp_hosts = list(
        Subdomain.objects.filter(
            scan_history_id=scan_id,
            ip_addresses__ports__number__in=SMTP_PORTS,
        ).values_list('name', 'ip_addresses__address', 'ip_addresses__ports__number')
        .distinct()
    )

    activity.logger.info(
        f"[run_email_security_activity] scan_id={scan_id} smtp_hosts_found={len(smtp_hosts)}"
    )

    checked_pairs = set()
    for (subdomain_name, ip_address, port) in smtp_hosts:
        host = subdomain_name or ip_address
        pair = (host, port)
        if pair in checked_pairs:
            continue
        checked_pairs.add(pair)
        host_url = f'smtp://{host}:{port}'

        relay = swaks_relay_test(host, port, domain_name)
        if relay.get('banner'):
            _vuln('SMTP Service Banner Disclosure', 0,
                  f'SMTP banner on {host}:{port}: {relay["banner"]}', host_url)
        if relay['open_relay']:
            _vuln(
                'SMTP Open Relay', 4,
                f'The SMTP server at {host}:{port} accepted a relay attempt for an '
                f'external recipient from an external sender. This server can be abused '
                f'to send spam or phishing email through the target organisation.',
                host_url,
            )

        if port in (25, 587):
            tls = swaks_starttls_check(host, port)
            if not tls['starttls_supported']:
                _vuln(
                    'STARTTLS Not Supported', 3,
                    f'The SMTP server at {host}:{port} did not advertise STARTTLS. '
                    f'Email transmitted to/from this server may be in plaintext.',
                    host_url,
                )

        if port == 25:
            enum = smtp_user_enum(host, port)
            if enum['users_found']:
                users_str = ', '.join(enum['users_found'][:20])
                _vuln(
                    'SMTP User Enumeration (VRFY/EXPN)', 2,
                    f'The SMTP server at {host}:{port} confirmed '
                    f'{len(enum["users_found"])} valid usernames: {users_str}.',
                    host_url,
                )

    activity.logger.info(
        f"[run_email_security_activity] scan_id={scan_id} complete "
        f"findings={findings_count} smtp_hosts={len(checked_pairs)}"
    )
    return {
        "findings_count": findings_count,
        "smtp_hosts_checked": len(checked_pairs),
        "dns_checked": True,
    }


@workflow.defn(name="EmailSecurityWorkflow")
class EmailSecurityWorkflow:
    @workflow.run
    async def run(self, ctx: dict) -> dict:
        result = await workflow.execute_activity(
            run_email_security_activity,
            ctx,
            start_to_close_timeout=timedelta(hours=1),
            heartbeat_timeout=timedelta(minutes=10),
            task_queue="python-orchestrator-queue",
        )
        workflow.logger.info(
            f"[EmailSecurityWorkflow] scan_id={ctx.get('scan_history_id')} result={result}"
        )
        return result
