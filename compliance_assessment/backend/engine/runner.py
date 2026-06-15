import os
import logging
import yaml
from django.utils import timezone

logger = logging.getLogger(__name__)

FRAMEWORKS_DIR = os.path.join(os.path.dirname(__file__), 'frameworks')

RESULT_SEVERITY = {'FAIL': 3, 'PARTIAL': 2, 'PASS': 1}
CONFIDENCE_RANK = {'HIGH': 3, 'MEDIUM': 2, 'LOW': 1}


def _load_framework_yaml(framework_key: str) -> dict:
    path = os.path.join(FRAMEWORKS_DIR, f'{framework_key}.yaml')
    if not os.path.exists(path):
        raise FileNotFoundError(f'Framework YAML not found: {path}')
    with open(path, 'r') as f:
        return yaml.safe_load(f)


def _get_evaluator(evaluator_name: str):
    from plugins_data.compliance_assessment.backend.engine.evaluators import EVALUATOR_MAP
    cls = EVALUATOR_MAP.get(evaluator_name)
    if cls is None:
        raise ValueError(f'Unknown evaluator: {evaluator_name}')
    return cls()


def run_framework(scan_id: int, framework_key: str):
    """Run a single compliance framework against the given scan."""
    from plugins_data.compliance_assessment.backend.models import (
        ComplianceAssessment, ControlResult, ComplianceEvidence,
    )

    spec = _load_framework_yaml(framework_key)
    controls = spec.get('controls', [])

    if not controls:
        logger.warning('Framework %s has no controls defined — skipping', framework_key)
        return None

    assessment, _ = ComplianceAssessment.objects.update_or_create(
        scan_history_id=scan_id,
        framework=framework_key,
        defaults={'status': 'RUNNING'},
    )

    try:
        for ctrl in controls:
            control_id = ctrl['id']
            is_manual = ctrl.get('manual', False)

            if is_manual:
                result = 'MANUAL'
                confidence = 'MANUAL'
                evidence_items = []
            else:
                collected = []
                for check in ctrl.get('checks', []):
                    evaluator_name = check['evaluator']
                    evaluator = _get_evaluator(evaluator_name)
                    ev_result = evaluator.check(scan_id, check.get('params', {}))
                    if ev_result.matches:
                        collected.append({
                            'result': check['result_if_found'],
                            'confidence': check.get('confidence', ev_result.confidence),
                            'evidence': ev_result.evidence,
                        })

                if not collected:
                    result = 'PASS'
                    confidence = 'MEDIUM'
                    evidence_items = []
                else:
                    best = max(collected, key=lambda x: (
                        RESULT_SEVERITY.get(x['result'], 0),
                        CONFIDENCE_RANK.get(x['confidence'], 0),
                    ))
                    result = best['result']
                    confidence = best['confidence']
                    evidence_items = [e for c in collected for e in c['evidence']]

            ctrl_obj, _ = ControlResult.objects.update_or_create(
                assessment=assessment,
                control_id=control_id,
                defaults={
                    'control_name': ctrl.get('name', control_id),
                    'section': ctrl.get('section', ''),
                    'result': result,
                    'confidence': confidence,
                    'static_remediation': ctrl.get('remediation', ''),
                },
            )
            ComplianceEvidence.objects.filter(control_result=ctrl_obj).delete()
            for ev in evidence_items[:20]:
                ComplianceEvidence.objects.create(
                    control_result=ctrl_obj,
                    evidence_type=_infer_evidence_type(ev),
                    evidence_id=ev.get('id'),
                    description=ev.get('description', ''),
                    detail=ev.get('detail', {}),
                )

        assessment.update_counts()
        assessment.status = 'COMPLETE'
        assessment.completed_at = timezone.now()
        assessment.save()

    except Exception as exc:
        logger.error('Runner failed for framework=%s scan=%s: %s', framework_key, scan_id, exc)
        assessment.status = 'FAILED'
        assessment.save()
        raise

    return assessment


def _infer_evidence_type(ev: dict) -> str:
    detail = ev.get('detail', {})
    if 'cvss_score' in detail or 'severity' in detail:
        return 'VULNERABILITY'
    if 'port' in detail or 'number' in detail:
        return 'PORT'
    if 'header' in detail:
        return 'HEADER'
    if 'url' in detail:
        return 'ENDPOINT'
    return 'VULNERABILITY'
