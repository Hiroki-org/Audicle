// popup.js

// URLからホスト名を取得するヘルパー関数
function getHostnameFromUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (e) {
    console.error("Invalid URL:", url, e);
    // 不正な URL の場合は空文字を返し、保存処理やキー作成を防ぐ
    return "";
  }
}

function parseAuthResult(finalUrl) {
  const parsed = new URL(finalUrl);
  const hashParams = new URLSearchParams((parsed.hash || "").replace(/^#/, ""));
  const queryParams = parsed.searchParams;

  const accessToken =
    hashParams.get("access_token") || queryParams.get("access_token");
  const expiresAt =
    hashParams.get("expires_at") || queryParams.get("expires_at");
  const email = hashParams.get("email") || queryParams.get("email");

  if (!accessToken) {
    throw new Error("アクセストークンが見つかりませんでした");
  }

  const parsedExpiresAt = expiresAt !== null ? Number(expiresAt) : NaN;
  return {
    accessToken,
    expiresAt: Number.isFinite(parsedExpiresAt) && parsedExpiresAt > 0
      ? parsedExpiresAt
      : Date.now() + 7 * 24 * 60 * 60 * 1000,
    email: email || "",
  };
}

async function loadExtensionConfig() {
  const response = await fetch(chrome.runtime.getURL("config.json"));
  return await response.json();
}

function launchWebAuthFlow(url) {
  return new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow({ url, interactive: true }, (finalUrl) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!finalUrl) {
        reject(new Error("認証フローがキャンセルされました"));
        return;
      }
      resolve(finalUrl);
    });
  });
}

function updateAuthStatus(authStatus, loginButton, logoutButton, authData) {
  if (!authStatus || !loginButton || !logoutButton) {
    return;
  }

  const hasValidAuth =
    !!authData?.accessToken &&
    (!authData?.expiresAt || Date.now() < Number(authData.expiresAt));

  if (hasValidAuth) {
    authStatus.textContent = authData.email
      ? `ログイン中: ${authData.email}`
      : "Audicle ログイン済み";
    loginButton.style.display = "none";
    logoutButton.style.display = "block";
    return;
  }

  authStatus.textContent = "Audicle 未ログイン";
  loginButton.style.display = "block";
  logoutButton.style.display = "none";
}

// テスト用にエクスポートする（Node環境の場合のみ）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getHostnameFromUrl,
    parseAuthResult,
  };
}

if (typeof document !== 'undefined') {
  document.addEventListener("DOMContentLoaded", async () => {
    const toggleSwitch = document.getElementById("toggle-switch");
    const pauseResumeBtn = document.getElementById("pause-resume-btn");
    const playbackRateSlider = document.getElementById("playback-rate");
    const playbackRateValue = document.getElementById("playback-rate-value");
    const authStatus = document.getElementById("auth-status");
    const loginButton = document.getElementById("audicle-login-btn");
    const logoutButton = document.getElementById("audicle-logout-btn");

    // 再生速度スライダーの初期化
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(["playbackRate"], (result) => {
        const rate = result.playbackRate || 1.0;
        if (playbackRateSlider && playbackRateValue) {
          playbackRateSlider.value = rate;
          playbackRateValue.textContent = rate;
        }
      });
    }

    if (typeof chrome !== "undefined" && chrome.storage && authStatus && loginButton && logoutButton) {
      chrome.storage.local.get(["audicleAuth"], (result) => {
        updateAuthStatus(authStatus, loginButton, logoutButton, result.audicleAuth);
      });

      loginButton.addEventListener("click", async () => {
        try {
          const extensionConfig = await loadExtensionConfig();
          const webAppUrl =
            extensionConfig.webAppUrl || extensionConfig.serverUrls?.vercel_app;

          if (!webAppUrl) {
            throw new Error("webAppUrl が設定されていません");
          }

          const redirectUri = chrome.identity.getRedirectURL("audicle-auth");
          const authUrl = `${webAppUrl}/extension/login?redirect_uri=${encodeURIComponent(
            redirectUri
          )}`;

          const finalUrl = await launchWebAuthFlow(authUrl);
          const authResult = parseAuthResult(finalUrl);

          chrome.storage.local.set(
            {
              audicleAuth: {
                accessToken: authResult.accessToken,
                expiresAt: authResult.expiresAt,
                email: authResult.email,
              },
            },
            () => {
              updateAuthStatus(authStatus, loginButton, logoutButton, authResult);
            }
          );
        } catch (error) {
          console.error("Audicle login failed:", error);
          authStatus.textContent = "ログインに失敗しました";
        }
      });

      logoutButton.addEventListener("click", () => {
        chrome.storage.local.remove(["audicleAuth"], () => {
          updateAuthStatus(authStatus, loginButton, logoutButton, null);
        });
      });
    }

    // 再生速度スライダーの変更
    if (playbackRateSlider && playbackRateValue && typeof chrome !== 'undefined') {
      playbackRateSlider.addEventListener("input", () => {
        const rate = parseFloat(playbackRateSlider.value);
        playbackRateValue.textContent = rate;
        chrome.storage.local.set({ playbackRate: rate });

        // リアルタイムで再生中のオーディオに反映
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {
              command: "updatePlaybackRate",
              rate: rate,
            });
          }
        });
      });
    }

    // 現在のタブのURLを取得して、そのURLの状態を読み込む
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0]) return;

        const url = tabs[0].url;
        const hostname = getHostnameFromUrl(url);

        // 無効なホスト名（空文字や'undefined'）は保存対象外として扱う
        const isValidHostname = (h) =>
          typeof h === "string" && h.trim() !== "" && h !== "undefined";

        // URLごとの状態を読み込む
        chrome.storage.local.get(["urlStates", "enabled"], (result) => {
          const urlStates = result.urlStates || {};
          // ホスト名が無効な場合はグローバルのenabledのみ使用
          const isEnabled = isValidHostname(hostname)
            ? hostname in urlStates
              ? urlStates[hostname]
              : !!result.enabled
            : !!result.enabled;
          if (toggleSwitch) {
            toggleSwitch.checked = isEnabled;
          }
        });

        // スイッチが操作されたら、そのURLの状態を保存
        if (toggleSwitch) {
          toggleSwitch.addEventListener("change", () => {
            const isEnabled = toggleSwitch.checked;

            // 無効なホスト名の場合は保存しない（誤って"undefined"キー等が作られるのを防ぐ）
            if (!isValidHostname(hostname)) {
              console.warn("popup: invalid hostname, skipping save:", hostname);
              return;
            }

            chrome.storage.local.get(["urlStates"], (result) => {
              const urlStates = result.urlStates || {};
              urlStates[hostname] = isEnabled;
              chrome.storage.local.set({ urlStates });
            });
          });
        }
      });
    }

    // 一時停止/再開ボタン
    if (pauseResumeBtn && typeof chrome !== 'undefined') {
      pauseResumeBtn.addEventListener("click", () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) {
            chrome.tabs.sendMessage(
              tabs[0].id,
              { command: "togglePauseResume" },
              (response) => {
                if (response && response.isPlaying !== undefined) {
                  pauseResumeBtn.textContent = response.isPlaying
                    ? "一時停止"
                    : "再開";
                }
              }
            );
          }
        });
      });
    }
  });
}
