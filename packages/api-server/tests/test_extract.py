import sys
import os
import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi.testclient import TestClient
import subprocess
import asyncio
import json

# Add parent directory to path to allow importing main
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app

client = TestClient(app)

def _make_mock_process(returncode=0, stdout=b"", stderr=b""):
    """Helper to create a mock async subprocess process."""
    mock_proc = AsyncMock()
    mock_proc.returncode = returncode
    mock_proc.communicate = AsyncMock(return_value=(stdout, stderr))
    mock_proc.kill = MagicMock()
    return mock_proc

def test_extract_content_success():
    """Test successful content extraction."""
    mock_response = {
        "title": "Test Title",
        "chunks": ["Chunk 1", "Chunk 2"]
    }

    mock_proc = _make_mock_process(
        returncode=0,
        stdout=json.dumps(mock_response).encode("utf-8")
    )

    with patch("main.asyncio.create_subprocess_exec", new_callable=AsyncMock, return_value=mock_proc) as mock_exec:
        response = client.post("/extract", json={"url": "http://example.com"})

        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Test Title"
        assert data["chunks"] == ["Chunk 1", "Chunk 2"]

        mock_exec.assert_called_once_with(
            "node", "readability_script.js", "http://example.com",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )

def test_extract_content_failure_script_error():
    """Test handling of script failure (non-zero exit code)."""
    mock_proc = _make_mock_process(
        returncode=1,
        stderr=b"Some script error"
    )

    with patch("main.asyncio.create_subprocess_exec", new_callable=AsyncMock, return_value=mock_proc):
        response = client.post("/extract", json={"url": "http://example.com"})

        assert response.status_code == 400
        assert "Extraction failed" in response.json()["detail"]
        assert "Some script error" in response.json()["detail"]

def test_extract_content_timeout():
    """Test handling of subprocess timeout."""
    mock_proc = _make_mock_process()
    mock_proc.communicate = AsyncMock(side_effect=asyncio.TimeoutError())

    with patch("main.asyncio.create_subprocess_exec", new_callable=AsyncMock, return_value=mock_proc):
        with patch("main.asyncio.wait_for", side_effect=asyncio.TimeoutError()):
            response = client.post("/extract", json={"url": "http://example.com"})

            assert response.status_code == 408
            assert response.json()["detail"] == "Extraction timeout"

def test_extract_content_json_error():
    """Test handling of invalid JSON output from script."""
    mock_proc = _make_mock_process(
        returncode=0,
        stdout=b"Invalid JSON"
    )

    with patch("main.asyncio.create_subprocess_exec", new_callable=AsyncMock, return_value=mock_proc):
        response = client.post("/extract", json={"url": "http://example.com"})

        assert response.status_code == 500
        assert response.json()["detail"] == "Failed to parse extraction result"

def test_extract_content_unexpected_error():
    """Test handling of unexpected exceptions."""
    with patch("main.asyncio.create_subprocess_exec", new_callable=AsyncMock, side_effect=Exception("Unexpected error")):
        response = client.post("/extract", json={"url": "http://example.com"})

        assert response.status_code == 500
        assert "Internal server error" in response.json()["detail"]
        assert "Unexpected error" in response.json()["detail"]
