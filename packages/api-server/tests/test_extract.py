import sys
import os
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
import subprocess
import json

# Add parent directory to path to allow importing main
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app

client = TestClient(app)

def test_extract_content_success():
    """Test successful content extraction."""
    mock_response = {
        "title": "Test Title",
        "chunks": ["Chunk 1", "Chunk 2"]
    }

    with patch("subprocess.run") as mock_run:
        mock_process = MagicMock()
        mock_process.returncode = 0
        mock_process.stdout = json.dumps(mock_response)
        mock_run.return_value = mock_process

        response = client.post("/extract", json={"url": "http://example.com"})

        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Test Title"
        assert data["chunks"] == ["Chunk 1", "Chunk 2"]

        mock_run.assert_called_once()
        args, kwargs = mock_run.call_args
        assert args[0] == ["node", "readability_script.js", "http://example.com"]
        assert kwargs["capture_output"] is True
        assert kwargs["text"] is True
        assert kwargs["timeout"] == 30

def test_extract_content_failure_script_error():
    """Test handling of script failure (non-zero exit code)."""
    with patch("subprocess.run") as mock_run:
        mock_process = MagicMock()
        mock_process.returncode = 1
        mock_process.stderr = "Some script error"
        mock_run.return_value = mock_process

        response = client.post("/extract", json={"url": "http://example.com"})

        assert response.status_code == 400
        assert "Extraction failed" in response.json()["detail"]
        assert "Some script error" in response.json()["detail"]

def test_extract_content_timeout():
    """Test handling of subprocess timeout."""
    with patch("subprocess.run") as mock_run:
        mock_run.side_effect = subprocess.TimeoutExpired(cmd=["node"], timeout=30)

        response = client.post("/extract", json={"url": "http://example.com"})

        assert response.status_code == 408
        assert response.json()["detail"] == "Extraction timeout"

def test_extract_content_json_error():
    """Test handling of invalid JSON output from script."""
    with patch("subprocess.run") as mock_run:
        mock_process = MagicMock()
        mock_process.returncode = 0
        mock_process.stdout = "Invalid JSON"
        mock_run.return_value = mock_process

        response = client.post("/extract", json={"url": "http://example.com"})

        assert response.status_code == 500
        assert response.json()["detail"] == "Failed to parse extraction result"

def test_extract_content_unexpected_error():
    """Test handling of unexpected exceptions."""
    with patch("subprocess.run") as mock_run:
        mock_run.side_effect = Exception("Unexpected error")

        response = client.post("/extract", json={"url": "http://example.com"})

        assert response.status_code == 500
        assert "Internal server error" in response.json()["detail"]
        assert "Unexpected error" in response.json()["detail"]
