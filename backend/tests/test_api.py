import unittest
from unittest.mock import patch
import io
import zipfile

from fastapi.testclient import TestClient

from app.main import create_app
from app.templates_repo import SAMPLE_EXAMPLE
from app.themes import PROFESSIONAL_THEME


class ApiIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.client = TestClient(create_app())

    def test_health_endpoints(self) -> None:
        health = self.client.get("/api/health")
        self.assertEqual(health.status_code, 200)
        self.assertEqual(health.json(), {"status": "ok"})

        parser_health = self.client.get("/api/health/parser")
        self.assertEqual(parser_health.status_code, 200)
        self.assertEqual(parser_health.json()["parser"], "ok")

    def test_templates_contract(self) -> None:
        response = self.client.get("/api/templates")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        ids = {item["id"] for item in payload}
        self.assertTrue({"assignment", "resume", "report", "meeting", "cybersec"}.issubset(ids))
        names = {item["name"] for item in payload}
        self.assertTrue(
            {
                "Project Report Template",
                "Research Paper Template",
                "Study Notes Template",
                "Technical Documentation Template",
                "Assignment Template",
            }.issubset(names)
        )

    def test_markers_catalog_contract(self) -> None:
        response = self.client.get("/api/markers")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body.get("success"))
        markers = body.get("markers", [])
        self.assertTrue(isinstance(markers, list) and len(markers) > 10)
        keys = {item.get("key") for item in markers}
        self.assertTrue({"H1", "PARAGRAPH", "TABLE", "ASCII", "FIGURE", "CHAPTER", "PAGEBREAK"}.issubset(keys))
        ascii_item = next((item for item in markers if item.get("key") == "ASCII"), {})
        self.assertIn("DIAGRAM", ascii_item.get("aliases", []))

    def test_themes_include_required_v7_builtins(self) -> None:
        response = self.client.get("/api/themes")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body.get("success"))
        themes = body.get("themes", {})
        names = {v.get("name") for v in themes.values() if isinstance(v, dict)}
        self.assertTrue(
            {
                "Academic Classic",
                "University Blue",
                "Engineering Report",
                "Clean Research",
                "Modern Minimal",
                "Corporate White",
                "Dark Technical",
                "Elegant Thesis",
                "Lecture Notes",
                "Professional Docs",
            }.issubset(names)
        )

    def test_preflight_cors(self) -> None:
        for origin in (
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "https://notes-forge-ruddy.vercel.app",
            "https://notes-forge.onrender.com",
        ):
            response = self.client.options(
                "/api/templates",
                headers={
                    "Origin": origin,
                    "Access-Control-Request-Method": "GET",
                },
            )
            self.assertIn(response.status_code, (200, 204))
            self.assertEqual(response.headers.get("access-control-allow-origin"), origin)

    def test_preflight_cors_rejects_unknown_origin(self) -> None:
        response = self.client.options(
            "/api/templates",
            headers={
                "Origin": "https://malicious.example",
                "Access-Control-Request-Method": "GET",
            },
        )
        self.assertIn(response.status_code, (200, 204, 400))
        self.assertNotEqual(
            response.headers.get("access-control-allow-origin"),
            "https://malicious.example",
        )

    def test_preview_contract(self) -> None:
        response = self.client.post(
            "/api/preview",
            json={
                "content": SAMPLE_EXAMPLE,
                "theme": PROFESSIONAL_THEME.model_dump(),
                "formattingOptions": {
                    "margins": {"top": 25, "bottom": 25, "left": 25, "right": 25},
                    "lineSpacing": 1.4,
                },
                "security": {
                    "removeMetadata": False,
                    "watermark": {"type": "text", "value": "DRAFT", "position": "center"},
                },
            },
        )
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertIn("previewHtml", body)
        self.assertIn("structure", body)
        self.assertGreaterEqual(body["structure"]["headingCount"], 1)

    def test_generate_and_download_docx(self) -> None:
        response = self.client.post(
            "/api/generate",
            json={
                "content": SAMPLE_EXAMPLE,
                "theme": PROFESSIONAL_THEME.model_dump(),
                "format": "docx",
                "filename": "notesforge_output",
                "security": {"disableEditingDocx": False, "removeMetadata": True},
                "templateId": "assignment",
            },
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload.get("success"))
        self.assertIn("downloadUrl", payload)
        self.assertIn("fileId", payload)
        self.assertEqual(payload.get("requestedFormat"), "docx")
        self.assertEqual(payload.get("actualFormat"), "docx")
        self.assertEqual(payload.get("filename"), "notesforge_output.docx")

        download = self.client.get(payload["downloadUrl"])
        self.assertEqual(download.status_code, 200)
        self.assertTrue(
            download.headers["content-type"].startswith(
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            )
        )

    def test_generate_docx_reflects_theme_border_alignment_and_table_styles(self) -> None:
        custom_theme = PROFESSIONAL_THEME.model_dump()
        custom_theme["styles"] = {
            "page_border_enabled": True,
            "page_border_color": "#B91C1C",
            "page_border_width": 2,
            "page_border_style": "double",
            "header_alignment": "left",
            "footer_alignment": "right",
            "page_number_alignment": "right",
            "page_number_position": "footer",
            "footer_color": "#0055AA",
            "header_show_page_numbers": False,
            "footer_show_page_numbers": True,
            "table_header_text": "#FFFFFF",
            "table_odd_row": "#F3EDFF",
        }
        content = 'H1: "Theme Test"\nTABLE: "A | B"\nTABLE: "1 | 2"'
        response = self.client.post(
            "/api/generate",
            json={
                "content": content,
                "theme": custom_theme,
                "format": "docx",
                "filename": "theme_reflect",
                "security": {
                    "headerText": "Header Demo",
                    "footerText": "Footer Demo",
                    "pageNumberMode": "page_x_of_y",
                    "disableEditingDocx": False,
                    "removeMetadata": False,
                },
            },
        )
        self.assertEqual(response.status_code, 200)
        download = self.client.get(response.json()["downloadUrl"])
        self.assertEqual(download.status_code, 200)

        with zipfile.ZipFile(io.BytesIO(download.content)) as archive:
            document_xml = archive.read("word/document.xml").decode("utf-8", "ignore")
            header_xml = archive.read("word/header1.xml").decode("utf-8", "ignore")
            footer_xml = archive.read("word/footer1.xml").decode("utf-8", "ignore")

        document_xml_u = document_xml.upper()
        self.assertIn("W:PGBORDERS", document_xml_u)
        self.assertIn('w:jc w:val="left"', header_xml)
        self.assertIn('w:jc w:val="right"', footer_xml)
        self.assertIn("NUMPAGES", footer_xml)
        self.assertIn("PAGE", footer_xml)
        self.assertIn('w:color w:val="0055AA"', footer_xml)
        self.assertIn('W:FILL="F6F6F6"', document_xml_u)
        self.assertIn('W:FILL="F3EDFF"', document_xml_u)

    def test_generate_and_download_textual_formats(self) -> None:
        for fmt, ctype_prefix in [
            ("html", "text/html"),
            ("md", "text/markdown"),
            ("txt", "text/plain"),
        ]:
            response = self.client.post(
                "/api/generate",
                json={
                    "content": SAMPLE_EXAMPLE,
                    "theme": PROFESSIONAL_THEME.model_dump(),
                    "format": fmt,
                    "filename": f"notesforge_output_{fmt}",
                    "security": {"disableEditingDocx": False, "removeMetadata": False},
                    "templateId": "assignment",
                },
            )
            self.assertEqual(response.status_code, 200)
            payload = response.json()
            self.assertEqual(payload.get("requestedFormat"), fmt)
            self.assertEqual(payload.get("actualFormat"), fmt)
            self.assertTrue(payload.get("filename", "").endswith(f".{fmt}"))
            download = self.client.get(payload["downloadUrl"])
            self.assertEqual(download.status_code, 200)
            self.assertTrue(download.headers["content-type"].startswith(ctype_prefix))

    def test_generate_docx_marker_coverage_justify_ascii_code(self) -> None:
        content = (
            "H1: Main Title\n"
            "H2: Section\n"
            "H3: Subsection\n"
            "H4: Topic\n"
            "H5: Topic 5\n"
            "H6: Topic 6\n"
            "PARAGRAPH: left paragraph\n"
            "CENTER: centered paragraph\n"
            "RIGHT: right paragraph\n"
            "JUSTIFY: this paragraph should be justified\n"
            "with continuation text\n"
            "BULLET: bullet one\n"
            "- bullet two\n"
            "NUMBERED: first item\n"
            "2. second item\n"
            "CODE: print('hello')\n"
            "for i in range(2):\n"
            "    print(i)\n"
            "ASCII: +---+\n"
            "| A |\n"
            "+---+\n"
            "TABLE: Col1 | Col2\n"
            "TABLE: V1 | V2\n"
            "PAGEBREAK:\n"
            "PARAGRAPH: after break\n"
        )
        response = self.client.post(
            "/api/generate",
            json={
                "content": content,
                "theme": PROFESSIONAL_THEME.model_dump(),
                "format": "docx",
                "filename": "marker_coverage",
                "security": {"disableEditingDocx": False, "removeMetadata": False},
            },
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload.get("requestedFormat"), "docx")
        self.assertEqual(payload.get("actualFormat"), "docx")

        download = self.client.get(payload["downloadUrl"])
        self.assertEqual(download.status_code, 200)
        with zipfile.ZipFile(io.BytesIO(download.content)) as archive:
            document_xml = archive.read("word/document.xml").decode("utf-8", "ignore")

        self.assertIn("this paragraph should be justified", document_xml)
        self.assertIn("with continuation text", document_xml)
        self.assertIn("print('hello')", document_xml)
        self.assertIn("+---+", document_xml)
        self.assertIn("| A |", document_xml)
        self.assertIn("Col1", document_xml)
        self.assertIn("V1", document_xml)
        self.assertIn("after break", document_xml)
        self.assertIn('w:jc w:val="both"', document_xml)

    def test_config_endpoints(self) -> None:
        current = self.client.get("/api/config")
        self.assertEqual(current.status_code, 200)
        body = current.json()
        self.assertTrue(body.get("success"))
        self.assertIn("config", body)

        update = self.client.post(
            "/api/config/update",
            json={"path": "spacing.line_spacing", "value": 1.6},
        )
        self.assertEqual(update.status_code, 200)
        self.assertEqual(update.json(), {"success": True})

        after = self.client.get("/api/config")
        self.assertEqual(after.status_code, 200)
        self.assertEqual(after.json()["config"]["spacing"]["line_spacing"], 1.6)

        tab_update = self.client.post(
            "/api/config/update",
            json={"path": "spacing.tab_width", "value": 8},
        )
        self.assertEqual(tab_update.status_code, 200)
        after_tab = self.client.get("/api/config")
        self.assertEqual(after_tab.status_code, 200)
        self.assertEqual(after_tab.json()["config"]["spacing"]["tab_width"], 8)

    def test_apply_theme_updates_config(self) -> None:
        applied = self.client.post(
            "/api/themes/apply",
            json={"theme_name": "corporate"},
        )
        self.assertEqual(applied.status_code, 200)
        payload = applied.json()
        self.assertTrue(payload.get("success"))
        cfg = payload.get("config", {})
        self.assertEqual(cfg.get("app", {}).get("theme"), "corporate")
        self.assertEqual(cfg.get("fonts", {}).get("family"), "Arial")
        self.assertEqual(cfg.get("colors", {}).get("h1"), "#C41E3A")

    @patch("app.exporter._convert_docx_to_pdf", return_value=(False, "converter unavailable"))
    @patch("app.exporter._convert_html_to_pdf_weasyprint", return_value=(False, "weasy unavailable"))
    @patch("app.exporter._convert_nodes_to_pdf_reportlab", return_value=(False, "reportlab unavailable"))
    def test_generate_pdf_fallback_contract(self, _mock_reportlab, _mock_weasy, _mock_docx) -> None:
        response = self.client.post(
            "/api/generate",
            json={
                "content": SAMPLE_EXAMPLE,
                "theme": PROFESSIONAL_THEME.model_dump(),
                "format": "pdf",
                "filename": "notesforge_output",
                "security": {"disableEditingDocx": False, "removeMetadata": True},
                "templateId": "assignment",
            },
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload.get("requestedFormat"), "pdf")
        self.assertEqual(payload.get("actualFormat"), "pdf")
        joined_warnings = " | ".join(payload.get("warnings") or [])
        self.assertIn("fallback renderer", joined_warnings.lower())
        self.assertTrue(payload.get("downloadUrl", "").startswith("/api/download/"))
        dl = self.client.get(payload["downloadUrl"])
        self.assertEqual(dl.status_code, 200)
        self.assertTrue(dl.headers["content-type"].startswith("application/pdf"))

    def test_download_rejects_non_token_path(self) -> None:
        response = self.client.get("/api/download/../../etc/passwd")
        self.assertIn(response.status_code, (404, 422))


if __name__ == "__main__":
    unittest.main()
