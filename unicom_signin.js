/*
联通营业厅每日自动签到 (Quantumult X)
抓包: 2026-10-18 联通APP签到页
签到接口: POST https://activity.10010.com/sixPalaceGridTurntableLottery/signin/daySign
  body: shareCl=&shareCode=  (Cookie 鉴权,核心字段 ecs_token)
用法: 先加 rewrite,打开联通APP「我的」→签到页抓 Cookie(+imei),之后每天 8 点自动签
不做: 签到翻倍(需手动看广告视频)

====================================
[rewrite_local]
^https://activity\.10010\.com/sixPalaceGridTurntableLottery/signin/ url script-request-header https://raw.githubusercontent.com/wuya110/QuantumultX/main/unicom_signin.js

[task_local]
0 8 * * * https://raw.githubusercontent.com/wuya110/QuantumultX/main/unicom_signin.js, tag=联通签到, enabled=true

[mitm]
hostname = activity.10010.com
====================================
*/

const COOKIE_KEY = 'unicom_signin_cookie';
const IMEI_KEY = 'unicom_signin_imei';
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)  unicom{version:iphone_c@13.0000};ltst;OSVersion/27.0.1';
const ORIGIN = 'https://img.client.10010.com';
const REFERER = 'https://img.client.10010.com/SigininApp/index.html?channel=shouye';

const REQ_TIMEOUT = 15000;  // 单请求 15s 超时
const WATCHDOG = 180000;    // 整体 180s 看门狗
const MAX_FAIL = 3;         // 连续 3 次请求失败直接熔断

let cookie = '';
let failCount = 0;

function baseHeaders(extra) {
  return Object.assign({
    'Host': 'activity.10010.com',
    'Accept': 'application/json, text/plain, */*',
    'Origin': ORIGIN,
    'Referer': REFERER,
    'User-Agent': UA,
    'Accept-Language': 'zh-CN,zh-Hans;q=0.9',
    'Cookie': cookie,
    'Connection': 'keep-alive'
  }, extra || {});
}

// 单请求超时(QX 自带 timeout + Promise.race 双保险) + 失败计数
function req(opts) {
  return Promise.race([
    new Promise((resolve, reject) => {
      $task.fetch(Object.assign({ timeout: Math.ceil(REQ_TIMEOUT / 1000) }, opts)).then(
        resp => {
          if (resp.statusCode >= 200 && resp.statusCode < 300) { failCount = 0; resolve(resp); }
          else reject(new Error('HTTP ' + resp.statusCode));
        },
        err => reject(err)
      );
    }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('请求超时(15s)')), REQ_TIMEOUT))
  ]).catch(err => { failCount++; throw err; });
}

function checkCircuit() {
  if (failCount >= MAX_FAIL) throw new Error('连续失败' + MAX_FAIL + '次,熔断停止');
}

function parseJson(body) {
  try { return JSON.parse(body); }
  catch (e) { throw new Error('返回不是JSON: ' + String(body).slice(0, 80)); }
}

// 签到动作(幂等:已签过返回 already=true,不算失败)
async function daySign() {
  checkCircuit();
  const resp = await req({
    url: 'https://activity.10010.com/sixPalaceGridTurntableLottery/signin/daySign',
    method: 'POST',
    headers: baseHeaders({ 'Content-Type': 'application/x-www-form-urlencoded' }),
    body: 'shareCl=&shareCode='
  });
  const j = parseJson(resp.body);
  const d = j.data || {};
  const desc = d.statusDesc || j.desc || '';
  if (j.code === '0000') {
    return { already: false, desc: desc, prize: d.redSignMessage || '', doubled: !!d.doubleShowFlag };
  }
  if (/已经签到/.test(desc)) return { already: true, desc: desc };
  throw new Error('签到接口异常: ' + (desc || j.code));
}

async function getIntegral() {
  checkCircuit();
  const resp = await req({
    url: 'https://activity.10010.com/sixPalaceGridTurntableLottery/signin/getIntegral',
    method: 'GET',
    headers: baseHeaders()
  });
  const j = parseJson(resp.body);
  return (j.data && j.data.integralTotal) || null;
}

// 连续签到/每日奖品(需 imei,抓包时从重写 URL 里存;无 imei 时尝试空参,服务端可能按会话识别)
async function getContinuous() {
  const imei = $prefs.valueForKey(IMEI_KEY);
  const tries = imei ? [imei, ''] : [''];
  for (const im of tries) {
    checkCircuit();
    try {
      const resp = await req({
        url: 'https://activity.10010.com/sixPalaceGridTurntableLottery/signin/getContinuous?taskId=&channel=shouye&imei=' + encodeURIComponent(im),
        method: 'GET',
        headers: baseHeaders()
      });
      const j = parseJson(resp.body);
      if (j.code === '0000' && j.data) return j.data;
    } catch (e) { /* 试下一个 */ }
  }
  return null;
}

function dayPrize(cont, day) {
  try {
    const list = cont.current || [];
    const it = list.find(x => String(x.day) === String(day));
    return it && it.prizeName ? it.prizeName : null;
  } catch (e) { return null; }
}

// ============ 入口: rewrite 触发抓 Cookie(+imei), task 触发签到 ============
if (typeof $request !== 'undefined') {
  const ck = $request.headers['Cookie'] || $request.headers['cookie'];
  if (ck && ck.indexOf('ecs_token') !== -1) {
    if ($prefs.valueForKey(COOKIE_KEY) !== ck) {
      $prefs.setValueForKey(ck, COOKIE_KEY);
      $notify('联通签到', 'Cookie 获取成功', '自动签到已就绪,可关闭抓包');
    }
  }
  const m = ($request.url || '').match(/[?&]imei=([^&]+)/);
  if (m && m[1]) $prefs.setValueForKey(decodeURIComponent(m[1]), IMEI_KEY);
  $done({});
} else {
  let watchdog = null;
  !(async () => {
    watchdog = setTimeout(() => {
      $notify('联通签到', '整体超时', '180s 未完成,已强制结束');
      $done();
    }, WATCHDOG);

    cookie = $prefs.valueForKey(COOKIE_KEY);
    if (!cookie) {
      $notify('联通签到', '缺少 Cookie', '先开重写,打开联通APP签到页抓一次');
      return;
    }

    try {
      const s = await daySign();
      const total = await getIntegral().catch(() => null);
      const cont = await getContinuous().catch(() => null);

      const today = new Date().getDate();
      const tp = s.prize || (dayPrize(cont, today) ? dayPrize(cont, today) + '元' : null);
      const np = dayPrize(cont, today + 1);
      const contDays = cont && cont.continueCountCur;
      const noContHint = !cont && !$prefs.valueForKey(IMEI_KEY);

      const sub = s.already ? '☑️ 今日已签到' : ('✅ ' + (s.desc || '签到成功') + (s.prize ? ' ' + s.prize : ''));
      const lines = [
        '今日奖励: ' + (tp || '--'),
        '连续签到: ' + (contDays ? contDays + ' 天' : '--'),
        '当前积分: ' + (total === null ? '--' : total),
        '明日奖励: ' + (np ? np + '元' : '--')
      ];
      if (noContHint) lines.push('重进APP签到页一次,补全连续签到数据');
      if (s.doubled) lines.push('有翻倍奖励,可手动去APP看广告翻倍');
      $notify('联通签到', sub, lines.join('\n'));
    } catch (e) {
      const msg = String((e && e.message) || e);
      if (/HTTP 4|登录|过期|未登录|失效/i.test(msg)) {
        $notify('联通签到', '❌ Cookie 可能已失效', '重新打开联通APP签到页抓一次即可');
      } else {
        $notify('联通签到', '❌ 签到失败', msg);
      }
    }
  })().catch(e => {
    $notify('联通签到', '❌ 执行异常', String((e && e.message) || e));
  }).finally(() => {
    if (watchdog) clearTimeout(watchdog);
    $done();
  });
}
