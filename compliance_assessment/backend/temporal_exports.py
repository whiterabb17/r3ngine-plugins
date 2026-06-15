import hashlib
import logging
import os
from datetime import timedelta

from temporalio import activity, workflow

logger = logging.getLogger(__name__)

FRAMEWORKS_DIR = os.path.join(os.path.dirname(__file__), 'engine', 'frameworks')


def _get_active_framework_keys() -> list:
    import yaml
    keys = []
    for fname in os.listdir(FRAMEWORKS_DIR):
        if not fname.endswith('.yaml'):
            continue
        key = fname.replace('.yaml', '')
        path = os.path.join(FRAMEWORKS_DIR, fname)
        try:
            with open(path) as f:
                spec = yaml.safe_load(f)
            if spec and spec.get('controls'):
                keys.append(key)
        except Exception:
            pass
    return keys


@activity.defn
def run_compliance_assessment_activity(ctx: dict) -> dict:
    """Run compliance assessment for all active frameworks after Tier 7."""
    scan_id = ctx.get('scan_history_id')
    if not scan_id:
        logger.error('[COMPLIANCE] No scan_history_id in ctx')
        return {'status': 'failed', 'error': 'No scan_history_id'}

    logger.info('[COMPLIANCE] START scan_id=%s', scan_id)

    import django.db as db
    db.connection.close()

    from plugins_data.compliance_assessment.backend.engine.runner import run_framework
    from plugins_data.compliance_assessment.backend.engine.report_builder import build_html_report, build_pdf_report
    from plugins_data.compliance_assessment.backend.engine.signer import sign_report
    from django.conf import settings

    r3ngine_version = getattr(settings, 'VERSION', '3.6.0')
    framework_keys = _get_active_framework_keys()
    results = {}

    for framework_key in framework_keys:
        try:
            assessment = run_framework(scan_id, framework_key)
            if assessment is None:
                results[framework_key] = 'skipped'
                continue

            html_path = build_html_report(assessment)
            assessment.html_report_path = html_path
            assessment.save(update_fields=['html_report_path'])

            try:
                pdf_path = build_pdf_report(html_path)
                assessment.pdf_report_path = pdf_path
                assessment.save(update_fields=['pdf_report_path'])
            except ImportError:
                pass  # WeasyPrint not installed

            domain = assessment.scan_history.domain.name
            attest_path = sign_report(
                html_path=html_path,
                framework=framework_key,
                scan_id=scan_id,
                domain=domain,
                compliance_score=assessment.compliance_score or 0.0,
                r3ngine_version=r3ngine_version,
            )
            assessment.attestation_path = attest_path
            with open(html_path, 'rb') as f:
                assessment.attestation_hash = hashlib.sha256(f.read()).hexdigest()
            assessment.save(update_fields=['attestation_path', 'attestation_hash'])

            results[framework_key] = 'complete'
            logger.info('[COMPLIANCE] COMPLETE framework=%s scan=%s score=%s',
                        framework_key, scan_id, assessment.compliance_score)

        except Exception as exc:
            logger.error('[COMPLIANCE] ERROR framework=%s scan=%s: %s', framework_key, scan_id, exc)
            results[framework_key] = f'failed: {type(exc).__name__}'

    logger.info('[COMPLIANCE] ALL DONE scan=%s results=%s', scan_id, results)
    return {'scan_history_id': scan_id, 'frameworks': results}


@workflow.defn(name='ComplianceAssessmentWorkflow')
class ComplianceAssessmentWorkflow:
    @workflow.run
    async def run(self, ctx: dict) -> dict:
        result = await workflow.execute_activity(
            run_compliance_assessment_activity,
            ctx,
            start_to_close_timeout=timedelta(hours=1),
            heartbeat_timeout=timedelta(minutes=10),
        )
        workflow.logger.info('[COMPLIANCE] workflow complete scan_id=%s', ctx.get('scan_history_id'))
        return result
