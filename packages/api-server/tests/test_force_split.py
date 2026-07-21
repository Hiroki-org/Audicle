import sys
import unittest
from unittest.mock import MagicMock
import os

# Mock external dependencies
sys.modules["google.api_core.exceptions"] = MagicMock()
sys.modules["google.cloud"] = MagicMock()
sys.modules["google.cloud.texttospeech"] = MagicMock()
sys.modules["uvicorn"] = MagicMock()

os.environ["CORS_ALLOWED_ORIGINS"] = "http://localhost"
# Add parent directory to path to import main
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from main import _force_split

class TestForceSplit(unittest.TestCase):
    def test_short_text(self):
        # Text under the limit should not be split
        text = "Hello world."
        chunks = _force_split(text, limit=50)
        self.assertEqual(chunks, ["Hello world."])

    def test_exact_limit(self):
        # Text exactly at the limit should not be split
        text = "a" * 50
        chunks = _force_split(text, limit=50)
        self.assertEqual(chunks, ["a" * 50])

    def test_over_limit_ascii(self):
        # Text over limit should be split appropriately
        text = "a" * 105
        chunks = _force_split(text, limit=50)
        self.assertEqual(len(chunks), 3)
        self.assertEqual(chunks[0], "a" * 50)
        self.assertEqual(chunks[1], "a" * 50)
        self.assertEqual(chunks[2], "a" * 5)

    def test_multibyte_characters(self):
        # Multi-byte characters should not be cut in the middle of their byte representation
        # 'あ' is 3 bytes in UTF-8
        text = "ああああああ" # 6 chars, 18 bytes
        # Splitting at 10 bytes:
        # Max chars in 10 bytes is 3 (9 bytes)
        chunks = _force_split(text, limit=10)
        self.assertEqual(len(chunks), 2)
        self.assertEqual(chunks[0], "あああ") # 3 chars, 9 bytes
        self.assertEqual(chunks[1], "あああ") # 3 chars, 9 bytes

    def test_mixed_characters(self):
        # Mixture of ASCII (1 byte) and multibyte (3 bytes)
        # 'a' (1 byte), 'あ' (3 bytes)
        text = "aaああbbいい" # 2+6+2+6 = 16 bytes

        # Limit 5 bytes
        # Chunk 1: "aaあ" = 2 + 3 = 5 bytes -> fits perfectly
        # Chunk 2: "あ" = 3 bytes + "b" (1) + "b" (1) = 5 bytes -> fits perfectly
        # Chunk 3: "い" = 3 bytes -> fits
        # Chunk 4: "い" = 3 bytes -> fits
        chunks = _force_split(text, limit=5)
        self.assertEqual(len(chunks), 4)
        self.assertEqual(chunks[0], "aaあ")
        self.assertEqual(chunks[1], "あbb")
        self.assertEqual(chunks[2], "い")
        self.assertEqual(chunks[3], "い")

    def test_limit_smaller_than_char(self):
        # Edge case: If limit is smaller than a single character's byte size
        # 'あ' is 3 bytes, limit is 2 bytes
        # The algorithm should ideally make progress, but current logic:
        # if len(text[start:mid].encode('utf-8')) <= limit is false for mid=start+1
        # end remains start+1, low becomes mid+1. It will include 1 char even if it exceeds limit.
        text = "あ"
        chunks = _force_split(text, limit=2)
        # It's an edge case, but we should make sure it doesn't infinite loop
        # and returns the character since it can't split it further
        self.assertEqual(chunks, ["あ"])

    def test_empty_string(self):
        text = ""
        chunks = _force_split(text, limit=50)
        self.assertEqual(chunks, [])

if __name__ == '__main__':
    unittest.main()
