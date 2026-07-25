import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import worker from '../worker.js';

const port = Number(process.env.PORT || 4173);
const publicRoot = resolve(fileURLToPath(new URL('../public/', import.meta.url)));

const preview = {
  title: 'A slow Sunday route through Kreuzberg',
  description: 'Four small stops that make an easy Berlin afternoon.',
  author_name: 'Mira Chen',
  author_avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=160&q=80',
  image_url: 'https://images.unsplash.com/photo-1560969184-10fe8719e047?auto=format&fit=crop&w=1200&q=86',
  media_items: [
    'photo-1560969184-10fe8719e047',
    'photo-1559564484-e48b3e040ff4',
    'photo-1546726747-421c6d69c929',
    'photo-1554072675-66db59dba46f',
  ].map((id) => ({
    url: `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&q=86`,
    mime_type: 'image/jpeg',
  })),
  total_media_count: 9,
  body: 'Start near the canal before the cafés fill up, then follow the quieter streets toward Görlitzer Park.\n\nThe route is easy to walk, works without a reservation, and leaves enough time to stop wherever looks interesting. Bring a light layer — the water can feel cooler than the rest of the neighbourhood.',
  city: 'Berlin',
  created_at: '2026-07-21T08:30:00Z',
  helpful_count: 128,
  save_count: 74,
  comment_count: 18,
  comments_preview: [
    {
      body: 'The canal section is especially calm before 10.',
      author_name: 'Jonas',
      author_avatar_url: null,
      created_at: '2026-07-21T09:30:00Z',
      helpful_count: 9,
      reply_count: 5,
      moderation_status: 'approved',
    },
    {
      body: 'I tried this with my parents and the pace was perfect.',
      author_name: 'Sofia',
      author_avatar_url: null,
      created_at: '2026-07-21T10:10:00Z',
      helpful_count: 4,
      reply_count: 2,
      moderation_status: 'approved',
    },
    {
      body: 'There is a good bakery one street before the park.',
      author_name: 'Alex',
      author_avatar_url: null,
      created_at: '2026-07-21T11:20:00Z',
      helpful_count: 2,
      reply_count: 0,
      moderation_status: 'approved',
    },
  ],
};

globalThis.fetch = async () => new Response(
  JSON.stringify({ data: preview, error: null, meta: {} }),
  { headers: { 'content-type': 'application/json' } },
);

const contentTypes = {
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

createServer(async (request, response) => {
  const url = new URL(request.url || '/', `http://127.0.0.1:${port}`);
  if (url.pathname.startsWith('/assets/')) {
    const assetPath = resolve(publicRoot, `.${url.pathname}`);
    if (!assetPath.startsWith(publicRoot)) {
      response.writeHead(404).end();
      return;
    }
    try {
      const body = await readFile(assetPath);
      response.writeHead(200, { 'content-type': contentTypes[extname(assetPath)] || 'application/octet-stream' });
      response.end(body);
    } catch {
      response.writeHead(404).end();
    }
    return;
  }

  const workerResponse = await worker.fetch(new Request(url, {
    headers: {
      'accept-language': request.headers['accept-language'] || 'en',
      'user-agent': request.headers['user-agent'] || '',
    },
  }));
  response.writeHead(workerResponse.status, Object.fromEntries(workerResponse.headers));
  response.end(Buffer.from(await workerResponse.arrayBuffer()));
}).listen(port, '127.0.0.1', () => {
  console.log(`Share preview: http://127.0.0.1:${port}/p/0b1c2d3e-4f50-6172-8394-a5b6c7d8e9f0?s=${'a'.repeat(32)}`);
});
