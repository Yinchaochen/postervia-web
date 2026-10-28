import { classifyUserAgent, sanitizeSrc } from './get-link.js';

// GET /c?e=<event>&src=<slug>[&lang=en|de] — counts one page open or one CTA
// click, then 302s to an allowlisted path. Same discipline as /get: no IP, no
// user agent, no cookie, and a sink that fails never touches the redirect.
const REDIRECTS = {
  ask: '/ask.html',
  site: '/',
};

// Page opens: the denominator for every click number. The names are distinct
// from the REDIRECTS keys, so an event resolves to an open or to a redirect
// and never to both.
const VIEWS = new Set(['open-newhere', 'open-ask']);

const LANGS = new Set(['en', 'de']);

const REDIRECT_HEADERS = {
  'cache-control': 'no-store',
  'referrer-policy': 'no-referrer',
  'x-robots-tag': 'noindex',
  vary: 'User-Agent',
};

function shouldCount(request) {
  const secPurpose = request.headers.get('sec-purpose') || '';
  const purpose = request.headers.get('purpose') || '';
  return !/prefetch/i.test(secPurpose) && !/prefetch/i.test(purpose);
}

function count(env, kind, event, src) {
  console.log(JSON.stringify({ evt: 'page_event', kind, event, src }));
  try {
    env?.CLICKS?.writeDataPoint({ blobs: [kind, event, src], doubles: [1], indexes: [src] });
  } catch {
    // swallowed on purpose, see above
  }
}

export function handleClick(request, env) {
  const url = new URL(request.url);
  const event = (url.searchParams.get('e') || '').toLowerCase();
  const src = sanitizeSrc(url.searchParams.get('src'));
  const { bot } = classifyUserAgent(request.headers.get('user-agent'));
  const countable = !bot && request.method === 'GET' && shouldCount(request);

  if (VIEWS.has(event)) {
    if (countable) count(env, 'view', event, src);
    return new Response(null, { status: 204, headers: REDIRECT_HEADERS });
  }

  const target = REDIRECTS[event];
  if (!target) return new Response('Not found', { status: 404 });

  if (countable) count(env, 'click', event, src);

  const next = new URL(target, url.origin);
  const lang = (url.searchParams.get('lang') || '').toLowerCase();
  if (LANGS.has(lang)) next.searchParams.set('lang', lang);
  if (src !== 'direct' && src !== 'invalid') next.searchParams.set('src', src);

  return new Response(null, { status: 302, headers: { location: next.href, ...REDIRECT_HEADERS } });
}
