import os
import logging
from collections import defaultdict
from datetime import datetime, timezone

from django.conf import settings
from jinja2 import Environment, FileSystemLoader

logger = logging.getLogger(__name__)

TEMPLATE_DIR = os.path.join(os.path.dirname(__file__), '..', 'templates')
FRAMEWORK_NAMES = {
    'pci_dss_4': 'PCI DSS 4.0',
    'hipaa': 'HIPAA Technical Safeguards',
    'nist_800_53': 'NIST SP 800-53 Rev 5',
    'cis_v8': 'CIS Controls v8',
    'iso_27001': 'ISO 27001:2022',
    'soc2': 'SOC 2 Type II (Security TSC)',
}


def build_html_report(assessment) -> str:
    """Render the Jinja2 HTML template and save to MEDIA_ROOT."""
    scan = assessment.scan_history
    domain = scan.domain.name if hasattr(scan, 'domain') and scan.domain else 'unknown'

    controls = list(assessment.controls.order_by('section', 'control_id').values(
        'control_id', 'control_name', 'section', 'result',
        'confidence', 'static_remediation',
    ))

    sections = defaultdict(list)
    for ctrl in controls:
        sections[ctrl['section']].append(ctrl)

    timestamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S')
    rel_dir = os.path.join('plugins', 'compliance', str(scan.id))
    abs_dir = os.path.join(settings.MEDIA_ROOT, rel_dir)
    os.makedirs(abs_dir, exist_ok=True)

    filename = f'{assessment.framework}_{timestamp}.html'
    html_path = os.path.join(abs_dir, filename)

    env = Environment(loader=FileSystemLoader(TEMPLATE_DIR), autoescape=False)
    template = env.get_template('compliance_report.html')
    rendered = template.render(
        framework_name=FRAMEWORK_NAMES.get(assessment.framework, assessment.framework),
        domain=domain,
        scan_id=scan.id,
        generated_at=datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC'),
        r3ngine_version=getattr(settings, 'VERSION', '3.6.0'),
        compliance_score=assessment.compliance_score,
        pass_count=assessment.pass_count,
        fail_count=assessment.fail_count,
        partial_count=assessment.partial_count,
        manual_count=assessment.manual_count,
        sections=dict(sections),
    )

    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(rendered)

    logger.info('Compliance HTML report written: %s', html_path)
    return html_path


def build_pdf_report(html_path: str) -> str:
    """Convert HTML report to PDF using WeasyPrint."""
    try:
        from weasyprint import HTML as WeasyHTML
    except ImportError:
        logger.error('WeasyPrint not installed — PDF generation skipped')
        raise

    pdf_path = html_path.replace('.html', '.pdf')
    WeasyHTML(filename=html_path).write_pdf(pdf_path)
    logger.info('Compliance PDF report written: %s', pdf_path)
    return pdf_path
