from main import _split_text, MAX_TTS_BYTES


class TestSplitText:
    def test_split_text_normal(self):
        text = "こんにちは。元気ですか？はい、元気です。"
        chunks = _split_text(text)
        assert len(chunks) == 1
        assert chunks[0] == text

    def test_split_text_exceeding_max_bytes(self):
        # Create a text that exceeds MAX_TTS_BYTES
        part1 = "a" * (MAX_TTS_BYTES - 2000) + "。"
        part2 = "b" * (MAX_TTS_BYTES - 2000) + "。"
        text = part1 + part2

        chunks = _split_text(text)
        assert len(chunks) == 2
        assert chunks[0] == part1
        assert chunks[1] == part2

    def test_split_text_forced_split(self):
        # A single sentence larger than MAX_TTS_BYTES without punctuation
        long_text = "a" * (MAX_TTS_BYTES + 1000)
        chunks = _split_text(long_text)

        assert len(chunks) == 2
        assert len(chunks[0].encode('utf-8')) <= MAX_TTS_BYTES
        assert chunks[0] == "a" * MAX_TTS_BYTES
        assert chunks[1] == "a" * 1000

    def test_split_text_comma_fallback(self):
        # Sentence larger than MAX_TTS_BYTES, but has commas
        part1 = "a" * (MAX_TTS_BYTES - 2000)
        part2 = "b" * (MAX_TTS_BYTES - 2000)
        text = part1 + "、" + part2 + "。"

        chunks = _split_text(text)

        assert len(chunks) == 2
        assert chunks[0] == part1 + "、"
        assert chunks[1] == part2 + "。"

    def test_split_text_empty(self):
        assert _split_text("") == []

    def test_split_text_multibyte(self):
        # Test multibyte character boundary
        # Japanese 'あ' is 3 bytes.
        # MAX_TTS_BYTES is 5000.
        # 5000 // 3 = 1666. 1666 * 3 = 4998 bytes.

        target_char_count = 1700
        long_text = "あ" * target_char_count
        chunks = _split_text(long_text)

        # First chunk should be 1666 chars * 3 bytes = 4998 bytes
        assert len(chunks[0].encode('utf-8')) <= MAX_TTS_BYTES
        assert len(chunks[0]) == 1666
        assert chunks[0] == "あ" * 1666

        # Second chunk
        remaining = target_char_count - 1666
        assert chunks[1] == "あ" * remaining

    def test_split_text_complex_punctuation(self):
        # Test with multiple types of punctuation (full-width)
        text = "ひとつ！ふたつ？みっつ。\nよっつ"
        chunks = _split_text(text)
        # Should fit in one chunk after punctuation merge
        assert len(chunks) == 1
        assert chunks[0] == text
