"""Email security scanning functions for the email_security plugin."""

import logging
import subprocess

logger = logging.getLogger(__name__)

SMTP_PORTS = [25, 587, 465, 993]
DKIM_SELECTORS = ['default', 'google', 'mail', 'email', 'selector1', 'selector2', 'k1', 's1']


def check_spf(domain: str) -> dict:
    """Query SPF TXT record for domain.

    Returns:
        {
            "found": bool,
            "record": str | None,
            "weak": bool,   # True if +all or ~all
        }
    """
    import dns.resolver
    import dns.exception

    result = {"found": False, "record": None, "weak": False}
    try:
        answers = dns.resolver.resolve(domain, 'TXT', lifetime=10)
        for rdata in answers:
            txt = str(rdata).strip('"')
            if txt.startswith('v=spf1'):
                result["found"] = True
                result["record"] = txt
                result["weak"] = ('+all' in txt or '~all' in txt)
                break
    except (dns.exception.DNSException, Exception) as e:
        logger.debug(f"[check_spf] {domain}: {e}")
    return result


def check_dmarc(domain: str) -> dict:
    """Query DMARC TXT record at _dmarc.{domain}.

    Returns:
        {
            "found": bool,
            "record": str | None,
            "policy": str | None,   # "none", "quarantine", "reject"
        }
    """
    import dns.resolver
    import dns.exception

    result = {"found": False, "record": None, "policy": None}
    try:
        answers = dns.resolver.resolve(f'_dmarc.{domain}', 'TXT', lifetime=10)
        for rdata in answers:
            txt = str(rdata).strip('"')
            if 'v=DMARC1' in txt:
                result["found"] = True
                result["record"] = txt
                for part in txt.split(';'):
                    part = part.strip()
                    if part.lower().startswith('p='):
                        result["policy"] = part.split('=', 1)[1].strip().lower()
                break
    except (dns.exception.DNSException, Exception) as e:
        logger.debug(f"[check_dmarc] _dmarc.{domain}: {e}")
    return result


def check_dkim(domain: str) -> dict:
    """Probe common DKIM selectors at {selector}._domainkey.{domain}.

    Returns:
        {
            "found": bool,
            "selector": str | None,
            "record": str | None,
        }
    """
    import dns.resolver
    import dns.exception

    for selector in DKIM_SELECTORS:
        try:
            name = f'{selector}._domainkey.{domain}'
            answers = dns.resolver.resolve(name, 'TXT', lifetime=10)
            for rdata in answers:
                txt = str(rdata).strip('"')
                if 'v=DKIM1' in txt or 'p=' in txt:
                    return {"found": True, "selector": selector, "record": txt}
        except (dns.exception.DNSException, Exception):
            continue
    return {"found": False, "selector": None, "record": None}


def assess_spoofability(spf: dict, dmarc: dict) -> list:
    """Return list of spoofability findings based on SPF and DMARC results.

    Each finding: {"name": str, "severity": int, "description": str}
    """
    findings = []

    no_spf = not spf["found"]
    weak_spf = spf["found"] and spf["weak"]
    no_dmarc = not dmarc["found"]
    dmarc_none = dmarc["found"] and dmarc["policy"] == "none"

    if no_spf and no_dmarc:
        findings.append({
            "name": "Direct Email Spoofing Feasible",
            "severity": 3,
            "description": (
                "No SPF or DMARC records exist for this domain. An attacker can send "
                "email appearing to come from this domain with no technical barrier. "
                "This enables phishing, fraud, and reputational damage."
            ),
        })
    elif weak_spf and (no_dmarc or dmarc_none):
        findings.append({
            "name": "Email Spoofing via SPF Bypass Feasible",
            "severity": 2,
            "description": (
                f"SPF policy uses a permissive qualifier ({spf['record']}) "
                "and DMARC is either absent or set to p=none. Spoofed messages "
                "may still reach recipients."
            ),
        })
    return findings
