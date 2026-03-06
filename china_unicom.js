/*
 * 中国联通自动签到 (一键合集)
 * * [rewrite_local]
 * # 抓取 Cookie 规则
 * ^https:\/\/act\.10010\.com\/SigninApp\/signin\/querySignininfo url script-request-header https://raw.githubusercontent.com/wuya110/QuantumultX/refs/heads/main/china_unicom.js
 * * [task_local]
 * # 每天 8:30 自动执行
 * 30 8 * * * https://raw.githubusercontent.com/wuya110/QuantumultX/refs/heads/main/china_unicom.js, tag=联通自动签到, enabled=true
 * * [hostname]
 * hostname = act.10010.com
 */

const $ = new Env("中国联通签到");
const ckKey = "unicom_ck_wuya";

if (typeof $request !== "undefined") {
  // 触发重写：获取 Cookie
  getCookie();
} else {
  // 触发任务：执行签到
  checkin();
}

function getCookie() {
  if ($request.headers && $request.headers["Cookie"]) {
    const ck = $request.headers["Cookie"];
    $.setdata(ck, ckKey);
    $.msg($.name, "✅ 获取 Cookie 成功", "账号数据已保存，可以关闭抓包并等待自动签到");
  }
  $.done();
}

async function checkin() {
  const ck = $.getdata(ckKey);
  if (!ck) {
    $.msg($.name, "❌ 签到失败", "本地没有 Cookie，请手动进入联通App签到页触发");
    $.done();
    return;
  }

  const options = {
    url: "https://act.10010.com/SigninApp/signin/daySign",
    headers: {
      "Cookie": ck,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "ChinaUnicom4.x/12.9 (com.chinaunicom.mobilebusiness; build:40; iOS 26.3.0)"
    },
    body: "imei="
  };

  $.post(options, (err, resp, data) => {
    try {
      const res = JSON.parse(data);
      if (res.code === "0000") {
        $.msg($.name, "🎉 签到成功", `奖励: ${res.data.prizeName || "积分"}`);
      } else {
        $.msg($.name, "⚠️ 结果", res.msg || "接口返回异常");
      }
    } catch (e) {
      $.msg($.name, "❌ 解析失败", "返回数据格式有误");
    }
    $.done();
  });
}

// QX 环境兼容封装
function Env(n) {
  this.name = n;
  this.getdata = (k) => $prefs.valueForKey(k);
  this.setdata = (v, k) => $prefs.setValueForKey(v, k);
  this.msg = (t, s, b) => $notify(t, s, b);
  this.post = (o, c) => $task.fetch(o).then(r => c(null, r, r.body), e => c(e, null, null));
  this.done = (v) => $done(v);
}
