import unittest
import sys
import os
from unittest.mock import patch, MagicMock
from fastapi import HTTPException
import socket

# Add parent directory to path to import main
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import validate_url

class TestSSRF(unittest.TestCase):
    def test_valid_https_url(self):
        # google.com is public
        validate_url("https://google.com")

    def test_valid_http_url(self):
        validate_url("http://example.com")

    def test_invalid_scheme(self):
        with self.assertRaises(HTTPException) as cm:
            validate_url("ftp://example.com")
        self.assertEqual(cm.exception.status_code, 400)
        self.assertIn("Invalid URL scheme", cm.exception.detail)

    def test_private_ip(self):
        with self.assertRaises(HTTPException) as cm:
            validate_url("http://192.168.1.1")
        self.assertEqual(cm.exception.status_code, 400)
        self.assertIn("Access to private network is denied", str(cm.exception.detail))

    def test_localhost(self):
        with self.assertRaises(HTTPException) as cm:
            validate_url("http://localhost:8000")
        self.assertEqual(cm.exception.status_code, 400)
        self.assertIn("Access to private network is denied", str(cm.exception.detail))

    def test_loopback_ip(self):
        with self.assertRaises(HTTPException) as cm:
            validate_url("http://127.0.0.1")
        self.assertEqual(cm.exception.status_code, 400)

    def test_0_0_0_0(self):
        with self.assertRaises(HTTPException) as cm:
            validate_url("http://0.0.0.0")
        self.assertEqual(cm.exception.status_code, 400)

    @patch('socket.getaddrinfo')
    def test_dns_rebinding(self, mock_getaddrinfo):
        # Simulate a domain resolving to a private IP
        # socket.AF_INET = 2, socket.SOCK_STREAM = 1
        mock_getaddrinfo.return_value = [(2, 1, 6, '', ('10.0.0.1', 80))]

        with self.assertRaises(HTTPException) as cm:
            validate_url("http://evil.com")
        self.assertEqual(cm.exception.status_code, 400)
        self.assertIn("Access to private network is denied", str(cm.exception.detail))

if __name__ == '__main__':
    unittest.main()
