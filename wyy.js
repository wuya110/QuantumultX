#!name=网易云音乐SVIP&去广告(修复版)
#!desc=已修复解析器报错问题，内置MITM Hostname。使用前请确保已安装并信任QX证书。
#!author=暗夜 & 你的智能助手

# ========================================
# 1. MITM Hostname (引用此资源会自动添加)
# ========================================
hostname = interface*.music.163.com, music.163.com, iad*.music.126.net, iad*.nosdn.127.net

# ========================================
# 2. 去广告 & 净化 (Reject / Reject-200)
# ========================================
# 阻断广告域名
^https?:\/\/iadmat\.nosdn\.127\.net url reject
^https?:\/\/iadmatapk\.nosdn\.127\.net url reject
^https?:\/\/iadmusicmat\.music\.126\.net url reject
^https?:\/\/iadmusicmatvideo\.music\.126\.net url reject
^https?:\/\/ipv4\.music\.163\.com url reject
^https?:\/\/ipv6\.music\.163\.com url reject

# 阻断开屏与配置广告
^https?://interface.*\.music\.163\.com/eapi/ad/get url reject
^https?://interface.*\.music\.163\.com/eapi/ad/config/get url reject
^https?://interface.*\.music\.163\.com/eapi/ad/iyunIds url reject
^https?://interface.*\.music\.163\.com/eapi/ad/prefetch/select url reject
^https?://interface.*\.music\.163\.com/eapi/ad/loading/current url reject

# 屏蔽推广板块 (用 reject-200 替代 map local {}，更稳定)
^https?:\/\/interface\d?\.music\.163\.com\/eapi\/(?:delivery\/(batch-)?deliver|moment\/tab\/info\/|side-bar\/mini-program\/music-service\/account|yunbei\/account\/entrance\/) url reject-200
^https?:\/\/interface\d?\.music\.163\.com\/eapi\/(?:community\/friends\/fans-group\/artist\/group\/|mine\/applet\/redpoint|music\/songshare\/text\/recommend\/|resniche\/position\/play\/new\/|resniche\/tspopup\/show|resource\/comments?\/musiciansaid\/|user\/sub\/artist) url reject-200
^https?:\/\/interface\d?\.music\.163\.com\/eapi\/(?:ios\/version|mlivestream\/entrance\/playpage\/|link\/position\/show\/strategy|link\/scene\/show\/resource|v1\/content\/exposure\/comment\/banner\/) url reject-200
^https?:\/\/interface\d?\.music\.163\.com\/w?eapi\/(?:activity\/bonus\/playpage\/time\/query|resource-exposure\/|search\/(?:chart\/|rcmd\/keyword\/|specialkeyword\/)) url reject-200
^https:\/\/interface\d\.music\.163\.com\/eapi\/my\/podcast\/tab\/recommend url reject-200
^https?:\/\/interface\d?\.music\.163\.com\/e?api\/(ocpc\/)?ad\/ url reject-200
^https?:\/\/interface\d?\.music\.163.com\/w?e?api\/search\/default url reject-200

# ========================================
# 3. SVIP 解锁脚本 (Script)
# ========================================
# 皮肤解锁
^https?:\/\/interface\d?\.music\.163\.com\/eapi\/playermode\/ url script-request-header https://he2o.vercel.app/Resource/-Rewrite/anyehttp/wyy-s.js

# 歌曲/听书/详情/列表解锁
^https?:\/\/interface\d?\.music\.163\.com\/eapi\/search\/(?:complex\/page|complex\/rec\/song\/get|song\/list\/page) url script-request-header https://he2o.vercel.app/Resource/-Rewrite/anyehttp/wyy-s.js
^https?:\/\/interface\d?\.music\.163\.com\/eapi\/v3\/song\/detail url script-request-header https://he2o.vercel.app/Resource/-Rewrite/anyehttp/wyy-s.js
^https?:\/\/interface\d?\.music\.163\.com\/eapi\/song\/(?:chorus|enhance\/|play\/|type\/detail\/get) url script-request-header https://he2o.vercel.app/Resource/-Rewrite/anyehttp/wyy-s.js
^https?:\/\/interface\d?\.music\.163\.com\/eapi\/(?:v1\/artist\/top\/song|v3\/discovery\/recommend\/songs) url script-request-header https://he2o.vercel.app/Resource/-Rewrite/anyehttp/wyy-s.js

# 等级/首页/音质解锁
^https?:\/\/interface\d?\.music\.163\.com\/eapi\/vipnewcenter\/app\/resource\/newaccountpage url script-request-header https://he2o.vercel.app/Resource/-Rewrite/anyehttp/wyy-s.js
^https?:\/\/interface\d?\.music\.163\.com\/w?e?api\/(homepage\/|v6\/)?playlist\/(?!(?:delete|subscribe|unsubscribe)) url script-request-header https://he2o.vercel.app/Resource/-Rewrite/anyehttp/wyy-s.js
^https?:\/\/interface\d?\.music\.163\.com\/eapi\/vipauth\/app\/auth\/(soundquality\/)?query url script-request-header https://he2o.vercel.app/Resource/-Rewrite/anyehttp/wyy-s.js
