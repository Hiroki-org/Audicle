"""
Docker版 Edge TTS API Server for Audicle
テキストを受け取ってEdge TTSで音声合成し、MP3として返すサーバー
LAN内の他PCからアクセス可能なDocker化されたバージョン
"""

from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import edge_tts
import io
import tempfile
import os
from typing import Optional

app = FastAPI(title="Docker Edge TTS Server", version="1.0.0")

class SynthesizeRequest(BaseModel):
    text: str
    voice: Optional[str] = "ja-JP-NanamiNeural"  # デフォルトは日本語の女性音声
    rate: Optional[str] = "+0%"  # 話速 (+50%, -25%など)

class HealthResponse(BaseModel):
    status: str
    message: str
    version: str
    container_info: str

@app.get("/", response_model=HealthResponse)
async def health_check():
    """サーバーの状態確認"""
    return HealthResponse(
        status="ok", 
        message="Docker Edge TTS Server is running",
        version="1.0.0",
        container_info="Dockerized for LAN access"
    )

@app.get("/voices")
async def list_voices():
    """利用可能な音声一覧を取得"""
    voices = await edge_tts.list_voices()
    # 日本語音声のみを抽出してフィルタリング
    japanese_voices = [
        {
            "name": voice["Name"],
            "display_name": voice["DisplayName"], 
            "locale": voice["Locale"],
            "gender": voice["Gender"]
        }
        for voice in voices 
        if voice["Locale"].startswith("ja")
    ]
    return {"voices": japanese_voices}

@app.post("/synthesize")
async def synthesize_text(request: SynthesizeRequest):
    """
    テキストを音声に変換してMP3として返す
    Audicleからのリクエストを受け取るメインエンドポイント
    """
    try:
        if not request.text.strip():
            raise HTTPException(status_code=400, detail="テキストが空です")
        
        # Edge TTSで音声合成（pitch パラメータを削除）
        communicate = edge_tts.Communicate(
            request.text, 
            request.voice, 
            rate=request.rate
        )
        
        # 一時ファイルに保存
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as temp_file:
            temp_filename = temp_file.name
            
        # 音声データを生成して保存
        await communicate.save(temp_filename)
        
        # ファイルを読み込んでバイナリデータとして返す
        def generate():
            try:
                with open(temp_filename, "rb") as audio_file:
                    while True:
                        chunk = audio_file.read(8192)
                        if not chunk:
                            break
                        yield chunk
            finally:
                # 一時ファイルを削除
                if os.path.exists(temp_filename):
                    os.unlink(temp_filename)
        
        return StreamingResponse(
            generate(),
            media_type="audio/mpeg",
            headers={"Content-Disposition": "attachment; filename=synthesized.mp3"}
        )
        
    except Exception as e:
        # 一時ファイルのクリーンアップ
        if 'temp_filename' in locals() and os.path.exists(temp_filename):
            os.unlink(temp_filename)
        raise HTTPException(status_code=500, detail=f"音声合成エラー: {str(e)}")

@app.post("/synthesize/simple")
async def synthesize_simple(request: dict):
    """
    シンプルな音声合成エンドポイント（既存のAudicle互換性用）
    {"text": "こんにちは"} の形式で受け取る
    """
    text = request.get("text", "")
    if not text.strip():
        raise HTTPException(status_code=400, detail="テキストが空です")
    
    # ログに受信テキストを表示（先頭50文字まで）
    display_text = text[:50] + "..." if len(text) > 50 else text
    print(f"🐳 [Docker TTS Request] Text: '{display_text}' (length: {len(text)})")
    
    # SynthesizeRequestに変換して既存の処理を再利用
    synthesize_request = SynthesizeRequest(text=text)
    return await synthesize_text(synthesize_request)

if __name__ == "__main__":
    import uvicorn
    print("🐳 Docker Edge TTS Server starting...")
    print("📡 API docs: http://0.0.0.0:8001/docs")
    print("🔊 Synthesize endpoint: http://0.0.0.0:8001/synthesize")
    print("🌐 LAN access enabled - accessible from other devices")
    uvicorn.run(app, host="0.0.0.0", port=8001)