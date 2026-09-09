// Unit tests for worker.js — run with: node scripts/test-worker.mjs
// Drives the exported fetch handler directly (node >= 18 has Request/Response),
// stubbing globalThis.fetch to fake the share-preview API.
import assert from 'node:assert/strict';

import { classifyUserAgent } from '../get-link.js';
import { SHARE_COPY } from '../share-copy.generated.js';
import worker from '../worker.js';

const POST_ID = '0b1c2d3e-4f50-6172-8394-a5b6c7d8e9f0';
const TOKEN = 'a'.repeat(32);
const realFetch = globalThis.fetch;
let fetchCalls = [];

function stubFetch(impl) {
  fetchCalls = [];
  globalThis.fetch = async (input, init) => {
    fetchCalls.push(String(input));
    return impl(String(input), init);
  };
}

function previewResponse(data) {
  return new Response(JSON.stringify({ data, error: null, meta: {} }), {
    headers: { 'content-type': 'application/json' },
  });
}

async function get(path, ua = '') {
  return worker.fetch(
    new Request(`https://postervia.app${path}`, { headers: ua ? { 'user-agent': ua } : {} }),
  );
}

const tests = [];
function test(name, fn) {
  tests.push([name, fn]);
}

test('pretty legal path 301s to .html', async () => {
  const res = await get('/privacy');
  assert.equal(res.status, 301);
  assert.ok(res.headers.get('location').endsWith('/privacy.html'));
});

test('unknown path 404s', async () => {
  const res = await get('/nope');
  assert.equal(res.status, 404);
});

test('share chrome ships complete long-tail translations with placeholders intact', () => {
  const requiredKeys = Object.keys(SHARE_COPY.en).sort();
  assert.ok(Object.keys(SHARE_COPY).length >= 100);
  for (const [locale, copy] of Object.entries(SHARE_COPY)) {
    assert.deepEqual(Object.keys(copy).sort(), requiredKeys, `${locale} has the full share copy`);
    for (const placeholder of ['count', 'current', 'total', 'author']) {
      for (const [key, source] of Object.entries(SHARE_COPY.en)) {
        if (source.includes(`{${placeholder}}`)) {
          assert.ok(copy[key].includes(`{${placeholder}}`), `${locale}.${key} keeps {${placeholder}}`);
        }
      }
    }
  }
  assert.notEqual(SHARE_COPY.fr.openInApp, SHARE_COPY.en.openInApp);
  assert.notEqual(SHARE_COPY.ja.openInApp, SHARE_COPY.en.openInApp);
});

test('/p without token: generic landing, store links, no auto-redirect, noindex, no API call', async () => {
  stubFetch(() => {
    throw new Error('must not call API without a token');
  });
  const res = await get(`/p/${POST_ID}`, 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)');
  const html = await res.text();
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-robots-tag'), 'noindex');
  assert.ok(html.includes('name="robots" content="noindex"'));
  assert.ok(html.includes('apps.apple.com'));
  assert.ok(!html.includes('http-equiv="refresh"'));
  assert.ok(!html.includes('og:title'));
  assert.equal(fetchCalls.length, 0);
});

test('/p with valid token: OG tags injected from API', async () => {
  stubFetch(() =>
    previewResponse({
      title: 'Anmeldung without an appointment',
      description: 'I walked in at 7am and it worked.',
      author_name: 'Mira',
      author_avatar_url: 'https://media.postervia.app/avatars/mira.jpg',
      image_url: 'https://media.postervia.app/community/first.jpg',
      media_items: [
        ...Array.from({ length: 4 }, (_, index) => ({
          url: `https://media.postervia.app/community/${index + 1}.jpg`,
          mime_type: 'image/jpeg',
        })),
      ],
      total_media_count: 18,
      body: 'A useful route with enough detail to read before installing the app.',
      city: 'Berlin',
      created_at: '2026-07-21T08:30:00Z',
      helpful_count: 4753,
      save_count: 4784,
      comment_count: 55,
      comments_preview: [
        {
          body: 'The early route is quieter.',
          author_name: 'Kai',
          author_avatar_url: 'https://media.postervia.app/avatars/kai.jpg',
          created_at: '2026-07-21T09:30:00Z',
          helpful_count: 3,
          reply_count: 7,
          moderation_status: 'approved',
        },
      ],
    }),
  );
  const res = await get(`/p/${POST_ID}?s=${TOKEN}`, 'LinkedInBot/1.0');
  const html = await res.text();
  assert.equal(fetchCalls.length, 1);
  assert.ok(fetchCalls[0].includes(`/v1/community/posts/${POST_ID}/share-preview?s=${TOKEN}`));
  assert.ok(html.includes('<title>Anmeldung without an appointment · Postervia</title>'));
  assert.ok(html.includes('og:title" content="Anmeldung without an appointment"'));
  assert.ok(html.includes('og:description" content="Mira · I walked in at 7am and it worked."'));
  assert.ok(html.includes('og:image" content="https://media.postervia.app/community/first.jpg"'));
  assert.ok(html.includes('twitter:card" content="summary_large_image"'));
  assert.ok(html.includes('Postervia'));
  assert.equal((html.match(/data-media-state="visible"/g) || []).length, 3);
  assert.equal((html.match(/data-media-state="locked"/g) || []).length, 1);
  assert.ok(html.includes('4 / 18'));
  assert.ok(html.includes('data-watermark'));
  assert.ok(html.includes('Open in App'));
  assert.ok(html.includes('View all 55 comments in the app'));
  assert.ok(html.includes('Show all 7 replies in the app'));
  assert.ok(html.includes(`postervia://p/${POST_ID}?s=${TOKEN}`));
  assert.ok(!html.includes('http-equiv="refresh"'));
});

test('three or fewer media stay fully visible without an app gate', async () => {
  stubFetch(() =>
    previewResponse({
      title: 'Three calm places',
      description: 'A short list.',
      author_name: 'Mira',
      image_url: 'https://media.postervia.app/community/one.jpg',
      media_items: [1, 2, 3].map((index) => ({
        url: `https://media.postervia.app/community/${index}.jpg`,
        mime_type: 'image/jpeg',
      })),
      total_media_count: 3,
      body: 'All three images should be visible.',
      comments_preview: [],
      comment_count: 0,
    }),
  );
  const html = await (await get(`/p/${POST_ID}?s=${TOKEN}`)).text();
  assert.equal((html.match(/data-media-state="visible"/g) || []).length, 3);
  assert.equal((html.match(/data-media-state="locked"/g) || []).length, 0);
  assert.ok(!html.includes('See the rest in Postervia'));
});

test('browser locale selects localized chrome and RTL direction', async () => {
  stubFetch(() =>
    previewResponse({
      title: '柏林路线',
      description: '三张图先看。',
      author_name: 'Mira',
      image_url: null,
      media_items: [],
      total_media_count: 0,
      body: '正文',
      comments_preview: [],
      comment_count: 0,
    }),
  );
  const zhRes = await worker.fetch(new Request(
    `https://postervia.app/p/${POST_ID}?s=${TOKEN}`,
    { headers: { 'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8' } },
  ));
  const zhHtml = await zhRes.text();
  assert.ok(zhHtml.includes('<html lang="zh-CN" dir="ltr">'));
  assert.ok(zhHtml.includes('在 App 中打开'));

  const arRes = await worker.fetch(new Request(
    `https://postervia.app/p/${POST_ID}?s=${TOKEN}`,
    { headers: { 'accept-language': 'ar,en;q=0.8' } },
  ));
  const arHtml = await arRes.text();
  assert.ok(arHtml.includes('<html lang="ar" dir="rtl">'));

  const frRes = await worker.fetch(new Request(
    `https://postervia.app/p/${POST_ID}?s=${TOKEN}`,
    { headers: { 'accept-language': 'fr-FR,fr;q=0.9,en;q=0.8' } },
  ));
  const frHtml = await frRes.text();
  assert.ok(frHtml.includes('<html lang="fr" dir="ltr">'));
  assert.ok(frHtml.includes('Ouvrir dans l’app'));
});

test('UGC is HTML-escaped (no stored XSS via post title)', async () => {
  stubFetch(() =>
    previewResponse({
      title: '"><script>alert(1)</script>',
      description: "O'Reilly & <friends>",
      author_name: 'A"B',
      image_url: null,
      media_items: [{ url: 'javascript:alert(1)', mime_type: 'image/jpeg' }],
      total_media_count: 1,
      body: '<img src=x onerror=alert(2)>',
      comments_preview: [{
        body: '<svg onload=alert(3)>',
        author_name: '<b>attacker</b>',
        author_avatar_url: 'data:text/html,<script>alert(4)</script>',
        reply_count: 0,
        helpful_count: 0,
        moderation_status: 'approved',
      }],
      comment_count: 1,
    }),
  );
  const res = await get(`/p/${POST_ID}?s=${TOKEN}`);
  const html = await res.text();
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(html.includes('O&#39;Reilly &amp; &lt;friends&gt;'));
  assert.ok(!html.includes('<img src=x onerror=alert(2)>'));
  assert.ok(!html.includes('<svg onload=alert(3)>'));
  assert.ok(!html.includes('javascript:alert(1)'));
  assert.ok(!html.includes('data:text/html'));
  assert.ok(html.includes('twitter:card" content="summary"'));
  assert.ok(!html.includes('og:image'));
});

test('template placeholders in UGC cannot break out of link attributes', async () => {
  stubFetch(() =>
    previewResponse({
      title: 'Poster',
      description: 'body',
      author_name: '__STORE_DATA__ onerror=alert(document.domain) x',
      media_items: [{ url: 'https://media.postervia.app/a.jpg', mime_type: 'image/jpeg' }],
      total_media_count: 9,
      body: 'A useful route with enough detail to read before installing the app.',
      comment_count: 2,
      comments_preview: [{
        body: 'nice __APP_LINK__ __STORE_DATA__',
        author_name: '__APP_LINK__',
        reply_count: 4,
        helpful_count: 0,
        moderation_status: 'approved',
      }],
    }),
  );
  const res = await get(`/p/${POST_ID}?s=${TOKEN}`, 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)');
  const html = await res.text();
  // A closing quote immediately followed by an event handler is the attribute-breakout signature.
  assert.ok(!/"\s+onerror=/.test(html));
  // The placeholders must never manufacture a data-store-url attribute from author/comment text.
  assert.ok(!/alt="[^"]*data-store-url=/.test(html));
  // Legit app-gate links are still wired from real values, not user text.
  assert.ok(html.includes('data-store-url="https://apps.apple.com'));
});

test('API 404 (bad token / hidden post) falls back to generic landing', async () => {
  stubFetch(() => new Response('{}', { status: 404 }));
  const res = await get(`/p/${POST_ID}?s=${TOKEN}`);
  const html = await res.text();
  assert.equal(res.status, 200);
  assert.ok(!html.includes('og:title'));
  assert.ok(html.includes('Continue in Postervia'));
});

test('API failure falls back to generic landing', async () => {
  stubFetch(() => {
    throw new Error('network down');
  });
  const res = await get(`/p/${POST_ID}?s=${TOKEN}`);
  const html = await res.text();
  assert.equal(res.status, 200);
  assert.ok(!html.includes('og:title'));
});

test('non-UUID id or malformed token never reaches the API', async () => {
  stubFetch(() => {
    throw new Error('must not call API for junk input');
  });
  const junkId = await get(`/p/not-a-uuid?s=${TOKEN}`);
  assert.equal(junkId.status, 200);
  const junkToken = await get(`/p/${POST_ID}?s=${encodeURIComponent('"><img>')}`);
  assert.equal(junkToken.status, 200);
  assert.equal(fetchCalls.length, 0);
});

// ---- /get campaign store link ----------------------------------------------
const UA = {
  iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  crios: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1',
  macSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  androidChrome: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  androidReduced: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  windowsChrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  windowsPhone: 'Mozilla/5.0 (Mobile; Windows Phone 8.1; Android 4.0; ARM; Trident/7.0; Touch; rv:11.0; IEMobile/11.0; NOKIA; Lumia 930) like iPhone OS 7_0_3 Mac OS X AppleWebKit/537 (KHTML, like Gecko) Mobile Safari/537',
  openHarmony: 'Mozilla/5.0 (Phone; OpenHarmony 5.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36 ArkWeb/4.1.6.1 Mobile',
  kaios: 'Mozilla/5.0 (Mobile; Nokia 8110 4G; rv:48.0) Gecko/48.0 Firefox/48.0 KAIOS/2.5',
  whatsapp: 'WhatsApp/2.23.20.0 A',
  facebook: 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
  googlebotPhone: 'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  instagram: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 334.0.0.0.0 (iPhone15,2; iOS 17_5; en_US; en; scale=3.00; 1179x2556; 123456789)',
  fban: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/470.0.0.0.0;FBBV/1;FBDV/iPhone15,2;FBMD/iPhone;FBSN/iOS;FBSV/17.5;FBSS/3;FBID/phone;FBLC/en_US;FBOP/5]',
  wechat: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/116.0.0.0 Mobile Safari/537.36 XWEB/1160065 MMWEBSDK/20231202 MMWEBID/1 MicroMessenger/8.0.47',
  snapchat: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 Snapchat/12.90.0.44',
  cubot: 'Mozilla/5.0 (Linux; Android 11; CUBOT KINGKONG 5 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36',
};

function fakeClicks(impl) {
  const points = [];
  const writeDataPoint = impl || ((point) => points.push(point));
  return { points, env: { CLICKS: { writeDataPoint } } };
}

// Captures the console.log click channel so the harness output stays clean
// and the log line shape can be asserted.
async function getLink(path, { ua = '', env, method = 'GET', headers = {} } = {}) {
  const logs = [];
  const realLog = console.log;
  console.log = (line) => logs.push(line);
  try {
    const res = await worker.fetch(
      new Request(`https://postervia.app${path}`, {
        method,
        headers: ua ? { 'user-agent': ua, ...headers } : headers,
      }),
      env,
    );
    return { res, logs };
  } finally {
    console.log = realLog;
  }
}

function assertRedirect(res) {
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.equal(res.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(res.headers.get('x-robots-tag'), 'noindex');
  assert.equal(res.headers.get('vary'), 'User-Agent');
  return res.headers.get('location');
}

const PLAY_REFERRER = 'referrer=utm_source%3Dpostervia_web%26utm_medium%3Dsurvey%26utm_campaign%3Dsprachcafe';

test('/get: iPhone Safari and Chrome iOS go to the App Store', async () => {
  for (const ua of [UA.iphoneSafari, UA.crios]) {
    const { res } = await getLink('/get?src=sprachcafe', { ua });
    const location = assertRedirect(res);
    assert.equal(location, 'https://apps.apple.com/de/app/postervia/id6768678629?l=en-GB');
  }
});

test('/get: Android Chrome (full and reduced UA) goes to Play with the utm referrer', async () => {
  for (const ua of [UA.androidChrome, UA.androidReduced]) {
    const { res } = await getLink('/get?src=sprachcafe', { ua });
    const location = assertRedirect(res);
    assert.ok(location.startsWith('https://play.google.com/store/apps/details?id=app.novaku.mobile&'));
    assert.ok(location.endsWith(PLAY_REFERRER), location);
  }
});

test('/get: desktop-class UAs land on get-app.html (Mac, Windows, Windows Phone, OpenHarmony, KaiOS)', async () => {
  for (const ua of [UA.macSafari, UA.windowsChrome, UA.windowsPhone, UA.openHarmony, UA.kaios]) {
    const { res } = await getLink('/get?src=sprachcafe', { ua });
    const location = assertRedirect(res);
    assert.equal(location, 'https://postervia.app/get-app?src=sprachcafe', ua);
  }
});

test('/get: to=ios|android overrides the UA, junk to= is ignored', async () => {
  const { points, env } = fakeClicks();
  const ios = await getLink('/get?src=sprachcafe&to=ios', { ua: UA.windowsChrome, env });
  assert.ok(assertRedirect(ios.res).startsWith('https://apps.apple.com/'));
  const android = await getLink('/get?src=sprachcafe&to=android', { ua: UA.macSafari, env });
  assert.ok(assertRedirect(android.res).startsWith('https://play.google.com/'));
  const junk = await getLink('/get?src=sprachcafe&to=junk', { ua: UA.windowsChrome, env });
  assert.equal(assertRedirect(junk.res), 'https://postervia.app/get-app?src=sprachcafe');
  const junkIos = await getLink('/get?src=sprachcafe&to=junk', { ua: UA.iphoneSafari, env });
  assert.ok(assertRedirect(junkIos.res).startsWith('https://apps.apple.com/'));
  assert.deepEqual(points.map((point) => point.blobs), [
    ['ios', 'sprachcafe', 'to'],
    ['android', 'sprachcafe', 'to'],
    ['desktop', 'sprachcafe', 'ua'],
    ['ios', 'sprachcafe', 'ua'],
  ]);
});

test('/get: src missing → direct, invalid or too long → invalid, raw value never echoed', async () => {
  const { points, env } = fakeClicks();
  const missing = await getLink('/get', { ua: UA.windowsChrome, env });
  assert.equal(assertRedirect(missing.res), 'https://postervia.app/get-app?src=direct');

  const raw = 'Sprach Café';
  const spaced = await getLink(`/get?src=${encodeURIComponent(raw)}`, { ua: UA.androidChrome, env });
  const spacedLocation = assertRedirect(spaced.res);
  assert.ok(!spacedLocation.includes(raw));
  assert.ok(!spacedLocation.includes(encodeURIComponent(raw)));
  assert.ok(!spacedLocation.toLowerCase().includes('sprach'));
  assert.ok(spacedLocation.endsWith('utm_campaign%3Dinvalid'));

  const long = await getLink(`/get?src=${'a'.repeat(25)}`, { ua: UA.iphoneSafari, env: { ...env, APPLE_PT: '12345' } });
  assert.ok(assertRedirect(long.res).includes('&ct=web-invalid&'));

  const upper = await getLink('/get?src=Reddit', { ua: UA.windowsChrome, env });
  assert.equal(assertRedirect(upper.res), 'https://postervia.app/get-app?src=reddit');

  assert.deepEqual(points.map((point) => point.blobs[1]), ['direct', 'invalid', 'invalid', 'reddit']);
  assert.deepEqual(points.map((point) => point.indexes[0]), ['direct', 'invalid', 'invalid', 'reddit']);
});

test('/get: preview crawlers get a 200 OG page and are not counted', async () => {
  for (const ua of [UA.whatsapp, UA.facebook, UA.googlebotPhone, 'curl/8.6.0', 'python-requests/2.31']) {
    const { points, env } = fakeClicks();
    const { res, logs } = await getLink('/get?src=sprachcafe', { ua, env });
    const html = await res.text();
    assert.equal(res.status, 200, ua);
    assert.ok(res.headers.get('content-type').startsWith('text/html'));
    assert.equal(res.headers.get('x-robots-tag'), 'noindex');
    assert.ok(html.includes('og:title" content="Postervia"'));
    assert.ok(html.includes('og:description" content="Find your path. Leave a light."'));
    assert.ok(html.includes('og:image" content="https://postervia.app/assets/postervia-icon.png"'));
    assert.ok(html.includes('og:site_name" content="Postervia"'));
    assert.equal(points.length, 0, ua);
    assert.equal(logs.length, 0, ua);
  }
});

test('/get: in-app browsers are real users, not bots', async () => {
  for (const ua of [UA.instagram, UA.fban, UA.wechat, UA.snapchat, UA.cubot]) {
    assert.equal(classifyUserAgent(ua).bot, false, ua);
  }
  assert.equal(classifyUserAgent(UA.cubot).platform, 'android');
  for (const ua of ['Mozilla/5.0 (compatible; PetalBot;+https://webmaster.petalsearch.com/site/petalbot)', 'Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)', 'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)', 'TelegramBot (like TwitterBot)']) {
    assert.equal(classifyUserAgent(ua).bot, true, ua);
  }
  const { points, env } = fakeClicks();
  const { res } = await getLink('/get?src=survey', { ua: UA.instagram, env });
  assert.ok(assertRedirect(res).startsWith('https://apps.apple.com/'));
  assert.deepEqual(points, [{ blobs: ['ios', 'survey', 'ua'], doubles: [1], indexes: ['survey'] }]);
});

test('/get: APPLE_PT adds pt/ct/mt to the App Store URL only when set', async () => {
  const withPt = await getLink('/get?src=sprachcafe', { ua: UA.iphoneSafari, env: { APPLE_PT: '123456' } });
  const location = assertRedirect(withPt.res);
  assert.ok(location.startsWith('https://apps.apple.com/de/app/postervia/id6768678629?l=en-GB&'));
  assert.ok(location.includes('&pt=123456'));
  assert.ok(location.includes('&ct=web-sprachcafe'));
  assert.ok(location.includes('&mt=8'));

  for (const env of [{ APPLE_PT: '' }, {}, undefined]) {
    const { res } = await getLink('/get?src=sprachcafe', { ua: UA.iphoneSafari, env });
    const plain = assertRedirect(res);
    assert.equal(plain, 'https://apps.apple.com/de/app/postervia/id6768678629?l=en-GB');
    assert.ok(!plain.includes('pt=') && !plain.includes('ct='));
  }
});

test('/get: one data point per counted click and a log line with nothing but platform/src/via', async () => {
  const { points, env } = fakeClicks();
  const { res, logs } = await getLink('/get?src=uni', { ua: UA.androidChrome, env });
  assertRedirect(res);
  assert.deepEqual(points, [{ blobs: ['android', 'uni', 'ua'], doubles: [1], indexes: ['uni'] }]);
  assert.equal(logs.length, 1);
  const line = JSON.parse(logs[0]);
  assert.deepEqual(line, { evt: 'get_click', platform: 'android', src: 'uni', via: 'ua' });
  assert.ok(!logs[0].includes('Pixel'));
});

test('/get: env missing or a throwing sink still redirects', async () => {
  const noEnv = await getLink('/get?src=eltern', { ua: UA.iphoneSafari });
  assert.ok(assertRedirect(noEnv.res).startsWith('https://apps.apple.com/'));
  const noBinding = await getLink('/get?src=eltern', { ua: UA.androidChrome, env: {} });
  assert.ok(assertRedirect(noBinding.res).startsWith('https://play.google.com/'));
  const { env } = fakeClicks(() => {
    throw new Error('analytics down');
  });
  const throwing = await getLink('/get?src=eltern', { ua: UA.androidChrome, env });
  assert.ok(assertRedirect(throwing.res).startsWith('https://play.google.com/'));
});

test('/get: HEAD and prefetch requests redirect but are not counted', async () => {
  const { points, env } = fakeClicks();
  const head = await getLink('/get?src=reddit', { ua: UA.iphoneSafari, env, method: 'HEAD' });
  assert.ok(assertRedirect(head.res).startsWith('https://apps.apple.com/'));
  const secPurpose = await getLink('/get?src=reddit', {
    ua: UA.androidChrome,
    env,
    headers: { 'sec-purpose': 'prefetch;prerender' },
  });
  assert.ok(assertRedirect(secPurpose.res).startsWith('https://play.google.com/'));
  const purpose = await getLink('/get?src=reddit', { ua: UA.androidChrome, env, headers: { purpose: 'prefetch' } });
  assert.ok(assertRedirect(purpose.res).startsWith('https://play.google.com/'));
  assert.equal(points.length, 0);
  assert.equal(head.logs.length + secPurpose.logs.length + purpose.logs.length, 0);
});

test('/get: exact path only, trailing variants still 404', async () => {
  assert.equal((await get('/get/')).status, 404);
  assert.equal((await get('/getx')).status, 404);
});

let failed = 0;
for (const [name, fn] of tests) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`FAIL - ${name}`);
    console.error(err);
  }
}
globalThis.fetch = realFetch;
console.log(failed === 0 ? `\n${tests.length}/${tests.length} passed` : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
