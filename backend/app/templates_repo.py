from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List

from .models import RegenerateTemplateRequest, TemplateDefinition
from .themes import PROFESSIONAL_THEME


SAMPLE_EXAMPLE = """H1: NotesForge - Cybersecurity Incident Summary
H2: Executive Summary
PARAGRAPH: A brief summary of the incident, its impact, and immediate actions taken.
H2: Details
PARAGRAPH: The incident occurred on 2026-02-24 at 22:15 IST. Affected systems included DB server and internal API.
BULLET: Initial detection via IDS alert.
BULLET: Systems isolated.
BULLET: Forensic snapshot taken.
H2: Indicators of Compromise (IOCs)
TABLE: Type | Value | Notes
TABLE: IP | 203.0.113.45 | Suspicious outbound traffic
TABLE: Hash | e3b0c442... | Malware sample hash
H2: Recommendations
NUMBERED: Rotate compromised credentials.
NUMBERED: Patch vulnerable services.
NUMBERED: Run a full internal audit.
CODE: curl -X GET "https://internal-api.local/health" -H "Authorization: Bearer <token>"
PAGEBREAK:
H2: Appendix
ASCII: +-----------------------+
ASCII: | Incident Flow Diagram |
ASCII: +-----------------------+
"""


PROMPT_FORMAT = (
    "Using strict NotesForge marker syntax (H1-H6, PARAGRAPH, CENTER, RIGHT, JUSTIFY, BULLET, NUMBERED, "
    "TABLE, CODE, ASCII, PAGEBREAK), generate a structured document about '{topic}' for the '{templateName}' template. "
    "Every non-empty line must start with a marker and a colon. No free text lines. "
    "Keep sections concise, include TABLE and CODE where relevant, and produce deterministic output. "
    "Output ONLY NotesForge markers content with no commentary."
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
                aiPromptTemplate="Write a strict marker-based assignment on {topic}: H1, H2, PARAGRAPH, BULLET, TABLE, NUMBERED, CODE. Every non-empty line must begin with a marker.",
                sampleContent=SAMPLE_EXAMPLE,
            ),
            TemplateDefinition(
                id="resume",
                name="Resume",
                description="One page resume layout",
                defaultTheme=PROFESSIONAL_THEME,
                aiPromptTemplate="Generate a strict marker one-page resume for {topic}: H1, H2, PARAGRAPH, BULLET, TABLE (optional). Use marker-prefixed lines only.",
                sampleContent=(
                    "H1: Alex Candidate\n"
                    "H2: Profile\nPARAGRAPH: Product-focused engineer with 5+ years of experience.\n"
                    "H2: Experience\nBULLET: Senior Engineer at Example Corp (2022-Present)\n"
                    "BULLET: Software Engineer at Delta Labs (2019-2022)\n"
                    "H2: Skills\nBULLET: Python, TypeScript, FastAPI, React\n"
                    "H2: Contact\nTABLE: Channel | Value\nTABLE: Email | alex@example.com\nTABLE: Location | Bengaluru, IN\n"
                    "H2: Summary\nPARAGRAPH: Builds reliable platforms with strong communication.\n"
                ),
            ),
            TemplateDefinition(
                id="report",
                name="Report",
                description="Professional report",
                defaultTheme=PROFESSIONAL_THEME,
                aiPromptTemplate="Create a professional strict-marker report for {topic} with H1, H2, PARAGRAPH, TABLE, BULLET, NUMBERED, PAGEBREAK and a conclusion section.",
                sampleContent=(
                    "H1: Professional Report\nH2: Overview\nPARAGRAPH: Scope and objective.\n"
                    "H2: Findings\nTABLE: Item | Status | Notes\nTABLE: Control 1 | Pass | Healthy\n"
                    "H2: Actions\nBULLET: Action one\nBULLET: Action two\n"
                    "PAGEBREAK:\n"
                    "H2: Conclusion\nPARAGRAPH: Final summary.\n"
                ),
            ),
            TemplateDefinition(
                id="meeting",
                name="Meeting Notes",
                description="Meeting minutes template",
                defaultTheme=PROFESSIONAL_THEME,
                aiPromptTemplate="Generate strict marker meeting notes for {topic} using H1, H2, PARAGRAPH, NUMBERED, BULLET, TABLE and PAGEBREAK markers.",
                sampleContent=(
                    "H1: Meeting Notes\nPARAGRAPH: Date, attendees, and purpose.\n"
                    "H2: Agenda\nNUMBERED: Review updates\nNUMBERED: Discuss blockers\n"
                    "H2: Decisions\nTABLE: Decision | Owner | Due\nTABLE: Release milestone approved | PM | 2026-03-15\n"
                    "H2: Action Items\nBULLET: Owner A complete task X by Friday\n"
                ),
            ),
            TemplateDefinition(
                id="cybersec",
                name="Cybersecurity Report",
                description="Incident or audit report for security",
                defaultTheme=PROFESSIONAL_THEME,
                aiPromptTemplate="Write a strict-marker cybersecurity incident report for {topic} including H1, H2, PARAGRAPH, TABLE indicators, BULLET recommendations, CODE IOCs and PAGEBREAK.",
                sampleContent=SAMPLE_EXAMPLE,
            ),
            TemplateDefinition(
                id="technical_notes",
                name="Technical Notes",
                description="Engineering notes with code and diagrams",
                defaultTheme=PROFESSIONAL_THEME,
                aiPromptTemplate="Create strict marker technical notes for {topic} using H1, H2, PARAGRAPH, BULLET, TABLE, CODE, ASCII and optional PAGEBREAK markers.",
                sampleContent=(
                    "H1: Technical Notes - Service Architecture\n"
                    "H2: Summary\nPARAGRAPH: High-level overview of the service architecture.\n"
                    "H2: Components\nBULLET: API Gateway\nBULLET: Auth Service\nBULLET: Data Service\n"
                    "H2: Data Flow\nASCII: +---------+    +---------+    +---------+\n"
                    "ASCII: | Client  | -> |  API    | -> |  Data   |\n"
                    "ASCII: +---------+    +---------+    +---------+\n"
                    "H2: Sample Command\nCODE: curl -X GET https://api.example.com/health\n"
                ),
            ),
            TemplateDefinition(
                id="research_notes",
                name="Research Notes",
                description="Structured research capture with findings",
                defaultTheme=PROFESSIONAL_THEME,
                aiPromptTemplate="Generate strict marker research notes for {topic} using H1, H2, PARAGRAPH, BULLET, TABLE, NUMBERED, CODE where relevant.",
                sampleContent=(
                    "H1: Research Notes - Topic Overview\n"
                    "H2: Objective\nPARAGRAPH: Define the research objective and expected outcome.\n"
                    "H2: Sources\nBULLET: Source A\nBULLET: Source B\n"
                    "H2: Findings\nTABLE: Finding | Evidence | Confidence\nTABLE: F1 | Data set 2026-Q1 | High\n"
                    "H2: Next Steps\nNUMBERED: Validate findings with peer review.\nNUMBERED: Draft final summary.\n"
                ),
            ),
            TemplateDefinition(
                id="interview_prep",
                name="Interview Prep",
                description="Interview preparation template",
                defaultTheme=PROFESSIONAL_THEME,
                aiPromptTemplate="Build strict marker interview prep notes for {topic} with H1, H2, PARAGRAPH, BULLET, NUMBERED, TABLE and CODE markers.",
                sampleContent=(
                    "H1: Interview Preparation - Backend Engineer\n"
                    "H2: Core Topics\nBULLET: API design\nBULLET: Databases\nBULLET: System design\n"
                    "H2: Practice Plan\nNUMBERED: Solve 2 coding problems daily.\nNUMBERED: Review one system design case daily.\n"
                    "H2: Progress Tracker\nTABLE: Week | Focus | Status\nTABLE: 1 | DSA + APIs | In progress\n"
                    "H2: Key Snippet\nCODE: def solve_problem(input_data):\n"
                ),
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
                "H2: Experience\nBULLET: Role at Company A\nBULLET: Role at Company B\n"
                "H2: Skills\nBULLET: Skill 1\nBULLET: Skill 2\n"
                "H2: Summary\nPARAGRAPH: Concise career summary.\n"
            )
        if template_id == "meeting":
            return (
                f"H1: Meeting Minutes — {topic_clean}\n"
                "PARAGRAPH: Meeting objective and attendees.\n"
                "H2: Agenda\nNUMBERED: Opening\nNUMBERED: Discussion\nNUMBERED: Decisions\n"
                "H2: Action Items\nBULLET: Assign owner and due date\n"
            )
        if template_id == "cybersec":
            return SAMPLE_EXAMPLE.replace(
                "NotesForge - Cybersecurity Incident Summary",
                f"NotesForge - {topic_clean} Cybersecurity Report",
            )
        if template_id == "technical_notes":
            return (
                f"H1: Technical Notes - {topic_clean}\n"
                "H2: Overview\nPARAGRAPH: Concise technical summary.\n"
                "H2: Key Points\nBULLET: Point A\nBULLET: Point B\n"
                "H2: Implementation\nCODE: print('implementation sample')\n"
                "H2: Diagram\nASCII: +-------+ -> +-------+\n"
            )
        if template_id == "research_notes":
            return (
                f"H1: Research Notes - {topic_clean}\n"
                "H2: Objective\nPARAGRAPH: Define objective and constraints.\n"
                "H2: Results\nTABLE: Metric | Value | Note\nTABLE: Accuracy | 0.91 | Baseline\n"
                "H2: Next Steps\nNUMBERED: Expand dataset.\nNUMBERED: Compare model variants.\n"
            )
        if template_id == "interview_prep":
            return (
                f"H1: Interview Prep - {topic_clean}\n"
                "H2: Topics\nBULLET: Data structures\nBULLET: System design\n"
                "H2: Plan\nNUMBERED: Daily practice.\nNUMBERED: Mock interview.\n"
                "H2: Snippet\nCODE: def solve(): pass\n"
            )
        # report fallback
        return (
            f"H1: Professional Report — {topic_clean}\n"
            "H2: Executive Summary\nPARAGRAPH: Key objective and scope.\n"
            "H2: Findings\nTABLE: Category | Result | Notes\nTABLE: Risk | Medium | Needs follow-up\n"
            "H2: Recommendations\nBULLET: Recommendation A\nBULLET: Recommendation B\n"
            "H2: Conclusion\nPARAGRAPH: Final concise conclusion.\n"
            "CODE: print('done')\n"
        )
