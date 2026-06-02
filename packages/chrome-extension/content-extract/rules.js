// ============================================================================
// コンテンツ抽出ルール管理システム
//
// 目的:
// - サイト別抽出ルールの一元管理
// - ルール優先順位の明確化
// - 新しいサイト用ルール追加の標準化
// - 可観測性の向上（どのルールが採用されたか追跡可能）
// ============================================================================

// ============================================================================
// ルール定義: サイト別特化ルール
// ============================================================================

const SITE_SPECIFIC_RULES = {
  "qiita.com": {
    id: "qiita-custom", // ← 重要: id プロパティを追加
    name: "Qiita記事抽出",
    type: "site-specific", // ← type プロパティも追加
    priority: 1000, // 高優先度（サイト特化ルールは常に高優先度）
    description: "Qiitaの記事構造に最適化された抽出ルール",

    // マッチ条件（より詳細な条件指定も可能）
    match: {
      hostname: "qiita.com",
      pathPattern: null, // 全パスにマッチ（将来的に特定パスのみに制限可能）
    },

    // 抽出戦略
    extractStrategy: {
      // メインコンテナの特定
      containerSelectors: [
        "#personal-public-article-body .mdContent-inner",
        ".it-Article .rendered-body",
        ".rendered-body",
        ".article_body",
      ],

      // 抽出対象要素（優先順）
      contentSelectors: [
        "p",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "ul > li",
        "ol > li",
        "blockquote",
        "pre",
      ],

      // 除外要素
      excludeSelectors: [".ad", ".advertisement", ".sidebar", ".navigation"],

      // 最小テキスト長（これより短いものは無視）
      minTextLength: 3,
    },

    // デバッグ用メタデータ
    metadata: {
      author: "system",
      created: "2025-01-01",
      lastUpdated: "2025-01-01",
      testUrls: ["https://qiita.com/sample-article"],
    },
  },

  // 将来的に他のサイトを追加:
  // 'github.com': { ... },
  // 'stackoverflow.com': { ... },
  // 'medium.com': { ... }
};

// ============================================================================
// ルール定義: 汎用ルール
// ============================================================================

const GENERAL_RULES = {
  readability: {
    id: "readability-fallback",
    name: "Readability.js抽出",
    type: "library-based",
    priority: 5, // 中優先度
    description: "Mozilla Readabilityライブラリを使用した汎用抽出",

    match: {
      hostname: "*", // 全サイトにマッチ
    },

    extractStrategy: {
      type: "readability-lib",
      requiresLibrary: true,
      libraryPath: "lib/Readability.js",
    },

    metadata: {
      author: "Mozilla",
      created: "2025-01-01",
      lastUpdated: "2025-01-01",
    },
  },

  fallback: {
    id: "fallback-extraction",
    name: "基本フォールバック抽出",
    type: "basic-selectors",
    priority: 1, // 最低優先度
    description: "一般的なHTMLセレクタによるフォールバック抽出",

    match: {
      hostname: "*", // 全サイトにマッチ
    },

    extractStrategy: {
      containerSelectors: [
        "article",
        "main",
        ".post-body",
        ".entry-content",
        "body",
      ],
      contentSelectors: ["p", "h1", "h2", "h3", "h4", "h5", "h6"],
      minTextLength: 10,
    },

    metadata: {
      author: "system",
      created: "2025-01-01",
      lastUpdated: "2025-01-01",
    },
  },
};

// ============================================================================
// ルール管理クラス
// ============================================================================

class ExtractionRulesManager {
  constructor() {
    this.siteRules = SITE_SPECIFIC_RULES;
    this.generalRules = GENERAL_RULES;
    this.appliedRule = null; // 最後に適用されたルール（可観測性用）
    this.extractionHistory = []; // 抽出履歴（デバッグ用）
  }

  /**
   * 指定されたホスト名とURLに最適なルールを見つける
   */
  findBestRule(hostname, url = null) {
    console.log(`[ExtractionRules] Finding best rule for: ${hostname}`);

    // 1. サイト固有ルールを優先検索
    if (this.siteRules[hostname]) {
      const rule = this.siteRules[hostname];
      console.log(`[ExtractionRules] Found site-specific rule: ${rule.id}`);
      return rule;
    }

    // 2. 汎用ルールから選択（優先度順）
    const generalRuleKeys = Object.keys(this.generalRules);
    if (generalRuleKeys.length > 0) {
      // 優先度が最も高い汎用ルールを選択
      const ruleKey = generalRuleKeys[0]; // 現在は'fallback'のみ
      const rule = this.generalRules[ruleKey];
      console.log(`[ExtractionRules] Using general rule: ${rule.id}`);
      return rule;
    }

    console.warn(`[ExtractionRules] No applicable rule found for: ${hostname}`);
    return null;
  }

  /**
   * 現在のページに適用可能なルールを優先順位付きで取得
   */
  getApplicableRules() {
    const hostname = window.location.hostname;
    const pathname = window.location.pathname;
    const allRules = [];

    // サイト特化ルール
    Object.entries(this.siteRules).forEach(([key, rule]) => {
      if (this.matchesRule(rule, hostname, pathname)) {
        allRules.push({ key, ...rule, type: "site-specific" });
      }
    });

    // 汎用ルール
    Object.entries(this.generalRules).forEach(([key, rule]) => {
      if (this.matchesRule(rule, hostname, pathname)) {
        allRules.push({ key, ...rule, type: "general" });
      }
    });

    // 優先順位でソート（降順）
    return allRules.sort((a, b) => b.priority - a.priority);
  }

  /**
   * ルールがページにマッチするかチェック
   */
  matchesRule(rule, hostname, pathname) {
    const match = rule.match;

    // ホスト名チェック
    if (match.hostname === "*") {
      return true;
    }

    if (match.hostname && hostname !== match.hostname) {
      return false;
    }

    // パスパターンチェック（将来的に実装）
    if (match.pathPattern && !pathname.match(match.pathPattern)) {
      return false;
    }

    return true;
  }

  /**
   * 抽出ルールに基づいて実際に抽出を実行
   */
  extractContent(rule) {
    console.log(`[ExtractionRules] Applying rule: ${rule.name} (${rule.type})`);

    const startTime = performance.now();
    let result = null;

    try {
      if (rule.extractStrategy.type === "readability-lib") {
        result = this.extractWithReadability(rule);
      } else {
        result = this.extractWithSelectors(rule);
      }

      const endTime = performance.now();

      // 抽出成功を記録
      this.recordExtraction(rule, result, endTime - startTime, true);

      return result;
    } catch (error) {
      const endTime = performance.now();

      // 抽出失敗を記録
      this.recordExtraction(rule, null, endTime - startTime, false, error);

      throw error;
    }
  }

  /**
   * セレクタベースの抽出
   */
  extractWithSelectors(rule) {
    const strategy = rule.extractStrategy;
    let container = null;

    // コンテナを探す
    for (const selector of strategy.containerSelectors || ["body"]) {
      container = document.querySelector(selector);
      if (container) {
        console.log(`[ExtractionRules] Found container: ${selector}`);
        break;
      }
    }

    if (!container) {
      throw new Error("No suitable container found");
    }

    // コンテンツ要素を抽出（DOM順序を保持）
    const contentSelectors = strategy.contentSelectors || ["p"];

    // 全てのセレクターを組み合わせて一度にクエリ
    const combinedSelector = contentSelectors.join(", ");
    const elements = Array.from(container.querySelectorAll(combinedSelector));

    console.log(
      `[ExtractionRules] Found ${elements.length} elements with selector: ${combinedSelector}`
    );

    // 結果を処理
    const blocks = [];
    elements.forEach((el, index) => {
      const text = el.textContent?.trim();
      if (text && text.length >= (strategy.minTextLength || 1)) {
        blocks.push({
          id: index,
          element: el,
          text: text,
          type: el.tagName.toLowerCase(),
          selector: this.getElementSelector(el),
        });
      }
    });

    return blocks;
  }

  /**
   * Readabilityライブラリによる抽出
   */
  extractWithReadability(rule) {
    if (typeof Readability === "undefined") {
      throw new Error("Readability library not available");
    }

    const documentClone = document.cloneNode(true);
    const reader = new Readability(documentClone);
    const article = reader.parse();

    if (!article?.content) {
      throw new Error("Readability extraction failed");
    }

    // HTMLを解析して構造化
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = article.content;
    const elements = tempDiv.querySelectorAll("p, h1, h2, h3, h4, h5, h6");

    const blocks = [];
    elements.forEach((el, index) => {
      const text = el.textContent?.trim();
      if (text) {
        blocks.push({
          id: index,
          element: null, // Readabilityは仮想要素
          text: text,
          type: el.tagName.toLowerCase(),
          selector: "readability-generated",
        });
      }
    });

    return blocks;
  }

  /**
   * 抽出結果を記録（可観測性）
   */
  recordExtraction(rule, result, duration, success, error = null) {
    this.appliedRule = rule;

    const record = {
      timestamp: new Date().toISOString(),
      rule: {
        key: rule.key,
        name: rule.name,
        type: rule.type,
        priority: rule.priority,
      },
      url: window.location.href,
      success: success,
      blocksFound: result ? result.length : 0,
      duration: Math.round(duration),
      error: error ? error.message : null,
    };

    this.extractionHistory.unshift(record);

    // 履歴は最新100件まで保持
    if (this.extractionHistory.length > 100) {
      this.extractionHistory.splice(100);
    }

    console.log(`[ExtractionRules] Extraction completed:`, record);
  }

  /**
   * 要素のCSSセレクタを生成（デバッグ用）
   */
  getElementSelector(element) {
    if (element.id) {
      return `#${element.id}`;
    }

    let selector = element.tagName.toLowerCase();
    if (element.className) {
      selector += `.${Array.from(element.classList).join(".")}`;
    }

    return selector;
  }

  /**
   * デバッグ情報を取得
   */
  getDebugInfo() {
    return {
      appliedRule: this.appliedRule,
      availableRules: this.getApplicableRules().map((rule) => ({
        key: rule.key,
        name: rule.name,
        type: rule.type,
        priority: rule.priority,
      })),
      extractionHistory: this.extractionHistory.slice(0, 10), // 最新10件
      currentPage: {
        hostname: window.location.hostname,
        pathname: window.location.pathname,
        url: window.location.href,
      },
    };
  }
}

// ============================================================================
// エクスポート（グローバルに配置）
// ============================================================================

// グローバルに配置してcontent.jsから利用可能にする
window.ExtractionRulesManager = ExtractionRulesManager;

console.log("[ExtractionRules] Rules manager loaded");
