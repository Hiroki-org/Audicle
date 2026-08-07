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

from main import _split_text, MAX_TTS_BYTES  # noqa: E402


class TestSplitText(unittest.TestCase):
    def test_short_text(self):
        text = "Hello world."
        chunks = _split_text(text)
        self.assertEqual(chunks, ["Hello world."])

    def test_split_by_sentence(self):
        # Create a text that is longer than MAX_TTS_BYTES but
        # has sentence breaks
        # MAX_TTS_BYTES is 5000
        part1 = "a" * 3000 + "。"
        part2 = "b" * 3000 + "。"
        text = part1 + part2
        chunks = _split_text(text)
        self.assertEqual(len(chunks), 2)
        self.assertEqual(chunks[0], part1)
        self.assertEqual(chunks[1], part2)

    def test_split_by_comma(self):
        # Create a text where a single sentence is > 5000 bytes, but has commas
        part1 = "a" * 3000 + "、"
        part2 = "b" * 3000 + "。"
        text = part1 + part2
        chunks = _split_text(text)
        # Should be split at comma
        self.assertEqual(len(chunks), 2)
        self.assertEqual(chunks[0], part1)
        self.assertEqual(chunks[1], part2)

    def test_force_split(self):
        # Create a text > 5000 bytes with NO punctuation
        text = "a" * 6000
        chunks = _split_text(text)
        self.assertEqual(len(chunks), 2)
        self.assertEqual(len(chunks[0].encode("utf-8")), MAX_TTS_BYTES)
        self.assertEqual(chunks[0], "a" * 5000)
        self.assertEqual(chunks[1], "a" * 1000)

    def test_mixed_split(self):
        # Complex case
        # 1. 3000 chars + \n
        # 2. 6000 chars (no punct) -> force split
        # 3. 3000 chars + 、 + 3000 chars -> split at comma
        p1 = "a" * 3000 + "\n"
        p2 = "b" * 6000  # Force split: 5000 + 1000
        p3_1 = "c" * 3000 + "、"
        p3_2 = "d" * 3000 + "。"

        text = p1 + p2 + p3_1 + p3_2
        chunks = _split_text(text)

        self.assertEqual(chunks[0], p1)
        self.assertEqual(len(chunks[1].encode("utf-8")), 5000)
        # Remaining of p2+p3_1 is 4003 bytes.
        self.assertEqual(len(chunks[2].encode("utf-8")), 4003)
        self.assertEqual(chunks[3], p3_2)

    def test_multibyte_boundary(self):
        # Test force split on multibyte character boundary
        # "あ" is 3 bytes.
        # 5000 bytes is not divisible by 3 (5000 % 3 = 2).
        # So it should split at 4998 bytes (1666 chars).
        text = "あ" * 2000  # 6000 bytes
        chunks = _split_text(text)

        self.assertEqual(len(chunks), 2)
        # First chunk should be 4998 bytes
        self.assertEqual(len(chunks[0].encode("utf-8")), 4998)
        self.assertEqual(chunks[0], "あ" * 1666)
        # Second chunk
        self.assertEqual(len(chunks[1].encode("utf-8")), 1002)
        self.assertEqual(chunks[1], "あ" * 334)


if __name__ == "__main__":
    unittest.main()
