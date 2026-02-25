from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List

from .models import RegenerateTemplateRequest, TemplateDefinition
from .themes import PROFESSIONAL_THEME


SAMPLE_EXAMPLE = """H1: NotesForge — Cybersecurity Incident Summary
H2: Executive Summary
PARAGRAPH: A brief summary of the incident, its impact, and immediate actions taken.
H2: Details
PARAGRAPH: The incident occurred on 2026-02-24 at 22:15 IST. Affected systems included DB server and internal API.
BULLET:
- Initial detection via IDS alert.
- Systems isolated.
- Forensic snapshot taken.
H2: Indicators of Compromise (IOCs)
TABLE:
| Type | Value | Notes |
| IP | 203.0.113.45 | Suspicious outbound traffic |
| Hash | e3b0c442... | Malware sample hash |
H2: Recommendations
NUMBERED:
1. Rotate compromised credentials.
2. Patch vulnerable services.
3. Run a full internal audit.
CODE:
curl -X GET "https://internal-api.local/health" -H "Authorization: Bearer <token>"
"""


PROMPT_FORMAT = (
    "Using NotesForge marker syntax (H1–H6, PARAGRAPH, BULLET, NUMBERED, TABLE, CODE), "
    "generate a structured document about '{topic}' for the '{templateName}' template. "
    "Keep sections concise, include sample TABLE and CODE if relevant, and ensure the content is deterministic. "
    "Output ONLY NotesForge markers content, no commentary."
)


@dataclass
class TemplateRepo:
    templates: Dict[str, TemplateDefinition]

    @classmethod
    def build_default(cls) -> "TemplateRepo":
        items = [
            TemplateDefinition(
                id="assignment",
                name="Assignment",
                description="Academic assignment/report layout",
                defaultTheme=PROFESSIONAL_THEME,
                aiPromptTemplate="Write a structured assignment on {topic} using NotesForge markers: H1:Title, H2:Overview, PARAGRAPH, BULLET, TABLE, CODE if needed.",
                sampleContent=SAMPLE_EXAMPLE,
            ),
            TemplateDefinition(
                id="resume",
                name="Resume",
                description="One page resume layout",
                defaultTheme=PROFESSIONAL_THEME,
                aiPromptTemplate="Generate a concise one-page resume for {topic} (role), with sections: H1:Name, H2:Profile, BULLET:Experience, BULLET:Skills, PARAGRAPH:Summary.",
                sampleContent=(
                    "H1: Alex Candidate\n"
                    "H2: Profile\nPARAGRAPH: Product-focused engineer with 5+ years of experience.\n"
                    "H2: Experience\nBULLET:\n- Senior Engineer at Example Corp (2022–Present)\n"
                    "- Software Engineer at Delta Labs (2019–2022)\n"
                    "H2: Skills\nBULLET:\n- Python, TypeScript, FastAPI, React\n"
                    "H2: Summary\nPARAGRAPH: Builds reliable platforms with strong communication.\n"
                ),
            ),
            TemplateDefinition(
                id="report",
                name="Report",
                description="Professional report",
                defaultTheme=PROFESSIONAL_THEME,
                aiPromptTemplate="Create a professional report for {topic} using NotesForge markers including H1, H2, PARAGRAPH, TABLE, BULLET, and Conclusion.",
                sampleContent=(
                    "H1: Professional Report\nH2: Overview\nPARAGRAPH: Scope and objective.\n"
                    "H2: Findings\nTABLE:\n| Item | Status | Notes |\n| Control 1 | Pass | Healthy |\n"
                    "H2: Actions\nBULLET:\n- Action one\n- Action two\nH2: Conclusion\nPARAGRAPH: Final summary.\n"
                ),
            ),
            TemplateDefinition(
                id="meeting",
                name="Meeting Notes",
                description="Meeting minutes template",
                defaultTheme=PROFESSIONAL_THEME,
                aiPromptTemplate="Give meeting minutes for {topic} with H1, PARAGRAPH, BULLET for action items, and NUMBERED for agenda.",
                sampleContent=(
                    "H1: Meeting Notes\nPARAGRAPH: Date, attendees, and purpose.\n"
                    "H2: Agenda\nNUMBERED:\n1. Review updates\n2. Discuss blockers\n"
                    "H2: Action Items\nBULLET:\n- Owner A: complete task X by Friday\n"
                ),
            ),
            TemplateDefinition(
                id="cybersec",
                name="Cybersecurity Report",
                description="Incident or audit report for security",
                defaultTheme=PROFESSIONAL_THEME,
                aiPromptTemplate="Write a cybersecurity incident report for {topic} with sections: H1:Incident Title, H2:Executive Summary, PARAGRAPH, TABLE:Indicators, BULLET:Recommendations, CODE for IOCs if present.",
                sampleContent=SAMPLE_EXAMPLE,
            ),
        ]
        return cls({item.id: item for item in items})

    def list_templates(self) -> List[TemplateDefinition]:
        return list(self.templates.values())

    def get(self, template_id: str) -> TemplateDefinition | None:
        return self.templates.get(template_id)

    def regenerate(self, req: RegenerateTemplateRequest) -> Dict[str, str]:
        template = self.get(req.templateId)
        if not template:
            raise KeyError(req.templateId)

        prompt = PROMPT_FORMAT.format(topic=req.topic, templateName=template.name)
        # If external provider integration is enabled, call it here.
        # Provider defaults intentionally deterministic and low temperature.
        generated = self._deterministic_content(template.id, req.topic)
        return {"content": generated, "prompt": prompt}

    def _deterministic_content(self, template_id: str, topic: str) -> str:
        topic_clean = topic.strip()
        if template_id == "assignment":
            return SAMPLE_EXAMPLE.replace(
                "NotesForge — Cybersecurity Incident Summary",
                f"NotesForge — {topic_clean} Assignment",
            )
        if template_id == "resume":
            return (
                f"H1: {topic_clean} Resume\n"
                "H2: Profile\nPARAGRAPH: Results-driven professional profile.\n"
                "H2: Experience\nBULLET:\n- Role at Company A\n- Role at Company B\n"
                "H2: Skills\nBULLET:\n- Skill 1\n- Skill 2\n"
                "H2: Summary\nPARAGRAPH: Concise career summary.\n"
            )
        if template_id == "meeting":
            return (
                f"H1: Meeting Minutes — {topic_clean}\n"
                "PARAGRAPH: Meeting objective and attendees.\n"
                "H2: Agenda\nNUMBERED:\n1. Opening\n2. Discussion\n3. Decisions\n"
                "H2: Action Items\nBULLET:\n- Assign owner and due date\n"
            )
        if template_id == "cybersec":
            return SAMPLE_EXAMPLE.replace(
                "NotesForge — Cybersecurity Incident Summary",
                f"NotesForge — {topic_clean} Cybersecurity Report",
            )
        # report fallback
        return (
            f"H1: Professional Report — {topic_clean}\n"
            "H2: Executive Summary\nPARAGRAPH: Key objective and scope.\n"
            "H2: Findings\nTABLE:\n| Category | Result | Notes |\n| Risk | Medium | Needs follow-up |\n"
            "H2: Recommendations\nBULLET:\n- Recommendation A\n- Recommendation B\n"
            "H2: Conclusion\nPARAGRAPH: Final concise conclusion.\n"
            "CODE:\n# Optional implementation snippet\nprint('done')\n"
        )
