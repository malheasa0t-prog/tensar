import assert from 'node:assert/strict';
import test from 'node:test';

import { createImageProxyHandler, readAllowedImageHosts } from './img.js';

/**
 * Creates an image proxy request context for tests.
 *
 * @param {string} targetUrl
 * @param {{ env?: Record<string, string>, params?: Record<string, string> }} [options]
 * @returns {{ env: Record<string, string>, request: Request }}
 */
function createContext(targetUrl, { env = {}, params = {} } = {}) {
  const query = new URLSearchParams({ url: targetUrl, ...params });

  return {
    env,
    request: new Request(`https://techzone.example/api/img?${query.toString()}`),
  };
}

test('readAllowedImageHosts should merge defaults with environment hosts', () => {
  const hosts = readAllowedImageHosts({
    NEXT_PUBLIC_SUPABASE_URL: 'https://demo.supabase.co',
    IMAGE_PROXY_ALLOWED_HOSTS: 'cdn.example.com, https://images.example.com/path/to/file.png ',
  });

  assert.equal(hosts.has('rxiukzmqoiknlehxctbs.supabase.co'), true);
  assert.equal(hosts.has('bayubxlmrgkquwoutwmn.supabase.co'), true);
  assert.equal(hosts.has('placehold.co'), true);
  assert.equal(hosts.has('serva-s.com'), true);
  assert.equal(hosts.has('demo.supabase.co'), true);
  assert.equal(hosts.has('cdn.example.com'), true);
  assert.equal(hosts.has('images.example.com'), true);
});

test('createImageProxyHandler should reject hosts outside the allow-list', async () => {
  let wasCalled = false;
  const handler = createImageProxyHandler({
    fetchImpl() {
      wasCalled = true;
      throw new Error('Unexpected upstream fetch');
    },
  });

  const response = await handler(
    createContext('https://evil.example.com/malicious.png', {
      env: { NEXT_PUBLIC_SUPABASE_URL: 'https://demo.supabase.co' },
    })
  );

  assert.equal(response.status, 403);
  assert.equal(wasCalled, false);
});

test('createImageProxyHandler should proxy allow-listed hosts with Cloudflare transforms', async () => {
  const upstreamCalls = [];
  const handler = createImageProxyHandler({
    fetchImpl(url, init) {
      upstreamCalls.push({ url, init });
      return Promise.resolve(
        new Response('image-bytes', {
          status: 200,
          headers: { 'Content-Type': 'image/png' },
        })
      );
    },
  });

  const response = await handler(
    createContext('https://demo.supabase.co/storage/v1/object/public/demo.png', {
      env: { NEXT_PUBLIC_SUPABASE_URL: 'https://demo.supabase.co' },
      params: { format: 'png', q: '70', w: '640' },
    })
  );

  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'image-bytes');
  assert.equal(upstreamCalls.length, 1);
  assert.equal(upstreamCalls[0].url, 'https://demo.supabase.co/storage/v1/object/public/demo.png');
  assert.equal(upstreamCalls[0].init.cf.image.format, 'png');
  assert.equal(upstreamCalls[0].init.cf.image.quality, 70);
  assert.equal(upstreamCalls[0].init.cf.image.width, 640);
});
