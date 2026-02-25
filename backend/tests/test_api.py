import unittest

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
        self.assertIn("downloadUrl", payload)
        self.assertIn("fileId", payload)

        download = self.client.get(payload["downloadUrl"])
        self.assertEqual(download.status_code, 200)
        self.assertTrue(
            download.headers["content-type"].startswith(
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            )
        )


if __name__ == "__main__":
    unittest.main()
