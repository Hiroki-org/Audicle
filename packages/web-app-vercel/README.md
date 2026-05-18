# Audicle Web App (Vercel 版)

[![codecov](https://codecov.io/gh/is0692vs/Audicle/branch/main/graph/badge.svg)](https://codecov.io/gh/is0692vs/Audicle)

**完全サーバーレス構成**の Next.js 15 アプリケーション。Vercel にデプロイ可能で、外部 API サーバー不要。音楽プレイヤーのような直感的な UI で、Web ページの記事を音声読み上げします。

> **注意**: このプロジェクトは`web-app`（セルフホスト版）とは異なり、完全にサーバーレスです。外部 API サーバー（FastAPI）は不要です。

## ✨ 主な機能

- **記事抽出・表示**: URL から本文を抽出し、チャンク単位で表示（サーバーレス）
- **音声合成**: Google Cloud Text-to-Speech API で高品質な音声合成（サーバーレス）
- **音声再生**: 連続再生、自動スクロール、クリック再生（Seek 機能）
- **速度調整**: 0.8x〜3.0x の可変速再生
- **記事管理**: 保存した記事の一覧表示と管理機能
- **音声キャッシュ**: 3 チャンク先読みによるスムーズな再生
- **認証**: Google OAuth によるアクセス制御
- **ログ機能**: 詳細なデバッグ情報出力
- **レスポンシブデザイン**: モバイル・デスクトップ対応
- **Web Share Target API**: スマホから共有メニューで記事を直接プレイリストに追加（PWA 対応）

## 🛠️ 技術スタック

- **Framework**: Next.js 15 (App Router, API Routes)
- **Runtime**: Node.js (Vercel Serverless Functions)
- **UI**: React 19, TypeScript
- **Styling**: Tailwind CSS 4
- **Audio**: Web Audio API
- **Storage**: localStorage (記事保存)
- **Cache**: Map-based メモリキャッシュ
- **TTS**: Google Cloud Text-to-Speech API
- **Auth**: NextAuth 5.0 (Google OAuth)
- **Extraction**: Mozilla Readability + JSDOM

## 🏗️ アーキテクチャ

```
web-app-vercel/
├── app/
│   ├── api/                # サーバーレスAPI Routes
│   │   ├── extract/        # 記事抽出エンドポイント
│   │   └── synthesize/     # 音声合成エンドポイント
│   ├── layout.tsx          # ルートレイアウト
│   ├── page.tsx            # 記事一覧ページ
│   └── reader/             # リーダーページ
├── components/
│   └── ReaderView.tsx      # 記事表示コンポーネント
├── lib/
│   ├── api.ts              # APIクライアント（内部API Routes呼び出し）
│   ├── auth.ts             # NextAuth設定
│   └── ...
└── vercel.json             # Vercel設定（Node.js Runtime指定）
```

**重要な違い**:

- ❌ 外部 API サーバー（FastAPI）は不要
- ✅ `/api/extract`, `/api/synthesize` は内部エンドポイント
- ✅ 同一オリジンのため、CORS 不要

詳細は [ARCHITECTURE.md](./ARCHITECTURE.md) を参照してください。

## 🚀 クイックスタート

### 前提条件

- Node.js 18+
- Google Cloud プロジェクト（Text-to-Speech API 有効化）
- Google OAuth クライアント（認証用）

### インストール & 起動

```bash
# 依存関係インストール
npm install

# 環境変数設定（.env.local作成）
cp .env.example .env.local
# .env.localを編集して必要な値を設定

# 開発サーバー起動
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開いて使用開始。

### 本番ビルド

```bash
npm run build
npm start
```

## ⚙️ 環境変数

`.env.local` または Vercel ダッシュボードで設定：

```bash
# Google Cloud TTS
GOOGLE_APPLICATION_CREDENTIALS_JSON={"type":"service_account",...}

# NextAuth (Google OAuth)
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
AUTH_SECRET=your-random-secret

# アクセス制御
ALLOWED_USERS=user1@example.com,user2@example.com
ALLOWED_EMAILS=user1@example.com,user2@example.com
```

### 環境変数の取得方法

1. **Google Cloud TTS**

   - [Google Cloud Console](https://console.cloud.google.com/)でプロジェクト作成
   - Text-to-Speech API を有効化
   - サービスアカウントを作成して JSON キーをダウンロード
   - JSON の内容を 1 行に圧縮して`GOOGLE_APPLICATION_CREDENTIALS_JSON`に設定（推奨）
   - もし JSON が複数行で管理されている場合は base64 化して 1 行で設定できます:
     `export GOOGLE_APPLICATION_CREDENTIALS_JSON=$(cat /path/to/key.json | base64 -w 0)`
   - もしくは標準のファイルパス環境変数 `GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json` を使用する方法もサポートします。

2. **Google OAuth**

   - [Google Cloud Console](https://console.cloud.google.com/)で認証情報作成
   - OAuth 2.0 クライアント ID を作成（Web アプリケーション）
   - リダイレクト URI に`https://your-domain.vercel.app/api/auth/callback/google`を追加

3. **AUTH_SECRET**
   - ランダムな文字列を生成（例: `openssl rand -base64 32`）

## 📱 使用方法

### 記事読み上げ

1. **記事一覧ページ** (`/`) にアクセス
2. **「+ 新しい記事を読む」** をクリック
3. **記事 URL を入力** して「読込」
4. **再生ボタン** をクリックして音声読み上げ開始

### 記事管理

- **記事一覧**: 保存済み記事の一覧表示
- **記事削除**: 各記事の削除ボタンで削除
- **記事再読**: タイトルクリックでリーダーページへ

### 再生コントロール

- **再生/一時停止**: 緑ボタンで切り替え
- **停止**: 赤ボタンで完全停止
- **Seek**: 任意の段落をクリックでそこから再生
- **自動スクロール**: 再生中の段落が自動で中央表示

### スマホから記事を共有（Web Share Target API）

スマホの Chrome で記事を開いている際に、**「共有」→「Audicle」** を選択することで、記事を読み込みプレイリストに直接追加できます。

#### 使い方

1. スマホの Chrome で記事ページを開く
2. 共有メニューを開く（通常は画面上部の共有アイコン）
3. 共有先として **「Audicle」** を選択
4. Audicle が開き、記事が自動的に読み込みプレイリストに追加される
5. 画面が自動的に閉じて元のページに戻る

#### 要件

- **ログイン済み**: 同じブラウザで Audicle にログインしている必要があります
- **PWA インストール**: PWA としてインストールしていない場合でも、ブラウザ内で動作します
- **同期**: Supabase 経由で PC と同期されるため、スマホで共有した記事を PC で再生できます

> **注**: Web Share Target API の仕様上、PWA は一瞬開く必要があります。完全にバックグラウンドでの処理はネイティブアプリ（iOS Share Extension / Android Share Intent）でのみ可能です。

## 🧪 テスト

プロジェクトには、単体テスト、結合テスト、E2E テストが含まれています。

### すべてのテストを実行

```bash
npm test
```

### 単体テスト

React コンポーネントやカスタムフック、ユーティリティ関数など、個別のモジュールが対象です。

```bash
npm run test:unit
```

### 結合テスト

API Routes など、複数のモジュールが連携する機能のテストです。

```bash
npm run test:integration
```

### E2E (End-to-End) テスト

Playwright を使用して、実際のブラウザでアプリケーション全体の動作をテストします。

```bash
# ヘッドレスモードで実行
npm run test:e2e

# UI 付きで実行
npm run test:e2e:ui
```

### テストカバレッジ

テストカバレッジレポートを生成します。

```bash
npm run test:coverage
```

## 🏗️ アーキテクチャ

```
packages/web-app/
├── app/
│   ├── layout.tsx          # ルートレイアウト
│   ├── page.tsx            # 記事一覧ページ
│   └── reader/page.tsx     # リーダーページ
├── components/
│   └── ReaderView.tsx      # 記事表示コンポーネント
├── hooks/
│   └── usePlayback.ts      # 再生制御フック
├── lib/
│   ├── api.ts              # APIクライアント
│   ├── audioCache.ts       # 音声キャッシュ
│   ├── logger.ts           # ログユーティリティ
│   └── storage.ts          # 記事ストレージ
└── types/
    └── api.ts              # 型定義
```

## 🔧 開発

### 主要コンポーネント

- **ReaderView**: 記事本文の表示とハイライト
- **usePlayback**: 音声再生のオーケストレーション
- **audioCache**: 音声データのキャッシュ管理
- **articleStorage**: localStorage ベースの記事保存

### 拡張方法

#### 新しい TTS エンジンの追加

`lib/api.ts` の `synthesizeSpeech` 関数を拡張：

```typescript
export async function synthesizeSpeech(
  text: string,
  voice = "ja-JP-Wavenet-B"
): Promise<Blob> {
  // エンジン選択ロジックを追加
  const engine = getSelectedEngine();
  return engine.synthesize(text, voice);
}
```

#### キャッシュ戦略のカスタマイズ

`lib/audioCache.ts` の `AudioCache` クラスを拡張：

```typescript
class AudioCache {
  // キャッシュサイズ制限を追加
  private maxSize = 50;
  // 永続化機能を追加
  saveToStorage() {
    /* ... */
  }
}
```

## 📊 パフォーマンス

- **初回再生**: API 呼び出し + 音声合成（~2-3 秒）
- **キャッシュ再生**: 即時再生（~0.1 秒）
- **先読み**: 3 チャンク分の音声をバックグラウンドで準備
- **メモリ使用**: 24 時間自動クリーンアップ

## 🐛 トラブルシューティング

### API サーバーが接続できない

```bash
# APIサーバーの起動確認
cd ../api-server
docker-compose ps

# ログ確認
docker-compose logs api-server
```

### 音声が再生されない

```bash
# ブラウザのコンソールを確認
# CORSエラーやネットワークエラーがないかチェック
```

### キャッシュが効かない

```bash
# コンソールで "CACHE MISS" が表示されるか確認
# 同じテキストで再テストして "CACHE HIT" になるか確認
```

## 📖 関連ドキュメント

- [プロジェクト全体 README](../../README.md)
- [開発ブランチレポート](BRANCH_REPORT.md)
- [実装完了レポート](COMPLETION_REPORT.md)
- [API サーバー仕様](../api-server/README.md)
