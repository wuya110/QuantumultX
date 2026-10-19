# QuantumultX · 自用 QX 脚本

| 文件 | 说明 |
|---|---|
| `unicom_signin.js` | 联通营业厅每日自动签到：rewrite 抓 Cookie(+imei)，每天 8 点定时签到，通知带今日奖励 / 连续天数 / 当前积分 / 明日奖励 |
| `unicom_signin.snippet` | 联通签到一键订阅：QX「重写」→「引用」添加，重写规则 + MitM 主机名一次导入 |
| `wyy.js` | 网易云音乐 SVIP & 去广告：重写规则集，QX「重写」→「引用」添加 |

## 联通签到安装

1. QX「重写」→「引用」→ 添加：
   `https://raw.githubusercontent.com/wuya110/QuantumultX/main/unicom_signin.snippet`
2. 配置文件 `[task_local]` 加一行：
   `0 8 * * * https://raw.githubusercontent.com/wuya110/QuantumultX/main/unicom_signin.js, tag=联通签到, enabled=true`
3. 开重写，进联通 APP「我的」→签到页，弹出"Cookie 获取成功"即可；之后每天 8 点自动签
