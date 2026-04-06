import unittest

from fastapi.testclient import TestClient

import backend_server


class BackendServerContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(backend_server.app)

    def test_health_endpoints(self):
        r1 = self.client.get("/api/health")
        self.assertEqual(r1.status_code, 200)
        self.assertEqual(r1.json().get("status"), "ok")

        r2 = self.client.get("/api/health/parser")
        self.assertEqual(r2.status_code, 200)
        self.assertEqual(r2.json().get("parser"), "ok")

    def test_templates_endpoint(self):
        r = self.client.get("/api/templates")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertIsInstance(data, list)
        self.assertGreaterEqual(len(data), 5)

    def test_preview_warning_contract(self):
        payload = {
            "content": "TABLE:\nPARAGRAPH: tail",
            "theme": {},
            "formattingOptions": {},
            "security": {},
        }
        r = self.client.post("/api/preview", json=payload)
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertIn("warnings", body)
        self.assertGreaterEqual(len(body["warnings"]), 1)


if __name__ == "__main__":
    unittest.main()
