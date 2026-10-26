/* 手机/电脑共用的端到端加密记忆同步。同步码只保存在本机浏览器，不上传明文。 */
(function () {
  const CODE_KEY = 'aipm.cloud.code.v1';
  const ENDPOINT = '/.netlify/functions/sync-memory';
  const enc = new TextEncoder(), dec = new TextDecoder();
  let account = null, timer = null, inFlight = null, dirty = false;

  function support() {
    // Sites 静态版没有 Netlify Functions；禁用配对连接，避免向不存在的端点发送数据。
    return false;
  }
  function bytesToHex(bytes) { return Array.from(bytes).map(function (x) { return x.toString(16).padStart(2, '0'); }).join(''); }
  function toBase64Url(bytes) {
    let binary = '';
    bytes.forEach(function (x) { binary += String.fromCharCode(x); });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function fromBase64Url(text) {
    const raw = atob(text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - text.length % 4) % 4));
    return Uint8Array.from(raw, function (c) { return c.charCodeAt(0); });
  }
  function cleanCode(text) { return String(text || '').trim().replace(/\s/g, '').replace(/^APM1-/i, ''); }
  async function derive(text) {
    const code = cleanCode(text);
    if (!/^[A-Za-z0-9_-]{22}$/.test(code)) throw new Error('同步码格式不正确，请完整复制 22 位编码');
    const secret = fromBase64Url(code);
    if (secret.length !== 16) throw new Error('同步码长度不正确');
    const material = await crypto.subtle.importKey('raw', secret, 'HKDF', false, ['deriveBits', 'deriveKey']);
    const salt = enc.encode('AI PM Academy encrypted sync v1');
    const room = new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: salt,
      info: enc.encode('room-id') }, material, 256));
    const auth = new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: salt,
      info: enc.encode('write-token') }, material, 256));
    const key = await crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: salt,
      info: enc.encode('aes-gcm-key') }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    return { code: 'APM1-' + code, id: bytesToHex(room), token: bytesToHex(auth), key: key };
  }
  function generateCode() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return 'APM1-' + toBase64Url(bytes);
  }
  async function encrypt(doc, key) {
    const safe = JSON.parse(JSON.stringify(doc));
    delete safe.apiKey; delete safe.llmConfig;
    const plain = enc.encode(JSON.stringify(safe));
    if (plain.length > 3_000_000) throw new Error('学习记录超过云端同步上限，请先导出备份');
    const iv = new Uint8Array(12);
    crypto.getRandomValues(iv);
    const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, plain));
    return { v: 1, iv: toBase64Url(iv), data: toBase64Url(cipher) };
  }
  async function decrypt(payload, key) {
    if (!payload || payload.v !== 1) throw new Error('云端数据版本不受支持');
    try {
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64Url(payload.iv) }, key,
        fromBase64Url(payload.data));
      const doc = JSON.parse(dec.decode(plain));
      if (!doc || typeof doc !== 'object' || !doc.terms || !doc.events) throw new Error('bad-document');
      return doc;
    } catch (error) { throw new Error('云端数据无法解密；请核对同步码，暂未覆盖本机记录'); }
  }
  async function request(method, value) {
    const controller = new AbortController();
    const timeout = setTimeout(function () { controller.abort(); }, 20000);
    try {
      const response = await fetch(ENDPOINT + '?id=' + account.id, {
        method: method, signal: controller.signal, cache: 'no-store', credentials: 'omit',
        headers: method === 'PUT' ? { 'Content-Type': 'application/json', 'X-AIPM-Sync-Auth': account.token } : {},
        body: method === 'PUT' ? JSON.stringify(value) : undefined
      });
      if (response.status === 404 && method === 'GET') return null;
      if (response.status === 409) return { conflict: true };
      if (!response.ok) {
        const info = await response.json().catch(function () { return {}; });
        if (response.status === 404 || response.status === 401) throw new Error('同步码未在本站开通或不匹配');
        throw new Error(info.error === 'sync-not-configured' ? '本站尚未配置云端同步' : '同步服务暂不可用（HTTP ' + response.status + '）');
      }
      return response.json();
    } finally { clearTimeout(timeout); }
  }
  function notify() { if (CloudSync.onChange) CloudSync.onChange(CloudSync); }
  async function perform() {
    if (!account) return false;
    CloudSync.status = 'syncing'; CloudSync.lastError = ''; notify();
    for (let attempt = 0; attempt < 4; attempt++) {
      const remote = await request('GET');
      const local = window.Store.readHot() || window.Mem.state;
      const cloudDoc = remote ? await decrypt(remote.payload, account.key) : null;
      const merged = cloudDoc ? window.Store.mergeDoc(local, cloudDoc) : local;
      const payload = await encrypt(merged, account.key);
      const saved = await request('PUT', { payload: payload, etag: remote ? remote.etag : null });
      if (saved && saved.conflict) continue;
      if (cloudDoc) window.Store.applyRemote(merged);
      CloudSync.status = 'synced'; CloudSync.lastSync = Date.now(); CloudSync.lastError = ''; notify();
      return true;
    }
    throw new Error('另一设备刚更新了记录，请稍后重试');
  }
  function sync() {
    if (!account) return Promise.resolve(false);
    if (inFlight) { dirty = true; return inFlight; }
    inFlight = perform().catch(function (error) {
      CloudSync.status = 'error'; CloudSync.lastError = String(error && error.message || error); notify();
      return false;
    }).finally(function () {
      inFlight = null;
      if (dirty && account) { dirty = false; CloudSync.schedule(true); }
    });
    return inFlight;
  }
  const CloudSync = {
    status: 'local', lastSync: 0, lastError: '', onChange: null,
    support: support,
    connected() { return !!account; },
    code() { return account ? account.code : ''; },
    generateCode: generateCode,
    derive: derive,
    encrypt: encrypt,
    decrypt: decrypt,
    async init() {
      if (!support()) return false;
      const saved = localStorage.getItem(CODE_KEY);
      if (!saved) return false;
      try { account = await derive(saved); }
      catch (error) { CloudSync.status = 'error'; CloudSync.lastError = '本机同步码损坏，请重新输入'; notify(); return false; }
      return sync();
    },
    async connect(code) {
      if (!support()) throw new Error('请在 HTTPS 公网站点使用手机同步');
      account = await derive(code);
      const ok = await sync();
      if (!ok) { const why = CloudSync.lastError; account = null; throw new Error(why || '连接失败'); }
      localStorage.setItem(CODE_KEY, account.code);
      notify(); return true;
    },
    disconnect() {
      clearTimeout(timer); timer = null;
      dirty = false;
      account = null; localStorage.removeItem(CODE_KEY);
      CloudSync.status = 'local'; CloudSync.lastError = ''; notify();
    },
    sync: sync,
    schedule(soon) {
      if (!account) return;
      if (inFlight) { dirty = true; return; }
      clearTimeout(timer);
      const wait = soon ? 2500 : Math.max(2500, 60000 - (Date.now() - CloudSync.lastSync));
      timer = setTimeout(function () { void sync(); }, wait);
    }
  };
  window.CloudSync = CloudSync;
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && account) void sync();
  });
})();
