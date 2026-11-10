// 多邻国 Duolingo Max 解锁 增强版 (Quantumult X)
// 来源: Loon 插件 TAKAGIVEGETA/MyScripts/lingoDuo「Duolingo Max 解锁 增强版」扒皮转 QX
//   - 插件: https://github.com/TAKAGIVEGETA/MyScripts/tree/main/lingoDuo
//   - 主脚本 lingoDuo-xaM-enhanced.js / 限时挑战 lingoDuo-time-modifier.js / 直接通关 lingoDuo-clear.js
// 改法(只改指定接口的返回,不动任何写请求):
//   1. 用户资料接口 (2023-05-23/batch 或 users/<id>): 并入 gold_subscription 会员项
//      (产品 com.duolingo.DuolingoMobile.subscription.Gold.TwelveMonth.24Q2Max.168,
//       APPLE 续费/一年有效期),subscriberLevel 置 GOLD,五项会员标识全置 true
//      → Max 会员标识 + 无限红心;带 etag 的缓存响应原样放行
//      另: 经验加倍 (xp_boost_stackable,倍数见 CONFIG)、解锁全部关卡 (locked 改 active)
//   2. 限时挑战接口 (live-ops-challenges): 挑战时长改成自定义分钟数
//   3. 关卡接口 (sessions/stories): 清空题目池,进入关卡直接通关(部分关卡类型除外)
// 开关(解锁全部关卡、直接通关已关;其它开着。想关哪个,把对应的 true 改回 false):
//   xp_boost 经验加倍 | multiplier 经验倍数
//   timer_switch 限时挑战时间增强 | timer_mins 自定义挑战时长(分钟)
//   unlock_all 解锁所有关卡 | instant_clear 直接通关
// 不做: 视频通话解锁——多邻国 2026-11-05 起把视频通话从 Max 下放到 Super、Max 本月停售,
//   插件里也没有视频通话的改法;本脚本只保证资料接口层面的会员标识。
// 用法: 装好 snippet 后杀掉多邻国 App 重进,看 Max 标识/红心、经验倍数、关卡锁是否生效。
//   若毫无变化,说明 iOS App 走的不是这条接口,脚本对 App 无效。
// 不通知: 用户资料接口每次拉取都会触发,通知会刷屏,故全程静默;解析失败原样放行。
//
// ====================================
// [rewrite_local]
// ^https?:\/\/(ios-api-[a-z0-9-]+|api\d+)\.duolingo\.c(n|om)\/2023-05-23\/(batch|users\/[^\/]+)(?:[?]|$) url script-response-body https://raw.githubusercontent.com/wuya110/QuantumultX/main/duolingo_max.js
// ^https?:\/\/(?:ios-api-[a-z0-9-]+|api\d+)\.duolingo\.c(?:n|om)\/.*\/live-ops-challenges url script-response-body https://raw.githubusercontent.com/wuya110/QuantumultX/main/duolingo_max.js
// ^https?:\/\/(?:ios-api-[a-z0-9-]+|api\d+|stories)\.duolingo\.c(?:n|om)\/(?:.*\/sessions|api2\/stories) url script-response-body https://raw.githubusercontent.com/wuya110/QuantumultX/main/duolingo_max.js
//
// [mitm]
// hostname = *.duolingo.com, *.duolingo.cn
// ====================================

// 开关: 目前全开,用于验证脚本是否生效;验证完想关哪个,把对应的 true 改回 false
var CONFIG = {
  xp_boost: true,      // 经验加倍
  multiplier: 2,       // 经验倍数
  timer_switch: true,  // 限时挑战时间增强
  timer_mins: 60,      // 自定义挑战时长(分钟)
  unlock_all: false,   // 解锁所有关卡(已关)
  instant_clear: false // 直接通关(已关,进关卡直接通完太夸张)
};

var NOW = Math.floor(Date.now() / 1000);
var URL = ($request && $request.url) || "";

var RE_MAIN = /^https?:\/\/(ios-api-[a-z0-9-]+|api\d+)\.duolingo\.c(n|om)\/2023-05-23\/(batch|users\/[^\/?#]+)(?:[?#]|$)/i;
var RE_TIME = /^https?:\/\/(?:ios-api-[a-z0-9-]+|api\d+)\.duolingo\.c(?:n|om)\/.*\/live-ops-challenges/i;
var RE_CLEAR = /^https?:\/\/(?:ios-api-[a-z0-9-]+|api\d+|stories)\.duolingo\.c(?:n|om)\/(?:.*\/sessions|api2\/stories)/i;

// ---- 主解锁: 会员标识 (lingoDuo-xaM-enhanced.js) ----
function applyGold(userdata) {
  if (!userdata.shopItems) userdata.shopItems = [];
  var hasGold = userdata.shopItems.some(function (item) { return item.id === "gold_subscription"; });
  if (!hasGold) {
    userdata.shopItems.push({
      id: "gold_subscription",
      purchaseDate: NOW - 172800,
      purchasePrice: 0,
      subscriptionInfo: {
        expectedExpiration: NOW + 31536000,
        productId: "com.duolingo.DuolingoMobile.subscription.Gold.TwelveMonth.24Q2Max.168",
        renewer: "APPLE",
        renewing: true,
        tier: "twelve_month",
        type: "gold"
      }
    });
  }
  userdata.subscriberLevel = "GOLD";
  if (!userdata.trackingProperties) userdata.trackingProperties = {};
  [
    "has_item_immersive_subscription",
    "has_item_premium_subscription",
    "has_item_live_subscription",
    "has_item_gold_subscription",
    "has_item_max_subscription"
  ].forEach(function (p) { userdata.trackingProperties[p] = true; });
}

function applyXpBoost(userdata) {
  if (!CONFIG.xp_boost) return;
  var xpMultiplier = parseInt(CONFIG.multiplier, 10);
  if (!userdata.shopItems) userdata.shopItems = [];
  var found = false;
  for (var i = 0; i < userdata.shopItems.length; i++) {
    if (userdata.shopItems[i].id === "xp_boost_stackable") {
      userdata.shopItems[i].purchaseDate = NOW;
      userdata.shopItems[i].expectedExpirationDate = NOW + 3600;
      userdata.shopItems[i].xpBoostMultiplier = xpMultiplier;
      found = true;
      break;
    }
  }
  if (!found) {
    userdata.shopItems.push({
      id: "xp_boost_stackable",
      purchaseDate: NOW,
      expectedExpirationDate: NOW + 3600,
      purchasePrice: 0,
      xpBoostMultiplier: xpMultiplier
    });
  }
}

function applyUnlockAll(userdata) {
  if (!CONFIG.unlock_all) return;
  if (userdata.currentCourse && Array.isArray(userdata.currentCourse.pathSectioned)) {
    userdata.currentCourse.pathSectioned.forEach(function (section) {
      if (Array.isArray(section.units)) {
        section.units.forEach(function (unit) {
          if (Array.isArray(unit.levels)) {
            unit.levels.forEach(function (level) {
              if (level.state === "locked") level.state = "active";
            });
          }
        });
      }
    });
  }
}

function applyAll(userdata) {
  applyGold(userdata);
  applyXpBoost(userdata);
  applyUnlockAll(userdata);
}

// ---- 分发: 按接口走三个原脚本的逻辑 ----
try {
  var body = $response.body;
  var done = false;
  if (body) {
    if (RE_MAIN.test(URL)) {
      var obj = JSON.parse(body);
      if (obj.responses && obj.responses.length >= 2) {
        if (obj.responses[0].headers && "etag" in obj.responses[0].headers) {
          $done({});
          done = true;
        } else {
          var b0 = obj.responses[0].body;
          if (typeof b0 === "string") {
            var ud = JSON.parse(b0);
            applyAll(ud);
            obj.responses[0].body = JSON.stringify(ud);
          } else {
            applyAll(b0);
            obj.responses[0].body = b0;
          }
          $done({ body: JSON.stringify(obj) });
          done = true;
        }
      } else if (obj && typeof obj === "object" &&
        (obj.shopItems !== undefined || obj.subscriberLevel !== undefined ||
          (obj.id && obj.trackingProperties))) {
        applyAll(obj);
        $done({ body: JSON.stringify(obj) });
        done = true;
      }
    } else if (RE_TIME.test(URL)) {
      if (CONFIG.timer_switch) {
        var o = JSON.parse(body);
        var seconds = parseInt(CONFIG.timer_mins, 10) * 60;
        if (!isNaN(seconds) && seconds > 0 && o.liveOpsChallenges) {
          o.liveOpsChallenges.forEach(function (c) {
            if (c.initialTime) c.initialTime = seconds;
            if (c.initialLevelTimes) c.initialLevelTimes = c.initialLevelTimes.map(function () { return seconds; });
            if (c.initialSessionTimes) c.initialSessionTimes = c.initialSessionTimes.map(function () { return seconds; });
          });
        }
        $done({ body: JSON.stringify(o) });
        done = true;
      }
    } else if (RE_CLEAR.test(URL)) {
      if (CONFIG.instant_clear) {
        var s = JSON.parse(body);
        var type = s.type;
        var skip = ["SIDE_QUEST_RAMP_UP_PRACTICE", "MATCH_PRACTICE"];
        if (type && skip.indexOf(type) === -1) {
          ["challenges", "adaptiveChallenges", "adaptiveInterleavedChallenges", "mistakesReplacementChallenges"].forEach(function (pool) {
            if (s[pool] && s[pool].length > 0) s[pool] = [];
          });
        }
        if (s.elements && s.elements.length > 0) s.elements = [];
        $done({ body: JSON.stringify(s) });
        done = true;
      }
    }
  }
  if (!done) $done({});
} catch (e) {
  $done({});
}
