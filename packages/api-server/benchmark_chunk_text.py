import time
import re
from main import _chunk_text, SENTENCE_SPLIT_REGEX, COMMA_SPLIT_REGEX, MAX_TTS_BYTES

# Create a challenging text for recursion and concatenation
text = "A。 " * 5000

start_time = time.time()
for _ in range(100):
    _chunk_text(text, MAX_TTS_BYTES, [SENTENCE_SPLIT_REGEX, COMMA_SPLIT_REGEX])
end_time = time.time()

print(f"Time taken: {end_time - start_time:.4f} seconds")
