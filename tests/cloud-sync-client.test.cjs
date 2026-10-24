const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createHash, webcrypto } = require('node:crypto');

(async () => {
  const { handleSync } = await import('../netlify/lib/sync-protocol.mjs');
  const code = 'APM1-' + Buffer.alloc(16, 7).toString('base64url');
  let blob = null, etag = '', revision = 0, config = null;
  const server = {
    async getWithMetadata() { return blob === null ? null : { data: blob, etag }; },
    async getMetadata() { return blob === null ? null : { etag }; },
    async set(_id, text, options) {
      if (options.onlyIfNew && blob !== null) return { modified: false };
      if (options.onlyIfMatch && options.onlyIfMatch !== etag) return { modified: false };
      blob = text; etag = '"revision-' + (++revision) + '"'; return { modified: true };
    }
  };
  function device(initial) {
    let doc = JSON.parse(JSON.stringify(initial));
    const storage = new Map();
    const merge = (a, b) => {
      const out = { ...a, ...b, updatedAt: Math.max(a.updatedAt || 0, b.updatedAt || 0),
        terms: { ...a.terms, ...b.terms } };
      out.events = Array.from(new Map([].concat(a.events || [], b.events || []).map(x => [x.id, x])).values());
      out.learningMemory = { attempts: Array.from(new Map([].concat((a.learningMemory || {}).attempts || [],
        (b.learningMemory || {}).attempts || []).map(x => [x.id, x])).values()) };
      return out;
    };
    const win = { crypto: webcrypto, fetch: (req, options) => handleSync(new Request(new URL(req, 'https://example.netlify.app'), options), server, config),
      Mem: { get state() { return doc; } }, Store: { readHot() { return doc; }, mergeDoc: merge,
        applyRemote(remote) { doc = merge(doc, remote); return doc; } } };
    const ctx = { window: win, crypto: webcrypto, fetch: win.fetch, location: { protocol: 'https:' },
      localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value),
        removeItem: key => storage.delete(key) }, document: { addEventListener() {} },
      TextEncoder, TextDecoder, atob, btoa, Uint8Array, AbortController, setTimeout, clearTimeout, console };
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets/cloud-sync.js'), 'utf8'), ctx);
    return { sync: win.CloudSync, get doc() { return doc; }, storage };
  }
  const desktop = device({ version: 2, updatedAt: 1, terms: { rag: { wrong: 1 } },
    events: [{ id: 'e-desktop', t: 1, type: 'quiz_wrong' }], learningMemory: { attempts: [{ id: 'a-desktop' }] },
    chat: [], apiKey: 'must-stay-local' });
  const derived = await desktop.sync.derive(code);
  config = { roomId: derived.id, authHash: createHash('sha256').update(derived.token).digest('hex') };
  assert.equal(await desktop.sync.connect(code), true);
  assert.ok(blob && !blob.includes('must-stay-local') && !blob.includes('quiz_wrong'), '云端不能出现学习明文或模型密钥');
  const phone = device({ version: 2, updatedAt: 2, terms: { memorytaxonomy: { right: 1 } },
    events: [{ id: 'e-phone', t: 2, type: 'quiz_right' }], learningMemory: { attempts: [{ id: 'a-phone' }] }, chat: [] });
  assert.equal(await phone.sync.connect(code), true);
  assert.equal(phone.doc.events.length, 2);
  assert.equal(await desktop.sync.sync(), true);
  assert.equal(desktop.doc.events.length, 2);
  assert.deepEqual(desktop.doc.learningMemory.attempts.map(x => x.id).sort(), ['a-desktop', 'a-phone']);
  assert.equal(desktop.sync.code(), code);
  desktop.sync.disconnect();
  assert.equal(desktop.sync.connected(), false);
  assert.equal(desktop.storage.size, 0);
  const wrong = device({ version: 2, updatedAt: 3, terms: {}, events: [], chat: [] });
  await assert.rejects(wrong.sync.connect('APM1-' + Buffer.alloc(16, 9).toString('base64url')));
  console.log('cloud client: encryption, paired-device merge, local-only key and wrong-code rejection validated');
})().catch(error => { console.error(error); process.exitCode = 1; });
