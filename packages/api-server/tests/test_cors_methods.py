import pytest
import os
from fastapi.testclient import TestClient
import importlib

@pytest.fixture(autouse=True)
def setup_env():
    os.environ["CORS_ALLOWED_ORIGINS"] = "http://localhost:3000"
    yield
    if "CORS_ALLOWED_ORIGINS" in os.environ:
        del os.environ["CORS_ALLOWED_ORIGINS"]

def test_cors_allowed_method():
    import main
    importlib.reload(main)
    from main import app
    client = TestClient(app)

    headers = {
        "Origin": "http://localhost:3000",
        "Access-Control-Request-Method": "POST"
    }
    response = client.options("/extract", headers=headers)
    assert response.status_code == 200

def test_cors_disallowed_method():
    import main
    importlib.reload(main)
    from main import app
    client = TestClient(app)

    headers = {
        "Origin": "http://localhost:3000",
        "Access-Control-Request-Method": "DELETE"
    }
    response = client.options("/extract", headers=headers)
    assert response.status_code == 400
