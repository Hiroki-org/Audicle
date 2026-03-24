import sys
import unittest
from unittest.mock import MagicMock
import os

# Mock external dependencies
sys.modules["google.api_core.exceptions"] = MagicMock()
sys.modules["google.cloud"] = MagicMock()
sys.modules["google.cloud.texttospeech"] = MagicMock()
sys.modules["uvicorn"] = MagicMock()

# Add parent directory to path to import main
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from main import _split_text, MAX_TTS_BYTES

class TestSplitText(unittest.TestCase):
    def test_short_text(self):
        text = "Hello world."
        chunks = _split_text(text)
        self.assertEqual(chunks, ["Hello world."])

    def test_split_by_sentence(self):
        # Create a text that is longer than MAX_TTS_BYTES but has sentence breaks
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
        self.assertEqual(len(chunks[0].encode('utf-8')), MAX_TTS_BYTES)
        self.assertEqual(chunks[0], "a" * 5000)
        self.assertEqual(chunks[1], "a" * 1000)

    def test_mixed_split(self):
        # Complex case
        # 1. 3000 chars + \n
        # 2. 6000 chars (no punct) -> force split
        # 3. 3000 chars + 、 + 3000 chars -> split at comma
        p1 = "a" * 3000 + "\n"
        p2 = "b" * 6000 # Force split: 5000 + 1000
        p3_1 = "c" * 3000 + "、"
        p3_2 = "d" * 3000 + "。"

        text = p1 + p2 + p3_1 + p3_2
        chunks = _split_text(text)

        # Expected chunks:
        # 1. p1 (3001 bytes)
        # 2. p2_part1 (5000 bytes)
        # 3. p2_part2 (1000 bytes) -> likely merged with next if < 5000?
        #    Wait, current implementation merges:
        #    "if len(current_chunk + sentence) > MAX_TTS_BYTES:"
        #    So p2_part2 (1000) might be merged with p3_1 (3001) -> 4003 bytes.
        #    Let's check logic.

        # Original logic:
        # 1. Split by \n/./!/? -> [p1, p2+p3_1+p3_2] (since p2 has no sentence terminators)
        #    Actually, p2+p3_1+p3_2 is one giant "sentence" if there are no sentence terminators in p2 or p3_1/p3_2 until the end.
        #    Wait, p3_2 ends with "。". So it splits there.
        #    So: Sentences = [p1, p2+p3_1+p3_2]
        # 2. Merge:
        #    Chunk 1: p1 (3001) -> OK.
        #    Chunk 2: p2+p3_1+p3_2 (6000+3001+3001 = 12002 bytes). -> Too big.
        # 3. Chunk 2 processing (recursive/fallback):
        #    Split Chunk 2 by '、'.
        #    p2 (6000) has no '、'.
        #    p3_1 has '、' at end.
        #    So sub-sentences: [p2+p3_1, p3_2]
        #    Sub-chunk 1: p2+p3_1 (9001 bytes). -> Too big.
        #    Sub-chunk 2: p3_2 (3001 bytes). -> OK.
        # 4. Sub-chunk 1 processing (force split):
        #    p2+p3_1 (9001 bytes).
        #    Force split at 5000. -> [0:5000], [5000:9001] (4003 bytes).

        # Total chunks:
        # 1. p1
        # 2. p2+p3_1 [0:5000]
        # 3. p2+p3_1 [5000:]
        # 4. p3_2

        self.assertEqual(chunks[0], p1)
        self.assertEqual(len(chunks[1].encode('utf-8')), 5000)
        # Remaining of p2+p3_1 is 4003 bytes.
        self.assertEqual(len(chunks[2].encode('utf-8')), 4003)
        self.assertEqual(chunks[3], p3_2)

    def test_multibyte_boundary(self):
        # Test force split on multibyte character boundary
        # "あ" is 3 bytes.
        # 5000 bytes is not divisible by 3 (5000 % 3 = 2).
        # So it should split at 4998 bytes (1666 chars).
        text = "あ" * 2000 # 6000 bytes
        chunks = _split_text(text)

        self.assertEqual(len(chunks), 2)
        # First chunk should be 4998 bytes
        self.assertEqual(len(chunks[0].encode('utf-8')), 4998)
        self.assertEqual(chunks[0], "あ" * 1666)
        # Second chunk
        self.assertEqual(len(chunks[1].encode('utf-8')), 1002)
        self.assertEqual(chunks[1], "あ" * 334)

if __name__ == '__main__':
    unittest.main()
