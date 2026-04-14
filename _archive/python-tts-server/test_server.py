#!/usr/bin/env python3
"""
Edge TTS Server テスト用スクリプト
サーバーが正常に動作しているかテストします
"""

import requests
import tempfile
import os

SERVER_URL = "http://localhost:8001"

def test_health_check():
    """ヘルスチェックのテスト"""
    print("🔍 ヘルスチェックをテスト中...")
    try:
        response = requests.get(f"{SERVER_URL}/")
        print(f"ステータス: {response.status_code}")
        print(f"レスポンス: {response.json()}")
        return response.status_code == 200
    except Exception as e:
        print(f"❌ エラー: {e}")
        return False

def test_voices():
    """音声リスト取得のテスト"""
    print("\n🎤 音声リスト取得をテスト中...")
    try:
        response = requests.get(f"{SERVER_URL}/voices")
        print(f"ステータス: {response.status_code}")
        voices = response.json()
        print(f"日本語音声数: {len(voices['voices'])}")
        if voices['voices']:
            print("利用可能な音声:")
            for voice in voices['voices'][:3]:  # 最初の3つを表示
                print(f"  - {voice['display_name']} ({voice['name']})")
        return response.status_code == 200
    except Exception as e:
        print(f"❌ エラー: {e}")
        return False

def test_synthesize():
    """音声合成のテスト"""
    print("\n🔊 音声合成をテスト中...")
    try:
        data = {
            "text": "こんにちは、Audicleの音声合成テストです。",
            "voice": "ja-JP-NanamiNeural"
        }
        
        response = requests.post(f"{SERVER_URL}/synthesize", json=data)
        print(f"ステータス: {response.status_code}")
        print(f"Content-Type: {response.headers.get('content-type')}")
        
        if response.status_code == 200:
            # 一時ファイルに保存してテスト
            with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as temp_file:
                temp_file.write(response.content)
                temp_filename = temp_file.name
            
            file_size = os.path.getsize(temp_filename)
            print(f"生成されたMP3ファイルサイズ: {file_size} bytes")
            
            # ファイルクリーンアップ
            os.unlink(temp_filename)
            
            return file_size > 0
        else:
            print(f"❌ エラーレスポンス: {response.text}")
            return False
    except Exception as e:
        print(f"❌ エラー: {e}")
        return False

def test_simple_synthesize():
    """シンプル音声合成のテスト (Audicle互換性)"""
    print("\n🔄 シンプル音声合成をテスト中...")
    try:
        data = {"text": "これはシンプルな音声合成のテストです。"}
        
        response = requests.post(f"{SERVER_URL}/synthesize/simple", json=data)
        print(f"ステータス: {response.status_code}")
        
        if response.status_code == 200:
            file_size = len(response.content)
            print(f"生成されたMP3データサイズ: {file_size} bytes")
            return file_size > 0
        else:
            print(f"❌ エラーレスポンス: {response.text}")
            return False
    except Exception as e:
        print(f"❌ エラー: {e}")
        return False

def main():
    print("🧪 Edge TTS Server テスト開始")
    print(f"📡 サーバーURL: {SERVER_URL}")
    print("=" * 50)
    
    # テスト実行
    tests = [
        ("ヘルスチェック", test_health_check),
        ("音声リスト取得", test_voices), 
        ("音声合成", test_synthesize),
        ("シンプル音声合成", test_simple_synthesize)
    ]
    
    results = []
    for test_name, test_func in tests:
        result = test_func()
        results.append((test_name, result))
    
    # 結果表示
    print("\n" + "=" * 50)
    print("🏁 テスト結果")
    for test_name, result in results:
        status = "✅ 成功" if result else "❌ 失敗"
        print(f"{status}: {test_name}")
    
    success_count = sum(1 for _, result in results if result)
    print(f"\n📊 成功: {success_count}/{len(results)}")
    
    if success_count == len(results):
        print("🎉 すべてのテストが成功しました！")
    else:
        print("⚠️  一部のテストが失敗しました。サーバーの状態を確認してください。")

if __name__ == "__main__":
    main()