import sys
import os
import unittest
from unittest.mock import MagicMock, patch, AsyncMock
import asyncio

# Mock external missing dependencies before importing main
sys.modules["google.api_core.exceptions"] = MagicMock()
sys.modules["google.cloud"] = MagicMock()
sys.modules["google.cloud.texttospeech"] = MagicMock()

# Configure CORS for test environment
os.environ["CORS_ALLOWED_ORIGINS"] = "http://localhost:3000"

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
import main

class TestExtractContent(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(main.app)

    @patch('asyncio.create_subprocess_exec', new_callable=AsyncMock)
    def test_extract_happy_path(self, mock_exec):
        # Setup mock process
        mock_proc = MagicMock()
        mock_proc.returncode = 0
        mock_proc.communicate = AsyncMock(return_value=(b'{"title": "Test Title", "chunks": ["Chunk 1", "Chunk 2"]}', b''))
        mock_exec.return_value = mock_proc

        # Send request
        response = self.client.post("/extract", json={"url": "http://example.com"})

        # Assertions
        mock_exec.assert_called_once_with(
            "node", "readability_script.js", "http://example.com/",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["title"], "Test Title")
        self.assertEqual(data["chunks"], ["Chunk 1", "Chunk 2"])

    @patch('asyncio.create_subprocess_exec', new_callable=AsyncMock)
    def test_extract_failure_non_zero_returncode(self, mock_exec):
        mock_proc = MagicMock()
        mock_proc.returncode = 1
        mock_proc.communicate = AsyncMock(return_value=(b'', b'Readability error'))
        mock_exec.return_value = mock_proc

        response = self.client.post("/extract", json={"url": "http://example.com"})

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"], "Extraction failed: Readability error")

    @patch('asyncio.create_subprocess_exec', new_callable=AsyncMock)
    def test_extract_timeout_error(self, mock_exec):
        mock_proc = MagicMock()
        # Mock communicate to raise TimeoutError on the first call (inside wait_for)
        # And return a successful tuple on the second call (in the exception handler)
        mock_proc.communicate = AsyncMock(side_effect=[asyncio.TimeoutError(), (b'', b'')])
        mock_exec.return_value = mock_proc

        response = self.client.post("/extract", json={"url": "http://example.com"})

        # The exception handler catches subprocess.TimeoutExpired
        self.assertEqual(response.status_code, 408)
        self.assertEqual(response.json()["detail"], "Extraction timeout")
        mock_proc.kill.assert_called_once()

    @patch('asyncio.create_subprocess_exec', new_callable=AsyncMock)
    def test_extract_json_decode_error(self, mock_exec):
        mock_proc = MagicMock()
        mock_proc.returncode = 0
        mock_proc.communicate = AsyncMock(return_value=(b'invalid json', b''))
        mock_exec.return_value = mock_proc

        response = self.client.post("/extract", json={"url": "http://example.com"})

        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.json()["detail"], "Failed to parse extraction result")

    @patch('asyncio.create_subprocess_exec', new_callable=AsyncMock)
    def test_extract_generic_exception(self, mock_exec):
        mock_proc = MagicMock()
        mock_proc.communicate = AsyncMock(side_effect=Exception("Unexpected database error"))
        mock_exec.return_value = mock_proc

        response = self.client.post("/extract", json={"url": "http://example.com"})

        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.json()["detail"], "Internal server error: Unexpected database error")


    def test_extract_invalid_url_injection(self):
        # Using a URL that could be interpreted as an argument flag
        response = self.client.post("/extract", json={"url": "-e console.log(1)"})
        self.assertEqual(response.status_code, 422)  # Unprocessable Entity due to validation error

        # Using a URL with shell injection characters
        response = self.client.post("/extract", json={"url": "http://example.com; rm -rf /"})
        self.assertEqual(response.status_code, 422)

if __name__ == '__main__':
    unittest.main()
