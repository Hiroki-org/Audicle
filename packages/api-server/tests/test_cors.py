import pytest
import os
import importlib
from fastapi.testclient import TestClient


@pytest.fixture(scope="module")
def client():
    os.environ["CORS_ALLOWED_ORIGINS"] = "http://localhost:3000,https://example.com"
    import main
    importlib.reload(main)
    client = TestClient(main.app)
    yield client
    os.environ.pop("CORS_ALLOWED_ORIGINS", None)


def test_cors_allowed_origin(client):

    headers = {
        "Origin": "http://localhost:3000",
        "Access-Control-Request-Method": "GET"
    }
    response = client.options("/", headers=headers)

    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:3000"


def test_cors_disallowed_origin(client):
    headers = {
        "Origin": "http://evil.com",
        "Access-Control-Request-Method": "GET"
    }
    response = client.options("/", headers=headers)

    assert response.status_code == 400
    assert "access-control-allow-origin" not in response.headers


@pytest.mark.parametrize(
    "origin",
    [
        "http://evil.com?x=1",
        "*.example.com",
        "https://user:pass@example.com",
        "ftp://example.com",
    ],
)
def test_invalid_cors_origin_config_is_rejected(origin, monkeypatch):
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", origin)
    import main

    with pytest.raises(ValueError):
        importlib.reload(main)
