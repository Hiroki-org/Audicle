import unittest
from unittest.mock import patch, MagicMock
import os
import sys

# ONLY mock external missing dependencies
sys.modules["google.api_core.exceptions"] = MagicMock()
sys.modules["google.cloud"] = MagicMock()
sys.modules["google.cloud.texttospeech"] = MagicMock()

os.environ["CORS_ALLOWED_ORIGINS"] = "http://localhost"
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import main

class TestGetClient(unittest.TestCase):
    def setUp(self):
        main._client = None
        if "GOOGLE_APPLICATION_CREDENTIALS" in os.environ:
            del os.environ["GOOGLE_APPLICATION_CREDENTIALS"]

    def tearDown(self):
        main._client = None
        if "GOOGLE_APPLICATION_CREDENTIALS" in os.environ:
            del os.environ["GOOGLE_APPLICATION_CREDENTIALS"]

    @patch('main.texttospeech.TextToSpeechClient')
    @patch('main.os.path.exists')
    def test_get_client_success(self, mock_exists, mock_tts_client):
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "/fake/path/creds.json"
        mock_exists.return_value = True
        mock_instance = MagicMock()
        mock_tts_client.return_value = mock_instance

        client = main._get_client()

        self.assertEqual(client, mock_instance)
        mock_tts_client.assert_called_once()
        self.assertEqual(main._client, mock_instance)

        # Test singleton behavior
        client2 = main._get_client()
        self.assertEqual(client2, mock_instance)
        mock_tts_client.assert_called_once() # Should not be called again

    def test_get_client_no_env_var(self):
        with self.assertRaisesRegex(RuntimeError, "GOOGLE_APPLICATION_CREDENTIALS environment variable is not set"):
            main._get_client()

    @patch('main.os.path.exists')
    def test_get_client_file_not_found(self, mock_exists):
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "/fake/path/creds.json"
        mock_exists.return_value = False

        with self.assertRaisesRegex(RuntimeError, "Credentials file not found"):
            main._get_client()

if __name__ == '__main__':
    unittest.main()
