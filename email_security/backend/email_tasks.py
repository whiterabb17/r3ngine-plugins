"""Email security scanning functions for the email_security plugin."""

import logging
import os
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

        # swaks exits 0 when RCPT is accepted (--quit-after RCPT), meaning relay allowed
        result["open_relay"] = proc.returncode == 0
        for line in output.splitlines():
            if '<-' in line and '220' in line and result["banner"] is None:
                result["banner"] = line.split('<-', 1)[-1].strip()[:200]
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


SMTP_USERNAMES_WORDLIST = '/usr/src/wordlist/smtp-usernames.txt'


def smtp_user_enum(targets: list, wordlist: str = SMTP_USERNAMES_WORDLIST,
                   method: str = 'VRFY', timeout: int = 120) -> dict:
    """Run smtp-user-enum once against all host:port targets using -T.

    Args:
        targets: list of (host, port) tuples
        wordlist: path to usernames wordlist
        method: VRFY, EXPN, or RCPT
        timeout: seconds before killing the process

    Returns:
        {"users_found": {"host:port": [usernames]}, "raw": str}
    """
    import tempfile

    if not targets:
        return {"users_found": {}, "raw": ""}

    if not os.path.isfile(wordlist):
        logger.warning("[smtp_user_enum] wordlist not found: %s", wordlist)
        return {"users_found": {}, "raw": ""}

    targets_file = None
    result: dict = {"users_found": {}, "raw": ""}
    try:
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as tf:
            targets_file = tf.name
            for host, port in targets:
                tf.write(f"{host}:{port}\n")

        cmd = [
            'smtp-user-enum',
            '-M', method,
            '-U', wordlist,
            '-T', targets_file,
        ]
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout + 10)
        output = proc.stdout
        result["raw"] = output[:10000]

        for line in output.splitlines():
            if 'EXISTS' not in line and '250 ' not in line:
                continue
            # Match line back to the originating host:port target.
            # smtp-user-enum outputs lines like: "10.0.0.1:25: admin EXISTS"
            matched_key = None
            for host, port in targets:
                host_port = f"{host}:{port}"
                if host_port in line:
                    matched_key = host_port
                    break
            if matched_key is None:
                # Fallback: match on host alone
                for host, port in targets:
                    if host in line:
                        matched_key = f"{host}:{port}"
                        break
            if matched_key is None:
                continue
            # Extract username — last colon-delimited segment, strip EXISTS/whitespace
            user = line.rsplit(':', 1)[-1].replace('EXISTS', '').strip()
            if user and '@' not in user:
                result["users_found"].setdefault(matched_key, [])
                if user not in result["users_found"][matched_key]:
                    result["users_found"][matched_key].append(user)

        if proc.returncode != 0 and not any(result["users_found"].values()):
            logger.warning(
                "[smtp_user_enum] exited %d: %s",
                proc.returncode,
                (proc.stderr or output)[:200],
            )
    except subprocess.TimeoutExpired:
        logger.debug("[smtp_user_enum] timed out after %ds", timeout)
    except FileNotFoundError:
        logger.warning("[smtp_user_enum] smtp-user-enum not found in PATH")
    except Exception as e:
        logger.debug("[smtp_user_enum] error: %s", e)
    finally:
        if targets_file:
            try:
                os.unlink(targets_file)
            except OSError:
                pass
    return result
