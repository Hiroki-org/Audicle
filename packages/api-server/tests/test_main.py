import unittest
import sys
import os
from unittest.mock import MagicMock

# Mock external dependencies not needed for _merge_punctuation
sys.modules["fastapi"] = MagicMock()
sys.modules["fastapi.responses"] = MagicMock()
sys.modules["fastapi.middleware.cors"] = MagicMock()
sys.modules["pydantic"] = MagicMock()
sys.modules["aiofiles"] = MagicMock()
sys.modules["google.api_core"] = MagicMock()
sys.modules["google.api_core.exceptions"] = MagicMock()
sys.modules["google.cloud"] = MagicMock()
sys.modules["google.cloud.texttospeech"] = MagicMock()

# Add parent directory to path to import main
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Now import main
from main import _merge_punctuation

class TestMergePunctuation(unittest.TestCase):

    def test_basic_merge(self):
        """Test basic punctuation merging."""
        sentences = ["Hello", "。", "World", "！"]
        delimiters = {"。", "！"}
        expected = ["Hello。", "World！"]
        self.assertEqual(_merge_punctuation(sentences, delimiters), expected)

    def test_multiple_consecutive_delimiters(self):
        """Test multiple consecutive delimiters."""
        sentences = ["Hello", "。", "！", "World"]
        delimiters = {"。", "！"}
        expected = ["Hello。！", "World"]
        self.assertEqual(_merge_punctuation(sentences, delimiters), expected)

    def test_long_consecutive_delimiters(self):
        """Test long sequence of consecutive delimiters."""
        sentences = ["Hello", "。", "。", "。", "World"]
        delimiters = {"。", "！"}
        expected = ["Hello。。。", "World"]
        self.assertEqual(_merge_punctuation(sentences, delimiters), expected)

    def test_mixed_delimiters(self):
        """Test mixed consecutive delimiters."""
        sentences = ["Hello", "。", "！", "?", "World"]
        delimiters = {"。", "！", "?"}
        expected = ["Hello。！?", "World"]
        self.assertEqual(_merge_punctuation(sentences, delimiters), expected)

    def test_no_delimiters(self):
        """Test with no delimiters in the list."""
        sentences = ["Hello", "World"]
        delimiters = {"。", "！"}
        expected = ["Hello", "World"]
        self.assertEqual(_merge_punctuation(sentences, delimiters), expected)

    def test_empty_list(self):
        """Test with an empty list."""
        sentences = []
        delimiters = {"。", "！"}
        expected = []
        self.assertEqual(_merge_punctuation(sentences, delimiters), expected)

    def test_single_element_no_delimiter(self):
        """Test with a single element that is not a delimiter."""
        sentences = ["Hello"]
        delimiters = {"。", "！"}
        expected = ["Hello"]
        self.assertEqual(_merge_punctuation(sentences, delimiters), expected)

    def test_single_element_is_delimiter(self):
        """Test with a single element that is a delimiter (should not be merged)."""
        sentences = ["。"]
        delimiters = {"。"}
        expected = ["。"]
        self.assertEqual(_merge_punctuation(sentences, delimiters), expected)

    def test_delimiter_at_start(self):
        """Test with a delimiter at the start."""
        sentences = ["。", "Hello"]
        delimiters = {"。"}
        expected = ["。", "Hello"]
        self.assertEqual(_merge_punctuation(sentences, delimiters), expected)

    def test_delimiter_at_end(self):
        """Test with a delimiter at the very end."""
        sentences = ["Hello", "。"]
        delimiters = {"。"}
        expected = ["Hello。"]
        self.assertEqual(_merge_punctuation(sentences, delimiters), expected)

if __name__ == "__main__":
    unittest.main()
