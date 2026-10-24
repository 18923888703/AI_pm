import { createHash, timingSafeEqual } from 'node:crypto';

const MAX_BODY = 4_600_000;
const ID = /^[a-f0-9]{64}$/;
const B64 = /^[A-Za-z0-9_-]+$/;
const ETAG = /^[\x21-\x7e]{1,180}$/;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  } });
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
  if (!ID.test(config.roomId || '') || !ID.test(config.authHash || '')) return json({ error: 'sync-not-configured' }, 503);
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!ID.test(id || '') || !equalHash(id, config.roomId)) return json({ error: 'not-found' }, 404);
  if (request.method === 'GET') {
    const entry = await store.getWithMetadata(id, { consistency: 'strong' });
    if (!entry) return json({ error: 'empty' }, 404);
    try { return json({ payload: JSON.parse(entry.data), etag: entry.etag }); }
    catch (error) { return json({ error: 'stored-payload-invalid' }, 500); }
  }
  if (request.method !== 'PUT' && request.method !== 'DELETE') return json({ error: 'method-not-allowed' }, 405);
  const token = request.headers.get('X-AIPM-Sync-Auth') || '';
  const tokenHash = createHash('sha256').update(token).digest('hex');
  if (!ID.test(token) || !equalHash(tokenHash, config.authHash)) return json({ error: 'unauthorized' }, 401);
  if (request.method === 'DELETE') {
    await store.delete(id);
    return json({ deleted: true });
  }
  const declared = Number(request.headers.get('Content-Length') || 0);
  if (declared > MAX_BODY) return json({ error: 'payload-too-large' }, 413);
  let body;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY) return json({ error: 'payload-too-large' }, 413);
    body = JSON.parse(raw);
  } catch (error) { return json({ error: 'invalid-json' }, 400); }
  if (!validPayload(body.payload) || (body.etag != null && (typeof body.etag !== 'string' || !ETAG.test(body.etag))))
    return json({ error: 'invalid-payload' }, 400);
  const options = body.etag ? { onlyIfMatch: body.etag } : { onlyIfNew: true };
  const result = await store.set(id, JSON.stringify(body.payload), options);
  if (!result.modified) return json({ error: 'conflict' }, 409);
  const saved = await store.getMetadata(id, { consistency: 'strong' });
  return json({ etag: saved && saved.etag || null, saved: true });
}
