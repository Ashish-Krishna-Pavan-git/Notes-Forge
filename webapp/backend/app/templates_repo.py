from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List

from .models import RegenerateTemplateRequest, TemplateDefinition
from .themes import PROFESSIONAL_THEME


SAMPLE_EXAMPLE = """COVER_PAGE: NotesForge - Cybersecurity Incident Summary
ABSTRACT_PAGE: Concise incident abstract with impact and containment status.
TOC:
LOT:
LOF:
CHAPTER: Executive Summary
BODY: A brief summary of the incident, impact, and immediate actions.
Continue the same BODY block on the next line without repeating the marker.
CHAPTER: Timeline and Details
BODY: Incident started on 2026-02-24 22:15 IST and affected API and DB services.
BULLET: Initial detection via IDS alert.
BULLET: \\tSOC escalation and triage.
BULLET: \\tHost isolation and forensic snapshot.
CHAPTER: Indicators of Compromise
TABLE: Type | Value | Notes
TABLE: IP | 203.0.113.45 | Suspicious outbound traffic
TABLE: Hash | e3b0c442... | Malware sample hash
CAPTION: IOCs captured during containment
FIGURE: https://example.com/incident-flow.png | Incident flow | center | 80
CHAPTER: Containment Commands
CODE: curl -X GET "https://internal-api.local/health" -H "Authorization: Bearer <token>"
docker compose logs api --tail 100
PAGEBREAK:
REFERENCES:
REFERENCE: [1] SOC Incident Runbook
APPENDIX: Diagram
DIAGRAM: +-----------------------+
| Incident Flow Diagram |
+-----------------------+
CAPTION: Incident flow diagram
"""


PROMPT_FORMAT = (
    "Using NotesForge v10 starter syntax, generate a structured document about '{topic}' for the "
    "'{templateName}' template. Prefer this starter marker set first: H1-H6, BODY/PARAGRAPH/PARA, BULLET, NUMBERED, "
    "CODE, TABLE, IMAGE, FIGURE, DIAGRAM, HIGHLIGHT, CAPTION, TOC, LOT, LOF, CHAPTER, REFERENCES, REFERENCE, APPENDIX, "
    "PAGEBREAK. Optional advanced markers like TIP, WARNING, INFO, SUCCESS, CHECKLIST, EQUATION, and SEPARATOR may be "
    "used only when they clearly help. Start each new block with MARKER: payload, then keep all following non-marker lines "
    "inside that same block until the next marker appears. Apply this sticky-block rule especially to H1-H6, BODY, CAPTION, "
    "REFERENCE, CODE, and DIAGRAM. Preserve tabs and indentation inside CODE/DIAGRAM blocks. NUMBERED items should auto-flow; "
    "do not waste tokens on manual 1/2/3 prefixes unless the numbering text itself matters. Use CAPTION immediately after "
    "TABLE/IMAGE/FIGURE/DIAGRAM when a caption is needed. Output ONLY marker lines with no commentary."
)


@dataclass
class TemplateRepo:
    templates: Dict[str, TemplateDefinition]

    @classmethod
    def build_default(cls) -> "TemplateRepo":
        items = [
            TemplateDefinition(
                id="quickstart_starter_template",
                name="Quick Start Starter",
                description="Smallest useful template for first-time users learning the starter markers.",
                defaultTheme=PROFESSIONAL_THEME,
                sampleContent=(
                    "H1: My First NotesForge File\n"
                    "Sticky heading line that stays in the same H1 block.\n"
                    "BODY: Write your opening summary here.\n"
                    "Continue on the next line without repeating BODY.\n"
                    "H2: Key Points\n"
                    "This line is still part of the same H2 block.\n"
                    "BULLET: First important point\n"
                    "\tNested point can start with a tab.\n"
                    "H2: Steps\n"
                    "NUMBERED: Draft the content\n"
                    "NUMBERED: Review the preview\n"
                    "NUMBERED: Export to DOCX or PDF\n"
                    "H2: Data Table\n"
                    "TABLE: Item | Value | Notes\n"
                    "TABLE: Example | 42 | Replace this row\n"
                    "CAPTION: Starter table\n"
                    "H2: Simple Diagram\n"
                    "DIAGRAM: +------------------+\n"
                    "|  Start Here      |\n"
                    "+------------------+\n"
                    "        |\n"
                    "        v\n"
                    "+------------------+\n"
                    "|  Finish Here     |\n"
                    "+------------------+\n"
                    "CAPTION: Starter diagram\n"
                ),
                aiPromptTemplate="Generate a beginner-friendly NotesForge starter document for {topic} using sticky H1/H2, BODY, BULLET, NUMBERED, TABLE, CAPTION and DIAGRAM blocks with tab-safe indentation.",
                layout={
                    "headers": True,
                    "footers": True,
                    "page_numbers": "page_x",
                    "table_style": "starter",
                    "chapter_layout": "starter",
                    "margins": "A4 standard",
                    "spacing": 1.25,
                    "title_format": "starter",
                },
                guideSteps=[
                    "Start each section once with H1/H2 or BODY, then keep writing until the next marker appears.",
                    "Use CAPTION right after a TABLE, IMAGE, FIGURE or DIAGRAM.",
                    "Use NUMBERED without manual counting unless you need a custom label.",
                ],
            ),
            TemplateDefinition(
                id="project_report_template",
                name="Project Report Template",
                description="Professional project report with academic front matter and chapters.",
                defaultTheme=PROFESSIONAL_THEME,
                sampleContent=(
                    "COVER_PAGE: Project Report\n"
                    "CERTIFICATE_PAGE: Certified that this project report is submitted by [Student Name].\n"
                    "DECLARATION_PAGE: I hereby declare that this work is original.\n"
                    "ACKNOWLEDGEMENT_PAGE: I thank my mentors and institution.\n"
                    "ABSTRACT_PAGE: Brief abstract of the project objective and outcomes.\n"
                    "TOC:\n"
                    "LOT:\n"
                    "LOF:\n"
                    "CHAPTER: Introduction\n"
                    "BODY: This chapter introduces the project scope and goals.\n"
                    "Continue the introduction without repeating BODY.\n"
                    "CHAPTER: Implementation\n"
                    "TABLE: Module | Status | Notes\n"
                    "TABLE: Parser | Complete | Marker handling implemented\n"
                    "CAPTION: Implementation status table\n"
                    "FIGURE: https://example.com/architecture.png | System architecture | center | 80\n"
                    "CHAPTER: Conclusion\n"
                    "BODY: Final project summary and future work.\n"
                    "Add one closing line in the same BODY block.\n"
                    "REFERENCES:\n"
                    "REFERENCE: [1] IEEE reference entry.\n"
                    "APPENDIX: Additional Data\n"
                ),
                aiPromptTemplate="Generate a beginner-friendly project report for {topic} using sticky BODY/H1/H2 style blocks, TOC, LOT, LOF, chapter sections, figures, tables, references and appendix.",
                layout={
                    "cover_page": True,
                    "headers": True,
                    "footers": True,
                    "page_numbers": "page_x_of_y",
                    "table_style": "professional",
                    "chapter_layout": "chapter_first",
                    "margins": "A4 standard",
                    "spacing": 1.5,
                    "title_format": "academic",
                },
                guideSteps=[
                    "Fill project title and metadata in front matter markers.",
                    "Update chapter content and table/figure captions.",
                    "Add references and appendix before export.",
                ],
            ),
            TemplateDefinition(
                id="research_paper_template",
                name="Research Paper Template",
                description="Research manuscript structure with abstract, chapters and references.",
                defaultTheme=PROFESSIONAL_THEME,
                sampleContent=(
                    "COVER_PAGE: Research Paper\n"
                    "ABSTRACT_PAGE: Abstract with objective, method and key findings.\n"
                    "TOC:\n"
                    "CHAPTER: Introduction\n"
                    "BODY: Background and motivation.\n"
                    "CHAPTER: Methodology\n"
                    "BODY: Method, datasets and evaluation process.\n"
                    "CHAPTER: Results\n"
                    "TABLE: Metric | Value\n"
                    "TABLE: Accuracy | 0.94\n"
                    "CAPTION: Evaluation results\n"
                    "FIGURE: https://example.com/confusion-matrix.png | Confusion matrix overview | center | 78\n"
                    "CHAPTER: Discussion\n"
                    "BODY: Interpretation of findings and limitations.\n"
                    "REFERENCES:\n"
                    "REFERENCE: [1] Journal article citation.\n"
                ),
                aiPromptTemplate="Generate a structured research paper for {topic} with BODY, CAPTION, methodology, results, discussion and references.",
                layout={
                    "cover_page": True,
                    "headers": True,
                    "footers": True,
                    "page_numbers": "page_x_of_y",
                    "table_style": "research",
                    "chapter_layout": "academic",
                    "margins": "A4 standard",
                    "spacing": 1.5,
                    "title_format": "research",
                },
                guideSteps=[
                    "Write abstract first, then chapter sections.",
                    "Place tables/figures with captions near discussion points.",
                    "Finalize references before submission export.",
                ],
            ),
            TemplateDefinition(
                id="study_notes_template",
                name="Study Notes Template",
                description="Organized lecture/study notes template with chapter-wise structure.",
                defaultTheme=PROFESSIONAL_THEME,
                sampleContent=(
                    "COVER_PAGE: Study Notes\n"
                    "TOC:\n"
                    "CHAPTER: Core Concepts\n"
                    "BULLET: Concept 1 summary\n"
                    "\tNested memory hook for concept 1\n"
                    "BULLET: Concept 2 summary\n"
                    "CHAPTER: Examples\n"
                    "NUMBERED: Worked example one\n"
                    "NUMBERED: Worked example two\n"
                    "TABLE: Topic | Key Formula | Comment\n"
                    "TABLE: Networking | Throughput = Data / Time | Core formula\n"
                    "CAPTION: Formula reference table\n"
                    "APPENDIX: Quick Revision Cards\n"
                ),
                aiPromptTemplate="Generate chapter-wise study notes for {topic} using BODY, BULLET, NUMBERED, TABLE and CAPTION with a quick revision appendix.",
                layout={
                    "cover_page": True,
                    "headers": True,
                    "footers": True,
                    "page_numbers": "page_x",
                    "table_style": "lecture",
                    "chapter_layout": "notes",
                    "margins": "A4 compact",
                    "spacing": 1.15,
                    "title_format": "notes",
                },
                guideSteps=[
                    "Break syllabus into chapters.",
                    "Keep bullet notes concise and exam-focused.",
                    "Use appendix for quick revision points.",
                ],
            ),
            TemplateDefinition(
                id="technical_documentation_template",
                name="Technical Documentation Template",
                description="Technical documentation layout with architecture, procedures and references.",
                defaultTheme=PROFESSIONAL_THEME,
                sampleContent=(
                    "COVER_PAGE: Technical Documentation\n"
                    "TOC:\n"
                    "CHAPTER: Overview\n"
                    "BODY: Scope and intended audience.\n"
                    "Continue the overview in the same BODY block.\n"
                    "CHAPTER: Architecture\n"
                    "FIGURE: https://example.com/service-map.png | Service interaction map | center | 75\n"
                    "CHAPTER: API Reference\n"
                    "TABLE: Endpoint | Method | Purpose\n"
                    "TABLE: /api/preview | POST | Generate live preview\n"
                    "CAPTION: API endpoint reference\n"
                    "CHAPTER: Operations\n"
                    "CODE: docker compose up --build\n"
                    "REFERENCES:\n"
                    "REFERENCE: [1] Internal standards document.\n"
                ),
                aiPromptTemplate="Generate starter-friendly technical documentation for {topic} using BODY, TABLE, CAPTION, FIGURE, CODE and REFERENCES markers.",
                layout={
                    "cover_page": True,
                    "headers": True,
                    "footers": True,
                    "page_numbers": "page_x",
                    "table_style": "technical",
                    "chapter_layout": "technical",
                    "margins": "A4 standard",
                    "spacing": 1.15,
                    "title_format": "technical",
                },
                guideSteps=[
                    "Document architecture before API details.",
                    "Keep command blocks executable and minimal.",
                    "Include references for external dependencies.",
                ],
            ),
            TemplateDefinition(
                id="assignment_template",
                name="Assignment Template",
                description="Formal assignment format with declaration, chapters and references.",
                defaultTheme=PROFESSIONAL_THEME,
                sampleContent=(
                    "COVER_PAGE: Assignment\n"
                    "DECLARATION_PAGE: This assignment is submitted as original work.\n"
                    "TOC:\n"
                    "CHAPTER: Problem Statement\n"
                    "BODY: Define assignment objective and constraints.\n"
                    "Add another line in the same BODY block.\n"
                    "CHAPTER: Solution\n"
                    "BODY: Present method and explanation.\n"
                    "TABLE: Criteria | Outcome\n"
                    "TABLE: Correctness | Satisfied\n"
                    "CAPTION: Evaluation criteria\n"
                    "CHAPTER: Conclusion\n"
                    "BODY: Summarize final learning outcomes.\n"
                    "REFERENCES:\n"
                    "REFERENCE: [1] Course reference book.\n"
                ),
                aiPromptTemplate="Generate starter-friendly assignment content for {topic} with BODY, TABLE, CAPTION and REFERENCES markers.",
                layout={
                    "cover_page": True,
                    "headers": True,
                    "footers": True,
                    "page_numbers": "page_x",
                    "table_style": "assignment",
                    "chapter_layout": "assignment",
                    "margins": "A4 standard",
                    "spacing": 1.5,
                    "title_format": "assignment",
                },
                guideSteps=[
                    "Define the assignment question clearly.",
                    "Explain the solution in chapter-wise format.",
                    "Add references to official sources.",
                ],
            ),
            TemplateDefinition(
                id="assignment",
                name="Assignment",
                description="Academic assignment/report layout",
                defaultTheme=PROFESSIONAL_THEME,
                aiPromptTemplate="Write a starter-friendly assignment on {topic}: H1, H2, BODY, BULLET, TABLE, CAPTION, NUMBERED and CODE.",
                sampleContent=SAMPLE_EXAMPLE,
            ),
            TemplateDefinition(
                id="resume",
                name="Resume",
                description="One page resume layout",
                defaultTheme=PROFESSIONAL_THEME,
                aiPromptTemplate="Generate a one-page resume for {topic} using H1, H2, BODY, BULLET and optional TABLE markers.",
                sampleContent=(
                    "H1: Alex Candidate\n"
                    "H2: Profile\nBODY: Product-focused engineer with 5+ years of experience.\n"
                    "H2: Experience\nBULLET: Senior Engineer at Example Corp (2022-Present)\n"
                    "BULLET: Software Engineer at Delta Labs (2019-2022)\n"
                    "H2: Skills\nBULLET: Python, TypeScript, FastAPI, React\n"
                    "H2: Contact\nTABLE: Channel | Value\nTABLE: Email | alex@example.com\nTABLE: Location | Bengaluru, IN\n"
                    "H2: Summary\nBODY: Builds reliable platforms with strong communication.\n"
                ),
            ),
            TemplateDefinition(
                id="report",
                name="Report",
                description="Professional report",
                defaultTheme=PROFESSIONAL_THEME,
                aiPromptTemplate="Create a professional report for {topic} with H1, H2, BODY, TABLE, CAPTION, BULLET, NUMBERED and PAGEBREAK.",
                sampleContent=(
                    "H1: Professional Report\nH2: Overview\nBODY: Scope and objective.\n"
                    "H2: Findings\nTABLE: Item | Status | Notes\nTABLE: Control 1 | Pass | Healthy\n"
                    "CAPTION: Findings summary\n"
                    "H2: Actions\nBULLET: Action one\nBULLET: Action two\n"
                    "PAGEBREAK:\n"
                    "H2: Conclusion\nBODY: Final summary.\n"
                ),
            ),
            TemplateDefinition(
                id="meeting",
                name="Meeting Notes",
                description="Meeting minutes template",
                defaultTheme=PROFESSIONAL_THEME,
                aiPromptTemplate="Generate meeting notes for {topic} using H1, H2, BODY, NUMBERED, BULLET, TABLE and CAPTION markers.",
                sampleContent=(
                    "H1: Meeting Notes\nBODY: Date, attendees, and purpose.\n"
                    "H2: Agenda\nNUMBERED: Review updates\nNUMBERED: Discuss blockers\n"
                    "H2: Decisions\nTABLE: Decision | Owner | Due\nTABLE: Release milestone approved | PM | 2026-03-15\n"
                    "CAPTION: Decisions tracker\n"
                    "H2: Action Items\nBULLET: Owner A complete task X by Friday\n"
                ),
            ),
            TemplateDefinition(
                id="cybersec",
                name="Cybersecurity Report",
                description="Incident or audit report for security",
                defaultTheme=PROFESSIONAL_THEME,
                aiPromptTemplate="Write a cybersecurity incident report for {topic} including H1, H2, BODY, TABLE, CAPTION, BULLET, CODE and PAGEBREAK.",
                sampleContent=SAMPLE_EXAMPLE,
            ),
            TemplateDefinition(
                id="technical_notes",
                name="Technical Notes",
                description="Engineering notes with code and diagrams",
                defaultTheme=PROFESSIONAL_THEME,
                aiPromptTemplate="Create technical notes for {topic} using H1, H2, BODY, BULLET, TABLE, CODE, DIAGRAM and optional PAGEBREAK markers.",
                sampleContent=(
                    "H1: Technical Notes - Service Architecture\n"
                    "H2: Summary\nBODY: High-level overview of the service architecture.\n"
                    "H2: Components\nBULLET: API Gateway\nBULLET: Auth Service\nBULLET: Data Service\n"
                    "H2: Data Flow\nDIAGRAM: +---------+    +---------+    +---------+\n"
                    "DIAGRAM: | Client  | -> |  API    | -> |  Data   |\n"
                    "DIAGRAM: +---------+    +---------+    +---------+\n"
                    "CAPTION: Service flow\n"
                    "H2: Sample Command\nCODE: curl -X GET https://api.example.com/health\n"
                ),
            ),
            TemplateDefinition(
                id="research_notes",
                name="Research Notes",
                description="Structured research capture with findings",
                defaultTheme=PROFESSIONAL_THEME,
                aiPromptTemplate="Generate research notes for {topic} using H1, H2, BODY, BULLET, TABLE, CAPTION and NUMBERED markers.",
                sampleContent=(
                    "H1: Research Notes - Topic Overview\n"
                    "H2: Objective\nBODY: Define the research objective and expected outcome.\n"
                    "H2: Sources\nBULLET: Source A\nBULLET: Source B\n"
                    "H2: Findings\nTABLE: Finding | Evidence | Confidence\nTABLE: F1 | Data set 2026-Q1 | High\n"
                    "CAPTION: Findings summary\n"
                    "H2: Next Steps\nNUMBERED: Validate findings with peer review.\nNUMBERED: Draft final summary.\n"
                ),
            ),
            TemplateDefinition(
                id="interview_prep",
                name="Interview Prep",
                description="Interview preparation template",
                defaultTheme=PROFESSIONAL_THEME,
                aiPromptTemplate="Build interview prep notes for {topic} with H1, H2, BODY, BULLET, NUMBERED, TABLE and CODE markers.",
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
        if template_id == "project_report_template":
            return (
                f"COVER_PAGE: {topic_clean} Project Report\n"
                "TOC:\nLOT:\nLOF:\n"
                "CHAPTER: Introduction\nBODY: Concise project overview.\n"
                "CHAPTER: Design\nTABLE: Component | Status\nTABLE: Parser | Complete\nCAPTION: Component status\n"
                "CHAPTER: Result\nFIGURE: https://example.com/final-diagram.png | Final implementation diagram | center | 80\n"
                "REFERENCES:\nREFERENCE: [1] Official reference source.\n"
            )
        if template_id == "research_paper_template":
            return (
                f"COVER_PAGE: {topic_clean} Research Paper\n"
                "ABSTRACT_PAGE: Abstract of objective, method and findings.\n"
                "TOC:\nCHAPTER: Introduction\nBODY: Research motivation.\n"
                "CHAPTER: Methodology\nBODY: Method details.\n"
                "CHAPTER: Results\nTABLE: Metric | Value\nTABLE: Accuracy | 0.90\nCAPTION: Results summary\n"
                "REFERENCES:\nREFERENCE: [1] Journal source.\n"
            )
        if template_id == "study_notes_template":
            return (
                f"COVER_PAGE: Study Notes - {topic_clean}\n"
                "TOC:\nCHAPTER: Key Concepts\nBULLET: Core concept one\nBULLET: Core concept two\n"
                "CHAPTER: Practice\nNUMBERED: Solve one problem\nNUMBERED: Review solutions\n"
                "APPENDIX: Quick Revision\n"
            )
        if template_id == "technical_documentation_template":
            return (
                f"COVER_PAGE: Technical Documentation - {topic_clean}\n"
                "TOC:\nCHAPTER: Overview\nBODY: Scope and audience.\n"
                "CHAPTER: API\nTABLE: Endpoint | Method\nTABLE: /api/health | GET\nCAPTION: API surface\n"
                "CHAPTER: Operations\nCODE: docker compose up --build\n"
                "REFERENCES:\nREFERENCE: [1] Internal standards.\n"
            )
        if template_id == "assignment_template":
            return (
                f"COVER_PAGE: {topic_clean} Assignment\nDECLARATION_PAGE: I declare this submission is my work.\n"
                "TOC:\nCHAPTER: Problem Statement\nBODY: Assignment objective.\n"
                "CHAPTER: Solution\nBODY: Solution details.\n"
                "REFERENCES:\nREFERENCE: [1] Course material.\n"
            )
        if template_id == "assignment":
            return SAMPLE_EXAMPLE.replace(
                "NotesForge — Cybersecurity Incident Summary",
                f"NotesForge — {topic_clean} Assignment",
            )
        if template_id == "resume":
            return (
                f"H1: {topic_clean} Resume\n"
                "H2: Profile\nBODY: Results-driven professional profile.\n"
                "H2: Experience\nBULLET: Role at Company A\nBULLET: Role at Company B\n"
                "H2: Skills\nBULLET: Skill 1\nBULLET: Skill 2\n"
                "H2: Summary\nBODY: Concise career summary.\n"
            )
        if template_id == "meeting":
            return (
                f"H1: Meeting Minutes — {topic_clean}\n"
                "BODY: Meeting objective and attendees.\n"
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
                "H2: Overview\nBODY: Concise technical summary.\n"
                "H2: Key Points\nBULLET: Point A\nBULLET: Point B\n"
                "H2: Implementation\nCODE: print('implementation sample')\n"
                "H2: Diagram\nDIAGRAM: +-------+ -> +-------+\n"
            )
        if template_id == "research_notes":
            return (
                f"H1: Research Notes - {topic_clean}\n"
                "H2: Objective\nBODY: Define objective and constraints.\n"
                "H2: Results\nTABLE: Metric | Value | Note\nTABLE: Accuracy | 0.91 | Baseline\nCAPTION: Results baseline\n"
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
            "H2: Executive Summary\nBODY: Key objective and scope.\n"
            "H2: Findings\nTABLE: Category | Result | Notes\nTABLE: Risk | Medium | Needs follow-up\n"
            "CAPTION: Findings overview\n"
            "H2: Recommendations\nBULLET: Recommendation A\nBULLET: Recommendation B\n"
            "H2: Conclusion\nBODY: Final concise conclusion.\n"
            "CODE: print('done')\n"
        )
