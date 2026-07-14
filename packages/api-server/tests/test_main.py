import sys
import os
import unittest
from unittest.mock import MagicMock

# Mock external missing dependencies before importing main

# Configure CORS for test environment
os.environ["CORS_ALLOWED_ORIGINS"] = "http://localhost:3000"

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
import main

class TestMainApp(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(main.app)

    def test_root_endpoint(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok", "service": "audicle-api"})

if __name__ == '__main__':
    unittest.main()
