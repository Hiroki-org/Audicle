import { normalizeArticleText } from '@/lib/parseArticle';

describe('normalizeArticleText', () => {
  it('Qiita風のblockquoteを正しく処理する', () => {
    const html = `
      <blockquote>
        <p>テキスト1<br><br>テキスト2<br><br>テキスト3</p>
      </blockquote>
    `;

    const result = normalizeArticleText(html);
    expect(result).toBe('テキスト1\n\nテキスト2\n\nテキスト3');
  });

  it('はてなブログ風のUI要素を除外する', () => {
    const html = `
      <blockquote>
        <p>引用テキスト</p>
        <div class="requote-button">
          <button>引用する</button>
        </div>
      </blockquote>
    `;

    const result = normalizeArticleText(html);
    expect(result).toBe('引用テキスト');
    expect(result).not.toContain('引用する');
  });

  it('見出しと段落を適切に処理する', () => {
    const html = `
      <h2>見出し</h2>
      <p>段落1</p>
      <p>段落2</p>
    `;

    const result = normalizeArticleText(html);
    expect(result).toBe('見出し\n\n段落1\n\n段落2');
  });

  describe('normalizeArticleText - 追加テスト', () => {
    it('要素の順序を保持する', () => {
      const html = `
      <p>段落1</p>
      <blockquote><p>引用</p></blockquote>
      <p>段落2</p>
    `;

      const result = normalizeArticleText(html);
      const lines = result.split('\n\n');
      expect(lines[0]).toBe('段落1');
      expect(lines[1]).toBe('引用');
      expect(lines[2]).toBe('段落2');
    });

    it('コードブロックを抽出する', () => {
      const html = `
      <p>コード例：</p>
      <pre><code>function hello() {
  console.log("Hello");
}</code></pre>
    `;

      const result = normalizeArticleText(html);
      expect(result).toContain('function hello()');
    });

    it('テーブルのセル内容を抽出する', () => {
      const html = `
      <table>
        <tr><td>項目1</td><td>値1</td></tr>
        <tr><td>項目2</td><td>値2</td></tr>
      </table>
    `;

      const result = normalizeArticleText(html);
      expect(result).toContain('項目1');
      expect(result).toContain('値2');
    });

    it('figcaptionを抽出する', () => {
      const html = `
      <figure>
        <img src="img.png" alt="img"/>
        <figcaption>図のキャプション</figcaption>
      </figure>
    `;

      const result = normalizeArticleText(html);
      expect(result).toContain('図のキャプション');
    });

    it('blockquote（pなし）を抽出する', () => {
      const html = '<blockquote>シンプルな引用</blockquote>';
      const result = normalizeArticleText(html);
      expect(result).toBe('シンプルな引用');
    });

    it('XSSペイロードが実行されず、テキストとして抽出されること', () => {
      const html = `
      <blockquote>
        <p>安全なテキスト<br><br><img src="x" onerror="alert(1)"></p>
      </blockquote>
      `;
      const result = normalizeArticleText(html);
      expect(result).toContain('安全なテキスト');
      expect(result).not.toContain('<img');
    });
  });
});
