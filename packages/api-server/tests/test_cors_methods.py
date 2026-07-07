import pytest
import os
import importlib
from fastapi.testclient import TestClient


@pytest.fixture(scope="module")
def client():
    os.environ["CORS_ALLOWED_ORIGINS"] = "http://localhost:3000"
    import main
    importlib.reload(main)
    client = TestClient(main.app)
    yield client
    os.environ.pop("CORS_ALLOWED_ORIGINS", None)


def test_cors_allowed_method(client):
    headers = {
        "Origin": "http://localhost:3000",
        "Access-Control-Request-Method": "POST"
    }
    response = client.options("/extract", headers=headers)
    assert response.status_code == 200


def test_cors_disallowed_method(client):
    headers = {
        "Origin": "http://localhost:3000",
        "Access-Control-Request-Method": "DELETE"
    }
    response = client.options("/extract", headers=headers)
    assert response.status_code == 400
