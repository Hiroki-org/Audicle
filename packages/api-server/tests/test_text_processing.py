import sys
import os
import pytest

# Add parent directory to sys.path to import main.py
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import _split_text, _merge_punctuation, MAX_TTS_BYTES

class TestTextProcessing:
    def test_merge_punctuation_basic(self):
        sentences = ["Hello", "。", "World", "！"]
        delimiters = {'。', '！'}
        expected = ["Hello。", "World！"]
        assert _merge_punctuation(sentences, delimiters) == expected

    def test_merge_punctuation_multiple(self):
        sentences = ["Hello", "。", "！", "World", "！", "？"]
        delimiters = {'。', '！', '？'}
        expected = ["Hello。！", "World！？"]
        assert _merge_punctuation(sentences, delimiters) == expected

    def test_merge_punctuation_no_punctuation(self):
        sentences = ["Hello", "World"]
        delimiters = {'。', '！'}
        expected = ["Hello", "World"]
        assert _merge_punctuation(sentences, delimiters) == expected

    def test_split_text_normal(self):
        text = "こんにちは。元気ですか？はい、元気です。"
        # "こんにちは。" (18 bytes)
        # "元気ですか？" (18 bytes)
        # "はい、元気です。" (24 bytes)
        # Total is small, so it should be one chunk or split if logic dictates?
        # Logic: Accumulates until MAX_TTS_BYTES.
        # Since it fits in MAX_TTS_BYTES, it should be one chunk.

        chunks = _split_text(text)
        assert len(chunks) == 1
        assert chunks[0] == text

    def test_split_text_exceeding_max_bytes(self):
        # Create a text that exceeds MAX_TTS_BYTES
        # MAX_TTS_BYTES is 5000.
        # 'a' is 1 byte.
        part1 = "a" * 3000 + "。"
        part2 = "b" * 3000 + "。"
        text = part1 + part2

        chunks = _split_text(text)
        assert len(chunks) == 2
        assert chunks[0] == part1
        assert chunks[1] == part2

    def test_split_text_forced_split(self):
        # A single sentence larger than MAX_TTS_BYTES without punctuation
        long_text = "a" * 6000
        chunks = _split_text(long_text)

        assert len(chunks) == 2
        assert len(chunks[0].encode('utf-8')) <= MAX_TTS_BYTES
        assert chunks[0] == "a" * 5000
        assert chunks[1] == "a" * 1000

    def test_split_text_comma_fallback(self):
        # Sentence larger than MAX_TTS_BYTES, but has commas
        # 3000 'a's + comma + 3000 'b's + period
        part1 = "a" * 3000
        part2 = "b" * 3000
        text = part1 + "、" + part2 + "。"

        chunks = _split_text(text)
        # Should split at comma
        # "a"*3000 + "、" -> 3003 bytes
        # "b"*3000 + "。" -> 3003 bytes

        assert len(chunks) == 2
        assert chunks[0] == part1 + "、"
        assert chunks[1] == part2 + "。"

    def test_split_text_empty(self):
        assert _split_text("") == []

    def test_split_text_multibyte(self):
        # Test multibyte character boundary
        # Japanese 'あ' is 3 bytes.
        # 5000 bytes is not divisible by 3 (5000 % 3 = 2).
        # So it should contain 1666 characters (4998 bytes).
        # The next character would make it 5001 bytes.

        long_text = "あ" * 1700
        chunks = _split_text(long_text)

        # First chunk should be 1666 chars * 3 bytes = 4998 bytes
        assert len(chunks[0].encode('utf-8')) <= MAX_TTS_BYTES
        assert len(chunks[0]) == 1666
        assert chunks[0] == "あ" * 1666

        # Second chunk
        remaining = 1700 - 1666
        assert chunks[1] == "あ" * remaining

    def test_split_text_complex_punctuation(self):
        # Test with multiple types of punctuation
        text = "One! Two? Three.\nFour"
        chunks = _split_text(text)
        # Should fit in one chunk
        assert len(chunks) == 1
        assert chunks[0] == text
