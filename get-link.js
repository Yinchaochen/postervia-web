import { APP_STORE_URL, PLAY_STORE_URL } from './share-page.js';

// GET /get?src=<slug>[&to=ios|android] — the campaign store link used by the
// survey's "Get the app" button. Counts one click per platform/src and 302s.
const SRC_RE = /^[a-z0-9_-]{1,24}$/;

// Preview crawlers and CLIs. In-app browsers (Instagram, FBAN/FBAV,
// MicroMessenger, Snapchat) are real users and deliberately not listed. The
// generic "bot" needs a delimiter after it: Cubot phones put "CUBOT " in the UA.
const BOT_RE = /WhatsApp|Telegram|facebookexternalhit|Twitterbot|Slackbot|Discordbot|LinkedInBot|Googlebot|bingbot|Applebot|curl|python-requests|bot(?=[/;)\-]|$)|crawl|spider|preview|fetcher/i;

const REDIRECT_HEADERS = {
  'cache-control': 'no-store',
  'referrer-policy': 'no-referrer',
  'x-robots-tag': 'noindex',
  vary: 'User-Agent',
};

const BOT_HTML = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="robots" content="noindex">
<title>Postervia</title>
<meta property="og:site_name" content="Postervia">
<meta property="og:title" content="Postervia">
<meta property="og:description" content="Find your path. Leave a light.">
<meta property="og:image" content="https://postervia.app/assets/postervia-icon.png">
</head><body><p>Find your path. Leave a light.</p></body></html>`;

export function sanitizeSrc(raw) {
  if (raw === null || raw === undefined) return 'direct';
  const slug = String(raw).toLowerCase();
  return SRC_RE.test(slug) ? slug : 'invalid';
}

// Order matters: Windows Phone UAs contain both "Android" and "iPhone".
function platformFromUa(ua) {
  if (/Windows Phone|IEMobile/i.test(ua)) return 'desktop';
  if (/KAIOS/i.test(ua)) return 'desktop';
  if (/OpenHarmony|ArkWeb/i.test(ua)) return 'desktop';
  if (/iPhone|iPad|iPod|CriOS|FxiOS/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

export function classifyUserAgent(ua) {
  const agent = String(ua || '');
  return { bot: BOT_RE.test(agent), platform: platformFromUa(agent) };
}

export function storeUrl(platform, src, env) {
  if (platform === 'ios') {
    const pt = env && typeof env.APPLE_PT === 'string' ? env.APPLE_PT : '';
    return pt ? `${APP_STORE_URL}&pt=${encodeURIComponent(pt)}&ct=web-${src}&mt=8` : APP_STORE_URL;
  }
  if (platform === 'android') {
    const referrer = new URLSearchParams({
      utm_source: 'postervia_web',
      utm_medium: 'survey',
      utm_campaign: src,
    }).toString();
    return `${PLAY_STORE_URL}&referrer=${encodeURIComponent(referrer)}`;
  }
  // Extensionless: the assets layer 307s every *.html URL to its bare path.
  return `/get-app?src=${src}`;
}

function shouldCount(request) {
  if (request.method !== 'GET') return false;
  const secPurpose = request.headers.get('sec-purpose') || '';
  const purpose = request.headers.get('purpose') || '';
  return !/prefetch/i.test(secPurpose) && !/prefetch/i.test(purpose);
}

// Best effort by design: no IP, no UA, no cookie, and a failing sink never
// touches the redirect.
function count(env, platform, src, via) {
  console.log(JSON.stringify({ evt: 'get_click', platform, src, via }));
  try {
    env?.CLICKS?.writeDataPoint({ blobs: [platform, src, via], doubles: [1], indexes: [src] });
  } catch {
    // swallowed on purpose, see above
  }
}

export function handleGet(request, env) {
  const url = new URL(request.url);
  const src = sanitizeSrc(url.searchParams.get('src'));
  const { bot, platform: sniffed } = classifyUserAgent(request.headers.get('user-agent'));
  if (bot) {
    return new Response(BOT_HTML, {
      headers: { 'content-type': 'text/html; charset=utf-8', 'x-robots-tag': 'noindex' },
    });
  }

  const to = url.searchParams.get('to');
  const explicit = to === 'ios' || to === 'android';
  const platform = explicit ? to : sniffed;
  const via = explicit ? 'to' : 'ua';
  if (shouldCount(request)) count(env, platform, src, via);

  return new Response(null, {
    status: 302,
    headers: { location: new URL(storeUrl(platform, src, env), url.origin).href, ...REDIRECT_HEADERS },
  });
}
