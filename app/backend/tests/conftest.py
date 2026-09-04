"""
Shared test setup.

This repo had no committed test suite before this - `pytest`/`pytest-asyncio`/
`httpx` were dependencies with nothing exercising them, confirmed by
searching for test files at the start of this work. Two deliberate choices,
given that starting point and the scope agreed for this pass ("targeted
tests for CEIM/NG112, not a full suite matching every existing endpoint"):

1. `.env` is loaded into process env vars here, at collection time, mirroring
   the manual pattern used throughout this project's development (see
   app/start.ps1's Import-DotEnv) - `core/config.py`'s Settings reads
   `os.environ` directly and does NOT load .env itself, so importing
   `main`/`core.config` without this would fail exactly as it does when the
   backend is started without the env pre-loaded.

2. Tests that need a live server, a real Postgres DB, or real external
   network (Ollama, the OASIS schema servers) are marked `@pytest.mark.integration`
   and hit the actual dev server this project already runs on
   `http://127.0.0.1:8001`, rather than spinning up an isolated ASGI test
   client - matching how every verification in this project's development
   session was actually done, and skip gracefully (not fail) if that server,
   Ollama, or the network isn't reachable, so `pytest` still passes cleanly
   in an environment where those aren't running.
"""

import os
import re
from pathlib import Path

import pytest

_BACKEND_ROOT = Path(__file__).resolve().parent.parent
_ENV_PATH = _BACKEND_ROOT / ".env"

if _ENV_PATH.exists():
    for _line in _ENV_PATH.read_text(encoding="utf-8").splitlines():
        _match = re.match(r"^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$", _line)
        if _match:
            os.environ.setdefault(_match.group(1).strip(), _match.group(2).strip())

API_BASE = "http://127.0.0.1:8001"


@pytest.fixture(scope="session")
def api_base() -> str:
    return API_BASE


@pytest.fixture(scope="session")
def require_dev_server():
    """Skip the test if the project's dev server isn't running, rather than
    failing - this is an integration check against a real process, not
    something CI can spin up on its own without also running Postgres and
    the backend."""
    import httpx

    try:
        r = httpx.get(f"{API_BASE}/health", timeout=3.0)
        if r.status_code != 200:
            pytest.skip(f"dev server at {API_BASE} responded {r.status_code}, not 200")
    except httpx.HTTPError as exc:
        pytest.skip(f"dev server at {API_BASE} is not reachable: {exc}")
