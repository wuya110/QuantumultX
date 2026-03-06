/**
 * @name 中国联通自动签到 (一键合并版)
 * @author Gemini
 * @description 包含自动抓取 Cookie 和 定时签到功能。配置完成后，手动进入联通App签到页面即可触发。
 * * [rewrite_local]
 * # 抓取 Cookie 脚本
 * ^https:\/\/act\.10010\.com\/SigninApp\/signin\/querySignininfo url script-request-header https://raw.githubusercontent.com/wuya110/QuantumultX/refs/heads/main/china_unicom.js
 * * [task_local]
 * # 每日 8:30 自动签到
 * 30 8 * * * https://raw.githubusercontent.com/wuya110/QuantumultX/refs/heads/main/china_unicom.js, tag=联通自动签到, enabled=true
 * * [hostname]
 * hostname = act.10010.com
 */

const $ = new Env("中国联通签到");
const checkinURL = "https://act.10010.com/SigninApp/signin/daySign";
const queryURL = "https://act.10010.com/SigninApp/signin/querySignininfo";
const cookieKey = "unicom_cookie_wuya";

// 逻辑分发：有 $request 说明是重写抓包模式，否则是定时任务模式
if (typeof $request !== "undefined") {
  getCookie();
} else {
  checkin();
}

// --- 核心功能：获取 Cookie ---
function getCookie() {
  if ($request.url.indexOf("querySignininfo") > -1 && $request.headers["Cookie"]) {
    const cookie = $request.headers["Cookie"];
    $.setdata(cookie, cookieKey);
    $.msg($.name, "🪪 获取 Cookie 成功", "账号数据已存入本地，可以开始自动签到");
  }
  $.done();
}

// --- 核心功能：执行签到 ---
async function checkin() {
  const cookieVal = $.getdata(cookieKey);
  if (!cookieVal) {
    $.msg($.name, "❌ 签到失败", "本地未发现 Cookie，请先打开联通App触发抓包");
    $.done();
    return;
  }

  const signHeaders = {
    "User-Agent": "ChinaUnicom4.x/12.9 (com.chinaunicom.mobilebusiness; build:40; iOS 26.3.0) unicom{version:iphone_c@12.0900}",
    "Cookie": cookieVal,
    "Content-Type": "application/x-www-form-urlencoded",
    "Origin": "https://img.client.10010.com",
    "Referer": "https://img.client.10010.com/SigininApp/index.html"
  };

  // 1. 先查询当前状态，防止重复签到
  $.post({ url: queryURL, headers: signHeaders, body: "imei=" }, (error, response, data) => {
    try {
      const info = JSON.parse(data);
      if (info.code === "0000" && info.data.currentDaySigned === "y") {
        $.msg($.name, "✅ 今日已完成", `已连续签到 ${info.data.continueCountCur} 天`);
        $.done();
      } else {
        // 2. 未签到则执行签到请求
        $.post({ url: checkinURL, headers: signHeaders, body: "imei=" }, (err, resp, body) => {
          try {
            const res = JSON.parse(body);
            if (res.code === "0000") {
              $.msg($.name, "🎉 签到成功", `获得奖励: ${res.data.prizeName || "积分"}`);
            } else {
              $.msg($.name, "⚠️ 签到异常", res.msg || "接口返回错误");
            }
          } catch (e) {
            $.msg($.name, "❌ 解析失败", "签到结果返回格式异常");
          }
          $.done();
        });
      }
    } catch (e) {
      $.msg($.name, "❌ 执行出错", "请检查网络或确认 Cookie 是否失效");
      $.done();
    }
  });
}

// --- 环境兼容类 (兼容 QX) ---
function Env(name) {
  this.name = name;
  this.getdata = (k) => $prefs.valueForKey(k);
  this.setdata = (v, k) => $prefs.setValueForKey(v, k);
  this.msg = (t, s, b) => $notify(t, s, b);
  this.post = (o, c) => $task.fetch(o).then(r => c(null, r, r.body), e => c(e, null, null));
  this.done = (v) => $done(v);
}
