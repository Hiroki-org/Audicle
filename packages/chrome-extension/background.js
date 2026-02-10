// background.js

// 音声合成の統一インターフェース
class AudioSynthesizer {
  constructor() {}

  /**
   * テキストを音声に変換してaudioDataUrlを返す
   * @param {string} text - 変換するテキスト
   * @returns {Promise<string>} - audioDataUrl (data:audio/mpeg;base64,...)
   */
  async synthesize(text) {
    throw new Error("synthesize method must be implemented");
  }
}

// Google翻訳TTS実装
class GoogleTTSSynthesizer extends AudioSynthesizer {
  constructor() {
    super();
  }

  async synthesize(text) {
    const cleanedText = cleanText(text);
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&q=${encodeURIComponent(
      cleanedText
    )}&tl=ja`;

    const response = await fetch(ttsUrl);
    const blob = await response.blob();

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsDataURL(blob);
    });
  }
}

// テスト用TTS実装（常にsample.mp3を返す）
class TestSynthesizer extends AudioSynthesizer {
  constructor() {
    super();
  }

  async synthesize(text) {
    console.log(
      `[TestSynthesizer] Request for text: "${text}" - returning sample.mp3`
    );

    const sampleUrl = chrome.runtime.getURL("sample.mp3");
    const response = await fetch(sampleUrl);
    const blob = await response.blob();

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsDataURL(blob);
    });
  }
}

// Edge TTS実装（Python TTS Serverを使用）
class EdgeTTSSynthesizer extends AudioSynthesizer {
  constructor(config) {
    super();
    this.serverUrl = config.serverUrls?.edge_tts || "http://localhost:8001";
  }

  async synthesize(text) {
    console.log(`[EdgeTTSSynthesizer] Synthesizing: "${text}"`);

    try {
      const cleanedText = cleanText(text);

      const response = await fetch(`${this.serverUrl}/synthesize/simple`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: cleanedText,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Edge TTS Server error: ${response.status} ${response.statusText}`
        );
      }

      const blob = await response.blob();

      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error(`[EdgeTTSSynthesizer] Error:`, error);
      throw new Error(`Edge TTS synthesis failed: ${error.message}`);
    }
  }
}

// Docker Edge TTS実装（Docker化されたTTS Serverを使用）
class EdgeTTSDockerSynthesizer extends AudioSynthesizer {
  constructor(config) {
    super();
    this.serverUrl =
      config.serverUrls?.edge_tts_docker || "http://localhost:8001";
  }

  async synthesize(text) {
    console.log(`[EdgeTTSDockerSynthesizer] Synthesizing: "${text}"`);
    console.log(`[EdgeTTSDockerSynthesizer] Server URL: ${this.serverUrl}`);

    try {
      const cleanedText = cleanText(text);

      const response = await fetch(`${this.serverUrl}/synthesize/simple`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: cleanedText,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Docker Edge TTS Server error: ${response.status} ${response.statusText}`
        );
      }

      const blob = await response.blob();

      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error(`[EdgeTTSDockerSynthesizer] Error:`, error);
      throw new Error(`Docker Edge TTS synthesis failed: ${error.message}`);
    }
  }
}

// Google Cloud TTS Docker 実装
class GoogleCloudTTSDockerSynthesizer extends AudioSynthesizer {
  constructor(config) {
    super();
    this.serverUrl =
      config.serverUrls?.google_cloud_tts_docker || "http://localhost:8002";
  }

  async synthesize(text) {
    console.log(`[GoogleCloudTTSDockerSynthesizer] Synthesizing: "${text}"`);
    console.log(
      `[GoogleCloudTTSDockerSynthesizer] Server URL: ${this.serverUrl}`
    );

    try {
      const cleanedText = cleanText(text);

      const response = await fetch(`${this.serverUrl}/synthesize/simple`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: cleanedText,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Google Cloud TTS Docker error: ${response.status} ${response.statusText} ${errorText}`
        );
      }

      const blob = await response.blob();

      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error(`[GoogleCloudTTSDockerSynthesizer] Error:`, error);
      throw new Error(
        `Google Cloud TTS Docker synthesis failed: ${error.message}`
      );
    }
  }
}

// API Server実装（新しいAPIサーバーを使用）
class APIServerSynthesizer extends AudioSynthesizer {
  constructor(config) {
    super();
    this.serverUrl = config.serverUrls?.api_server || "http://localhost:8000";
  }

  async synthesize(text) {
    console.log(`[APIServerSynthesizer] Synthesizing: "${text}"`);
    console.log(`[APIServerSynthesizer] Server URL: ${this.serverUrl}`);

    try {
      const cleanedText = cleanText(text);

      const response = await fetch(`${this.serverUrl}/synthesize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: cleanedText,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `API Server error: ${response.status} ${response.statusText}`
        );
      }

      const blob = await response.blob();

      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error(`[APIServerSynthesizer] Error:`, error);
      throw new Error(`API Server synthesis failed: ${error.message}`);
    }
  }
}

// 音声合成ファクトリー
class SynthesizerFactory {
  static create(type, config) {
    switch (type) {
      case "google_tts":
        return new GoogleTTSSynthesizer();
      case "test":
        return new TestSynthesizer();
      case "edge_tts":
        return new EdgeTTSSynthesizer(config);
      case "edge_tts_docker":
        return new EdgeTTSDockerSynthesizer(config);
      case "google_cloud_tts_docker":
        return new GoogleCloudTTSDockerSynthesizer(config);
      case "api_server":
        return new APIServerSynthesizer(config);
      default:
        throw new Error(`Unknown synthesizer type: ${type}`);
    }
  }
}

// 設定管理
let config = null;

async function loadConfig() {
  if (config) return config;

  try {
    const response = await fetch(chrome.runtime.getURL("config.json"));
    config = await response.json();

    // chrome.storage からユーザー設定を読み込んで上書き
    const storageData = await chrome.storage.local.get(["playbackRate"]);
    if (storageData.playbackRate !== undefined) {
      config.playbackRate = storageData.playbackRate;
    }
  } catch (error) {
    console.warn("Config file not found, using default settings");
    config = { synthesizerType: "google_tts", playbackRate: 1.0 };
  }
  return config;
}

// テキストをクリーンアップする関数
function cleanText(text) {
  // URLを除去
  text = text.replace(/https?:\/\/[^\s]+/g, "");
  // 特殊文字を除去（句読点以外）
  text = text.replace(
    /[^\w\s\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]/g,
    ""
  );
  // 連続する空白を1つに
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

// アイコン管理機能
function setActiveIcon() {
  chrome.action.setIcon({
    path: {
      16: "images/icon-active16.png",
      48: "images/icon-active48.png",
      128: "images/icon-active128.png",
    },
  });
}

function setDefaultIcon() {
  chrome.action.setIcon({
    path: {
      16: "images/icon16.png",
      48: "images/icon48.png",
      128: "images/icon128.png",
    },
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.command === "play") {
    loadConfig().then(async (config) => {
      try {
        const synthesizer = SynthesizerFactory.create(
          config.synthesizerType,
          config
        );
        const audioDataUrl = await synthesizer.synthesize(message.text);

        if (sender.tab?.id) {
          chrome.tabs.sendMessage(sender.tab.id, {
            command: "playAudio",
            audioDataUrl: audioDataUrl,
          });
        }
      } catch (error) {
        console.error("Speech synthesis error:", error);
        if (sender.tab?.id) {
          chrome.tabs.sendMessage(sender.tab.id, {
            command: "audioError",
            error: error.message,
          });
        }
      }
    });

    return true; // 非同期で応答を返すためtrueを返す
  }

  // prefetch 用に audioDataUrl を返すエンドポイント
  if (message.command === "fetch") {
    loadConfig().then(async (config) => {
      try {
        const synthesizer = SynthesizerFactory.create(
          config.synthesizerType,
          config
        );
        const audioDataUrl = await synthesizer.synthesize(message.text);
        sendResponse({ audioDataUrl: audioDataUrl });
      } catch (error) {
        console.error("Speech synthesis error (fetch):", error);
        sendResponse({ error: error.message });
      }
    });

    return true; // 非同期で sendResponse を使うため true を返す
  }

  // バッチフェッチ
  if (message.command === "batchFetch") {
    loadConfig().then(async (config) => {
      const synthesizer = SynthesizerFactory.create(
        config.synthesizerType,
        config
      );

      const results = await limitConcurrency(
        message.batch,
        async ({ index, text }) => {
          try {
            const audioDataUrl = await synthesizer.synthesize(text);
            return { index, audioDataUrl };
          } catch (error) {
            console.error("Speech synthesis error for index", index, ":", error);
            return { index, error: error.message };
          }
        },
        5 // Concurrency limit
      );
      const audioDataUrls = results.filter((r) => r.audioDataUrl);
      sendResponse({ audioDataUrls });
    });

    return true;
  }

  // 全キュー一括フェッチ
  if (message.command === "fullBatchFetch") {
    loadConfig().then(async (config) => {
      const synthesizer = SynthesizerFactory.create(
        config.synthesizerType,
        config
      );

      const results = await limitConcurrency(
        message.batch,
        async ({ index, text }) => {
          try {
            const audioDataUrl = await synthesizer.synthesize(text);
            return { index, audioDataUrl };
          } catch (error) {
            console.error("Speech synthesis error for index", index, ":", error);
            return { index, error: error.message };
          }
        },
        5 // Concurrency limit
      );
      const audioDataUrls = results.filter((r) => r.audioDataUrl);
      sendResponse({ audioDataUrls });
    });

    return true;
  }

  // 再生開始通知
  if (message.command === "playbackStarted") {
    setActiveIcon();
    console.log("Playback started - icon set to active");
  }

  // 再生停止通知
  if (message.command === "playbackStopped") {
    setDefaultIcon();
    console.log("Playback stopped - icon set to default");
  }
});


// Helper for concurrency control
async function limitConcurrency(items, mapper, concurrency) {
  const results = new Array(items.length);
  const queue = items.map((item, index) => ({ item, index }));

  const worker = async () => {
    while (queue.length > 0) {
      const { item, index } = queue.shift();
      results[index] = await mapper(item);
    }
  };

  const workers = Array(Math.min(concurrency, items.length))
    .fill(null)
    .map(() => worker());

  await Promise.all(workers);
  return results;
}
