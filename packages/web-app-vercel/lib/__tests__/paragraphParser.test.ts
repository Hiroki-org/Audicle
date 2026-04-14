import {
    parseHTMLToParagraphs,
    // 内部関数をテスト用にエクスポートする必要があるため、
    // テストファイルを別の形式で作成
} from '../paragraphParser';

/**
 * paragraphParser のチャンクリサイズ機能のテスト
 */
describe('paragraphParser', () => {
    describe('parseHTMLToParagraphs', () => {
        it('should parse simple HTML to paragraphs', () => {
            const html = '<p>こんにちは</p><p>世界</p>';
            const { paragraphs } = parseHTMLToParagraphs(html);
            expect(paragraphs.length).toBeGreaterThan(0);
        });

        it('should handle empty HTML', () => {
            const result = parseHTMLToParagraphs('');
            expect(result.paragraphs).toEqual([]);
        });

        it('should not duplicate content from p tags inside blockquotes', () => {
            const html = '<blockquote><p>This is a quote.</p></blockquote><p>This is a paragraph.</p>';
            const { paragraphs } = parseHTMLToParagraphs(html);
            expect(paragraphs.length).toBe(2);
            expect(paragraphs[0].type).toBe('blockquote');
            expect(paragraphs[0].originalText).toBe('This is a quote.');
            expect(paragraphs[1].type).toBe('p');
            expect(paragraphs[1].originalText).toBe('This is a paragraph.');
        });

        it('should handle nested blockquote with multiple p tags', () => {
            const html = '<blockquote><p>Quote line 1</p><p>Quote line 2</p></blockquote>';
            const { paragraphs } = parseHTMLToParagraphs(html);
            // blockquote全体が1つの段落として抽出される（内部のpは個別に抽出されない）
            expect(paragraphs.length).toBe(1);
            expect(paragraphs[0].type).toBe('blockquote');
            expect(paragraphs[0].originalText).toContain('Quote line 1');
            expect(paragraphs[0].originalText).toContain('Quote line 2');
        });

        it('should extract code blocks (pre elements)', () => {
            const html = '<p>コード例：</p><pre><code>function hello() {\n  console.log("Hello");\n}</code></pre><p>以上です。</p>';
            const { paragraphs } = parseHTMLToParagraphs(html);
            expect(paragraphs.length).toBe(3);
            expect(paragraphs[0].originalText).toBe('コード例：');
            expect(paragraphs[1].type).toBe('pre');
            expect(paragraphs[1].originalText).toContain('function hello()');
            expect(paragraphs[2].originalText).toBe('以上です。');
        });

        it('コードブロックを含む日本語記事でjaと判定されること', () => {
            const html = `
                <p>これはJavaScriptの解説です。</p>
                <pre><code>function test() { return 1; }</code></pre>
                <p>以上です。</p>
            `;
            const result = parseHTMLToParagraphs(html);
            expect(result.detectedLanguage).toBe('ja');
        });

        it('コードブロックのみでも誤判定しないこと', () => {
            const html = `
                <p>コード例：</p>
                <pre><code>const a = 1; const b = 2; const c = a + b;</code></pre>
            `;
            const result = parseHTMLToParagraphs(html);
            expect(result.detectedLanguage).toBe('ja');
        });

        it('should extract table cells (td/th elements)', () => {
            const html = '<table><tr><th>項目</th><th>値</th></tr><tr><td>名前</td><td>テスト</td></tr></table>';
            const { paragraphs } = parseHTMLToParagraphs(html);
            expect(paragraphs.length).toBeGreaterThanOrEqual(4);
            const texts = paragraphs.map(p => p.originalText);
            expect(texts).toContain('項目');
            expect(texts).toContain('値');
            expect(texts).toContain('名前');
            expect(texts).toContain('テスト');
        });

        it('should extract figcaption', () => {
            const html = '<figure><img src="test.png" /><figcaption>図1: テスト画像</figcaption></figure>';
            const { paragraphs } = parseHTMLToParagraphs(html);
            expect(paragraphs.length).toBe(1);
            expect(paragraphs[0].type).toBe('figcaption');
            expect(paragraphs[0].originalText).toBe('図1: テスト画像');
        });

        it('should fallback to body text when no block elements found', () => {
            const html = '<div>直接のテキスト内容</div>';
            const { paragraphs } = parseHTMLToParagraphs(html);
            expect(paragraphs.length).toBeGreaterThanOrEqual(1);
            expect(paragraphs.some(p => p.originalText.includes('直接のテキスト内容'))).toBe(true);
        });
    });

    describe('chunk resizing', () => {
        it('should split text exceeding 5000 bytes at punctuation', () => {
            // 日本語の「あ」は3バイト、1667文字で約5000バイト
            // 安全上限は4800バイトなので、1600文字を超える場合はリサイズされる
            const longJapaneseText = 'あ'.repeat(1700); // 約5100バイト
            const longTextWithPunctuation = `${longJapaneseText.slice(0, 800)}。${longJapaneseText.slice(801)}`;

            const html = `<p>${longTextWithPunctuation}</p>`;
            const { paragraphs } = parseHTMLToParagraphs(html);

            // リサイズされて複数のチャンクに分割されるはず
            expect(paragraphs.length).toBeGreaterThan(1);

            // 各チャンクが安全サイズ内であることを確認
            for (const chunk of paragraphs) {
                const byteSize = Buffer.byteLength(chunk.cleanedText, 'utf-8');
                expect(byteSize).toBeLessThanOrEqual(4800);
            }
        });

        it('should split text by commas when no period is available', () => {
            // 句点なしで読点ありのテキスト
            const longText = 'あ'.repeat(500) + '、' + 'い'.repeat(500) + '、' + 'う'.repeat(500) + '、' + 'え'.repeat(500);

            const html = `<p>${longText}</p>`;
            const { paragraphs } = parseHTMLToParagraphs(html);

            // 複数のチャンクに分割されるはず
            expect(paragraphs.length).toBeGreaterThan(1);
        });

        it('should force split text without any delimiters', () => {
            // 区切り文字なしの長いテキスト（日本語のみ）
            const longTextNoDelimiter = 'あ'.repeat(2000); // 約6000バイト

            const html = `<p>${longTextNoDelimiter}</p>`;
            const { paragraphs } = parseHTMLToParagraphs(html);

            // フォーススプリットで分割されるはず
            expect(paragraphs.length).toBeGreaterThan(1);

            // 各チャンクが安全サイズ内であることを確認
            for (const chunk of paragraphs) {
                const byteSize = Buffer.byteLength(chunk.cleanedText, 'utf-8');
                expect(byteSize).toBeLessThanOrEqual(4800);
            }
        });

        it('should not split text under 4800 bytes', () => {
            // 短いテキスト（安全上限以下）
            const shortText = 'こんにちは世界';

            const html = `<p>${shortText}</p>`;
            const { paragraphs } = parseHTMLToParagraphs(html);

            // 1つのチャンクのまま
            expect(paragraphs.length).toBe(1);
            expect(paragraphs[0].cleanedText).toBe(shortText);
        });

        it('should handle mixed Japanese and English text', () => {
            // 日英混合の長いテキスト
            const mixedText = ('日本語テキスト. English text. ' + 'あ'.repeat(200)).repeat(10);

            const html = `<p>${mixedText}</p>`;
            const { paragraphs } = parseHTMLToParagraphs(html);

            // 各チャンクが安全サイズ内であることを確認
            for (const chunk of paragraphs) {
                const byteSize = Buffer.byteLength(chunk.cleanedText, 'utf-8');
                expect(byteSize).toBeLessThanOrEqual(4800);
            }
        });

        it('should preserve delimiter priority (。 > 、 > .)', () => {
            // 句点、読点、ピリオドを含むテキスト
            // 約5000バイト超えになるようにして、句点で分割されることを確認
            const text = 'あ'.repeat(800) + '。' + 'い'.repeat(800) + '、' + 'う'.repeat(800);

            const html = `<p>${text}</p>`;
            const { paragraphs } = parseHTMLToParagraphs(html);

            // 分割されているはず
            expect(paragraphs.length).toBeGreaterThan(1);

            // 最初のチャンクは句点で終わるはず（優先度が高いため）
            if (paragraphs.length >= 2) {
                expect(paragraphs[0].cleanedText.endsWith('。')).toBe(true);
            }
        });
    });
});
