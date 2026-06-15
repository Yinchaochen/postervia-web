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
]);

const APP_STORE_URL = 'https://apps.apple.com/de/app/postervia/id6768678629?l=en-GB';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=app.novaku.mobile';

// Smart-link landing for shared posts (https://postervia.app/p/{id}). When the
// app is installed the OS intercepts the Universal/App Link and this Worker is
// never reached — so this page is the *not-installed* fallback: send the visitor
// to the right store by platform. After install, re-tapping the link opens the app.
function postLandingHtml(storeUrl) {
  const refresh = storeUrl ? `<meta http-equiv="refresh" content="1.5;url=${storeUrl}">` : '';
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Postervia</title>
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
      const ua = request.headers.get('user-agent') || '';
      const storeUrl = /iphone|ipad|ipod/i.test(ua)
        ? APP_STORE_URL
        : /android/i.test(ua)
          ? PLAY_STORE_URL
          : null;
      return new Response(postLandingHtml(storeUrl), {
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    }
    return new Response('Not found', { status: 404 });
  },
};
