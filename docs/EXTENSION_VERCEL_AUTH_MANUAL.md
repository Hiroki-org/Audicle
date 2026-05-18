# Audicle 拡張機能 Vercel連携マニュアル

このドキュメントでは、Chrome拡張機能からVercel版Audicleの音声合成API (`/api/synthesize`) を利用するための仕組みと、その利用方法・開発手順について説明します。

---

## 👤 一般ユーザー向け（使い方）

拡張機能を使って、現在見ているWebページの本文を高音質なGoogle Cloud TTS（Vercel版API経由）で読み上げる手順です。

### 1. ログイン設定

Vercel版APIを利用するには、拡張機能からAudicleへのログインが必要です。

1. ブラウザ右上の拡張機能アイコンから **Audicle** をクリックしてポップアップを開きます。
2. 「Audicle 未ログイン」と表示されている場合、**「Audicle にログイン」** ボタンをクリックします。
3. 新しいウィンドウが開き、AudicleのWeb画面が表示されます。Googleアカウント等でログインしてください。
4. ログインが完了するとウィンドウが自動的に閉じ、ポップアップに **「ログイン中: (あなたのメールアドレス)」** と表示されます。

### 2. 読み上げの実行

1. 読み上げたい記事のページを開きます（ログインが必要な有料記事などのページでも動作します）。
2. ポップアップの **「読み上げモード」** をONにします。
3. ページ内の読み上げを開始したい段落をクリックすると、Vercel版APIを経由して音声データが取得され、再生が始まります。

### 3. トラブルシューティング

- **「Audicle のログイン期限が切れました。再ログインしてください。」**
  - 認証トークンの有効期限（デフォルト7日間）が切れています。ポップアップから再度ログインを行ってください。
- **「Audicle へのアクセス権限がありません。管理者にお問い合わせください。」**
  - あなたのメールアドレスが、Vercel版APIの利用許可リスト (`ALLOWED_EMAILS`) に登録されていません。管理者に連絡してアクセス権をリクエストしてください。

---

## 💻 開発者向け（セットアップと仕様）

開発環境を構築し、拡張機能の認証連携をテストするための手順です。

### 1. 必要な環境変数

Vercel版アプリ (`packages/web-app-vercel`) を動作させるため、`.env.local` に以下の環境変数を設定してください。

```env
# APIを利用可能なメールアドレス（カンマ区切り）
ALLOWED_EMAILS=user1@example.com,user2@example.com

# 拡張機能からのCORSリクエストを許可するOrigin
# Chromeの「拡張機能を管理」ページで確認できるIDを指定します
ALLOWED_ORIGINS=http://localhost:3000,chrome-extension://<あなたの拡張機能ID>

# OAuthのコールバック先として許可する拡張機能のURL
ALLOWED_EXTENSION_REDIRECT_ORIGINS=https://<あなたの拡張機能ID>.chromiumapp.org

# (オプション) 拡張機能トークン署名用のシークレット
# 未設定の場合は AUTH_SECRET にフォールバックします
EXTENSION_AUTH_SECRET=your-random-secret
```

### 2. 拡張機能のローカル設定 (`config.json`)

ローカル開発中のVercelアプリ (`http://localhost:3000`) に拡張機能を接続する場合、`packages/chrome-extension/config.json` を以下のように書き換えてから、Chromeの拡張機能ページで「再読み込み」を行ってください。

```json
{
  "synthesizerType": "vercel_app",
  "serverUrls": {
    "vercel_app": "http://localhost:3000"
  }
}
```
※本番向けにリリース・ビルドする前に、この値を本番URL (`https://audicle-phi.vercel.app` 等) に戻すことを忘れないでください。

### 3. 認証・連携のアーキテクチャ

本機能は、ブラウザのCookie共有に依存しない**Bearerトークン認証（JWT）**を採用しています。これにより、サードパーティCookieの制限を受けずに安定した通信が可能です。

1. **ログインフロー**: 
   - 拡張機能が `chrome.identity.launchWebAuthFlow` を呼び出し、Vercelの `/extension/login` にアクセスします。
   - NextAuthのセッションが存在しない場合はログイン画面へリダイレクトします。
   - ログイン済みの場合、`/api/extension/token` にてJWT（拡張機能用トークン）を発行し、`https://<id>.chromiumapp.org/audicle-auth#access_token=...` へリダイレクトすることで拡張機能側に安全にトークンを渡します。
2. **アクセス制御**:
   - `/api/extension/token` (発行時) および `/api/synthesize` (音声合成時) の両方で `ALLOWED_EMAILS` による利用権限チェックが行われます。
3. **メタデータ連携と音声取得**:
   - `content.js` はページURL (`articleUrl`) と設定された `voiceModel` を抽出し、`background.js` に送信します。
   - `background.js` ( `VercelAppSynthesizer` ) は保存されたJWTを `Authorization: Bearer <token>` ヘッダーに付与し、`/api/synthesize` を呼び出します。これにより、キャッシュ生成時に参照元URLなどのメタデータがWeb App側に正しく保存されます。
