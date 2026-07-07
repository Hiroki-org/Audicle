import pytest
import os
import uvicorn
from fastapi import FastAPI
from fastapi.testclient import TestClient
import importlib

@pytest.fixture(autouse=True)
def setup_env():
    # Set up some dummy CORS origins for testing
    os.environ["CORS_ALLOWED_ORIGINS"] = "http://localhost:3000,https://example.com"
    yield
    # Cleanup
    if "CORS_ALLOWED_ORIGINS" in os.environ:
        del os.environ["CORS_ALLOWED_ORIGINS"]

def test_cors_allowed_origin():
    # Import inside the function so it picks up the patched env vars
    import main
    importlib.reload(main)
    from main import app
    client = TestClient(app)

    headers = {
        "Origin": "http://localhost:3000",
        "Access-Control-Request-Method": "GET"
    }
    response = client.options("/", headers=headers)

    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:3000"

def test_cors_disallowed_origin():
    import main
    importlib.reload(main)
    from main import app
    client = TestClient(app)

    headers = {
        "Origin": "http://evil.com",
        "Access-Control-Request-Method": "GET"
    }
    response = client.options("/", headers=headers)

    assert response.status_code == 400
    assert "access-control-allow-origin" not in response.headers
