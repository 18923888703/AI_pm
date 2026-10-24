const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');

(async () => {
  const { handleSync } = await import('../netlify/lib/sync-protocol.mjs');
  const id = 'a'.repeat(64), token = 'b'.repeat(64);
  const config = { roomId: id, authHash: createHash('sha256').update(token).digest('hex') };
  let blob = null, etag = '', revision = 0;
  const store = {
    async getWithMetadata() { return blob === null ? null : { data: blob, etag }; },
    async getMetadata() { return blob === null ? null : { etag }; },
    async delete() { blob = null; etag = ''; },
    async set(_id, value, options) {
      if (options.onlyIfNew && blob !== null) return { modified: false };
      if (options.onlyIfMatch && options.onlyIfMatch !== etag) return { modified: false };
      blob = value; etag = '"revision-' + (++revision) + '"';
      return { modified: true };
    }
  };
  const endpoint = 'https://example.netlify.app/.netlify/functions/sync-memory?id=' + id;
  const put = (body, auth = token) => new Request(endpoint, { method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-AIPM-Sync-Auth': auth }, body: JSON.stringify(body) });
  const payload = { v: 1, iv: '1234567890abcdef', data: 'A'.repeat(64) };
  assert.equal((await handleSync(new Request(endpoint.replace(id, 'c'.repeat(64))), store, config)).status, 404,
    '未获邀请的房间不能读写');
  assert.equal((await handleSync(put({ payload, etag: null }, 'c'.repeat(64)), store, config)).status, 401,
    '只知道房间 ID 不能写入');
  const created = await handleSync(put({ payload, etag: null }), store, config);
  assert.equal(created.status, 200);
  assert.equal(JSON.parse(blob).data, payload.data, '服务器只保存加密信封，不接收学习明文');
  const fetched = await handleSync(new Request(endpoint), store, config);
  assert.equal(fetched.status, 200);
  const read = await fetched.json();
  assert.deepEqual(read.payload, payload);
  assert.equal(read.etag, '"revision-1"');
  assert.equal(fetched.headers.get('Cache-Control'), 'no-store');
  assert.equal((await handleSync(put({ payload, etag: '"stale"' }), store, config)).status, 409,
    '旧设备不能覆盖另一设备的新版本');
  assert.equal((await handleSync(put({ payload, etag: read.etag }), store, config)).status, 200);
  assert.equal((await handleSync(put({ payload: { ...payload, data: 'abc' }, etag }), store, config)).status, 400);
  assert.equal((await handleSync(new Request(endpoint, { method: 'DELETE', headers: { 'X-AIPM-Sync-Auth': token } }), store, config)).status, 200);
  assert.equal((await handleSync(new Request(endpoint), store, config)).status, 404);
  assert.equal((await handleSync(new Request(endpoint), store, {})).status, 503, '缺少服务端配置时应拒绝访问');
  console.log('cloud protocol: room allowlist, authenticated writes, ETag conflict and encrypted envelope validated');
})().catch(error => { console.error(error); process.exitCode = 1; });
