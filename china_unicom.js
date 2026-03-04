/*
 * 中国联通积分签到脚本 (Quantumult X 专用)
 * 脚本说明：支持自动获取 Cookie 并执行每日签到
 * 仓库地址：https://github.com/wuya110/QuantumultX
 * 
 * [rewrite_local]
 * # 捕获 Cookie (打开联通APP，进入“积分商城”或“签到”页面即可)
 * ^https?:\/\/m\.client\.10010\.com\/mobileService\/clickCount\/recordClickCount\.htm url script-request-header china_unicom.js
 * 
 * [task_local]
 * # 每日 8:30 自动签到
 * 30 8 * * * china_unicom.js, tag=中国联通签到, img-url=https://raw.githubusercontent.com/Orz-3/mini/master/Color/10010.png, enabled=true
 * 
 * [mitm]
 * hostname = m.client.10010.com
 */

const $ = new Env("中国联通签到");
const cookieKey = "wuya_10010_cookie";

if (typeof $request !== "undefined") {
    // 捕获 Cookie 逻辑
    const ck = $request.headers["Cookie"] || $request.headers["cookie"];
    if (ck && $request.url.indexOf("recordClickCount.htm") > -1) {
        if ($.setdata(ck, cookieKey)) {
            $.msg($.name, "✅ 获取 Cookie 成功", "现在可以关闭重写并等待定时任务运行");
        }
    }
} else {
    // 执行签到逻辑
    dailySign();
}

function dailySign() {
    const cookie = $.getdata(cookieKey);
    if (!cookie) {
        $.msg($.name, "❌ 签到失败", "请先打开联通APP获取 Cookie");
        $.done();
        return;
    }

    const signUrl = {
        url: "https://m.client.10010.com/user_signin/signin/daySign",
        headers: {
            "Cookie": cookie,
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 unicom{version:iphone@11.0}",
            "Referer": "https://img.client.10010.com/mactivity/index.html"
        }
    };

    $.post(signUrl, (error, response, data) => {
        try {
            const res = JSON.parse(data);
            if (res.code === "0") {
                $.msg($.name, "✅ 签到成功", `获得积分: ${res.data.integral || "未知"}`);
            } else if (res.code === "1") {
                $.msg($.name, "ℹ️ 重复签到", res.msg || "今天已经签到过了");
            } else {
                $.msg($.name, "❌ 签到异常", res.msg || "接口返回错误");
            }
        } catch (e) {
            $.msg($.name, "❌ 脚本错误", "解析返回数据失败");
        }
        $.done();
    });
}

// --- Env.js 迷你兼容库 ---
function Env(n) {
    this.name = n;
    this.msg = (t, s, b) => $notify(t, s, b);
    this.getdata = (k) => $prefs.valueForKey(k);
    this.setdata = (v, k) => $prefs.setValueForKey(v, k);
    this.post = (u, cb) => $task.fetch(u).then(r => cb(null, r, r.body), e => cb(e));
    this.done = (o = {}) => $done(o);
}
