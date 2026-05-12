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

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (PRETTY_TO_HTML.has(url.pathname)) {
      url.pathname = url.pathname + '.html';
      return Response.redirect(url.toString(), 301);
    }
    return new Response('Not found', { status: 404 });
  },
};
