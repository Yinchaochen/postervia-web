// Static assets handler runs FIRST (run_worker_first omitted from
// wrangler.toml, defaulting to false). So this Worker only sees requests
// that didn't match an asset — i.e. requests like /privacy, /terms-de that
// don't have a corresponding file (files are named privacy.html, terms-de.html).
//
// We redirect those to the .html version. The browser follows the 301 and
// the second request hits /privacy.html which IS a matching asset — the
// static handler serves it without invoking this Worker.
//
// We deliberately do NOT use env.ASSETS.fetch() here because Cloudflare's
// auto-build flow sometimes fails to inject the [assets].binding into the
// Worker runtime, leaving env.ASSETS undefined. Sidestepping it entirely is
// the most reliable fix.

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

const APP_STORE_URL = 'https://apps.apple.com/de/app/postervia/id6768678629?l=en-GB';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=app.novaku.mobile';
const SHARE_PREVIEW_API = 'https://api.postervia.app/v1/community/posts';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Post metadata for OG tags, gated by the HMAC share token minted by the
// backend (D-040): without a valid `?s=` the API 404s, so crawlers cannot
// enumerate post ids — only holders of a real share link get a rich preview.
async function fetchSharePreview(postId, token) {
  if (!UUID_RE.test(postId) || !/^[0-9a-f]{16,64}$/i.test(token || '')) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(`${SHARE_PREVIEW_API}/${postId}/share-preview?s=${token}`, {
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const body = await res.json();
    return body && body.data && body.data.title ? body.data : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Every injected value is UGC — escape for the attribute context or a post
// title like `"><script>` becomes stored XSS on postervia.app.
function ogBlock(preview, pageUrl) {
  const title = escapeHtml(preview.title);
  const description = escapeHtml(
    [preview.author_name, preview.description].filter(Boolean).join(' · '),
  );
  const lines = [
    `<meta property="og:site_name" content="Postervia">`,
    `<meta property="og:type" content="article">`,
    `<meta property="og:title" content="${title}">`,
    `<meta property="og:description" content="${description}">`,
    `<meta property="og:url" content="${escapeHtml(pageUrl)}">`,
    `<meta name="twitter:title" content="${title}">`,
    `<meta name="twitter:description" content="${description}">`,
  ];
  if (preview.image_url && /^https:\/\//i.test(preview.image_url)) {
    lines.push(`<meta property="og:image" content="${escapeHtml(preview.image_url)}">`);
    lines.push(`<meta name="twitter:card" content="summary_large_image">`);
  } else {
    lines.push(`<meta name="twitter:card" content="summary">`);
  }
  return lines.join('\n');
}

// Smart-link landing for shared posts (https://postervia.app/p/{id}). When the
// app is installed the OS intercepts the Universal/App Link and this Worker is
// never reached — so this page is the *not-installed* fallback: send the visitor
// to the right store by platform. Preview crawlers (LinkedInBot, WhatsApp,
// Telegram, the sender's iMessage) read the OG tags injected from `preview`.
// noindex keeps shared posts out of search engines without blocking those
// crawlers (robots.txt must NOT disallow /p/ — LinkedIn/Twitter honor it and
// the preview card would die).
function postLandingHtml(storeUrl, preview, pageUrl) {
  const refresh = storeUrl ? `<meta http-equiv="refresh" content="1.5;url=${storeUrl}">` : '';
  const title = preview ? `${escapeHtml(preview.title)} · Postervia` : 'Postervia';
  const og = preview ? ogBlock(preview, pageUrl) : '';
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${title}</title>
${og}
${refresh}
<style>
  body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#F67673;color:#fff;display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center}
  .card{padding:32px 24px;max-width:360px}
  img{width:84px;height:84px;border-radius:20px;margin-bottom:20px}
  h1{font-size:22px;margin:0 0 8px}
  p{opacity:.9;margin:0 0 24px;font-size:15px;line-height:1.5}
  a.btn{display:block;background:#fff;color:#C81E3A;text-decoration:none;font-weight:700;padding:14px 20px;border-radius:999px;margin:10px 0;font-size:15px}
</style>
</head><body>
<div class="card">
  <img src="/assets/postervia-icon.png" alt="Postervia">
  <h1>Open in Postervia</h1>
  <p>Get the app to view this post and find your path.</p>
  <a class="btn" href="${APP_STORE_URL}">Download on the App Store</a>
  <a class="btn" href="${PLAY_STORE_URL}">Get it on Google Play</a>
</div>
</body></html>`;
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (PRETTY_TO_HTML.has(url.pathname)) {
      url.pathname = url.pathname + '.html';
      return Response.redirect(url.toString(), 301);
    }
    if (/^\/p\/[^/]+\/?$/.test(url.pathname)) {
      const postId = url.pathname.split('/')[2];
      const token = url.searchParams.get('s');
      const ua = request.headers.get('user-agent') || '';
      const storeUrl = /iphone|ipad|ipod/i.test(ua)
        ? APP_STORE_URL
        : /android/i.test(ua)
          ? PLAY_STORE_URL
          : null;
      const preview = token ? await fetchSharePreview(postId, token) : null;
      return new Response(postLandingHtml(storeUrl, preview, url.href), {
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'x-robots-tag': 'noindex',
        },
      });
    }
    return new Response('Not found', { status: 404 });
  },
};
