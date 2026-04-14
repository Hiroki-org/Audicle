/**
 * 共有されたURLを検証する
 * @param url 検証対象のURL
 * @returns URLが有効な場合はtrue、無効な場合はfalse
 */
export function validateUrl(url: string): boolean {
    try {
        const parsedUrl = new URL(url)
        // http/httpsスキームのみ許可（javascript:, data:などの危険なスキームを拒否）
        const allowedProtocols = ['http:', 'https:']
        return allowedProtocols.includes(parsedUrl.protocol)
    } catch {
        return false
    }
}
