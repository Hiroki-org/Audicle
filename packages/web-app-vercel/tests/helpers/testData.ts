export const mockArticles = [
    {
        url: 'https://github.com/is0692vs',  // 自分のGitHubプロフィール
        title: 'is0692vs - Overview',
    },
    {
        url: 'https://qiita.com/Opabinium/items/190eff0194cd6cef4b78',  // Qiitaの自分の記事
        title: 'Jules APIが公開されたのでVSCode拡張機能を作ってみた',
    }
];

// Minimal valid 1-sample WAV file (base64-encoded)
// This is a valid WAV header that decodes without atob errors
export const validAudioBase64 = 'UklGRi4AAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';

// Legacy mock data (deprecated)
export const mockAudioData = 'data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAA...';

// Mock article content for E2E tests
export const mockArticleContent = {
    title: 'テスト記事タイトル',
    content: 'これはテスト用の記事コンテンツです。音声再生のテストに使用されます。',
    paragraphs: [
        'これはテスト用の記事コンテンツです。',
        '音声再生のテストに使用されます。'
    ]
};