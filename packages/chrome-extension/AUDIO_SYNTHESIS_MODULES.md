# Audio Synthesis Modules List

List of available audio synthesis engines for Audicle and how to configure them.

## 🎯 Overview

Audicle adopts a loosely coupled audio synthesis module design, allowing you to switch between multiple audio synthesis engines.
Specify the engine to use in `config.json` under `synthesizerType`.

## 📋 Available Modules

### 1. Google TTS (Default)

**Value**: `"google_tts"`

```json
{
  "synthesizerType": "google_tts"
}
```

**Features**:

- ✅ **High Quality**: Uses Google Translate's audio synthesis engine.
- ✅ **Japanese Support**: Natural Japanese reading.
- ✅ **English Support**: Appropriately reads English text as well.
- ✅ **Free**: No additional cost.
- ⚠️ **Internet Required**: Internet connection is required.
- ⚠️ **Unofficial**: Unofficial use of Google Translate.

**Use Cases**:

- Reading general articles.
- Content mixed with Japanese and English.
- When high-quality audio is required without setup.

**Technical Details**:

- Endpoint: `https://translate.google.com/translate_tts`
- Audio Format: MP3
- Language: Japanese (tl=ja)

---

### 2. API Server (New Standard Backend)

**Value**: `"api_server"`

```json
{
  "synthesizerType": "api_server"
}
```

**Features**:

- ✅ **High Quality**: Uses Google Cloud Text-to-Speech API (WaveNet / Neural2).
- ✅ **Stability**: Stable operation via official API.
- ✅ **Customizable**: Voice type and speed can be adjusted.
- ✅ **Secure**: API keys are managed on the server side.
- ⚠️ **Server Required**: Requires `packages/api-server` to be running.

**Use Cases**:

- Long-term operation in a stable production environment.
- When the highest quality audio is required.
- When fine-grained control over reading parameters is needed.

**Technical Details**:

- Server: `packages/api-server` (http://localhost:8000)
- Audio Format: MP3
- Default Voice: ja-JP-Neural2-B (Google Cloud TTS)

**Setup Instructions**:

1. **Start API Server**:

   ```bash
   cd packages/api-server
   docker-compose up -d
   ```

2. **Change Configuration**:

   ```json
   {
     "synthesizerType": "api_server"
   }
   ```

3. **Reload Extension**: Update the Chrome extension.

## 🔧 Configuration

### 1. Edit Configuration File

Edit `packages/chrome-extension/config.json`:

```json
{
  "synthesizerType": "google_tts" // or "api_server"
}
```

### 2. Reload Extension

1. Open `chrome://extensions/`.
2. Click the "Update" button for the Audicle extension.
3. The settings will be applied.

### 3. Verify Operation

- Run the reading function on any page.
- Check the following logs in the Console:
  ```
  [GoogleTTSSynthesizer] Synthesizing: "Text content"
  ```
  or
  ```
  [APIServerSynthesizer] Synthesizing: "Text content"
  ```

## 🚀 Adding New Modules

### Architecture Overview

```javascript
// 1. Base Class
class AudioSynthesizer {
  async synthesize(text) {
    // Implementation required
  }
}

// 2. Concrete Class
class NewSynthesizer extends AudioSynthesizer {
  async synthesize(text) {
    // Unique audio synthesis logic
  }
}

// 3. Factory Registration
class SynthesizerFactory {
  static create(type) {
    switch (type) {
      case "new_engine":
        return new NewSynthesizer();
      // ...
    }
  }
}
```

### Implementation Steps

1. **Create New Class**: Add a new Synthesizer class to `background.js`.
2. **Register in Factory**: Add a new case to `SynthesizerFactory.create()`.
3. **Add Config Value**: Enable specifying the new `synthesizerType` in `config.json`.
4. **Run Tests**: Verify operation and debug.

## 🚨 Notes

### When Using Google TTS (Unofficial)

- **Usage Limits**: Possibility of being blocked with large request volumes.
- **Privacy**: Text is sent to Google servers.
- **Stability**: Possibility of becoming unavailable in the future due to unofficial API.

### When Using API Server

- **Docker Required**: Docker and Docker Compose environment required.
- **GCP Credentials**: Google Cloud service account key required.

### When Changing Settings

- **Reload Required**: Must reload the extension after changing settings.
- **Cache Clear**: Old audio data might be cached.
