/**
 * Basketball Reference fetch helpers.
 * Uses NBA-style Referer and conservative headers to reduce rate limiting / IP blocks.
 */

export const BBREF_FETCH_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Accept-Encoding': 'gzip, deflate, br',
  Connection: 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'cross-site',
  'Cache-Control': 'max-age=0',
  Referer: 'https://www.nba.com/',
};

export async function fetchBbrefHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: BBREF_FETCH_HEADERS,
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const contentType = res.headers.get('content-type');
  if (!contentType?.includes('text/html')) {
    throw new Error(`Unexpected content-type: ${contentType}`);
  }
  const html = await res.text();
  if (
    html.includes('Rate Limit') ||
    html.includes('Too Many Requests') ||
    html.includes('403 Forbidden')
  ) {
    throw new Error('Rate limited or blocked');
  }
  return html;
}
