from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass


@dataclass
class CheckResult:
    ok: bool
    name: str
    detail: str


def _get_json(url: str, timeout: int = 30) -> tuple[int, dict]:
    req = urllib.request.Request(url, method="GET")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        body = resp.read().decode("utf-8")
        return resp.status, json.loads(body)


def _post_json(url: str, payload: dict, timeout: int = 60) -> tuple[int, dict]:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        method="POST",
        data=data,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        body = resp.read().decode("utf-8")
        return resp.status, json.loads(body)


def _check_health(base: str) -> CheckResult:
    status, payload = _get_json(f"{base}/api/health")
    ok = status == 200 and payload.get("status") == "ok"
    return CheckResult(ok, "GET /api/health", f"status={status} payload={payload}")


def _check_config(base: str) -> CheckResult:
    status, payload = _get_json(f"{base}/api/config")
    ok = status == 200 and payload.get("success") is True and isinstance(payload.get("config"), dict)
    return CheckResult(ok, "GET /api/config", f"status={status} keys={list(payload.keys())}")


def _check_config_update(base: str) -> CheckResult:
    status, payload = _post_json(
        f"{base}/api/config/update",
        {"path": "app.contract_probe", "value": "ok"},
    )
    ok = status == 200 and payload.get("success") is True
    return CheckResult(ok, "POST /api/config/update", f"status={status} payload={payload}")


def _check_templates(base: str) -> CheckResult:
    status, payload = _get_json(f"{base}/api/templates")
    ok = status == 200 and isinstance(payload, list) and len(payload) > 0
    return CheckResult(ok, "GET /api/templates", f"status={status} count={len(payload) if isinstance(payload, list) else 'n/a'}")


def _check_generate_pdf(base: str) -> CheckResult:
    payload = {
        "content": "H1: Contract Probe\nPARAGRAPH: PDF generation contract check.",
        "theme": {
            "name": "Professional",
            "primaryColor": "#1F3A5F",
            "fontFamily": "Calibri, Arial, sans-serif",
            "headingStyle": {},
            "bodyStyle": {},
            "tableStyle": {},
            "margins": {"top": 25, "bottom": 25, "left": 25, "right": 25},
        },
        "format": "pdf",
        "filename": "contract_probe",
        "security": {},
    }
    status, result = _post_json(f"{base}/api/generate", payload)
    required = {
        "success",
        "downloadUrl",
        "fileId",
        "filename",
        "requestedFormat",
        "actualFormat",
        "warning",
        "warnings",
    }
    if status != 200:
        return CheckResult(False, "POST /api/generate", f"status={status} payload={result}")
    if not required.issubset(result.keys()):
        missing = sorted(required - set(result.keys()))
        return CheckResult(False, "POST /api/generate", f"missing keys={missing} payload={result}")

    download_url = f"{base}{result['downloadUrl']}"
    req = urllib.request.Request(download_url, method="GET")
    with urllib.request.urlopen(req, timeout=60) as download:
        content_type = (download.headers.get("Content-Type") or "").lower()
        _ = download.read(32)

    actual = (result.get("actualFormat") or "").lower()
    warning = (result.get("warning") or "").lower()
    if actual == "pdf":
        ok = "application/pdf" in content_type
    elif actual == "docx":
        ok = "application/vnd.openxmlformats-officedocument.wordprocessingml.document" in content_type
        ok = ok and ("pdf conversion" in warning or "fallback" in warning)
    else:
        ok = False

    detail = (
        f"status={status} actualFormat={result.get('actualFormat')} "
        f"contentType={content_type} warning={result.get('warning')}"
    )
    return CheckResult(ok, "POST /api/generate (pdf contract)", detail)


def main() -> int:
    base = (sys.argv[1] if len(sys.argv) > 1 else "https://notes-forge.onrender.com").rstrip("/")
    checks: list[CheckResult] = []

    check_fns = [
        _check_health,
        _check_config,
        _check_config_update,
        _check_templates,
        _check_generate_pdf,
    ]
    for fn in check_fns:
        name = fn.__name__.replace("_check_", "").replace("_", " ")
        try:
            checks.append(fn(base))
        except urllib.error.HTTPError as exc:
            checks.append(CheckResult(False, name, f"HTTP {exc.code}: {exc.reason}"))
        except Exception as exc:
            checks.append(CheckResult(False, name, str(exc)))

    failed = [c for c in checks if not c.ok]
    for check in checks:
        prefix = "PASS" if check.ok else "FAIL"
        print(f"[{prefix}] {check.name} :: {check.detail}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
