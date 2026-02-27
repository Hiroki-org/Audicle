import unittest
from unittest.mock import patch, MagicMock
import asyncio
import socket
from fastapi import HTTPException
import sys
import os

# Add parent directory to path to import main
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Import the function to be tested (we will add it to main.py later, but for now we define a dummy or import it after we mock everything if we were running full app, but here we will import the validate_url function once implemented.
# Since we haven't implemented it yet, we will write the test assuming it exists in main.py)

from main import validate_url, app

class TestURLValidation(unittest.IsolatedAsyncioTestCase):

    async def test_valid_https_url(self):
        # Mock getaddrinfo to return a public IP
        with patch("asyncio.get_event_loop") as mock_loop:
            mock_loop.return_value.getaddrinfo = asyncio.Future()
            mock_loop.return_value.getaddrinfo.set_result([(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 443))])

            # Since we can't easily mock the loop in the function if it calls asyncio.get_event_loop(),
            # we might need to mock socket.getaddrinfo instead if we run it in a thread,
            # or better, mock the loop.getaddrinfo call directly if the function uses it.

            # Let's assume validate_url uses loop.getaddrinfo.
            pass

    @patch("main.asyncio.get_running_loop")
    async def test_valid_url(self, mock_get_running_loop):
        # Mock successful DNS resolution to a public IP
        mock_loop = MagicMock()
        mock_get_running_loop.return_value = mock_loop

        # 93.184.216.34 is example.com
        future = asyncio.Future()
        future.set_result([(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 80))])
        mock_loop.getaddrinfo.return_value = future

        url = "http://example.com/article"
        await validate_url(url) # Should not raise

    @patch("main.asyncio.get_running_loop")
    async def test_invalid_scheme(self, mock_get_running_loop):
        url = "file:///etc/passwd"
        with self.assertRaises(HTTPException) as cm:
            await validate_url(url)
        self.assertEqual(cm.exception.status_code, 400)
        self.assertIn("Invalid URL scheme", cm.exception.detail)

    @patch("main.asyncio.get_running_loop")
    async def test_localhost_ip(self, mock_get_running_loop):
        mock_loop = MagicMock()
        mock_get_running_loop.return_value = mock_loop

        future = asyncio.Future()
        future.set_result([(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("127.0.0.1", 80))])
        mock_loop.getaddrinfo.return_value = future

        url = "http://127.0.0.1/admin"
        with self.assertRaises(HTTPException) as cm:
            await validate_url(url)
        self.assertEqual(cm.exception.status_code, 400)
        self.assertIn("Private or local IP addresses are not allowed", cm.exception.detail)

    @patch("main.asyncio.get_running_loop")
    async def test_private_ip(self, mock_get_running_loop):
        mock_loop = MagicMock()
        mock_get_running_loop.return_value = mock_loop

        # 192.168.1.1 is private
        future = asyncio.Future()
        future.set_result([(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("192.168.1.1", 80))])
        mock_loop.getaddrinfo.return_value = future

        url = "http://192.168.1.1/config"
        with self.assertRaises(HTTPException) as cm:
            await validate_url(url)
        self.assertEqual(cm.exception.status_code, 400)
        self.assertIn("Private or local IP addresses are not allowed", cm.exception.detail)

    @patch("main.asyncio.get_running_loop")
    async def test_dns_rebinding_attempt_resolves_to_private(self, mock_get_running_loop):
        mock_loop = MagicMock()
        mock_get_running_loop.return_value = mock_loop

        # hostname resolves to private IP
        future = asyncio.Future()
        future.set_result([(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("10.0.0.5", 80))])
        mock_loop.getaddrinfo.return_value = future

        url = "http://malicious-dns.com/"
        with self.assertRaises(HTTPException) as cm:
            await validate_url(url)
        self.assertEqual(cm.exception.status_code, 400)
        self.assertIn("Private or local IP addresses are not allowed", cm.exception.detail)

    @patch("main.asyncio.get_running_loop")
    async def test_ipv6_loopback(self, mock_get_running_loop):
        mock_loop = MagicMock()
        mock_get_running_loop.return_value = mock_loop

        future = asyncio.Future()
        future.set_result([(socket.AF_INET6, socket.SOCK_STREAM, 6, "", ("::1", 80, 0, 0))])
        mock_loop.getaddrinfo.return_value = future

        url = "http://[::1]/"
        with self.assertRaises(HTTPException) as cm:
            await validate_url(url)
        self.assertEqual(cm.exception.status_code, 400)

if __name__ == '__main__':
    unittest.main()
