import re
import sys
import unittest
from unittest.mock import MagicMock
import os

# Mock external dependencies
sys.modules["aiofiles"] = MagicMock()
sys.modules["fastapi"] = MagicMock()
sys.modules["fastapi.responses"] = MagicMock()
sys.modules["fastapi.middleware.cors"] = MagicMock()
sys.modules["pydantic"] = MagicMock()
sys.modules["google.api_core.exceptions"] = MagicMock()
sys.modules["google.cloud"] = MagicMock()
sys.modules["google.cloud.texttospeech"] = MagicMock()
sys.modules["uvicorn"] = MagicMock()

# Add parent directory to path to import main
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from main import _chunk_text

SPACE_SPLIT_REGEX = re.compile(r"(\\s)")
PERIOD_SPLIT_REGEX = re.compile(r"([.])")
COMMA_SPLIT_REGEX = re.compile(r"([,])")

class TestChunkTextLogic(unittest.TestCase):

    def test_basic_no_split(self):
        """Test that text smaller than limit returns as is."""
        text = "Hello world"
        limit = 50
        chunks = _chunk_text(text, limit, [SPACE_SPLIT_REGEX])
        self.assertEqual(chunks, ["Hello world"])

    def test_delimiter_merging(self):
        """Test that delimiters are attached to the preceding chunk."""
        text = "Hello. World."
        limit = 7 # Force split. "Hello." is 6 bytes. " World." is 7 bytes.
        # Split by period
        chunks = _chunk_text(text, limit, [PERIOD_SPLIT_REGEX])
        # Expect ["Hello.", " World."]
        self.assertEqual(chunks, ["Hello.", " World."])

    def test_separator_priority_recursion(self):
        """Test that if first separator leaves a chunk too big, it recurses with next separator."""
        # Text: "Part1,Part2. Part3,Part4."
        # Limit: 12 bytes.
        # "Part1,Part2." is 12 bytes. Fits.
        # " Part3,Part4." is 13 bytes. Too big.

        text = "Part1,Part2. Part3,Part4."
        limit = 12
        separators = [PERIOD_SPLIT_REGEX, COMMA_SPLIT_REGEX]

        chunks = _chunk_text(text, limit, separators)

        expected = ["Part1,Part2.", " Part3,", "Part4."]
        self.assertEqual(chunks, expected)

    def test_force_split_multibyte_safety(self):
        """Test force split doesn't break multibyte characters."""
        # "あ" is 3 bytes (E3 81 82)
        # Text: "ああ" (6 bytes)
        # Limit: 4 bytes.
        # Should split after first "あ" (3 bytes), leaving 1 byte room, so 2nd "あ" goes to next chunk.
        text = "ああ"
        limit = 4
        chunks = _chunk_text(text, limit, []) # No separators -> force split

        self.assertEqual(len(chunks), 2)
        self.assertEqual(chunks[0], "あ")
        self.assertEqual(chunks[1], "あ")

    def test_force_split_byte_limit_exact(self):
        """Test force split exactly at limit."""
        text = "abcdef"
        limit = 3
        chunks = _chunk_text(text, limit, [])
        self.assertEqual(chunks, ["abc", "def"])

    def test_accumulate_small_parts(self):
        """Test that small parts are accumulated until limit."""
        # Text: "a.b.c.d."
        # Limit: 4 bytes.
        # Split by '.'. Parts: "a.", "b.", "c.", "d."
        # Accumulate:
        # "a." (2) + "b." (2) = "a.b." (4) -> OK
        # "c." (2) + "d." (2) = "c.d." (4) -> OK

        text = "a.b.c.d."
        limit = 4
        chunks = _chunk_text(text, limit, [PERIOD_SPLIT_REGEX])
        self.assertEqual(chunks, ["a.b.", "c.d."])

if __name__ == '__main__':
    unittest.main()
