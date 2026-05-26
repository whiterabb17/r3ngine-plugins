# r3ngine-plugins/active_directory/backend/reporting/pdf_renderer.py
from __future__ import annotations
import html


def _esc(value) -> str:
    return html.escape(str(value) if value is not None else '')


def _sev_color(sev: str) -> str:
    return {
        'CRITICAL': '#d32f2f',
        'HIGH': '#f44336',
        'MEDIUM': '#ff9800',
        'LOW': '#2196f3',
        'INFO': '#9e9e9e',
    }.get(sev, '#9e9e9e')


def _build_html(report: dict) -> str:
    meta = report.get('metadata', {})
    summary = report.get('executive_summary', {})
    findings = report.get('findings', [])
    trusts = report.get('trust_analysis', [])
    exposures = report.get('exposure_analysis', [])
    timeline = report.get('timeline', [])

    sev_rows = ''.join(
        f'<tr><td style="color:{_sev_color(s)};font-weight:bold">{_esc(s)}</td>'
        f'<td>{summary.get("finding_counts", {}).get(s, 0)}</td></tr>'
        for s in ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO')
    )

    finding_rows = ''.join(
        f'<tr>'
        f'<td style="color:{_sev_color(f.get("severity",""))}"><b>{_esc(f.get("severity",""))}</b></td>'
        f'<td>{_esc(f.get("title",""))}</td>'
        f'<td><code>{_esc(f.get("affected_object",""))}</code></td>'
        f'<td style="font-size:0.85em">{_esc(f.get("remediation",""))}</td>'
        f'</tr>'
        for f in findings
    )

    trust_rows = ''.join(
        f'<tr><td>{_esc(t.get("source",""))}</td><td>{_esc(t.get("target",""))}</td>'
        f'<td>{_esc(t.get("type",""))}</td><td>{_esc(t.get("direction",""))}</td>'
        f'<td>{"Yes" if t.get("is_transitive") else "No"}</td>'
        f'<td>{"Enabled" if t.get("is_selective_auth") else "<b style=\"color:#f44336\">Disabled</b>"}</td>'
        f'<td>{t.get("risk_score", 0):.1f}</td></tr>'
        for t in trusts
    )

    exposure_rows = ''.join(
        f'<tr><td>{_esc(e.get("hostname",""))}</td><td>{_esc(e.get("type",""))}</td>'
        f'<td>{_esc(e.get("port",""))}</td>'
        f'<td>{e.get("risk_score", 0):.1f}</td>'
        f'<td>{_esc(e.get("correlated_domain",""))}</td></tr>'
        for e in exposures
    )

    timeline_rows = ''.join(
        f'<tr><td style="white-space:nowrap;font-size:0.8em">{_esc(str(e.get("timestamp",""))[:19])}</td>'
        f'<td>{_esc(e.get("event_type",""))}</td>'
        f'<td>{_esc(e.get("actor",""))}</td></tr>'
        for e in timeline
    )

    generated_at = str(meta.get('generated_at', ''))[:19]

    return f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body {{ font-family: Arial, sans-serif; font-size: 11pt; color: #1a1a2e; margin: 40px; }}
  h1 {{ font-size: 18pt; color: #0d1b2a; border-bottom: 2px solid #1565c0; padding-bottom: 6px; }}
  h2 {{ font-size: 13pt; color: #1565c0; margin-top: 28px; border-bottom: 1px solid #e0e0e0; padding-bottom: 4px; }}
  table {{ border-collapse: collapse; width: 100%; margin-top: 8px; font-size: 9.5pt; }}
  th {{ background: #1565c0; color: white; padding: 6px 8px; text-align: left; }}
  td {{ padding: 5px 8px; border-bottom: 1px solid #e8e8e8; vertical-align: top; }}
  tr:nth-child(even) td {{ background: #f9f9fb; }}
  code {{ font-family: monospace; font-size: 0.9em; }}
  .meta-grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 12px 0; }}
  .meta-item {{ background: #f0f4ff; padding: 8px 12px; border-radius: 4px; }}
  .meta-label {{ font-size: 0.75em; color: #666; text-transform: uppercase; }}
  .meta-value {{ font-weight: bold; font-size: 1em; }}
</style>
</head>
<body>
<h1>Active Directory Assessment Report</h1>
<div class="meta-grid">
  <div class="meta-item"><div class="meta-label">Assessment</div><div class="meta-value">{_esc(meta.get("assessment_name",""))}</div></div>
  <div class="meta-item"><div class="meta-label">Target Domain</div><div class="meta-value">{_esc(meta.get("target_domain",""))}</div></div>
  <div class="meta-item"><div class="meta-label">Status</div><div class="meta-value">{_esc(meta.get("status",""))}</div></div>
  <div class="meta-item"><div class="meta-label">Generated</div><div class="meta-value">{_esc(generated_at)}</div></div>
</div>

<h2>Executive Summary</h2>
<table>
  <tr><th>Metric</th><th>Value</th></tr>
  <tr><td>Domains Discovered</td><td>{summary.get("domain_count", 0)}</td></tr>
  <tr><td>Trust Relationships</td><td>{summary.get("trust_count", 0)}</td></tr>
  <tr><td>Exposed Services</td><td>{summary.get("exposure_count", 0)}</td></tr>
  <tr><td>Avg Trust Risk</td><td>{summary.get("average_trust_risk", 0):.2f}</td></tr>
  <tr><td>Avg Exposure Risk</td><td>{summary.get("average_exposure_risk", 0):.2f}</td></tr>
</table>

<h2>Finding Severity Breakdown</h2>
<table><tr><th>Severity</th><th>Count</th></tr>{sev_rows}</table>

<h2>Findings</h2>
<table>
  <tr><th>Severity</th><th>Title</th><th>Affected Object</th><th>Remediation</th></tr>
  {finding_rows if finding_rows else '<tr><td colspan="4">No findings recorded.</td></tr>'}
</table>

<h2>Trust Analysis</h2>
<table>
  <tr><th>Source</th><th>Target</th><th>Type</th><th>Direction</th><th>Transitive</th><th>Selective Auth</th><th>Risk</th></tr>
  {trust_rows if trust_rows else '<tr><td colspan="7">No trust relationships found.</td></tr>'}
</table>

<h2>Exposure Analysis</h2>
<table>
  <tr><th>Hostname</th><th>Type</th><th>Port</th><th>Risk</th><th>Correlated Domain</th></tr>
  {exposure_rows if exposure_rows else '<tr><td colspan="5">No exposures found.</td></tr>'}
</table>

<h2>Assessment Timeline</h2>
<table>
  <tr><th>Timestamp</th><th>Event</th><th>Actor</th></tr>
  {timeline_rows if timeline_rows else '<tr><td colspan="3">No timeline events recorded.</td></tr>'}
</table>

</body>
</html>"""


def _build_html_from_template(report: dict, template_name: str) -> str:
    from django.template.loader import render_to_string
    return render_to_string(f'report/{template_name}.html', {'report': report})


class PDFRenderer:
    SUPPORTED_TEMPLATES = frozenset({'standard', 'modern', 'cyber_pro'})

    @staticmethod
    def render(report: dict, template: str = 'standard') -> bytes:
        from weasyprint import HTML
        if template in PDFRenderer.SUPPORTED_TEMPLATES and template != 'standard':
            html_content = _build_html_from_template(report, f'ad_{template}')
        else:
            html_content = _build_html(report)
        return HTML(string=html_content).write_pdf()
