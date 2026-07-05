#!/usr/bin/env python3
"""
Edge TTS Server テスト用スクリプト (Async)
サーバーが正常に動作しているかテストします
"""

import aiohttp
import asyncio
import os
import tempfile
import time

SERVER_URL = "http://localhost:8001"

async def test_health_check(session):
    """ヘルスチェックのテスト"""
    print("🔍 ヘルスチェックをテスト中...")
    try:
        async with session.get(f"{SERVER_URL}/") as response:
            status = response.status
            data = await response.json()
            print(f"ヘルスチェック ステータス: {status}")
            print(f"ヘルスチェック レスポンス: {data}")
            return status == 200
    except Exception as e:
        print(f"❌ ヘルスチェック エラー: {e}")
        return False

async def test_voices(session):
    """音声リスト取得のテスト"""
    print("🎤 音声リスト取得をテスト中...")
    try:
        async with session.get(f"{SERVER_URL}/voices") as response:
            status = response.status
            voices = await response.json()
            print(f"音声リスト ステータス: {status}")
            print(f"日本語音声数: {len(voices['voices'])}")
            if voices['voices']:
                print("利用可能な音声 (一部):")
                for voice in voices['voices'][:3]:
                    print(f"  - {voice['display_name']} ({voice['name']})")
            return status == 200
    except Exception as e:
        print(f"❌ 音声リスト エラー: {e}")
        return False

async def test_synthesize(session):
    """音声合成のテスト"""
    print("🔊 音声合成をテスト中...")
    try:
        data = {
            "text": "こんにちは、Audicleの音声合成テストです。",
            "voice": "ja-JP-NanamiNeural"
        }
        
        async with session.post(f"{SERVER_URL}/synthesize", json=data) as response:
            status = response.status
            content_type = response.headers.get('content-type')
            print(f"音声合成 ステータス: {status}, Content-Type: {content_type}")
            
            if status == 200:
                content = await response.read()

                # 一時ファイルに保存してテスト
                with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as temp_file:
                    temp_file.write(content)
                    temp_filename = temp_file.name

                file_size = os.path.getsize(temp_filename)
                print(f"生成されたMP3ファイルサイズ: {file_size} bytes")

                # ファイルクリーンアップ
                os.unlink(temp_filename)

                return file_size > 0
            else:
                text = await response.text()
                print(f"❌ 音声合成 エラーレスポンス: {text}")
                return False
    except Exception as e:
        print(f"❌ 音声合成 エラー: {e}")
        return False

async def test_simple_synthesize(session):
    """シンプル音声合成のテスト (Audicle互換性)"""
    print("🔄 シンプル音声合成をテスト中...")
    try:
        data = {"text": "これはシンプルな音声合成のテストです。"}
        
        async with session.post(f"{SERVER_URL}/synthesize/simple", json=data) as response:
            status = response.status
            print(f"シンプル音声合成 ステータス: {status}")

            if status == 200:
                content = await response.read()
                file_size = len(content)
                print(f"生成されたMP3データサイズ: {file_size} bytes")
                return file_size > 0
            else:
                text = await response.text()
                print(f"❌ シンプル音声合成 エラーレスポンス: {text}")
                return False
    except Exception as e:
        print(f"❌ シンプル音声合成 エラー: {e}")
        return False

async def main():
    print("🧪 Edge TTS Server テスト開始")
    print(f"📡 サーバーURL: {SERVER_URL}")
    print("=" * 50)
    
    async with aiohttp.ClientSession() as session:
        tests = [
            ("ヘルスチェック", test_health_check(session)),
            ("音声リスト取得", test_voices(session)),
            ("音声合成", test_synthesize(session)),
            ("シンプル音声合成", test_simple_synthesize(session))
        ]

        start_time = time.time()
        # テストを並行実行
        results_data = await asyncio.gather(*(t[1] for t in tests))
        end_time = time.time()

        results = list(zip([t[0] for t in tests], results_data))

        # 結果表示
        print("\n" + "=" * 50)
        print("🏁 テスト結果")
        for test_name, result in results:
            status = "✅ 成功" if result else "❌ 失敗"
            print(f"{status}: {test_name}")

        success_count = sum(1 for _, result in results if result)
        print(f"\n📊 成功: {success_count}/{len(results)}")
        print(f"⏱️ 実行時間: {end_time - start_time:.3f}秒")

        if success_count == len(results):
            print("🎉 すべてのテストが成功しました！")
        else:
            print("⚠️  一部のテストが失敗しました。サーバーの状態を確認してください。")

if __name__ == "__main__":
    asyncio.run(main())
