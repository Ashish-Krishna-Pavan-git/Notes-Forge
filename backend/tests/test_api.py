import unittest
from unittest.mock import patch

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

    def test_preflight_cors(self) -> None:
        response = self.client.options(
            "/api/templates",
            headers={
                "Origin": "https://notes-forge-ruddy.vercel.app",
                "Access-Control-Request-Method": "GET",
            },
        )
        self.assertIn(response.status_code, (200, 204))
        self.assertEqual(
            response.headers.get("access-control-allow-origin"),
            "https://notes-forge-ruddy.vercel.app",
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
        self.assertEqual(cfg.get("colors", {}).get("h1"), "#B91C1C")

    @patch("app.exporter._convert_docx_to_pdf", return_value=(False, "converter unavailable"))
    @patch("app.exporter._convert_html_to_pdf_weasyprint", return_value=(False, "weasyprint unavailable"))
    def test_generate_pdf_fallback_contract(self, _mock_weasy, _mock_docx) -> None:
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
        self.assertEqual(payload.get("actualFormat"), "docx")
        self.assertTrue(payload.get("warning"))
        self.assertIn("PDF conversion", payload.get("warning", ""))

        download = self.client.get(payload["downloadUrl"])
        self.assertEqual(download.status_code, 200)
        self.assertTrue(
            download.headers["content-type"].startswith(
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            )
        )


if __name__ == "__main__":
    unittest.main()
