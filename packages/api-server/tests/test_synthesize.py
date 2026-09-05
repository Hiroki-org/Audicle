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
    @patch('aiofiles.open')
    def test_partial_chunk_failure_fallback_file(self, mock_aiofiles_open, mock_exists, mock_synthesize, mock_split):
        mock_split.return_value = ["Hello ", "world"]
        mock_synthesize.side_effect = [b"mocked_", Exception("Test error")]
        mock_exists.return_value = True

        mock_file_context = MagicMock()
        mock_file_context.read = AsyncMock(return_value=b"fallback_audio")
        mock_aiofiles_open.return_value.__aenter__ = AsyncMock(return_value=mock_file_context)
        mock_aiofiles_open.return_value.__aexit__ = AsyncMock()

        response = self.client.post("/synthesize", json={"text": "Hello world", "voice": "test-voice"})

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
    @patch('aiofiles.open')
    def test_synthesis_exception_fallback(self, mock_aiofiles_open, mock_exists, mock_synthesize, mock_split):
        mock_split.return_value = ["Hello world"]
        mock_synthesize.side_effect = Exception("Complete synthesis failure")
        mock_exists.return_value = True

        mock_file_context = MagicMock()
        mock_file_context.read = AsyncMock(return_value=b"fallback_audio_complete")
        mock_aiofiles_open.return_value.__aenter__ = AsyncMock(return_value=mock_file_context)
        mock_aiofiles_open.return_value.__aexit__ = AsyncMock()

        response = self.client.post("/synthesize", json={"text": "Hello world", "voice": "test-voice"})

        mock_split.assert_called_once_with("Hello world")
        mock_synthesize.assert_called_once_with("Hello world", "test-voice")
        mock_exists.assert_any_call(main.FALLBACK_PATH)
        mock_aiofiles_open.assert_called_once_with(main.FALLBACK_PATH, "rb")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, b"fallback_audio_complete")
        self.assertEqual(response.headers["content-type"], "audio/mpeg")
        self.assertEqual(response.headers["content-disposition"], "attachment; filename=fallback.mp3")
        self.assertEqual(response.headers["x-fallback"], "true")
        self.assertIn("Complete synthesis failure", response.headers["x-error"])


    @patch('main._get_client')
    def test_google_api_call_error_502(self, mock_get_client):
        from fastapi import HTTPException
        import asyncio

        class FakeGoogleAPICallError(Exception):
            pass

        class FakeRetryError(Exception):
            pass

        with patch('main.GoogleAPICallError', FakeGoogleAPICallError), patch('main.RetryError', FakeRetryError):
            mock_client_instance = MagicMock()
            mock_client_instance.synthesize_speech.side_effect = FakeGoogleAPICallError("Test Google API Error")
            mock_get_client.return_value = mock_client_instance

            with self.assertRaises(HTTPException) as context:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                loop.run_until_complete(main._synthesize_to_bytes("Hello world", "test-voice"))
                loop.close()

            self.assertEqual(context.exception.status_code, 502)
            self.assertIn("Test Google API Error", context.exception.detail)

if __name__ == '__main__':







    unittest.main()
