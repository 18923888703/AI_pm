import { createHash, timingSafeEqual } from 'node:crypto';

const MAX_BODY = 4_600_000;
const ID = /^[a-f0-9]{64}$/;
const B64 = /^[A-Za-z0-9_-]+$/;
const ETAG = /^[\x21-\x7e]{1,180}$/;

function json(data, status = 200, origin = '') {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  };
  if (origin) { headers['Access-Control-Allow-Origin'] = origin; headers.Vary = 'Origin'; }
  return new Response(JSON.stringify(data), { status, headers });
}
function equalHash(left, right) {
  if (!ID.test(left || '') || !ID.test(right || '')) return false;
  return timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}
function validPayload(value) {
  return value && value.v === 1 && typeof value.iv === 'string' && value.iv.length === 16 && B64.test(value.iv) &&
    typeof value.data === 'string' && value.data.length >= 24 && value.data.length <= 4_400_000 && B64.test(value.data);
}

export async function handleSync(request, store, config) {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin') || '';
  const allowedOrigin = origin === url.origin || origin === 'https://18923888703.github.io' ? origin : '';
  if (origin && !allowedOrigin) return json({ error: 'origin-not-allowed' }, 403);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-AIPM-Sync-Auth',
    'Access-Control-Max-Age': '600', 'Vary': 'Origin', 'Cache-Control': 'no-store'
  } });
  const respond = (data, status) => json(data, status, allowedOrigin);
  if (!ID.test(config.roomId || '') || !ID.test(config.authHash || '')) return respond({ error: 'sync-not-configured' }, 503);
  const id = url.searchParams.get('id');
  if (!ID.test(id || '') || !equalHash(id, config.roomId)) return respond({ error: 'not-found' }, 404);
  if (request.method === 'GET') {
    const entry = await store.getWithMetadata(id, { consistency: 'strong' });
    if (!entry) return respond({ error: 'empty' }, 404);
    try { return respond({ payload: JSON.parse(entry.data), etag: entry.etag }); }
    catch (error) { return respond({ error: 'stored-payload-invalid' }, 500); }
  }
  if (request.method !== 'PUT' && request.method !== 'DELETE') return respond({ error: 'method-not-allowed' }, 405);
  const token = request.headers.get('X-AIPM-Sync-Auth') || '';
  const tokenHash = createHash('sha256').update(token).digest('hex');
  if (!ID.test(token) || !equalHash(tokenHash, config.authHash)) return respond({ error: 'unauthorized' }, 401);
  if (request.method === 'DELETE') {
    await store.delete(id);
    return respond({ deleted: true });
  }
  const declared = Number(request.headers.get('Content-Length') || 0);
  if (declared > MAX_BODY) return respond({ error: 'payload-too-large' }, 413);
  let body;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY) return respond({ error: 'payload-too-large' }, 413);
    body = JSON.parse(raw);
  } catch (error) { return respond({ error: 'invalid-json' }, 400); }
  if (!validPayload(body.payload) || (body.etag != null && (typeof body.etag !== 'string' || !ETAG.test(body.etag))))
    return respond({ error: 'invalid-payload' }, 400);
  const options = body.etag ? { onlyIfMatch: body.etag } : { onlyIfNew: true };
  const result = await store.set(id, JSON.stringify(body.payload), options);
  if (!result.modified) return respond({ error: 'conflict' }, 409);
  const saved = await store.getMetadata(id, { consistency: 'strong' });
  return respond({ etag: saved && saved.etag || null, saved: true });
}
