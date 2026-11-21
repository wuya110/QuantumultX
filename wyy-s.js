#!name=网易云 SVIP 注入(自有版)
#!desc=抓取网易云 App 登录态 Cookie 并注入 SVIP 共享号，不依赖任何第三方脚本。账号来源 fuzhang.net/vip
/*
网易云音乐 SVIP(自有版) · Quantumult X
原理:
  1) 去 fuzhang.net/vip 挑一个网易云共享号,在网易云 App 里登录一次
  2) App 调 user/level 时,本脚本先把请求里的 Cookie 存为「待确认」
  3) 再看 user/level 的响应:确认是会员号才正式启用,自己的非会员号不会覆盖掉已存的共享号
  4) 之后所有 eapi 解锁请求都换上这份 Cookie,SVIP 身份即生效
  5) 共享号失效(改密码/被挤下线)时,换下一个号重复 1-3 步即可
账号来源: https://fuzhang.net/vip/ (每 3 小时更新,网易云音乐区每次 5 个号)

====================================
[rewrite_local]
^https?:\/\/music\.163\.com\/weapi\/user\/level url script-request-header https://raw.githubusercontent.com/wuya110/QuantumultX/main/wyy-s.js
^https?:\/\/music\.163\.com\/weapi\/user\/level url script-response-body https://raw.githubusercontent.com/wuya110/QuantumultX/main/wyy-s.js
(其余 eapi 解锁规则见 wyy.js,均指向本文件)

[mitm]
hostname = music.163.com
====================================
*/

const COOKIE_KEY = 'wyy_svip_cookie';       // 已确认的共享号 Cookie(正式启用)
const MUSIC_U_KEY = 'wyy_svip_music_u';
const PEND_COOKIE_KEY = 'wyy_svip_pending_cookie';  // 待确认的 Cookie
const PEND_U_KEY = 'wyy_svip_pending_u';
const REJECTED_U_KEY = 'wyy_svip_rejected_u';       // 记下被拒过的非会员号,避免重复提醒
const SOURCE_URL = 'https://fuzhang.net/vip/';

function nowStr() {
  const d = new Date();
  const p = function (n) { return (n < 10 ? '0' : '') + n; };
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}

function shortU(u) { return u ? u.slice(0, 12) + '...' : '无'; }

function notify(title, sub, body) { $notification.post(title, sub, body); }

/* ---------- 请求模式: user/level 请求里抓 Cookie,先存为待确认 ---------- */
function onRequest() {
  const headers = $request.headers || {};
  const cookie = headers['Cookie'] || headers['cookie'] || '';
  if (!cookie) { $done({}); return; }  // 没登录态,安静跳过,等响应那边也不处理
  const m = cookie.match(/MUSIC_U=([^;]+)/);
  if (!m) { $done({}); return; }
  $prefs.setValueForKey(cookie, PEND_COOKIE_KEY);
  $prefs.setValueForKey(m[1], PEND_U_KEY);
  $done({});
}

/* ---------- 响应模式: 看 user/level 的响应,会员号才正式启用 ---------- */
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
      info = {
        nickname: j.profile.nickname || '未知',
        level: (typeof j.level !== 'undefined' ? j.level : '未知'),
        vipType: j.profile.vipType
      };
    }
  } catch (e) { info = null; }

  const activeU = $prefs.valueForKey(MUSIC_U_KEY);

  // 响应读不到会员信息:已有共享号就别动它;还没有就先启用这个,总比没有强
  if (!info) {
    if (!activeU && pendCookie) {
      $prefs.setValueForKey(pendCookie, COOKIE_KEY);
      $prefs.setValueForKey(pendU, MUSIC_U_KEY);
      notify('网易云 SVIP 已就绪', 'MUSIC_U: ' + shortU(pendU), '会员身份未读到(响应异常),已先启用\n打开一首 VIP 歌试听验证\n时间: ' + nowStr());
    }
    $done({});
    return;
  }

  // vipType 0 = 非会员:丢弃,不覆盖已存的共享号;同一个号只提醒一次
  if (info.vipType === 0) {
    if ($prefs.valueForKey(REJECTED_U_KEY) !== pendU) {
      $prefs.setValueForKey(pendU, REJECTED_U_KEY);
      notify('网易云:这个号不是会员', '昵称: ' + info.nickname, '已存的共享号没动,继续用\n换个号: ' + SOURCE_URL);
    }
    $done({});
    return;
  }

  // 非 0 即某种会员:正式启用(同一个号不重复报)
  if (activeU === pendU) { $done({}); return; }
  $prefs.setValueForKey(pendCookie, COOKIE_KEY);
  $prefs.setValueForKey(pendU, MUSIC_U_KEY);
  let vipText = '会员(vipType ' + info.vipType + ')';
  if (info.vipType === 11) vipText = '黑胶 VIP';
  notify('网易云 SVIP 已确认',
    '昵称: ' + info.nickname + ' · 等级 Lv.' + info.level,
    '会员: ' + vipText + '\nMUSIC_U: ' + shortU(pendU) + '\n确认时间: ' + nowStr());
  $done({});
}

/* ---------- 注入模式: eapi 解锁请求换上共享号 Cookie ---------- */
function onInject() {
  const cookie = $prefs.valueForKey(COOKIE_KEY);
  if (!cookie) {
    if ($prefs.valueForKey('wyy_svip_reminded') !== '1') {
      $prefs.setValueForKey('1', 'wyy_svip_reminded');
      notify('网易云 SVIP 未生效', '还没抓到共享号 Cookie', '先去 ' + SOURCE_URL + ' 挑个号\n在网易云 App 里登录一次即可');
    }
    $done({});
    return;
  }
  const headers = $request.headers || {};
  headers['Cookie'] = cookie;
  $done({ headers: headers });
}

(function main() {
  if (typeof $response !== 'undefined' && $response) { onResponse(); return; }
  const url = ($request.url || '');
  if (url.indexOf('/weapi/user/level') !== -1) { onRequest(); return; }
  onInject();
})();
