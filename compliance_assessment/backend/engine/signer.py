import hashlib
import json
import os
from datetime import datetime, timezone


def sign_report(
    html_path: str,
    framework: str,
    scan_id: int,
    domain: str,
    compliance_score: float,
    r3ngine_version: str,
) -> str:
    """SHA-256 hash the HTML report and write an attestation JSON beside it.

    Returns the path to the attestation JSON file.
    """
    if not os.path.exists(html_path):
        raise FileNotFoundError(f'Report not found: {html_path}')

    with open(html_path, 'rb') as f:
        content = f.read()

    sha256 = hashlib.sha256(content).hexdigest()
    attest_path = html_path.replace('.html', '_attest.json')

    attestation = {
        'framework': framework,
        'scan_id': scan_id,
        'domain': domain,
        'report_file': os.path.basename(html_path),
        'sha256': sha256,
        'compliance_score': compliance_score,
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'r3ngine_version': r3ngine_version,
    }

    with open(attest_path, 'w') as f:
        json.dump(attestation, f, indent=2)

    return attest_path
