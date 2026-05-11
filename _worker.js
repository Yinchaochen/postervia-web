// Tiny request router for postervia-web. Rewrites pretty URLs like /privacy
// to the actual asset filename /privacy.html so the static-asset handler can
// find them, then defers everything else (CSS-style direct file requests,
// /index.html, /privacy.html, etc.) to ASSETS unchanged.
//
// Why not _redirects: Cloudflare Workers Static Assets does not parse the
// Pages-style _redirects file. Doing this in a Worker is the supported way.

const PRETTY_TO_HTML = new Set([
  '/privacy',
  '/privacy-de',
  '/terms',
  '/terms-de',
  '/impressum',
  '/impressum-de',
]);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (PRETTY_TO_HTML.has(url.pathname)) {
      url.pathname = url.pathname + '.html';
      return env.ASSETS.fetch(new Request(url.toString(), request));
    }
    return env.ASSETS.fetch(request);
  },
};
