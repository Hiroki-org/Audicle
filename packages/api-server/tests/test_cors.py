import pytest
import os
import sys
import importlib
from fastapi.testclient import TestClient

def test_cors():
    # Set env var
    os.environ["CORS_ALLOWED_ORIGINS"] = "http://localhost:3000"
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "dummy.json"

    # Reload main to pick up env var
    import main
    importlib.reload(main)

    client = TestClient(main.app)

    # Test allowed preflight
    response = client.options(
        "/extract",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Content-Type"
        }
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"
    assert "POST" in response.headers.get("access-control-allow-methods", "")

    # Test disallowed preflight
    response = client.options(
        "/extract",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "DELETE",
        }
    )
    assert response.status_code == 400
