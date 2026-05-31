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


def swaks_relay_test(host: str, port: int, domain: str, timeout: int = 20) -> dict:
    """Test for SMTP open relay using swaks.

    Attempts to send a probe to an external address from a domain-spoofed sender.
    Returns {"open_relay": bool, "banner": str | None, "raw": str}
    """
    cmd = [
        'swaks',
        '--to', 'probe@relay-test-probe.invalid',
        '--from', f'probe@{domain}',
        '--server', host,
        '--port', str(port),
        '--quit-after', 'RCPT',
        '--hide-all',
        '--timeout', str(timeout),
    ]
    result = {"open_relay": False, "banner": None, "raw": ""}
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout + 5)
        output = proc.stdout + proc.stderr
        result["raw"] = output[:2000]

        lines = output.splitlines()
        for i, line in enumerate(lines):
            if '<-' in line and '220' in line and result["banner"] is None:
                result["banner"] = line.split('<-', 1)[-1].strip()[:200]
            if '<-' in line and line.strip().startswith('<- 250') and 'RCPT' in '\n'.join(lines[max(0, i-3):i]):
                result["open_relay"] = True
    except subprocess.TimeoutExpired:
        logger.debug(f"[swaks_relay_test] {host}:{port} timed out")
    except FileNotFoundError:
        logger.warning("[swaks_relay_test] swaks not found in PATH")
    except Exception as e:
        logger.debug(f"[swaks_relay_test] {host}:{port}: {e}")
    return result


def swaks_starttls_check(host: str, port: int, timeout: int = 15) -> dict:
    """Check whether STARTTLS is advertised in SMTP EHLO response.

    Returns {"starttls_supported": bool, "ehlo_raw": str}
    """
    cmd = [
        'swaks',
        '--server', host,
        '--port', str(port),
        '--quit-after', 'EHLO',
        '--hide-all',
        '--timeout', str(timeout),
    ]
    result = {"starttls_supported": False, "ehlo_raw": ""}
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout + 5)
        output = proc.stdout + proc.stderr
        result["ehlo_raw"] = output[:2000]
        result["starttls_supported"] = 'STARTTLS' in output.upper()
    except subprocess.TimeoutExpired:
        logger.debug(f"[swaks_starttls_check] {host}:{port} timed out")
    except FileNotFoundError:
        logger.warning("[swaks_starttls_check] swaks not found in PATH")
    except Exception as e:
        logger.debug(f"[swaks_starttls_check] {host}:{port}: {e}")
    return result


def smtp_user_enum(host: str, port: int, wordlist: str = '/usr/share/smtp-user-enum/username.txt',
                   method: str = 'VRFY', timeout: int = 60) -> dict:
    """Run smtp-user-enum against host:port.

    Returns {"users_found": list[str], "raw": str}
    """
    cmd = [
        'smtp-user-enum',
        '-M', method,
        '-U', wordlist,
        '-t', host,
        '-p', str(port),
        '-T', str(timeout),
    ]
    result = {"users_found": [], "raw": ""}
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout + 10)
        output = proc.stdout
        result["raw"] = output[:5000]
        for line in output.splitlines():
            if 'EXISTS' in line or '250 ' in line:
                parts = line.split(':')
                if len(parts) >= 2:
                    user = parts[-1].replace('EXISTS', '').strip()
                    if user and '@' not in user:
                        result["users_found"].append(user)
    except subprocess.TimeoutExpired:
        logger.debug(f"[smtp_user_enum] {host}:{port} timed out")
    except FileNotFoundError:
        logger.warning("[smtp_user_enum] smtp-user-enum not found in PATH")
    except Exception as e:
        logger.debug(f"[smtp_user_enum] {host}:{port}: {e}")
    return result
