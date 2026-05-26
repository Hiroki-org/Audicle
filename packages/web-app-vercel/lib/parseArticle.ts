import { parseHTML } from 'linkedom';

/**
 * article.content をパースしてプレーンテキスト化する
 * blockquote内のUI要素を除外し，段落間に適切な改行を挿入する（サーバーサイド用）
 */
export function normalizeArticleText(content: string): string {
    if (!content) return '';

    const { document } = parseHTML(content);

    // はてなブログなどの代表的な UI 要素だけ削除（button は UI クラス指定で除外）
    // すべての button を一律に消すのは記事本文に含まれるボタンラベルも除外してしまうため避ける
    document
        .querySelectorAll(
            'button.share-button, button.social-button, button[aria-label*="Share"], .requote-button, .js-requote-button, nav, aside, footer'
        )
        .forEach(e => e.remove());

    const paragraphs: string[] = [];

    // single-pass で DOM の塊（h*, p, li, pre, td, th, figcaption, blockquote）を順に処理する
    const selectors = [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'p', 'li', 'pre', 'td', 'th', 'figcaption', 'blockquote'
    ];

    const elements = document.querySelectorAll(selectors.join(','));
    elements.forEach(elem => {
        // blockquote はまとめて特殊処理
        if (elem.matches('blockquote')) {
            // blockquote の中に <p> があれば、その <p> ごとに<br><br>で分割する
            const ps = elem.querySelectorAll('p');
            if (ps.length > 0) {
                ps.forEach(p => {
                    const html = p.innerHTML || '';
                    const parts = html.split(/<br\s*\/?>(?:\s*<br\s*\/?>)+/i);
                    parts.forEach(part => {
                        const { document: partDoc } = parseHTML(`<div>${part}</div>`);
                        const t = partDoc.querySelector('div')?.textContent?.trim();
                        if (t) paragraphs.push(t);
                    });
                });
            } else {
                // <p> がない場合は blockquote の textContent をそのまま抽出
                const text = elem.textContent?.trim();
                if (text) paragraphs.push(text);
            }
            return;
        }

        // blockquote 内の <p> は上で処理済みなので skip
        if (elem.matches('p') && elem.closest('blockquote')) {
            return;
        }

        // その他の要素は textContent を抽出
        const text = elem.textContent?.trim();
        if (text) {
            paragraphs.push(text);
        }
    });

    // 段落間に空行を挿入
    return paragraphs.join('\n\n');
}

// removed default export in favor of named export
