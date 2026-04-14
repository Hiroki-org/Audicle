from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import asyncio
import subprocess
import json
import os
import logging
import re
from typing import List, Pattern, cast
import aiofiles
from google.api_core.exceptions import GoogleAPICallError, RetryError
from google.cloud import texttospeech

# ログ設定
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = FastAPI(title="Audicle API Server", version="1.0.0")

# CORS設定
cors_origins_env = os.getenv("CORS_ALLOWED_ORIGINS")
allow_origins = []
if cors_origins_env:
    allow_origins = [
        origin.strip() for origin in cors_origins_env.split(",") if origin.strip()
    ]
    if "*" in allow_origins:
        raise ValueError(
            "CORS_ALLOWED_ORIGINS に '*' は使用できません。allow_credentials=True と組み合わせると起動に失敗します。"
        )

if not allow_origins:
    raise ValueError(
        "CORS_ALLOWED_ORIGINS 環境変数が設定されていないか、有効なオリジンがありません。フロントエンドからのアクセスを許可するために、有効なオリジンを指定してください。"
    )

logger.info("CORS許可オリジン: %s", allow_origins)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Google Cloud TTS クライアント
_client: texttospeech.TextToSpeechClient = None


def _get_client() -> texttospeech.TextToSpeechClient:
    """Lazily instantiate the Google Cloud TTS client."""
    global _client

    if _client is not None:
        return _client

    credentials_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    if not credentials_path:
        raise RuntimeError(
            "GOOGLE_APPLICATION_CREDENTIALS environment variable is not set."
        )

    if not os.path.exists(credentials_path):
        raise RuntimeError(f"Credentials file not found at '{credentials_path}'.")

    logger.info("Initialising Google Cloud Text-to-Speech client")
    _client = texttospeech.TextToSpeechClient()
    return _client


# Request models
class ExtractRequest(BaseModel):
    url: str


class SynthesizeRequest(BaseModel):
    text: str
    voice: str = os.getenv("DEFAULT_VOICE", "ja-JP-Neural2-B")


# Response models
class ExtractResponse(BaseModel):
    title: str
    chunks: List[str]


# Google Cloud TTS APIの最大リクエストバイト数
MAX_TTS_BYTES = 5000

# Maximum number of concurrent TTS API requests
# This prevents hitting Google Cloud TTS API rate limits
MAX_CONCURRENT_TTS_REQUESTS = int(os.getenv("MAX_CONCURRENT_TTS_REQUESTS", "10"))

# Semaphore for controlling TTS API concurrency
_tts_semaphore = None

# Pre-compiled regex patterns for text splitting
SENTENCE_SPLIT_REGEX = re.compile(r"([。！？\n])")
COMMA_SPLIT_REGEX = re.compile(r"(、)")


def _chunk_text(text: str, limit: int, separators: List[Pattern]) -> List[str]:
    """
    Recursively splits text into chunks smaller than `limit` bytes using `separators`.

    Args:
        text: The text to split.
        limit: The maximum byte size (UTF-8) per chunk.
        separators: A list of regex patterns to split by, in order of priority.
                    Patterns should capture the delimiter (e.g., r'([。])') so it can be preserved.
    """
    # Check if text fits in limit
    if len(text.encode("utf-8")) <= limit:
        return [text]

    # If no separators left, force split by byte limit
    if not separators:
        chunks = []
        start = 0
        while start < len(text):
            end = start + limit
            # Adjust end to avoid splitting multi-byte characters
            # and ensure chunk size <= limit
            while len(text[start:end].encode("utf-8")) > limit:
                end -= 1

            # Safety check to prevent infinite loop if a single char > limit (unlikely for UTF-8 and decent limit)
            if end <= start:
                end = start + 1

            chunks.append(text[start:end])
            start = end
        return chunks

    # Use first separator
    sep_pattern = separators[0]
    next_separators = separators[1:]

    # Split text. Regex should capture delimiters so they are included in the list.
    # e.g., re.split(r'([。])', "A。B") -> ["A", "。", "B"]
    # Use compiled pattern split
    parts = [s for s in sep_pattern.split(text) if s]

    # Merge punctuation/delimiters back to the previous sentence
    merged_parts = []
    i = 0
    while i < len(parts):
        current = parts[i]

        # Check if next part matches the separator pattern (is a delimiter)
        if i + 1 < len(parts) and sep_pattern.fullmatch(parts[i + 1]):
            current += parts[i + 1]
            i += 1

            # Handle consecutive delimiters (e.g., "Hello!!!")
            # Keep appending as long as they match the pattern
            while i + 1 < len(parts) and sep_pattern.fullmatch(parts[i + 1]):
                current += parts[i + 1]
                i += 1

        merged_parts.append(current)
        i += 1

    parts = merged_parts

    # Accumulate parts into chunks
    chunks = []
    current_chunk = ""

    for part in parts:
        if len((current_chunk + part).encode("utf-8")) > limit:
            if current_chunk:
                chunks.append(current_chunk)
            current_chunk = part
        else:
            current_chunk += part

    if current_chunk:
        chunks.append(current_chunk)

    # Recursively process any chunks that are still too big
    final_chunks = []
    for chunk in chunks:
        if len(chunk.encode("utf-8")) > limit:
            final_chunks.extend(_chunk_text(chunk, limit, next_separators))
        else:
            final_chunks.append(chunk)

    return final_chunks


def _split_text(text: str) -> List[str]:
    """テキストをGoogle Cloud TTS APIの制限内に分割する"""
    # First split by major punctuation, then by comma if needed, then force split
    return _chunk_text(text, MAX_TTS_BYTES, [SENTENCE_SPLIT_REGEX, COMMA_SPLIT_REGEX])


async def _synthesize_to_bytes(text: str, voice: str) -> bytes:
    client = _get_client()

    synthesis_input = texttospeech.SynthesisInput(text=text)

    voice_params = texttospeech.VoiceSelectionParams(
        language_code="ja-JP",
        name=voice,
    )

    # 環境変数から再生速度を取得（デフォルト: 2.0倍速）
    speaking_rate = float(os.getenv("TTS_SPEAKING_RATE", "2.0"))

    audio_config = texttospeech.AudioConfig(
        audio_encoding=texttospeech.AudioEncoding.MP3,
        speaking_rate=speaking_rate,
    )

    def _call_api() -> bytes:
        response = client.synthesize_speech(
            input=synthesis_input,
            voice=voice_params,
            audio_config=audio_config,
        )
        return response.audio_content

    try:
        return await asyncio.to_thread(_call_api)
    except (GoogleAPICallError, RetryError) as exc:
        logger.error("Google Cloud TTS API error: %s", exc)
        raise HTTPException(status_code=502, detail=f"Google Cloud TTS error: {exc}")
    except Exception as exc:
        logger.error("Unexpected synthesis error: %s", exc)
        raise HTTPException(status_code=500, detail=f"Unexpected error: {exc}")


@app.get("/")
async def root():
    return {"message": "Audicle API Server is running", "version": "1.0.0"}


@app.post("/extract", response_model=ExtractResponse)
async def extract_content(request: ExtractRequest):
    """URLから本文を抽出する"""
    try:
        # Node.jsスクリプトを実行してReadability.jsで本文抽出
        proc = await asyncio.create_subprocess_exec(
            "node",
            "readability_script.js",
            request.url,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        try:
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=30)
        except asyncio.TimeoutError:
            proc.kill()
            await proc.communicate()
            raise subprocess.TimeoutExpired(
                ["node", "readability_script.js", request.url], 30
            )

        if proc.returncode != 0:
            raise HTTPException(
                status_code=400,
                detail=f"Extraction failed: {stderr.decode('utf-8', errors='replace')}",
            )

        # JSONレスポンスをパース
        extracted_data = json.loads(stdout.decode("utf-8", errors="replace"))

        return ExtractResponse(
            title=extracted_data.get("title", ""),
            chunks=extracted_data.get("chunks", []),
        )

    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=408, detail="Extraction timeout")
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Failed to parse extraction result")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


async def _synthesize_chunks_in_parallel(
    text_chunks: list[str], voice: str
) -> list[bytes]:
    global _tts_semaphore
    if _tts_semaphore is None:
        max_concurrency = MAX_CONCURRENT_TTS_REQUESTS
        _tts_semaphore = asyncio.Semaphore(max_concurrency)

    async def _synthesize_chunk(
        chunk_text: str, voice_name: str, index: int, total: int
    ) -> bytes:
        async with _tts_semaphore:
            logger.info("Synthesizing chunk %d/%d", index + 1, total)
            result = await _synthesize_to_bytes(chunk_text, voice_name)
            logger.debug("Chunk %d/%d completed", index + 1, total)
            return result

    tasks = [
        _synthesize_chunk(chunk, voice, i, len(text_chunks))
        for i, chunk in enumerate(text_chunks)
    ]

    results: list[bytes | BaseException] = await asyncio.gather(
        *tasks, return_exceptions=True
    )

    errors = [r for r in results if isinstance(r, BaseException)]
    if errors:
        logger.error(
            "Synthesis failed for %d/%d chunks: %s",
            len(errors),
            len(results),
            "; ".join(f"{type(e).__name__}: {e}" for e in errors[:3]),
        )
        raise RuntimeError(
            f"Synthesis failed for {len(errors)} out of {len(results)} chunks: "
            + "; ".join(f"{type(e).__name__}: {e}" for e in errors[:3])
            + (f" (and {len(errors) - 3} more)" if len(errors) > 3 else "")
        )

    return [cast(bytes, result) for result in results]


async def _handle_synthesis_fallback(e: Exception) -> Response:
    logger.error("Synthesis error: %s", str(e))
    try:
        logger.info("Attempting fallback: returning test audio file")

        fallback_path = "fallback.mp3"
        if os.path.exists(fallback_path):
            async with aiofiles.open(fallback_path, "rb") as fallback_file:
                fallback_audio = await fallback_file.read()

            content_disposition = "attachment; filename=fallback.mp3"
            return Response(
                content=fallback_audio,
                media_type="audio/mpeg",
                headers={
                    "Content-Disposition": content_disposition,
                    "X-Fallback": "true",
                    "X-Error": "synthesis_failed",
                },
            )
        else:
            logger.warning("Fallback audio file not found, returning empty response")
            content_disposition_empty = "attachment; filename=empty.mp3"
            return Response(
                content=b"",
                media_type="audio/mpeg",
                headers={
                    "Content-Disposition": content_disposition_empty,
                    "X-Fallback": "true",
                    "X-Error": "synthesis_failed",
                },
            )

    except Exception as fallback_error:
        logger.error("Fallback also failed: %s", str(fallback_error))
        raise HTTPException(
            status_code=500,
            detail="Synthesis failed and fallback response generation also failed.",
        )


@app.post("/synthesize")
async def synthesize_speech(request: SynthesizeRequest):
    """テキストを音声化してMP3を返す"""
    try:
        logger.info("Synthesizing text: %s...", request.text[:100])
        logger.info("Using voice: %s", request.voice)

        text_chunks = await asyncio.to_thread(_split_text, request.text)
        logger.info("Split text into %d chunks", len(text_chunks))

        logger.info("Synthesizing %d chunks in parallel", len(text_chunks))

        audio_chunks = await _synthesize_chunks_in_parallel(text_chunks, request.voice)
        full_audio = b"".join(audio_chunks)

        return Response(
            content=full_audio,
            media_type="audio/mpeg",
            headers={"Content-Disposition": "attachment; filename=speech.mp3"},
        )

    except HTTPException:
        raise
    except Exception as e:
        return await _handle_synthesis_fallback(e)


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
