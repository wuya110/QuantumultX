/*
[rewrite_local]
^https:\/\/api\.revenuecat\.com\/v1\/(subscribers\/[^\/]+$|receipts$) url script-response-body https://raw.githubusercontent.com/wuya110/QuantumultX/main/cf.js
^https:\/\/api-paywalls\.revenuecat\.com\/v1\/events url script-response-body https://raw.githubusercontent.com/wuya110/QuantumultX/main/cf.js

[mitm]
hostname = api.revenuecat.com, api-paywalls.revenuecat.com
*/

// 针对 Cloudflare Remote 的 RevenueCat 解锁
let body = $response.body;
if (body) {
    try {
        let obj = JSON.parse(body);
        if (obj.subscriber) {
            obj.subscriber.entitlements = {
                "pro": {
                    "expires_date": "2099-12-31T23:59:59Z",
                    "product_identifier": "cloudflare_remote_pro",
                    "purchase_date": "2023-01-01T00:00:00Z"
                },
                "premium": {
                    "expires_date": "2099-12-31T23:59:59Z",
                    "product_identifier": "cloudflare_remote_premium",
                    "purchase_date": "2023-01-01T00:00:00Z"
                },
                "subscription": {
                    "expires_date": "2099-12-31T23:59:59Z",
                    "product_identifier": "cloudflare_remote_sub",
                    "purchase_date": "2023-01-01T00:00:00Z"
                }
            };
            obj.subscriber.subscriptions = {
                "cloudflare_remote_pro": {
                    "expires_date": "2099-12-31T23:59:59Z",
                    "original_purchase_date": "2023-01-01T00:00:00Z",
                    "purchase_date": "2023-01-01T00:00:00Z",
                    "store": "app_store"
                },
                "cloudflare_remote_premium": {
                    "expires_date": "2099-12-31T23:59:59Z",
                    "original_purchase_date": "2023-01-01T00:00:00Z",
                    "purchase_date": "2023-01-01T00:00:00Z",
                    "store": "app_store"
                },
                "cloudflare_remote_sub": {
                    "expires_date": "2099-12-31T23:59:59Z",
                    "original_purchase_date": "2023-01-01T00:00:00Z",
                    "purchase_date": "2023-01-01T00:00:00Z",
                    "store": "app_store"
                }
            };
            body = JSON.stringify(obj);
        }
    } catch (e) {
        console.log("JSON Parse Error: " + e);
    }
}
$done({ body });
