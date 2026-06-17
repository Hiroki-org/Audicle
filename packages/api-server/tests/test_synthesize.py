import sys
import unittest
from unittest.mock import MagicMock, patch, AsyncMock
import os
import io

# ONLY mock external missing dependencies, DO NOT mock fastapi, pydantic
sys.modules["google.api_core.exceptions"] = MagicMock()
sys.modules["google.cloud"] = MagicMock()
sys.modules["google.cloud.texttospeech"] = MagicMock()

# Add parent directory to path to import main
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
import main

class TestSynthesizeSpeech(unittest.TestCase):
    def setUp(self):
        # Reset the semaphore before each test to ensure clean state
        main._tts_semaphore = None
        self.client = TestClient(main.app)

    @patch('main._split_text')
    @patch('main._synthesize_to_bytes', new_callable=AsyncMock)
    def test_single_chunk_success(self, mock_synthesize, mock_split):
        mock_split.return_value = ["Hello world"]
        mock_synthesize.return_value = b"mocked_audio"

        response = self.client.post("/synthesize", json={"text": "Hello world", "voice": "test-voice"})

        mock_split.assert_called_once_with("Hello world")
        mock_synthesize.assert_called_once_with("Hello world", "test-voice")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, b"mocked_audio")
        self.assertEqual(response.headers["content-type"], "audio/mpeg")
        self.assertEqual(response.headers["content-disposition"], "attachment; filename=speech.mp3")

    @patch('main._split_text')
    @patch('main._synthesize_to_bytes', new_callable=AsyncMock)
    def test_multiple_chunks_success(self, mock_synthesize, mock_split):
        mock_split.return_value = ["Hello ", "world"]
        mock_synthesize.side_effect = [b"mocked_", b"audio"]

        response = self.client.post("/synthesize", json={"text": "Hello world", "voice": "test-voice"})

        mock_split.assert_called_once_with("Hello world")
        self.assertEqual(mock_synthesize.call_count, 2)
        mock_synthesize.assert_any_call("Hello ", "test-voice")
        mock_synthesize.assert_any_call("world", "test-voice")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, b"mocked_audio")
        self.assertEqual(response.headers["content-type"], "audio/mpeg")

    @patch('main._split_text')
    @patch('main._synthesize_to_bytes', new_callable=AsyncMock)
    @patch('main.os.path.exists')
    def test_partial_chunk_failure_fallback_file(self, mock_exists, mock_synthesize, mock_split):
        mock_split.return_value = ["Hello ", "world"]
        mock_synthesize.side_effect = [b"mocked_", Exception("Test error")]
        mock_exists.return_value = True

        # Create a dummy fallback file
        with open(main.FALLBACK_PATH, "wb") as f:
            f.write(b"fallback_audio")

        try:
            response = self.client.post("/synthesize", json={"text": "Hello world", "voice": "test-voice"})
        finally:
            if os.path.exists(main.FALLBACK_PATH):
                os.remove(main.FALLBACK_PATH)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, b"fallback_audio")
        self.assertEqual(response.headers["content-type"], "audio/mpeg")
        self.assertEqual(response.headers["content-disposition"], "attachment; filename=fallback.mp3")
        self.assertEqual(response.headers["x-fallback"], "true")
        self.assertIn("Test error", response.headers["x-error"])

    @patch('main._split_text')
    @patch('main._synthesize_to_bytes', new_callable=AsyncMock)
    @patch('main.os.path.exists')
    def test_partial_chunk_failure_no_fallback_file(self, mock_exists, mock_synthesize, mock_split):
        mock_split.return_value = ["Hello ", "world"]
        mock_synthesize.side_effect = [b"mocked_", Exception("Test error")]
        mock_exists.return_value = False

        response = self.client.post("/synthesize", json={"text": "Hello world", "voice": "test-voice"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, b"")
        self.assertEqual(response.headers["content-type"], "audio/mpeg")
        self.assertEqual(response.headers["content-disposition"], "attachment; filename=empty.mp3")
        self.assertEqual(response.headers["x-fallback"], "true")
        self.assertIn("Test error", response.headers["x-error"])

    @patch('main._split_text')
    @patch('main.os.path.exists')
    def test_fallback_failure(self, mock_exists, mock_split):
        mock_split.side_effect = Exception("Split failed")
        def side_effect_func(path):
            if path == main.FALLBACK_PATH:
                raise Exception("Fallback disk read failed")
            return True
        mock_exists.side_effect = side_effect_func

        response = self.client.post("/synthesize", json={"text": "Hello world", "voice": "test-voice"})

        mock_split.assert_called_once_with("Hello world")
        mock_exists.assert_any_call(main.FALLBACK_PATH)

        self.assertEqual(response.status_code, 500)
        data = response.json()
        self.assertIn("Split failed", data["detail"])
        self.assertIn("Fallback disk read failed", data["detail"])


    @patch('main._split_text')
    @patch('main._synthesize_to_bytes', new_callable=AsyncMock)
    @patch('main.os.path.exists')
    def test_synthesis_exception_fallback(self, mock_exists, mock_synthesize, mock_split):
        mock_split.return_value = ["Hello world"]
        mock_synthesize.side_effect = Exception("Complete synthesis failure")
        mock_exists.return_value = True

        # Create a dummy fallback file
        with open(main.FALLBACK_PATH, "wb") as f:
            f.write(b"fallback_audio_complete")

        try:
            response = self.client.post("/synthesize", json={"text": "Hello world", "voice": "test-voice"})
        finally:
            if os.path.exists(main.FALLBACK_PATH):
                os.remove(main.FALLBACK_PATH)

        mock_split.assert_called_once_with("Hello world")
        mock_synthesize.assert_called_once_with("Hello world", "test-voice")
        mock_exists.assert_any_call(main.FALLBACK_PATH)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, b"fallback_audio_complete")
        self.assertEqual(response.headers["content-type"], "audio/mpeg")
        self.assertEqual(response.headers["content-disposition"], "attachment; filename=fallback.mp3")
        self.assertEqual(response.headers["x-fallback"], "true")
        self.assertIn("Complete synthesis failure", response.headers["x-error"])

if __name__ == '__main__':
    unittest.main()
