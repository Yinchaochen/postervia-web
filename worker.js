import {
  APP_STORE_URL,
  PLAY_STORE_URL,
  escapeHtml,
  genericPostLandingHtml,
  postPageHtml,
  resolveShareLocale,
  safeHttpsUrl,
} from './share-page.js';

// Static assets run before this Worker. It handles pretty legal URLs and
// dynamic signed post-share routes; matching files are served directly.
const PRETTY_TO_HTML = new Set([
  '/privacy',
  '/privacy-de',
  '/terms',
  '/terms-de',
  '/impressum',
  '/impressum-de',
  '/support',
  '/support-de',
  '/child-safety',
  '/child-safety-de',
  '/ui-preview',
]);

const SHARE_PREVIEW_API = 'https://api.postervia.app/v1/community/posts';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The HMAC share token is the public-preview capability. Invalid input never
// reaches the API, and the backend repeats all visibility/moderation checks.
async function fetchSharePreview(postId, token) {
  if (!UUID_RE.test(postId) || !/^[0-9a-f]{16,64}$/i.test(token || '')) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(`${SHARE_PREVIEW_API}/${postId}/share-preview?s=${token}`, {
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const body = await response.json();
    return body && body.data && body.data.title ? body.data : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Every injected value is UGC. Attribute escaping plus https-only image URLs
// keep a malicious post title or media URL from becoming stored XSS.
function ogBlock(preview, pageUrl) {
  const title = escapeHtml(preview.title);
  const description = escapeHtml(
    [preview.author_name, preview.description].filter(Boolean).join(' · '),
  );
  const lines = [
    '<meta property="og:site_name" content="Postervia">',
    '<meta property="og:type" content="article">',
    `<meta property="og:title" content="${title}">`,
    `<meta property="og:description" content="${description}">`,
    `<meta property="og:url" content="${escapeHtml(pageUrl)}">`,
    `<meta name="twitter:title" content="${title}">`,
    `<meta name="twitter:description" content="${description}">`,
  ];
  const imageUrl = safeHttpsUrl(preview.image_url);
  if (imageUrl) {
    lines.push(`<meta property="og:image" content="${escapeHtml(imageUrl)}">`);
    lines.push('<meta name="twitter:card" content="summary_large_image">');
  } else {
    lines.push('<meta name="twitter:card" content="summary">');
  }
  return lines.join('\n');
}

function storeUrlFor(userAgent) {
  if (/iphone|ipad|ipod/i.test(userAgent)) return APP_STORE_URL;
  if (/android/i.test(userAgent)) return PLAY_STORE_URL;
  return null;
}

const HTML_HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'x-robots-tag': 'noindex',
  'content-security-policy': [
    "default-src 'none'",
    "img-src 'self' https: data:",
    "style-src 'unsafe-inline'",
    "script-src 'unsafe-inline'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; '),
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
};

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (PRETTY_TO_HTML.has(url.pathname)) {
      url.pathname = `${url.pathname}.html`;
      return Response.redirect(url.toString(), 301);
    }

    if (/^\/p\/[^/]+\/?$/.test(url.pathname)) {
      const postId = url.pathname.split('/')[2];
      const token = url.searchParams.get('s');
      const locale = resolveShareLocale(
        request.headers.get('accept-language'),
        url.searchParams.get('lang'),
      );
      const storeUrl = storeUrlFor(request.headers.get('user-agent') || '');
      const preview = token ? await fetchSharePreview(postId, token) : null;
      const html = preview
        ? postPageHtml({
            preview,
            pageUrl: url.href,
            postId,
            token,
            locale,
            storeUrl,
            ogBlock,
          })
        : genericPostLandingHtml({ locale });
      return new Response(html, { headers: HTML_HEADERS });
    }

    return new Response('Not found', { status: 404 });
  },
};
