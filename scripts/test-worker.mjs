// Unit tests for worker.js — run with: node scripts/test-worker.mjs
// Drives the exported fetch handler directly (node >= 18 has Request/Response),
// stubbing globalThis.fetch to fake the share-preview API.
import assert from 'node:assert/strict';

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

test('/p without token: generic landing, store refresh by UA, noindex, no API call', async () => {
  stubFetch(() => {
    throw new Error('must not call API without a token');
  });
  const res = await get(`/p/${POST_ID}`, 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)');
  const html = await res.text();
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-robots-tag'), 'noindex');
  assert.ok(html.includes('name="robots" content="noindex"'));
  assert.ok(html.includes('apps.apple.com'));
  assert.ok(html.includes('http-equiv="refresh"'));
  assert.ok(!html.includes('og:title'));
  assert.equal(fetchCalls.length, 0);
});

test('/p with valid token: OG tags injected from API', async () => {
  stubFetch(() =>
    previewResponse({
      title: 'Anmeldung without an appointment',
      description: 'I walked in at 7am and it worked.',
      author_name: 'Mira',
      image_url: 'https://media.postervia.app/community/first.jpg',
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
  // LinkedInBot is not iphone/android — no store refresh for crawlers.
  assert.ok(!html.includes('http-equiv="refresh"'));
});

test('UGC is HTML-escaped (no stored XSS via post title)', async () => {
  stubFetch(() =>
    previewResponse({
      title: '"><script>alert(1)</script>',
      description: "O'Reilly & <friends>",
      author_name: 'A"B',
      image_url: null,
    }),
  );
  const res = await get(`/p/${POST_ID}?s=${TOKEN}`);
  const html = await res.text();
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(html.includes('O&#39;Reilly &amp; &lt;friends&gt;'));
  assert.ok(html.includes('twitter:card" content="summary"'));
  assert.ok(!html.includes('og:image'));
});

test('API 404 (bad token / hidden post) falls back to generic landing', async () => {
  stubFetch(() => new Response('{}', { status: 404 }));
  const res = await get(`/p/${POST_ID}?s=${TOKEN}`);
  const html = await res.text();
  assert.equal(res.status, 200);
  assert.ok(!html.includes('og:title'));
  assert.ok(html.includes('Open in Postervia'));
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
