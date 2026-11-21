#!name=网易云 SVIP 全自动版
#!desc=定时拉取 fuzhang.net/vip 共享号自动登录 + 抓取 + 注入，不依赖任何第三方脚本
/*
网易云音乐 SVIP(全自动版) · Quantumult X
原理:
  定时任务每 3 小时拉一次 https://fuzhang.net/vip/ (网易云区每次 5 个共享号),
  用 WEAPI 登录逐个尝试,登上的那个号的 MUSIC_U 存起来,
  之后所有 eapi 解锁请求都换上这份 Cookie,SVIP 身份即生效。
  号池换新一批才重试,同一批号不反复试;登不上就留着旧 Cookie,等下一批。
  抓取模式仍在:在 App 里手动登录共享号时,user/level 请求+响应双重确认后也会启用。
账号来源: https://fuzhang.net/vip/ (每 3 小时更新)

====================================
[rewrite_local]
^https?:\/\/music\.163\.com\/weapi\/user\/level url script-request-header https://raw.githubusercontent.com/wuya110/QuantumultX/main/wyy-s.js
^https?:\/\/music\.163\.com\/weapi\/user\/level url script-response-body https://raw.githubusercontent.com/wuya110/QuantumultX/main/wyy-s.js
(其余 eapi 解锁规则见 wyy.js,均指向本文件)

[task_local]
0 *\/3 * * * https://raw.githubusercontent.com/wuya110/QuantumultX/main/wyy-s.js, tag=网易云自动登录, enabled=true

[mitm]
hostname = music.163.com
====================================
*/

const CONFIG = {
  sourceUrl: 'https://fuzhang.net/vip/',
  loginUrl: 'https://music.163.com/weapi/login/cellphone',
  cookieMaxAgeMs: 6 * 3600 * 1000,   // Cookie 6 小时内算新鲜,跳过登录
  taskWatchdogMs: 25000,             // 单次任务最多 25 秒
  reqTimeoutSec: 15                  // 单请求 15 秒超时
};

const COOKIE_KEY = 'wyy_svip_cookie';       // 已确认的共享号 Cookie(正式启用)
const MUSIC_U_KEY = 'wyy_svip_music_u';
const COOKIE_AT_KEY = 'wyy_svip_cookie_at';
const PEND_COOKIE_KEY = 'wyy_svip_pending_cookie';
const PEND_U_KEY = 'wyy_svip_pending_u';
const REJECTED_U_KEY = 'wyy_svip_rejected_u';
const BATCH_KEY = 'wyy_svip_batch';
const SOURCE_URL = 'https://fuzhang.net/vip/';

const WEAPI_NONCE = '0CoJUm6Qyw8W8jud';
const WEAPI_MODULUS = '00e0b509f6259df8642dbc35662901477df22677ec152b5ff68ace615bb7b725152b3ab17a876aea8a5aa76d2e417629ec4ee341f56135fccf695280104e0312ecbda92557c93870114af6c9d05c4f7f0c3685b7a46bee255932575cce10b424d813cfe4875d3e82047b97ddef52741d546b8e289dc6935b3ece0462db0a22b8e7';
const LOGIN_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

function nowStr() {
  const d = new Date();
  const p = function (n) { return (n < 10 ? '0' : '') + n; };
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}

function shortU(u) { return u ? u.slice(0, 12) + '...' : '无'; }

function notify(title, sub, body) { $notification.post(title, sub, body); }

function utf8Bytes(str) {
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    let c = str.charCodeAt(i);
    if (c < 128) bytes.push(c);
    else if (c < 2048) { bytes.push(0xc0 | (c >> 6), 0x80 | (c & 63)); }
    else if (c < 55296 || c >= 57344) { bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63)); }
    else {
      i++;
      const c2 = str.charCodeAt(i);
      c = 0x10000 + (((c & 0x3ff) << 10) | (c2 & 0x3ff));
      bytes.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
  }
  return bytes;
}

const B64CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function b64encode(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i], b1 = (i + 1 < bytes.length) ? bytes[i + 1] : 0, b2 = (i + 2 < bytes.length) ? bytes[i + 2] : 0;
    s += B64CHARS[b0 >> 2] + B64CHARS[((b0 & 3) << 4) | (b1 >> 4)];
    s += (i + 1 < bytes.length) ? B64CHARS[((b1 & 15) << 2) | (b2 >> 6)] : '=';
    s += (i + 2 < bytes.length) ? B64CHARS[b2 & 63] : '=';
  }
  return s;
}

/* ---------- MD5(标准实现,输出小写 hex) ---------- */
function md5(str) {
  const bytes = utf8Bytes(str);
  const bitLen = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  for (let i = 0; i < 4; i++) bytes.push((bitLen >>> (i * 8)) & 0xff);
  for (let i = 0; i < 4; i++) bytes.push(0);
  const K = [0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee, 0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501, 0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be, 0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821, 0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa, 0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8, 0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed, 0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a, 0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c, 0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70, 0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05, 0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665, 0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039, 0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1, 0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1, 0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391];
  const S = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
  function add(x, y) { return (x + y) | 0; }
  function rol(x, c) { return ((x << c) | (x >>> (32 - c))) | 0; }
  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  for (let off = 0; off < bytes.length; off += 64) {
    const M = [];
    for (let i = 0; i < 16; i++) M[i] = bytes[off + i * 4] | (bytes[off + i * 4 + 1] << 8) | (bytes[off + i * 4 + 2] << 16) | (bytes[off + i * 4 + 3] << 24);
    let a = a0, b = b0, c = c0, d = d0;
    for (let i = 0; i < 64; i++) {
      let f, g;
      if (i < 16) { f = (b & c) | (~b & d); g = i; }
      else if (i < 32) { f = (d & b) | (~d & c); g = (5 * i + 1) % 16; }
      else if (i < 48) { f = b ^ c ^ d; g = (3 * i + 5) % 16; }
      else { f = c ^ (b | ~d); g = (7 * i) % 16; }
      const tmp = d;
      d = c; c = b;
      b = add(b, rol(add(add(a, f), add(K[i], M[g])), S[i]));
      a = tmp;
    }
    a0 = add(a0, a); b0 = add(b0, b); c0 = add(c0, c); d0 = add(d0, d);
  }
  function hex(n) {
    let s = '';
    for (let i = 0; i < 4; i++) s += ('0' + ((n >>> (i * 8)) & 0xff).toString(16)).slice(-2);
    return s;
  }
  return hex(a0) + hex(b0) + hex(c0) + hex(d0);
}

/* ---------- AES-128 加密(S-box 算法生成,无查表硬编码) ---------- */
const AES_SBOX = (function () {
  function xtime(a) { return ((a << 1) ^ ((a & 0x80) ? 0x1b : 0)) & 0xff; }
  function mul(a, b) { let r = 0; while (b) { if (b & 1) r ^= a; a = xtime(a); b >>= 1; } return r; }
  function inv(a) { if (!a) return 0; let r = 1; for (let i = 0; i < 254; i++) r = mul(r, a); return r; }
  const s = new Array(256);
  for (let i = 0; i < 256; i++) {
    let x = inv(i), y = x;
    for (let k = 0; k < 4; k++) { x = ((x << 1) | (x >> 7)) & 0xff; y ^= x; }
    s[i] = (y ^ 0x63) & 0xff;
  }
  return s;
})();

function aesExpandKey(keyBytes) {
  const w = [];
  for (let i = 0; i < 4; i++) w[i] = (keyBytes[i * 4] << 24) | (keyBytes[i * 4 + 1] << 16) | (keyBytes[i * 4 + 2] << 8) | keyBytes[i * 4 + 3];
  const Rcon = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36];
  for (let i = 4; i < 44; i++) {
    let t = w[i - 1];
    if (i % 4 === 0) {
      t = ((AES_SBOX[(t >> 16) & 0xff] << 24) | (AES_SBOX[(t >> 8) & 0xff] << 16) | (AES_SBOX[t & 0xff] << 8) | AES_SBOX[(t >> 24) & 0xff]) ^ (Rcon[i / 4 - 1] << 24);
    }
    w[i] = (w[i - 4] ^ t) | 0;
  }
  return w;
}

function aesEncryptBlock(input, w) {
  const s = input.slice();
  function xtime(a) { return ((a << 1) ^ ((a & 0x80) ? 0x1b : 0)) & 0xff; }
  function addKey(round) {
    for (let i = 0; i < 16; i++) {
      const word = w[round * 4 + (i >> 2)];
      s[i] ^= (word >> (24 - (i % 4) * 8)) & 0xff;
    }
  }
  function subBytes() { for (let i = 0; i < 16; i++) s[i] = AES_SBOX[s[i]]; }
  function shiftRows() {
    const t = s.slice();
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) s[4 * c + r] = t[4 * ((c + r) % 4) + r];
  }
  function mixColumns() {
    for (let c = 0; c < 4; c++) {
      const i = c * 4;
      const a0 = s[i], a1 = s[i + 1], a2 = s[i + 2], a3 = s[i + 3];
      s[i] = xtime(a0) ^ (xtime(a1) ^ a1) ^ a2 ^ a3;
      s[i + 1] = a0 ^ xtime(a1) ^ (xtime(a2) ^ a2) ^ a3;
      s[i + 2] = a0 ^ a1 ^ xtime(a2) ^ (xtime(a3) ^ a3);
      s[i + 3] = (xtime(a0) ^ a0) ^ a1 ^ a2 ^ xtime(a3);
    }
  }
  addKey(0);
  for (let round = 1; round < 10; round++) { subBytes(); shiftRows(); mixColumns(); addKey(round); }
  subBytes(); shiftRows(); addKey(10);
  return s;
}

function aesCbcEncrypt(plainBytes, keyBytes) {
  const iv = [0x30, 0x31, 0x30, 0x32, 0x30, 0x33, 0x30, 0x34, 0x30, 0x35, 0x30, 0x36, 0x30, 0x37, 0x30, 0x38];
  const w = aesExpandKey(keyBytes);
  const padded = plainBytes.slice();
  const pad = 16 - (padded.length % 16);
  for (let i = 0; i < pad; i++) padded.push(pad);
  let prev = iv.slice();
  const out = [];
  for (let off = 0; off < padded.length; off += 16) {
    const block = [];
    for (let i = 0; i < 16; i++) block.push(padded[off + i] ^ prev[i]);
    const enc = aesEncryptBlock(block, w);
    for (let i = 0; i < 16; i++) out.push(enc[i]);
    prev = enc;
  }
  return out;
}

/* ---------- WEAPI 加密(两次 AES-CBC + RSA,已用真机登录验证过) ---------- */
function modPow(base, exp, mod) {
  let r = 1n;
  let b = base % mod;
  let e = exp;
  while (e > 0n) { if (e & 1n) r = (r * b) % mod; b = (b * b) % mod; e >>= 1n; }
  return r;
}

function rsaEnc(secKey) {
  const rev = secKey.split('').reverse().join('');
  let hex = '';
  for (let i = 0; i < rev.length; i++) hex += ('0' + rev.charCodeAt(i).toString(16)).slice(-2);
  const c = modPow(BigInt('0x' + hex), 0x10001n, BigInt('0x' + WEAPI_MODULUS));
  return c.toString(16).padStart(256, '0');
}

function weapiEncrypt(obj, secKey) {
  const text = JSON.stringify(obj);
  const p1 = b64encode(aesCbcEncrypt(utf8Bytes(text), utf8Bytes(WEAPI_NONCE)));
  const p2 = b64encode(aesCbcEncrypt(utf8Bytes(p1), utf8Bytes(secKey)));
  return { params: p2, encSecKey: rsaEnc(secKey) };
}

function randStr(n) {
  const cs = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let s = '';
  for (let i = 0; i < n; i++) s += cs[Math.floor(Math.random() * cs.length)];
  return s;
}

/* ---------- QX 网络请求(带超时) ---------- */
function taskFetch(opts) {
  const timeoutMs = (opts.timeout || CONFIG.reqTimeoutSec) * 1000;
  delete opts.timeout;
  return Promise.race([
    new Promise(function (resolve, reject) {
      $task.fetch(opts).then(function (resp) { resolve(resp); }, function (err) { reject(err); });
    }),
    new Promise(function (_, reject) { setTimeout(function () { reject(new Error('请求超时')); }, timeoutMs); })
  ]);
}

function getHeader(headers, name) {
  if (!headers) return '';
  const want = name.toLowerCase();
  for (const k in headers) {
    if (k.toLowerCase() === want) {
      const v = headers[k];
      return Array.isArray(v) ? v.join('; ') : String(v);
    }
  }
  return '';
}

function cookieVal(joined, name) {
  const m = joined.match(new RegExp(name + '=([^;]+)'));
  return m ? m[1] : '';
}

function buildCookie(setCookieJoined) {
  const mu = cookieVal(setCookieJoined, 'MUSIC_U');
  const csrf = cookieVal(setCookieJoined, '__csrf');
  const parts = [];
  if (mu) parts.push('MUSIC_U=' + mu);
  if (csrf) parts.push('__csrf=' + csrf);
  parts.push('os=iPhone OS', 'osver=26.0', 'deviceId=00000000000000000000000000000000', 'appver=9.4.0', 'buildver=6352', 'channel=distribution', 'machineid=iPhone17.2');
  return parts.join('; ');
}

function vipText(vipType) {
  if (vipType === 11) return '黑胶 VIP';
  if (vipType === 0) return '非会员';
  if (typeof vipType === 'undefined' || vipType === '') return '未知';
  return '会员(vipType ' + vipType + ')';
}

function saveCookie(cookie, musicU) {
  $prefs.setValueForKey(cookie, COOKIE_KEY);
  $prefs.setValueForKey(musicU, MUSIC_U_KEY);
  $prefs.setValueForKey(String(Date.now()), COOKIE_AT_KEY);
}

/* ---------- 号池解析 ---------- */
function parseAccounts(html) {
  let seg = '';
  const cardAt = html.indexOf('data-plat="网易云音乐"');
  if (cardAt !== -1) {
    const nextAt = html.indexOf('data-plat="', cardAt + 10);
    seg = nextAt !== -1 ? html.slice(cardAt, nextAt) : html.slice(cardAt);
  }
  const pairs = [];
  const re = /data-u="(1\d{10})" data-p="([A-Za-z0-9]+)"/g;
  let x;
  while ((x = re.exec(seg)) !== null) pairs.push([x[1], x[2]]);
  if (pairs.length) return pairs;
  const m = html.match(/网易云音乐" data-txt="([^"]+)"/);
  if (m) {
    const re2 = /(1\d{10}) ([A-Za-z0-9]+)/g;
    while ((x = re2.exec(m[1])) !== null) pairs.push([x[1], x[2]]);
  }
  return pairs;
}

/* ---------- WEAPI 登录 ---------- */
async function weapiLogin(phone, pwd) {
  const secKey = randStr(16);
  const obj = { phone: phone, password: md5(pwd), rememberLogin: 'true' };
  const enc = weapiEncrypt(obj, secKey);
  const resp = await taskFetch({
    url: CONFIG.loginUrl,
    method: 'POST',
    headers: {
      'User-Agent': LOGIN_UA,
      'Referer': 'https://music.163.com/',
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'params=' + encodeURIComponent(enc.params) + '&encSecKey=' + enc.encSecKey,
    timeout: CONFIG.reqTimeoutSec
  });
  let j;
  try { j = JSON.parse(resp.body || ''); } catch (e) { return { ok: false, err: '响应异常' }; }
  if (j.code === 200) {
    const joined = getHeader(resp.headers, 'set-cookie');
    const musicU = cookieVal(joined, 'MUSIC_U');
    if (!musicU) return { ok: false, err: '登录成功但没下发 MUSIC_U' };
    return { ok: true, musicU: musicU, cookie: buildCookie(joined), profile: j.profile || {} };
  }
  return { ok: false, err: 'code ' + j.code + (j.msg ? ' ' + j.msg : '') };
}

/* ---------- 抓取模式: user/level 请求里抓 Cookie,先存为待确认 ---------- */
function onRequest() {
  const headers = $request.headers || {};
  const cookie = headers['Cookie'] || headers['cookie'] || '';
  if (!cookie) { $done({}); return; }
  const m = cookie.match(/MUSIC_U=([^;]+)/);
  if (!m) { $done({}); return; }
  $prefs.setValueForKey(cookie, PEND_COOKIE_KEY);
  $prefs.setValueForKey(m[1], PEND_U_KEY);
  $done({});
}

/* ---------- 确认模式: user/level 的响应,会员号才正式启用 ---------- */
function onResponse() {
  const pendU = $prefs.valueForKey(PEND_U_KEY);
  if (!pendU) { $done({}); return; }
  const pendCookie = $prefs.valueForKey(PEND_COOKIE_KEY) || '';
  $prefs.setValueForKey('', PEND_COOKIE_KEY);
  $prefs.setValueForKey('', PEND_U_KEY);
  let info = null;
  try {
    const j = JSON.parse($response.body || '');
    if (j && j.profile) {
      info = { nickname: j.profile.nickname || '未知', level: (typeof j.level !== 'undefined' ? j.level : '未知'), vipType: j.profile.vipType };
    }
  } catch (e) { info = null; }
  const activeU = $prefs.valueForKey(MUSIC_U_KEY);
  if (!info) {
    if (!activeU && pendCookie) {
      saveCookie(pendCookie, pendU);
      notify('网易云 SVIP 已就绪', 'MUSIC_U: ' + shortU(pendU), '会员身份未读到(响应异常),已先启用\n打开一首 VIP 歌试听验证\n时间: ' + nowStr());
    }
    $done({});
    return;
  }
  if (info.vipType === 0) {
    if ($prefs.valueForKey(REJECTED_U_KEY) !== pendU) {
      $prefs.setValueForKey(pendU, REJECTED_U_KEY);
      notify('网易云:这个号不是会员', '昵称: ' + info.nickname, '已存的共享号没动,继续用\n换个号: ' + SOURCE_URL);
    }
    $done({});
    return;
  }
  if (activeU === pendU) { $done({}); return; }
  saveCookie(pendCookie, pendU);
  notify('网易云 SVIP 已确认',
    '昵称: ' + info.nickname + ' · 等级 Lv.' + info.level,
    '会员: ' + vipText(info.vipType) + '\nMUSIC_U: ' + shortU(pendU) + '\n确认时间: ' + nowStr());
  $done({});
}

/* ---------- 注入模式: eapi 解锁请求换上共享号 Cookie ---------- */
function onInject() {
  const cookie = $prefs.valueForKey(COOKIE_KEY);
  if (!cookie) {
    if ($prefs.valueForKey('wyy_svip_reminded') !== '1') {
      $prefs.setValueForKey('1', 'wyy_svip_reminded');
      notify('网易云 SVIP 未生效', '还没抓到共享号 Cookie', '定时任务每 3 小时自动登录一次\n等下一批号,或去 ' + SOURCE_URL + ' 手动登录一次');
    }
    $done({});
    return;
  }
  const headers = $request.headers || {};
  headers['Cookie'] = cookie;
  $done({ headers: headers });
}

/* ---------- 定时任务模式:拉号池,自动登录 ---------- */
async function onTask() {
  const startAt = Date.now();
  try {
    const storedAt = parseInt($prefs.valueForKey(COOKIE_AT_KEY) || '0', 10);
    if (storedAt && Date.now() - storedAt < CONFIG.cookieMaxAgeMs) { $done(); return; }
    const page = await taskFetch({ url: CONFIG.sourceUrl, method: 'GET', headers: { 'User-Agent': LOGIN_UA }, timeout: CONFIG.reqTimeoutSec });
    const accounts = parseAccounts(page.body || '');
    if (!accounts.length) {
      notify('网易云自动登录', '没抓到账号', 'fuzhang 页面结构可能变了\n' + SOURCE_URL);
      $done();
      return;
    }
    const batchHash = md5(accounts.map(function (a) { return a.join(':'); }).join('|'));
    if (batchHash === $prefs.valueForKey(BATCH_KEY)) { $done(); return; }
    $prefs.setValueForKey(batchHash, BATCH_KEY);
    const fails = [];
    for (let i = 0; i < accounts.length; i++) {
      if (Date.now() - startAt > CONFIG.taskWatchdogMs) { fails.push('超时未试完'); break; }
      const phone = accounts[i][0], pwd = accounts[i][1];
      try {
        const r = await weapiLogin(phone, pwd);
        if (r.ok) {
          saveCookie(r.cookie, r.musicU);
          notify('网易云 SVIP 已自动登录',
            '账号尾号 ' + phone.slice(-4) + ' · ' + (r.profile.nickname || '未知'),
            '会员: ' + vipText(r.profile.vipType) + '\nMUSIC_U: ' + shortU(r.musicU) + '\n时间: ' + nowStr());
          $done();
          return;
        }
        fails.push(phone.slice(-4) + ': ' + r.err);
      } catch (e) {
        fails.push(phone.slice(-4) + ': ' + String((e && e.message) || e).slice(0, 40));
      }
    }
    notify('网易云自动登录', '这批 ' + accounts.length + ' 个号都登不上', fails.join('\n') + '\n下一批号更新后再试');
    $done();
  } catch (e) {
    notify('网易云自动登录出错', String((e && e.message) || e).slice(0, 100), '下一轮再试');
    $done();
  }
}

(function main() {
  if (typeof $response !== 'undefined' && $response) { onResponse(); return; }
  if (typeof $request !== 'undefined' && $request && $request.url) {
    if ($request.url.indexOf('/weapi/user/level') !== -1) { onRequest(); return; }
    onInject();
    return;
  }
  onTask();
})();
