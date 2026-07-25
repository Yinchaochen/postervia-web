// Unit tests for worker.js — run with: node scripts/test-worker.mjs
// Drives the exported fetch handler directly (node >= 18 has Request/Response),
// stubbing globalThis.fetch to fake the share-preview API.
import assert from 'node:assert/strict';

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
