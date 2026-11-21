#!name=网易云 SVIP 注入(实验版)
#!desc=Cookie 由助手每小时从 fuzhang 号池自动刷新，失效自动换号
/*
网易云音乐 SVIP(实验版) · Quantumult X
Cookie 由助手每小时从 https://fuzhang.net/vip/ 号池自动登录刷新后写进来,
QX 端什么都不用做。不用手动登录,不用定时任务。
本文件由维护脚本自动更新,不要手工改 Cookie。
*/
const WYY_COOKIE = '';

(function () {
  if (!WYY_COOKIE) { $done({}); return; }
  const headers = $request.headers || {};
  headers['Cookie'] = WYY_COOKIE;
  $done({ headers: headers });
})();
