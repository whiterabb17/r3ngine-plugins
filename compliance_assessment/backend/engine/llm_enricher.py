import logging
from django.utils import timezone

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a compliance expert specialising in information security regulatory frameworks.
Provide detailed, actionable remediation guidance for a specific compliance control failure
identified during a remote security assessment. Be concise (under 300 words), specific to the
evidence found, and reference specific CVEs, ports, or findings from the scan."""


def enrich_control_with_ai(control_result_id: int) -> str:
    """Generate AI remediation for a ControlResult and save it.

    Uses reNgine LLMBaseGenerator infrastructure. Returns the generated remediation text.
    """
    from plugins_data.compliance_assessment.backend.models import ControlResult, ComplianceEvidence

    ctrl = ControlResult.objects.select_related('assessment__scan_history__domain').get(
        pk=control_result_id
    )

    if ctrl.ai_remediation:
        raise ValueError(f'Control {ctrl.control_id} already has AI remediation')

    evidence_items = list(
        ComplianceEvidence.objects.filter(control_result=ctrl).values('description', 'evidence_type')[:10]
    )
    evidence_text = '\n'.join(
        f"- [{e['evidence_type']}] {e['description']}" for e in evidence_items
    ) or 'No specific evidence items recorded.'

    framework_name = ctrl.assessment.get_framework_display()
    domain = ctrl.assessment.scan_history.domain.name

    user_prompt = f"""Framework: {framework_name}
Control: {ctrl.control_id} — {ctrl.control_name}
Section: {ctrl.section}
Result: {ctrl.result} (confidence: {ctrl.confidence})
Domain assessed: {domain}

Standard remediation:
{ctrl.static_remediation or 'None provided.'}

Evidence found:
{evidence_text}

Provide specific, actionable remediation steps."""

    # Use reNgine LLMBaseGenerator — the base class handles provider selection,
    # PII anonymization, and deanonymization automatically.
    try:
        from reNgine.llm import LLMBaseGenerator
        generator = LLMBaseGenerator(logger=logger)
        remediation = generator._call_llm(SYSTEM_PROMPT, user_prompt)
    except ImportError:
        raise NotImplementedError('LLM integration not available — check reNgine.llm module')

    if not remediation or remediation.startswith('Error:'):
        raise ValueError(f'LLM returned unusable response: {remediation!r}')

    ctrl.ai_remediation = remediation.strip()
    ctrl.ai_enriched_at = timezone.now()
    ctrl.save(update_fields=['ai_remediation', 'ai_enriched_at'])

    logger.info('AI remediation generated for control %s (scan %s)', ctrl.control_id, ctrl.assessment.scan_history_id)
    return ctrl.ai_remediation
